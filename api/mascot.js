// Pip saved mascots. POST stores a painted mascot (passcode-protected); GET serves it to any website.
//   POST /api/mascot                 { mode, image(base64), mime, face, grid, name, greeting, desc } -> { id }
//   GET  /api/mascot?id=ID           -> mascot JSON (with an image URL that has CORS enabled)
//   GET  /api/mascot?id=ID&img=1     -> the painting itself
import { put, list } from '@vercel/blob';
import { whoIs, refuse, readKey, writeKey, readJson, writeJson, storeName } from './_keys.js';
import { sanitize, clean } from './_steps.js';

// No-code moments: "when this happens on my site, do that". Saved on the mascot, read by critter.js.
const MOMENT_NAMES = ['welcome', 'welcome-back', 'first-purchase', 'purchase', 'streak', 'level-up', 'goal', 'milestone', 'empty', 'oops'];
function cleanRules(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list.slice(0, 30) : []) {
    const w = r && r.when || {}, t = r && r.then || {}, value = clean(w.value).slice(0, 80);
    if (!['visit', 'click', 'text'].includes(w.type) || !value) continue;
    let then = null;
    if (t.type === 'moment' && MOMENT_NAMES.includes(t.name)) then = { type: 'moment', name: t.name, ...(clean(t.say) ? { say: clean(t.say).slice(0, 70) } : {}), ...(Number.isFinite(Number(t.count)) && t.count !== '' && t.count != null ? { count: Math.max(0, Math.min(100000, Math.round(Number(t.count)))) } : {}) };
    else if (t.type === 'say' && clean(t.text)) then = { type: 'say', text: clean(t.text).slice(0, 70) };
    else if (t.type === 'point' && clean(t.target)) then = { type: 'point', target: clean(t.target).slice(0, 80), text: clean(t.text).slice(0, 70) };
    else if (t.type === 'pose' && /^[a-z0-9-]{1,24}$/.test(String(t.name || ''))) then = { type: 'pose', name: String(t.name), ...(clean(t.say) ? { say: clean(t.say).slice(0, 70) } : {}) };
    else if (t.type === 'play') { const steps = sanitize(t.steps); if (steps.length) then = { type: 'play', steps }; }
    if (!then) continue;
    if (['across', 'left', 'right', 'center'].includes(t.move)) then.move = t.move;   // glide there and back while it happens
    out.push({ id: /^r_[a-z0-9]{4,12}$/.test(r.id) ? r.id : 'r_' + Math.random().toString(36).slice(2, 10), when: { type: w.type, value }, then, once: r.once !== false });
  }
  return out;
}

export const config = { maxDuration: 60 };

const cors = res => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pip-pass');
};
const ID = /^[a-z0-9]{6,24}$/;
const newId = () => Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');

async function findData(id) {
  return readJson(`mascots/${id}/data.json`);   // always the latest: moments and poses change
}

