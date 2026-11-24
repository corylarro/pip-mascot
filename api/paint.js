// Pip painted mascots: server-side proxy to OpenAI so the API key never reaches the browser.
// Steps: "base" (paint the character), "reference" (paint it from a photo), "edit" (repaint the face with a new expression), "face" (locate the face).
export const config = { maxDuration: 300 };

const API = 'https://api.openai.com/v1';
const uniq = a => [...new Set(a.filter(Boolean))];
const IMAGE_MODELS = () => uniq([process.env.OPENAI_IMAGE_MODEL, 'gpt-image-2.5-flare', 'gpt-image-2', 'gpt-image-1.5', 'gpt-image-1']);
const VISION_MODELS = () => uniq([process.env.OPENAI_VISION_MODEL, 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini']);
// Errors that mean "try the next model" rather than "give up".
const tryNext = (status, msg) => [400, 403, 404].includes(status) && /model|not supported|does not exist|not found|access|unsupported|invalid value/i.test(msg || '');

async function call(url, opts) {
  const r = await fetch(url, opts);
  let json = null;
  try { json = await r.json(); } catch (e) { /* non-JSON */ }
  return { ok: r.ok, status: r.status, json, msg: (json && json.error && json.error.message) || r.statusText };
}

function extractText(j) {
  if (!j) return '';
  if (typeof j.output_text === 'string') return j.output_text;
  return (j.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
}
function parseJson(t) {
  if (!t) return null;
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) t = m[1];
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

const BLANK_PROMPT = `This image shows one cartoon mascot character on a plain background. Its face is intentionally blank (no eyes or mouth drawn yet). Decide where its eyes and mouth SHOULD go so it looks natural and appealing for this character, like a well-designed animated character.
Reply with ONLY this JSON (no prose). All numbers are fractions of the image width/height from 0 to 1; x,y is the top-left corner of each box:
{"face":{"x":0,"y":0,"w":0,"h":0},"eyes":[{"x":0,"y":0,"w":0,"h":0},{"x":0,"y":0,"w":0,"h":0}],"mouth":{"x":0,"y":0,"w":0,"h":0},"eyeColor":"#4a2e1c"}
"eyes" are two boxes (left then right) sized like the character's eyes should be (fairly large and cute), placed on the face area. "mouth" is where the mouth should be (below the eyes, above any chin or beard edge; if there is a beard, place it where the lips would show). "eyeColor" is an iris colour that suits the character.`;
const FACE_PROMPT = `This image shows one cartoon mascot character on a plain background. Locate its face features.
Reply with ONLY this JSON (no prose). All numbers are fractions of the image width/height from 0 to 1; x,y is the top-left corner of each box:
{"face":{"x":0,"y":0,"w":0,"h":0},"eyes":[{"x":0,"y":0,"w":0,"h":0}],"mouth":{"x":0,"y":0,"w":0,"h":0}}
"face" must tightly cover the eyes, eyebrows and mouth (not the whole head, ears or hair). List every visible eye, left to right. Each eye box covers just that eye (not the eyebrow). The mouth box covers just the lips/mouth opening, even if partly hidden by a beard.`;

const LIMBS_PROMPT = `This image is a character sheet: 12 panels in a grid of 4 columns and 3 rows, all showing the same character. Panels are numbered 1 to 12, left to right, top to bottom (panel 1 is top-left, panel 8 is the right end of the middle row).
For panels 1, 8, 9, 10 and 11, count the character's ARMS: the upper limbs, including any arm that is raised to wave or stretched out to point. For a four-legged animal, count its FRONT legs instead (a lifted front paw still counts as one front leg). Do not count back legs or feet. Look carefully at each panel on its own; a raised arm usually means the other arm stays down, so two arms is normal.
Also say whether the character in panel 1 is an animal with paws, and for panels 8 to 11 whether a hand with separate human-style fingers appears.
Reply with ONLY this JSON (no prose): {"arms":{"1":2,"8":2,"9":2,"10":2,"11":2},"pawAnimal":false,"fingers":{"8":false,"9":false,"10":false,"11":false}}`;

import { whoIs, spend, refuse } from './_keys.js';
import { moderate } from './_moderate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(500).json({ error: 'OPENAI_API_KEY is not set in the Vercel project’s environment variables.' }); return; }
  const who = await whoIs(req);
  if (refuse(res, who, 'Painting')) return;

  // Lock-screen check: confirms the passcode or key without painting anything.
  if (req.query && req.query.check) { res.status(200).json({ ok: true, owner: !!who.owner, credits: who.rec ? who.rec.credits : null }); return; }
  const b = (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : req.body) || {};
  const auth = { Authorization: `Bearer ${key}` };
  const quality = ['low', 'medium', 'high'].includes(b.quality) ? b.quality : 'medium';

  // A paint uses one credit for buyers; checks and touch-ups are free. Credits are only used when the paint succeeds.
  if ((b.step === 'base' || b.step === 'reference') && who.rec && !(who.rec.credits > 0)) { res.status(402).json({ error: 'You’re out of paint credits.', credits: 0 }); return; }

  try {
    // Screen what the person typed (and any photo) before painting, so a blocked request never uses a paint.
    if (b.step === 'base' || b.step === 'reference') {
      const block = await moderate({ key, desc: b.desc, photo: b.step === 'reference' ? b.photo : null, photoMime: b.photoMime, visionModels: VISION_MODELS() });
      if (block) { console.log('paint blocked:', block.reason); res.status(422).json({ error: block.message, blocked: block.reason }); return; }
    }
    if (b.step === 'base') {
      const prompt = String(b.prompt || '').slice(0, 6000);
      const sizes = uniq([b.size, ...(b.fallbackSizes || []), '1024x1024']).filter(x => /^\d{3,4}x\d{3,4}$/.test(x));
      let last = null;
      outer: for (const model of IMAGE_MODELS()) {
        for (const size of sizes) {
          const r = await call(`${API}/images/generations`, {
            method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, size, quality, output_format: 'webp', n: 1 })
          });
          if (r.ok && r.json && r.json.data && r.json.data[0]) { const credits = await spend(who).catch(() => null); res.json({ image: r.json.data[0].b64_json, mime: 'image/webp', model, size, credits }); return; }
          last = r;
          if (/size|resolution|dimension/i.test(r.msg || '') && r.status === 400) continue;   // try the next size
          if (!tryNext(r.status, r.msg)) break outer;
          break;
        }
      }
      res.status(last.status || 500).json({ error: last.msg, status: last.status }); return;
    }

    if (b.step === 'reference') {
      // Paint from a photo: the photo is the reference, the prompt says how to draw it.
      if (!b.photo) { res.status(400).json({ error: 'Missing photo.' }); return; }
      const photo = Buffer.from(b.photo, 'base64');
      const prompt = String(b.prompt || '').slice(0, 6000);
      const sizes = uniq([b.size, ...(b.fallbackSizes || []), '1536x1024', '1024x1024']).filter(x => /^\d{3,4}x\d{3,4}$/.test(x));
      let last = null;
      outer: for (const model of IMAGE_MODELS()) {
        for (const size of sizes) {
          for (const hiFi of [true, false]) {
            const fd = new FormData();
            fd.append('model', model); fd.append('prompt', prompt);
            fd.append('image', new Blob([photo], { type: b.photoMime || 'image/jpeg' }), 'photo.jpg');
            fd.append('size', size); fd.append('quality', quality); fd.append('output_format', 'webp'); fd.append('n', '1');
            if (hiFi) fd.append('input_fidelity', 'high');
            const r = await call(`${API}/images/edits`, { method: 'POST', headers: auth, body: fd });
            if (r.ok && r.json && r.json.data && r.json.data[0]) { const credits = await spend(who).catch(() => null); res.json({ image: r.json.data[0].b64_json, mime: 'image/webp', model, size, credits }); return; }
            last = r;
            if (hiFi && /input_fidelity|fidelity/i.test(r.msg || '')) continue;   // same model and size, without the optional setting
            break;
          }
          if (last.status === 400 && /size|resolution|dimension/i.test(last.msg || '')) continue;   // try the next size
          if (!tryNext(last.status, last.msg)) break outer;
          break;
        }
      }
      res.status(last.status || 500).json({ error: last.msg, status: last.status }); return;
    }

    if (b.step === 'edit') {
      if (!b.image) { res.status(400).json({ error: 'Missing image.' }); return; }
      const img = Buffer.from(b.image, 'base64'), mask = b.mask ? Buffer.from(b.mask, 'base64') : null;
      const models = uniq([b.model, ...IMAGE_MODELS()]);
      let last = null;
      for (const model of models) {
        for (const [useMask, hiFi] of (mask ? [[true, true], [true, false], [false, false]] : [[false, true], [false, false]])) {
          const fd = new FormData();
          fd.append('model', model);
          fd.append('prompt', String(b.prompt || '').slice(0, 4000));
          fd.append('image', new Blob([img], { type: b.mime || 'image/webp' }), 'image.webp');
          if (useMask) fd.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');
          fd.append('size', '1024x1024'); fd.append('quality', quality); fd.append('output_format', 'webp'); fd.append('n', '1');
          if (hiFi) fd.append('input_fidelity', 'high');
          const r = await call(`${API}/images/edits`, { method: 'POST', headers: auth, body: fd });
          if (r.ok && r.json && r.json.data && r.json.data[0]) { res.json({ image: r.json.data[0].b64_json, mime: 'image/webp', model, masked: useMask, hiFi }); return; }
          last = r;
          if (/input_fidelity|fidelity/i.test(r.msg || '') || (useMask && /mask/i.test(r.msg || ''))) continue;   // retry this model without the optional parameter
          break;
        }
        if (!tryNext(last.status, last.msg)) break;
      }
      res.status(last.status || 500).json({ error: last.msg, status: last.status }); return;
    }

    if (b.step === 'limbs') {
      // Quality check after painting: did the wave or point poses grow an extra limb?
      if (!b.image) { res.status(400).json({ error: 'Missing image.' }); return; }
      let last = null;
      for (const model of VISION_MODELS()) {
        const r = await call(`${API}/responses`, {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: [{ role: 'user', content: [
            { type: 'input_text', text: LIMBS_PROMPT },
            { type: 'input_image', image_url: `data:${b.mime || 'image/webp'};base64,${b.image}` }
          ] }] })
        });
        if (r.ok) { const v = parseJson(extractText(r.json));
          if (v && v.arms) {
            // only drop a pose on a clear miscount (more arms than the standing pose), not on a hunch
            const base = Number(v.arms['1']) || 2, extra = {};
            for (const p of ['8', '9', '10', '11']) extra[p] = (Number(v.arms[p]) > base) || !!(v.pawAnimal && v.fingers && v.fingers[p]);
            res.json({ extra, arms: v.arms, model }); return; } last = { status: 502, msg: 'Could not read the check.' }; continue; }
        last = r; if (!tryNext(r.status, r.msg)) break;
      }
      res.status(last.status || 500).json({ error: last.msg, status: last.status }); return;
    }

    if (b.step === 'face') {
      if (!b.image) { res.status(400).json({ error: 'Missing image.' }); return; }
      let last = null;
      for (const model of VISION_MODELS()) {
        const r = await call(`${API}/responses`, {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: [{ role: 'user', content: [
            { type: 'input_text', text: b.blank ? BLANK_PROMPT : FACE_PROMPT },
            { type: 'input_image', image_url: `data:${b.mime || 'image/webp'};base64,${b.image}` }
          ] }] })
        });
        if (r.ok) { const face = parseJson(extractText(r.json)); if (face) { res.json({ face, model }); return; } last = { status: 502, msg: 'Could not read the face position.' }; continue; }
        last = r; if (!tryNext(r.status, r.msg)) break;
      }
      res.status(last.status || 500).json({ error: last.msg, status: last.status }); return;
    }

    res.status(400).json({ error: 'Unknown step.' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
