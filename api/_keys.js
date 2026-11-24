// Critterkit keys: what a buyer gets after paying. A key holds paint credits.
// Stored in the Blob store as keys/<key>.json (the key itself is the secret, so the file name is unguessable).
import { put, list } from '@vercel/blob';
import crypto from 'node:crypto';

const KEY = /^ck_[A-Za-z0-9_-]{20,40}$/;
export const newKey = () => 'ck_' + crypto.randomBytes(18).toString('base64url');

async function readJson(path) {
  const { blobs } = await list({ prefix: path, limit: 1 });
  if (!blobs.length || blobs[0].pathname !== path) return null;
  const r = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: 'no-store' });   // skip the CDN copy: credits change
  return r.ok ? r.json() : null;
}
const writeJson = (path, data) => put(path, JSON.stringify(data), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });

export const readKey = k => (KEY.test(k || '') ? readJson(`keys/${k}.json`) : Promise.resolve(null));
export const writeKey = (k, rec) => writeJson(`keys/${k}.json`, rec);
export const findCheckout = id => readJson(`checkouts/${id}.json`);
export const saveCheckout = (id, data) => writeJson(`checkouts/${id}.json`, data);

// Who is calling: the owner (PAINT_PASSCODE), a buyer (a Critterkit key), or nobody.
// Both arrive in the same x-pip-pass header, so one box on the paint page takes either.
export async function whoIs(req) {
  const pass = process.env.PAINT_PASSCODE, v = String(req.headers['x-pip-pass'] || '').trim();
  if (!pass) return { owner: true };          // no passcode set (preview deployments): open, like before
  if (v && v === pass) return { owner: true };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const rec = await readKey(v).catch(() => null);
  return rec ? { key: v, rec } : null;
}

// Use one paint credit after a successful paint. Returns credits left (null for the owner).
export async function spend(who) {
  if (!who || !who.key) return null;
  const rec = (await readKey(who.key).catch(() => null)) || who.rec;
  rec.credits = Math.max(0, (rec.credits || 0) - 1); rec.used = (rec.used || 0) + 1; rec.lastPaint = new Date().toISOString();
  await writeKey(who.key, rec);
  return rec.credits;
}