async function saveAtlas(id, b) {
  const mime = /^image\/(webp|png)$/.test(b.atlasMime) ? b.atlasMime : 'image/webp';
  const v = Date.now().toString(36), blob = await put(`mascots/${id}/atlas-${v}.${mime.split('/')[1]}`, Buffer.from(b.atlas, 'base64'), { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });   // new address per save: never stale
  return { atlasUrl: blob.url, atlasMime: mime, atlasMeta: b.atlasMeta || null, atlasFace: b.atlasFace || null, atlasV: v };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { res.status(500).json({ error: 'Mascot storage isn’t connected yet. Create a Blob store in Vercel and connect it to this project.' }); return; }

  try {
    if (req.method === 'POST') {
      const who = await whoIs(req);
      if (refuse(res, who, 'Saving')) return;
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
      await writeJson(`mascots/${id}/data.json`, meta);
      // remember it on the buyer's key, so "My mascots" can list it on any device
      if (who && who.key) {
        try { const rec = (await readKey(who.key)) || who.rec; rec.mascots = [{ id, name: meta.name, created: meta.created }, ...(rec.mascots || [])].slice(0, 50); await writeKey(who.key, rec); }
        catch (e) {}
      }
      res.json({ id }); return;
    }

    if (req.method === 'PUT' && req.query.pose) {
      // Keep (or remove) a custom pose. Only the key that saved the mascot, or the owner passcode.
      const who = await whoIs(req);
      if (refuse(res, who, 'Saving poses')) return;
      const id = String(req.query.id || '');
      if (!ID.test(id)) { res.status(400).json({ error: 'Unknown mascot id.' }); return; }
      if (!who.owner && !(who.rec.mascots || []).some(m => m.id === id)) { res.status(403).json({ error: 'This mascot was saved with a different key.' }); return; }
      const meta = await findData(id);
      if (!meta) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
      const name = String(b.name || '').toLowerCase();
      if (!/^[a-z0-9-]{1,24}$/.test(name)) { res.status(400).json({ error: 'Pose names use lowercase letters, numbers and dashes.' }); return; }
      // a pose can stand in for one of the built-in reactions ("use this pose when it points at something")
      const ROLES = ['point', 'thinking', 'success', 'error', 'wave', 'dance', 'sleeping', 'love', 'surprised', 'confused', 'sad'];
      if (b.role !== undefined && !b.image && !b.remove) {
        const role = ROLES.includes(b.role) ? b.role : null;
        if (!(meta.poses || []).some(p => p.name === name)) { res.status(404).json({ error: 'No pose with that name.' }); return; }
        meta.poses = (meta.poses || []).map(p => { const q = { ...p }; if (q.name === name) { if (role) q.role = role; else delete q.role; } else if (role && q.role === role) delete q.role; return q; });
        await writeJson(`mascots/${id}/data.json`, meta);
        res.json({ poses: meta.poses.map(p => ({ name: p.name, desc: p.desc, role: p.role || null })) }); return;
      }
      const prevRole = ((meta.poses || []).find(p => p.name === name) || {}).role;
      let poses = (meta.poses || []).filter(p => p.name !== name);
      if (!b.remove) {
        if (!b.image) { res.status(400).json({ error: 'Missing pose image.' }); return; }
        if (poses.length >= 40) { res.status(400).json({ error: 'That’s 40 poses, the most a mascot can have. Remove one first.' }); return; }
        const mime = /^image\/(webp|png)$/.test(b.mime) ? b.mime : 'image/png', pv = Date.now().toString(36);
        const blob = await put(`mascots/${id}/poses/${name}-${pv}.${mime.split('/')[1]}`, Buffer.from(b.image, 'base64'), { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });
        let url2 = null;
        if (b.image2) { const m2 = /^image\/(webp|png)$/.test(b.mime2) ? b.mime2 : 'image/png';
          url2 = (await put(`mascots/${id}/poses/${name}-${pv}-2.${m2.split('/')[1]}`, Buffer.from(b.image2, 'base64'), { access: 'public', contentType: m2, addRandomSuffix: false, allowOverwrite: true })).url; }
        // frames 3 and 4 of a short move
        const more = [];
        for (const [i, f] of (Array.isArray(b.more) ? b.more.slice(0, 2) : []).entries()) {
          if (!url2 || !f || !f.image) continue; const mf = /^image\/(webp|png)$/.test(f.mime) ? f.mime : 'image/png';
          more.push({ url: (await put(`mascots/${id}/poses/${name}-${pv}-${i + 3}.${mf.split('/')[1]}`, Buffer.from(f.image, 'base64'), { access: 'public', contentType: mf, addRandomSuffix: false, allowOverwrite: true })).url, mime: mf });
        }
        const nf = 1 + (url2 ? 1 : 0) + more.length, air = Array.isArray(b.air) ? b.air.slice(0, nf).map(Boolean) : [];
        poses = [...poses, { name, url: blob.url, mime, ...(url2 ? { url2, mime2: /^image\/(webp|png)$/.test(b.mime2) ? b.mime2 : 'image/png' } : {}), ...(more.length ? { more } : {}), ...(b.once && url2 ? { once: true } : {}), ...(air.some(Boolean) ? { air } : {}), ...(Number(b.pace) >= .5 && Number(b.pace) <= 2.5 && Number(b.pace) !== 1 ? { pace: Number(b.pace) } : {}), desc: String(b.desc || '').slice(0, 200), v: pv, created: new Date().toISOString(), ...(prevRole ? { role: prevRole } : {}) }];
      }
      meta.poses = poses;
      await writeJson(`mascots/${id}/data.json`, meta);
      res.json({ poses: poses.map(p => ({ name: p.name, desc: p.desc })) }); return;
    }

    if (req.method === 'PUT') {
      // Add prepared poses to a mascot saved before they existed.
      if (refuse(res, await whoIs(req), 'Updating')) return;
      const id = String(req.query.id || '');
      if (!ID.test(id)) { res.status(400).json({ error: 'Unknown mascot id.' }); return; }
      const meta = await findData(id);
      if (!meta) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
      if (!b.atlas) { res.status(400).json({ error: 'Missing prepared poses.' }); return; }
      Object.assign(meta, await saveAtlas(id, b));
      await writeJson(`mascots/${id}/data.json`, meta);
      res.json({ id, atlas: true }); return;
    }

    if (req.method === 'PATCH') {
      // Save the no-code moments. Only the key that saved the mascot (or the owner passcode) can change them.
      const who = await whoIs(req);
      if (refuse(res, who, 'Changing moments')) return;
      const id = String(req.query.id || '');
      if (!ID.test(id)) { res.status(400).json({ error: 'Unknown mascot id.' }); return; }
      if (!who.owner && !(who.rec.mascots || []).some(m => m.id === id)) { res.status(403).json({ error: 'This mascot was saved with a different key.' }); return; }
      const meta = await findData(id);
      if (!meta) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
      meta.rules = cleanRules(b.rules);
      await writeJson(`mascots/${id}/data.json`, meta);
      res.json({ rules: meta.rules }); return;
    }

    if (req.method === 'GET') {
      const id = String(req.query.id || '');
      if (!ID.test(id)) { res.status(400).json({ error: 'Unknown mascot id.' }); return; }
      const meta = await findData(id);
      if (!meta) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      if (req.query.img === 'pose') {
        const p = (meta.poses || []).find(x => x.name === String(req.query.name || ''));
        if (!p) { res.status(404).json({ error: 'No pose with that name.' }); return; }
        const fi = Number(req.query.f) || 1, two = fi === 2 && p.url2, extra = fi > 2 && (p.more || [])[fi - 3];
        if (fi > 2 && !extra) { res.status(404).json({ error: 'No such frame.' }); return; }
        const r = await fetch(`${extra ? extra.url : two ? p.url2 : p.url}?v=${p.v}`, { cache: 'no-store' });
        if (!r.ok) { res.status(502).json({ error: 'Could not load the pose.' }); return; }
        let bytes = Buffer.from(await r.arrayBuffer()), type = (extra ? extra.mime : two ? p.mime2 : p.mime) || 'image/png';
        if (req.query.fmt === 'png' && type !== 'image/png') { try { const sharp = (await import('sharp')).default; bytes = await sharp(bytes).png().toBuffer(); type = 'image/png'; } catch (e) {} }
        res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); res.send(bytes); return;
      }
      if (req.query.img) {
        const atlas = req.query.img === 'atlas' && meta.atlasUrl;
        const r = await fetch(atlas ? `${meta.atlasUrl}?v=${meta.atlasV || ''}` : meta.imageUrl, { cache: 'no-store' });
        if (!r.ok) { res.status(502).json({ error: 'Could not load the painting.' }); return; }
        let bytes = Buffer.from(await r.arrayBuffer()), type = (atlas ? meta.atlasMime : meta.mime) || 'image/webp';
        // ?fmt=png converts for places that can't read WebP (like the iOS simulator)
        if (req.query.fmt === 'png' && type !== 'image/png') {
          try { const sharp = (await import('sharp')).default; bytes = await sharp(bytes).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(); type = 'image/png'; }
          catch (e) { /* fall back to the original format */ }
        }
        // ?b64=1 returns the image as text (handy for tools that can't read binary)
        if (req.query.b64) { res.setHeader('Cache-Control', 'no-store'); res.json({ type, b64: bytes.toString('base64') }); return; }
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(bytes); return;
      }
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15'); res.setHeader('x-ck-store', storeName());   // browsers always ask, the CDN keeps it 15s: changes show within ~15s
      const out = { id, mode: meta.mode, grid: meta.grid, face: meta.face, name: meta.name, greeting: meta.greeting, rules: meta.rules || [],
        poses: (meta.poses || []).map(p => ({ name: p.name, desc: p.desc, ...(p.role ? { role: p.role } : {}), image: `https://${host}/api/mascot?id=${id}&img=pose&name=${p.name}&v=${p.v}`, ...(p.url2 ? { image2: `https://${host}/api/mascot?id=${id}&img=pose&name=${p.name}&f=2&v=${p.v}` } : {}),
          ...(p.more && p.more.length ? { frames: [1, 2, ...p.more.map((_, i) => i + 3)].map(f => `https://${host}/api/mascot?id=${id}&img=pose&name=${p.name}${f > 1 ? `&f=${f}` : ''}&v=${p.v}`) } : {}),
          ...(p.once ? { once: true } : {}), ...(p.air ? { air: p.air } : {}), ...(p.pace ? { pace: p.pace } : {}) })),
        image: `https://${host}/api/mascot?id=${id}&img=1` };
      if (meta.atlasUrl) Object.assign(out, { atlas: `https://${host}/api/mascot?id=${id}&img=atlas&v=${meta.atlasV}`, atlasMeta: meta.atlasMeta, atlasFace: meta.atlasFace });
      res.json(out);
      return;
    }
    res.status(405).json({ error: 'Use GET, POST, PUT or PATCH.' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
