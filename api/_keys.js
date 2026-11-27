// Critterkit keys: what a buyer gets after paying. A key holds paint credits.
// Stored in the Blob store as keys/<key>.json (the key itself is the secret, so the file name is unguessable).
import { put, list } from '@vercel/blob';
import crypto from 'node:crypto';

const KEY = /^ck_[A-Za-z0-9_-]{20,40}$/;
export const newKey = () => 'ck_' + crypto.randomBytes(18).toString('base64url');

// Read a stored file straight from its address instead of listing the store first (listing is the slow, metered call).
// The address comes from the store id in the token; the first listing confirms it, and listing remains the fallback.
let BASE = null, BASE_OK = false;
const guessBase = () => { const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(process.env.BLOB_READ_WRITE_TOKEN || ''); return m ? `https://${m[1].toLowerCase()}.public.blob.vercel-storage.com` : null; };
export async function blobFetch(path) {
  const base = BASE || guessBase();
  if (base) {
    const r = await fetch(`${base}/${path}?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);   // skip the CDN copy: these change
    if (r && r.ok) { BASE = base; BASE_OK = true; return r; }
    if (r && r.status === 404 && BASE_OK) return null;                                                   // address known good: it's really missing
  }
  const { blobs } = await list({ prefix: path, limit: 1 });
  if (!blobs.length || blobs[0].pathname !== path) return null;
  BASE = new URL(blobs[0].url).origin; BASE_OK = true;
  const r = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: 'no-store' });
  return r.ok ? r : null;
}
export async function readJson(path) {
  const r = await blobFetch(path);
  return r ? r.json() : null;
}
export const writeJson = (path, data) => put(path, JSON.stringify(data), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });

// Credits: a new mascot uses 5, a custom pose uses 1. Keys made before credits held "paints" (one per mascot): 1 paint = 5 credits.
export const MASCOT_COST = 5;
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
