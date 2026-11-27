// "My mascots": what a Critterkit key holds. GET /api/me with the key in x-pip-pass.
// With the owner passcode it lists every mascot on the site (newest first), so the owner can open any of them.
import { list } from '@vercel/blob';
import { whoIs, refuse, readJson } from './_keys.js';

async function allMascots() {
  const ids = new Map();
  let cursor;
  do {
    const r = await list({ prefix: 'mascots/', cursor, limit: 1000 });
    for (const b of r.blobs) {
      const m = /^mascots\/([a-z0-9]{6,24})\//.exec(b.pathname);
      if (m) { const t = new Date(b.uploadedAt).getTime(); if (!ids.has(m[1]) || ids.get(m[1]) < t) ids.set(m[1], t); }
    }
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  const newest = [...ids.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  return Promise.all(newest.map(async ([id, t]) => {
    const d = await readJson(`mascots/${id}/data.json`).catch(() => null);
    return { id, name: (d && d.name) || '', created: (d && d.created) || new Date(t).toISOString() };
  }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'Use GET.' }); return; }
  const who = await whoIs(req);
  if (refuse(res, who, 'This page')) return;
  if (who.owner) { res.json({ owner: true, credits: null, mascots: await allMascots().catch(() => []) }); return; }
  res.json({ credits: who.rec.credits || 0, mascots: (who.rec.mascots || []).map(({ id, name, created }) => ({ id, name, created })) });
}
