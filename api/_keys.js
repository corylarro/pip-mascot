// Critterkit keys: what a buyer gets after paying. A key holds paint credits.
// Stored in the Blob store as keys/<key>.json (the key itself is the secret, so the file name is unguessable).
import { put, list } from '@vercel/blob';
import crypto from 'node:crypto';

const KEY = /^ck_[A-Za-z0-9_-]{20,40}$/;
export const newKey = () => 'ck_' + crypto.randomBytes(18).toString('base64url');

export async function readJson(path) {
  const { blobs } = await list({ prefix: path, limit: 1 });
  if (!blobs.length || blobs[0].pathname !== path) return null;
  const r = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: 'no-store' });   // skip the CDN copy: credits change
  return r.ok ? r.json() : null;
}
export const writeJson = (path, data) => put(path, JSON.stringify(data), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });

export const readKey = k => (KEY.test(k || '') ? readJson(`keys/${k}.json`) : Promise.resolve(null));
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

// Use one paint credit after a successful paint. Returns credits left (null for the owner).
export async function spend(who) {
  if (!who || !who.key) return null;
  const rec = (await readKey(who.key).catch(() => null)) || who.rec;
  rec.credits = Math.max(0, (rec.credits || 0) - 1); rec.used = (rec.used || 0) + 1; rec.lastPaint = new Date().toISOString();
  await writeKey(who.key, rec);
  return rec.credits;
}
