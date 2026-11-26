// "It's live": the mascot reports which website it loaded on, so its owner can see the install worked.
//   POST /api/seen?id=ID       sent by critter.js, at most once a day per browser. The site comes from the Origin header.
//   GET  /api/seen?id=ID       the sites it has been seen on. Needs the key that saved it (x-pip-pass), or the owner passcode.
import { readJson, writeJson, whoIs, refuse } from './_keys.js';

const ID = /^[a-z0-9]{6,24}$/;
const OURS = /(^|\.)critterkit\.com$|\.vercel\.app$|^localhost$|^127\.|^0\.0\.0\.0$|^\[::1\]$/;
const DAY = 24 * 3600 * 1000;

function siteOf(req) {
  const raw = req.headers.origin && req.headers.origin !== 'null' ? req.headers.origin : req.headers.referer;
  try { const u = new URL(raw); return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase().replace(/^www\./, '') : null; } catch (e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pip-pass');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const id = String(req.query.id || '');
  if (!ID.test(id) || !process.env.BLOB_READ_WRITE_TOKEN) { res.status(400).json({ error: 'Unknown mascot id.' }); return; }
  const path = `seen/${id}.json`;

  if (req.method === 'POST') {
    const site = siteOf(req);
    if (site && !OURS.test(site) && site.length < 100) {
      try {
        const rec = (await readJson(path)) || { sites: {} }, now = Date.now(), s = rec.sites[site];
        if (!s || now - Date.parse(s.last) > DAY) {
          if (!s && Object.keys(rec.sites).length >= 30) { res.status(204).end(); return; }
          rec.sites[site] = { first: s ? s.first : new Date(now).toISOString(), last: new Date(now).toISOString() };
          await writeJson(path, rec);
        }
      } catch (e) {}
    }
    res.status(204).end(); return;
  }

  if (req.method === 'GET') {
    const who = await whoIs(req);
    if (refuse(res, who, 'Checking')) return;
    if (!who.owner && !(who.rec.mascots || []).some(m => m.id === id)) { res.status(403).json({ error: 'This mascot was saved with a different key.' }); return; }
    const rec = (await readJson(path).catch(() => null)) || { sites: {} };
    const sites = Object.entries(rec.sites).map(([site, v]) => ({ site, ...v })).sort((a, b) => b.last.localeCompare(a.last));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ sites }); return;
  }
  res.status(405).json({ error: 'Use GET or POST.' });
}
