// Waitlist signups. POST { email, source } -> { ok: true }
// Each signup is stored as its own small file in the Blob store under waitlist/ (unguessable name).
// GET /api/waitlist?pass=PAINT_PASSCODE -> { count, emails } for the owner.
import { put, list } from '@vercel/blob';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) { res.status(500).json({ error: 'The waitlist isn’t connected yet.' }); return; }
  try {
    if (req.method === 'POST') {
      const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
      const email = String(b.email || '').trim().toLowerCase();
      if (!EMAIL.test(email) || email.length > 254) { res.status(400).json({ error: 'That email looks off. Check for a typo.' }); return; }
      const entry = { email, source: String(b.source || '').slice(0, 40), at: new Date().toISOString(), ref: String(req.headers.referer || '').slice(0, 200) };
      await put(`waitlist/${Date.now()}.json`, JSON.stringify(entry), { access: 'public', contentType: 'application/json', addRandomSuffix: true });
      res.status(200).json({ ok: true });
      return;
    }
    if (req.method === 'GET') {
      const pass = process.env.PAINT_PASSCODE;
      if (!pass || req.query.pass !== pass) { res.status(401).json({ error: 'Passcode needed.' }); return; }
      let cursor, blobs = [];
      do { const r = await list({ prefix: 'waitlist/', cursor, limit: 1000 }); blobs = blobs.concat(r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
      const rows = await Promise.all(blobs.map(b => fetch(b.url, { cache: 'no-store' }).then(r => r.json()).catch(() => null)));
      const seen = new Set(), emails = [];
      for (const r of rows.filter(Boolean).sort((a, b) => a.at.localeCompare(b.at))) if (!seen.has(r.email)) { seen.add(r.email); emails.push(r); }
      res.status(200).json({ count: emails.length, emails });
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Couldn’t save that. Try again in a moment.' });
  }
}
