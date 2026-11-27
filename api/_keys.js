// Critterkit keys: what a buyer gets after paying. A key holds paint credits.
// Stored in the Blob store as keys/<key>.json (the key itself is the secret, so the file name is unguessable).
import { put, list, del } from '@vercel/blob';
import crypto from 'node:crypto';

const KEY = /^ck_[A-Za-z0-9_-]{20,40}$/;
export const newKey = () => 'ck_' + crypto.randomBytes(18).toString('base64url');

// Files that change (keys, credits, usage counts, mascot settings) are saved as a new version each time
// (name@<time>), because a changed file at the same address can be served stale for up to a minute, and a
// read-change-write on a stale copy loses data (a pose, a rule, a credit). Reading lists the versions and takes
// the newest; older versions are tidied up. Files saved before versioning are still read from their plain name.
const stamp = () => Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 6);
async function versions(path) {
  const { blobs } = await list({ prefix: path + '@', limit: 1000 });
  return blobs.filter(b => b.pathname.startsWith(path + '@')).sort((a, b) => (a.pathname < b.pathname ? 1 : -1));   // newest first
}
// Small changing files (keys, credits, moments, usage counts) live in Redis when it's connected (Upstash via the
// Vercel Marketplace: a generous free tier, instant reads, never stale). Without it they fall back to Blob versions.
// Files saved in Blob before Redis was connected are copied over the first time they're read.
const REDIS_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
async function redis(cmd) {
  const r = await fetch(REDIS_URL(), { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}
async function blobRead(path) {
  const v = await versions(path);
  if (v.length) { const r = await fetch(v[0].url, { cache: 'no-store' }); return r.ok ? r.json() : null; }   // unique address: never stale
  const { blobs } = await list({ prefix: path, limit: 1 });                                                 // saved before versioning
  if (!blobs.length || blobs[0].pathname !== path) return null;
  const r = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: 'no-store' });
  return r.ok ? r.json() : null;
}
export async function readJson(path) {
  if (REDIS_URL() && REDIS_TOKEN()) {
    const v = await redis(['GET', 'ck:' + path]);
    if (v != null) return JSON.parse(v);
    if (/^(usage|rate)\//.test(path)) return null;                 // counters start fresh: no need to look in Blob
    const old = await blobRead(path).catch(() => null);           // not moved yet
    if (old != null) await redis(['SET', 'ck:' + path, JSON.stringify(old)]).catch(() => {});
    return old;
  }
  return blobRead(path);
}
export async function writeJson(path, data) {
  if (REDIS_URL() && REDIS_TOKEN()) {
    const ttl = /^(usage|rate)\//.test(path) ? ['EX', 60 * 60 * 24 * 3] : [];   // counters tidy themselves up
    await redis(['SET', 'ck:' + path, JSON.stringify(data), ...ttl]);
    return { pathname: path };
  }
  const out = await put(`${path}@${stamp()}`, JSON.stringify(data), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
  if (Math.random() < .2) versions(path).then(v => { const old = v.slice(3).map(b => b.url); if (old.length) return del(old); }).catch(() => {});   // tidy now and then
  return out;
}

// Credits: a new mascot uses 5, a custom pose uses 1. Keys made before credits held "paints" (one per mascot): 1 paint = 5 credits.
export const MASCOT_COST = 5;
// which store small data lives in, and whether it answers (for the owner's check)
export async function storeStatus() { if (!(REDIS_URL() && REDIS_TOKEN())) return 'blob'; try { return (await redis(['PING'])) === 'PONG' ? 'redis' : 'redis-error'; } catch (e) { return 'redis-error'; } }
const norm = rec => { if (rec && rec.cv !== 2) { rec.credits = (rec.credits || 0) * MASCOT_COST; rec.cv = 2; } return rec; };
export const readKey = k => (KEY.test(k || '') ? readJson(`keys/${k}.json`).then(norm) : Promise.resolve(null));
export const writeKey = (k, rec) => writeJson(`keys/${k}.json`, rec);
export const findCheckout = id => readJson(`checkouts/${id}.json`);
export const saveCheckout = (id, data) => writeJson(`checkouts/${id}.json`, data);

// Who is calling: the owner (PAINT_PASSCODE), a buyer (a Critterkit key), or nobody.
// Both arrive in the same x-pip-pass header, so one box on the paint page takes either.
// Too many wrong guesses from one connection: 10 per hour, then it's locked out until the hour is up
// (even a right guess is refused while locked, so guessing gets nowhere).
const MAX_FAILS = 10, WINDOW = 60 * 60 * 1000;
export const ipTag = req => crypto.createHash('sha256').update('critterkit:' + (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown')).digest('hex').slice(0, 32);

export async function whoIs(req) {
  const pass = process.env.PAINT_PASSCODE, v = String(req.headers['x-pip-pass'] || '').trim();
  if (!pass) return { owner: true };          // no passcode set (preview deployments): open, like before
  if (!v) return null;                        // nothing entered yet: not a guess
  const canStore = !!process.env.BLOB_READ_WRITE_TOKEN, tag = ipTag(req), now = Date.now();
  const fails = canStore ? await readJson(`fails/${tag}.json`).catch(() => null) : null;
  const inWindow = fails && now - fails.start < WINDOW;
  if (inWindow && fails.count >= MAX_FAILS) return { locked: true, retryAfter: Math.ceil((fails.start + WINDOW - now) / 60000) };
  if (v === pass) return { owner: true };
  const rec = canStore ? await readKey(v).catch(() => null) : null;
  if (rec) return { key: v, rec };
  if (canStore) await writeJson(`fails/${tag}.json`, { start: inWindow ? fails.start : now, count: (inWindow ? fails.count : 0) + 1 }).catch(() => {});
  return null;
}

// Send the right "no" for a failed whoIs. Returns true if it answered.
export function refuse(res, who, what) {
  if (who && who.locked) { res.setHeader('Retry-After', String(who.retryAfter * 60)); res.status(429).json({ error: `Too many wrong tries. Try again in about ${who.retryAfter} minute${who.retryAfter === 1 ? '' : 's'}.`, locked: true }); return true; }
  if (!who) { res.status(401).json({ error: `${what} needs your Critterkit key.` }); return true; }
  return false;
}

// Use credits after a successful paint (MASCOT_COST for a new mascot, 1 for a pose). Returns credits left (null for the owner).
export async function spend(who, n = 1) {
  if (!who || !who.key) return null;
  const rec = (await readKey(who.key).catch(() => null)) || who.rec;
  rec.credits = Math.max(0, (rec.credits || 0) - n); rec.used = (rec.used || 0) + 1; rec.lastPaint = new Date().toISOString();
  await writeKey(who.key, rec);
  return rec.credits;
}
