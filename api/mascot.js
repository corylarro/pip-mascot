// Pip saved mascots. POST stores a painted mascot (passcode-protected); GET serves it to any website.
//   POST /api/mascot                 { mode, image(base64), mime, face, grid, name, greeting, desc } -> { id }
//   GET  /api/mascot?id=ID           -> mascot JSON (with an image URL that has CORS enabled)
//   GET  /api/mascot?id=ID&img=1     -> the painting itself
import { put, list } from '@vercel/blob';

export const config = { maxDuration: 60 };

const cors = res => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pip-pass');
};
const ID = /^[a-z0-9]{6,24}$/;
const newId = () => Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');

async function findData(id) {
  const { blobs } = await list({ prefix: `mascots/${id}/` });
  const data = blobs.find(b => b.pathname.endsWith('/data.json'));
  if (!data) return null;
  const r = await fetch(data.url, { cache: 'no-store' });
  return r.ok ? r.json() : null;
}

async function saveAtlas(id, b) {
  const mime = /^image\/(webp|png)$/.test(b.atlasMime) ? b.atlasMime : 'image/webp';
  const blob = await put(`mascots/${id}/atlas.${mime.split('/')[1]}`, Buffer.from(b.atlas, 'base64'), { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });
  return { atlasUrl: blob.url, atlasMime: mime, atlasMeta: b.atlasMeta || null, atlasFace: b.atlasFace || null, atlasV: Date.now().toString(36) };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { res.status(500).json({ error: 'Mascot storage isn’t connected yet. Create a Blob store in Vercel and connect it to this project.' }); return; }

  try {
    if (req.method === 'POST') {
      const pass = process.env.PAINT_PASSCODE;
      if (pass && req.headers['x-pip-pass'] !== pass) { res.status(401).json({ error: 'This site needs a passcode to save mascots.' }); return; }
      const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
      if (!b.image || !b.face) { res.status(400).json({ error: 'Missing image or face data.' }); return; }
      const mode = b.mode === 'simple' ? 'simple' : 'sheet';
      const mime = /^image\/(webp|png|jpeg)$/.test(b.mime) ? b.mime : 'image/webp';
      const ext = mime.split('/')[1];
      const id = newId();
      const img = await put(`mascots/${id}/image.${ext}`, Buffer.from(b.image, 'base64'), { access: 'public', contentType: mime, addRandomSuffix: false });
      const meta = {
        id, mode, grid: Array.isArray(b.grid) ? b.grid.slice(0, 2).map(Number) : [3, 2], face: b.face,
        name: String(b.name || '').slice(0, 40), greeting: String(b.greeting || '').slice(0, 120), desc: String(b.desc || '').slice(0, 300),
        imageUrl: img.url, mime, created: new Date().toISOString()
      };
      if (b.atlas) Object.assign(meta, await saveAtlas(id, b));
      await put(`mascots/${id}/data.json`, JSON.stringify(meta), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
      res.json({ id }); return;
    }

    if (req.method === 'PUT') {
      // Add prepared poses to a mascot saved before they existed.
      const pass = process.env.PAINT_PASSCODE;
      if (pass && req.headers['x-pip-pass'] !== pass) { res.status(401).json({ error: 'This site needs a passcode to update mascots.' }); return; }
      const id = String(req.query.id || '');
      if (!ID.test(id)) { res.status(400).json({ error: 'Unknown mascot id.' }); return; }
      const meta = await findData(id);
      if (!meta) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
      if (!b.atlas) { res.status(400).json({ error: 'Missing prepared poses.' }); return; }
      Object.assign(meta, await saveAtlas(id, b));
      await put(`mascots/${id}/data.json`, JSON.stringify(meta), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
      res.json({ id, atlas: true }); return;
    }

    if (req.method === 'GET') {
      const id = String(req.query.id || '');
      if (!ID.test(id)) { res.status(400).json({ error: 'Unknown mascot id.' }); return; }
      const meta = await findData(id);
      if (!meta) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      if (req.query.img) {
        const atlas = req.query.img === 'atlas' && meta.atlasUrl;
        const r = await fetch(atlas ? meta.atlasUrl : meta.imageUrl);
        if (!r.ok) { res.status(502).json({ error: 'Could not load the painting.' }); return; }
        const bytes = Buffer.from(await r.arrayBuffer()), type = (atlas ? meta.atlasMime : meta.mime) || 'image/webp';
        // ?b64=1 returns the image as text (handy for tools that can't read binary)
        if (req.query.b64) { res.setHeader('Cache-Control', 'no-store'); res.json({ type, b64: bytes.toString('base64') }); return; }
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(bytes); return;
      }
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=600');
      const out = { id, mode: meta.mode, grid: meta.grid, face: meta.face, name: meta.name, greeting: meta.greeting,
        image: `https://${host}/api/mascot?id=${id}&img=1` };
      if (meta.atlasUrl) Object.assign(out, { atlas: `https://${host}/api/mascot?id=${id}&img=atlas&v=${meta.atlasV}`, atlasMeta: meta.atlasMeta, atlasFace: meta.atlasFace });
      res.json(out);
      return;
    }
    res.status(405).json({ error: 'Use GET, POST or PUT.' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
