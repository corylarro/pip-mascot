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

import { whoIs, spend, refuse, MASCOT_COST, readJson, writeJson, storeStatus } from './_keys.js';
import { createHash } from 'node:crypto';

// Spending guards, so nobody can run up the OpenAI bill:
//  - each key can paint at most POSE_HOURLY poses an hour and POSE_DAILY a day (every painting counts, free repaints too)
//  - and at most IMAGE_KEY_DAILY other paintings a day (new mascots and their touch-ups)
//  - the whole site stops painting for the day after IMAGE_DAILY_CAP paintings (mascots and poses together)
// The owner passcode skips the per-key limits but still counts toward the site-wide cap.
const LIMITS = () => ({ hourly: Number(process.env.POSE_HOURLY) || 15, daily: Number(process.env.POSE_DAILY) || 40, images: Number(process.env.IMAGE_KEY_DAILY) || 40, site: Number(process.env.IMAGE_DAILY_CAP) || 500 });
const today = () => new Date().toISOString().slice(0, 10);
const keyTag = k => createHash('sha256').update('critterkit-pose:' + k).digest('hex').slice(0, 24);
async function guard(who, kind) {
  const L = LIMITS(), day = today(), hour = new Date().getUTCHours();
  const site = (await readJson(`usage/site-${day}.json`).catch(() => null)) || { n: 0 };
  if (site.n >= L.site) return 'Painting is taking a breather for today. Try again tomorrow, and your credits are safe.';
  if (kind === 'pose' && who.key) {
    const u = (await readJson(`usage/pose-${keyTag(who.key)}-${day}.json`).catch(() => null)) || { n: 0, hours: {} };
    if (u.n >= L.daily) return `That’s ${L.daily} poses today, the daily limit. Try again tomorrow.`;
    if ((u.hours[hour] || 0) >= L.hourly) return `That’s ${L.hourly} poses this hour. Take a short break and try again.`;
  }
  if (kind === 'image' && who.key) {
    const u = (await readJson(`usage/img-${keyTag(who.key)}-${day}.json`).catch(() => null)) || { n: 0 };
    if (u.n >= L.images) return 'That’s a lot of painting for one day. Try again tomorrow, and your credits are safe.';
  }
  return null;
}
// count one painting (call after each image the model returns, kept or not)
async function counted(who, kind) {
  const day = today(), hour = new Date().getUTCHours();
  try { const site = (await readJson(`usage/site-${day}.json`)) || { n: 0 }; site.n++; await writeJson(`usage/site-${day}.json`, site); } catch (e) {}
  if (kind === 'pose' && who.key) {
    try { const p = `usage/pose-${keyTag(who.key)}-${day}.json`, u = (await readJson(p)) || { n: 0, hours: {} }; u.n++; u.hours[hour] = (u.hours[hour] || 0) + 1; await writeJson(p, u); } catch (e) {}
  }
  if (kind === 'image' && who.key) {
    try { const p = `usage/img-${keyTag(who.key)}-${day}.json`, u = (await readJson(p)) || { n: 0 }; u.n++; await writeJson(p, u); } catch (e) {}
  }
}
import { moderate } from './_moderate.js';
import { list } from '@vercel/blob';

// Custom pose: the same character, painted in a new pose. The reference is the mascot's own neutral frame.
const POSE_PROMPT = (desc, transparent) => `The image shows a cartoon mascot character. Paint this SAME character again: identical design, colours, proportions, materials, face and art style, so it is clearly the same character.
New pose: ${desc}.
Show the whole body from head to feet, facing the viewer, centred, about the same size as in the reference, with generous empty space around it. Include any object the pose needs (held, ridden or worn) in the same art style.
Never change who the character is: an outfit, hat or costume may go on top, but its face, colours and body must stay recognisable.
${transparent ? 'Transparent background.' : 'Plain flat light grey background, the same colour everywhere.'} One character only. No text, no letters, no logos, no border, no ground shadow.`;
// Look-alike check: is the new painting clearly the same character? Off-model results are painted again or not charged.
const LIKENESS_PROMPT = `Image 1 is a mascot character. Image 2 is supposed to show the SAME character in a new pose.
Is image 2 clearly the same character? Compare species and body shape, colours, face and eye style, outfit and accessories, and art style.
A different pose, held objects, props or an added hat or costume piece are fine. A different character, a big colour change, or a different art style is not.
Also give the box around the character's own body in image 2 (head to feet, including anything worn, but NOT objects it holds, rides or stands on, like an umbrella, a skateboard or a sign), as fractions of the image width and height.
Also suggest 3 small changes that would make image 2 come alive as a two-frame loop: each moves ONE thing a little (an arm, a held object, a tilt, the eyes), short and plain, like "the umbrella tilts the other way".
Reply with ONLY this JSON: {"same":true,"score":8,"why":"few words","body":[x0,y0,x1,y1],"moves":["...","...","..."]} where score is 0 (different character) to 10 (unmistakably the same).`;
async function looksSame(key, refPng, outB64) {
  for (const model of VISION_MODELS()) {
    try {
      const r = await call(`${API}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, ...(/^gpt-5/.test(model) ? { reasoning: { effort: 'minimal' } } : {}), input: [{ role: 'user', content: [
          { type: 'input_text', text: LIKENESS_PROMPT },
          { type: 'input_image', image_url: `data:image/png;base64,${refPng.toString('base64')}`, detail: 'low' },
          { type: 'input_image', image_url: `data:image/png;base64,${outB64}`, detail: 'low' }] }] }) });
      if (!r.ok) { if (tryNext(r.status, r.msg)) continue; return { ok: true, skipped: true }; }
      const j = parseJson(extractText(r.json));
      if (!j) return { ok: true, skipped: true };
      const bd = Array.isArray(j.body) && j.body.length === 4 && j.body.every(n => Number.isFinite(Number(n)) && n >= 0 && n <= 1) ? j.body.map(Number) : null;
      const body = bd && bd[2] - bd[0] > .08 && bd[3] - bd[1] > .12 ? bd : null;   // ignore boxes that make no sense
      const moves = Array.isArray(j.moves) ? j.moves.map(m => String(m).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 90)).filter(m => m.length > 3).slice(0, 3) : [];
      return { ok: j.same !== false && Number(j.score) >= 6, score: Number(j.score), why: String(j.why || '').slice(0, 80), body, moves };
    } catch (e) { return { ok: true, skipped: true }; }
  }
  return { ok: true, skipped: true };   // if the check can't run, don't block the painting
}
// Second frame of an animated pose: the same painting with one small change, so the two can loop.
const FRAME2_PROMPT = (change, transparent) => `Repaint this exact image as the next frame of a short looping animation.
Keep EVERYTHING identical: the same character, the same framing, size and position in the image, the same colours, lighting, style and every detail.
Change only this, and only a little: ${change}.
${transparent ? 'Transparent background.' : 'Plain flat light grey background, the same colour everywhere.'} No text, no border, no ground shadow.`;
// Frames 2-4 of a short move: the same character in the next moment of the action.
const SEQ_PROMPT = (desc, moment, i, n, transparent) => `Repaint this exact character as frame ${i} of ${n} of a short animation: ${desc}.
In this frame: ${moment}.
Keep EVERYTHING else identical: the same character, colours, proportions, face, materials, art style and the same props. Keep it the same size in the image and keep its lowest point at the same height in the image even if it jumps (the animation adds the jump). Only the pose changes.
${transparent ? 'Transparent background.' : 'Plain flat light grey background, the same colour everywhere.'} No text, no border, no ground shadow, no motion lines.`;
// Turns "does a kickflip" into 1-4 frame moments. Text only, so it's free for the user.
const PLAN_PROMPT = desc => `You plan a very short animation of an app's cartoon mascot. It is painted as 2 to 4 still frames.
The request: "${desc}"
Reply with JSON only: {"name":"kebab-case-name","frames":["...","..."],"once":true,"air":[false,true]}
Rules:
- Use the fewest frames that read clearly. Small repeating motions (waving, bobbing, wagging, nodding, blinking, typing) get 2 frames and once:false (they loop).
- Actions with a start and an end (jumps, tricks, throws, spins, landing, catching, popping out) get 3 or 4 frames and once:true (play once, hold the last frame).
- Each frame is under 14 words and describes the character's exact pose in that moment, and any prop it holds, wears or rides. Frame 1 names every prop so later frames match.
- air[i] is true only when the character is off the ground in that frame. Same length as frames.
- Never change who the character is. Never add other characters.`;
// A whole short move painted at once, as panels in one image, so every frame matches.
const MOVE_COST = 2;
const MOVE_LAYOUT = n => n === 4 ? { cols: 2, rows: 2, size: '1024x1024', text: 'a 2 by 2 grid of 4 equal panels, read left to right then top to bottom' }
  : { cols: n, rows: 1, size: '1536x1024', text: `${n} equal panels side by side, read left to right` };
const MOVE_PROMPT = (desc, frames, transparent) => `The image shows a cartoon mascot character. Paint an animation strip of this SAME character: identical design, colours, proportions, face, materials and art style in every panel.
Do not add any hat, clothing or accessory the character isn't already wearing, unless the action below needs it.
The action: ${desc}.
Layout: ${MOVE_LAYOUT(frames.length).text}. Leave plenty of empty space around the character in each panel so nothing touches or crosses a panel edge. The character is the same size in every panel, whole body visible.
${frames.map((f, i) => `Panel ${i + 1}: ${f}.`).join('\n')}
Each panel is a clearly different moment, so the action reads when the panels play in order. Any prop (a skateboard, a ball) is the exact same object in every panel, and its own motion is clearly visible (a board doing a flip is visibly rotated differently in each panel).
${transparent ? 'Transparent background.' : 'Plain flat light grey background, the same colour everywhere.'} No text, no numbers, no panel borders or dividing lines, no motion lines, no ground shadow.`;
async function poseReference(id) {
  const meta = await readJson(`mascots/${id}/data.json`);
  if (!meta) return null;
  if (!meta.atlasUrl || !meta.atlasMeta) return { meta };
  const atlas = Buffer.from(await (await fetch(`${meta.atlasUrl}?v=${meta.atlasV || ''}`)).arrayBuffer());
  const sharp = (await import('sharp')).default, n = meta.atlasMeta.size;
  const png = await sharp(atlas).extract({ left: 0, top: 0, width: n, height: n }).resize(1024, 1024).png().toBuffer();
  return { meta, png };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(500).json({ error: 'OPENAI_API_KEY is not set in the Vercel project’s environment variables.' }); return; }
  const who = await whoIs(req);
  if (refuse(res, who, 'Painting')) return;

  // Lock-screen check: confirms the passcode or key without painting anything.
  if (req.query && req.query.check) { res.status(200).json({ ok: true, owner: !!who.owner, credits: who.rec ? who.rec.credits : null, ...(who.owner ? { store: await storeStatus() } : {}) }); return; }
  const b = (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : req.body) || {};
  const auth = { Authorization: `Bearer ${key}` };
  const quality = ['low', 'medium', 'high'].includes(b.quality) ? b.quality : 'medium';

  // A paint uses one credit for buyers; checks and touch-ups are free. Credits are only used when the paint succeeds.
  if (b.step === 'pose') {
    if (who.rec && !(who.rec.credits >= 1)) { res.status(402).json({ error: 'A custom pose uses 1 credit and you’re out.', credits: 0 }); return; }
    const id = String(b.id || ''), desc = String(b.desc || '').trim().slice(0, 200);
    if (!/^[a-z0-9]{6,24}$/.test(id)) { res.status(400).json({ error: 'Unknown mascot.' }); return; }
    if (desc.length < 3) { res.status(400).json({ error: 'Describe the pose first.' }); return; }
    if (!who.owner && !(who.rec.mascots || []).some(m => m.id === id)) { res.status(403).json({ error: 'This mascot was saved with a different key.' }); return; }
    try {
      const block = await moderate({ key, desc, photo: null, visionModels: VISION_MODELS() });
      if (block) { res.status(422).json({ error: block.message, blocked: block.reason }); return; }
      const stop = await guard(who, 'pose');
      if (stop) { res.status(429).json({ error: stop }); return; }
      const ref = await poseReference(id);
      if (!ref) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      if (!ref.png) { res.status(409).json({ error: 'Open this mascot on the paint page and save it again first, so its poses are prepared.' }); return; }
      let last = null, miss = null;
      const paintOnce = async () => {
        for (const model of IMAGE_MODELS()) {
          let noTransparent = false, noHiFi = false;
          for (const [transparent, hiFi] of [[true, true], [true, false], [false, true], [false, false]]) {
            if ((transparent && noTransparent) || (hiFi && noHiFi)) continue;
            const fd = new FormData();
            fd.append('model', model); fd.append('prompt', POSE_PROMPT(desc, transparent));
            fd.append('image', new Blob([ref.png], { type: 'image/png' }), 'mascot.png');
            fd.append('size', '1024x1024'); fd.append('quality', 'medium'); fd.append('output_format', 'png'); fd.append('n', '1');
            if (transparent) fd.append('background', 'transparent');
            if (hiFi) fd.append('input_fidelity', 'high');
            const r = await call(`${API}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
            if (r.ok && r.json && r.json.data && r.json.data[0]) { await counted(who, 'pose'); return { image: r.json.data[0].b64_json, model }; }
            last = r;
            if (/fidelity/i.test(r.msg || '')) { noHiFi = true; continue; }        // this model doesn't take that setting
            if (/background|transparen/i.test(r.msg || '')) { noTransparent = true; continue; }
            if (tryNext(r.status, r.msg)) break;                                     // next model
            return null;                                                             // a real failure
          }
        }
        return null;
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt && await guard(who, 'pose')) break;   // no free repaint past the limits
        const out = await paintOnce();
        if (!out) break;
        const same = await looksSame(key, ref.png, out.image);
        if (same.ok) { const credits = await spend(who, 1).catch(() => null); res.json({ image: out.image, mime: 'image/png', model: out.model, credits, likeness: same.score ?? null, body: same.body || null, moves: same.moves || [] }); return; }
        miss = same; console.log('pose off-model', attempt, same.score, same.why);
      }
      if (miss) { res.status(422).json({ error: 'It didn’t come out looking like your mascot, so we didn’t keep it and your credit wasn’t used. Try describing the pose a different way.', offModel: true }); return; }
      res.status((last && last.status) || 500).json({ error: (last && last.msg) || 'Painting failed.' }); return;
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); return; }
  }

  if (b.step === 'plan') {
    const desc = String(b.desc || '').trim().slice(0, 160);
    if (desc.length < 3) { res.status(400).json({ error: 'Describe the move first.' }); return; }
    try {
      const stop = await guard(who, 'pose');
      if (stop) { res.status(429).json({ error: stop }); return; }
      const block = await moderate({ key, desc, photo: null, visionModels: VISION_MODELS() });
      if (block) { res.status(422).json({ error: block.message, blocked: block.reason }); return; }
      for (const model of VISION_MODELS()) {
        const r = await call(`${API}/responses`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, ...(/^gpt-5/.test(model) ? { reasoning: { effort: 'minimal' } } : {}), input: PLAN_PROMPT(desc) }) });
        if (!r.ok) { if (tryNext(r.status, r.msg)) continue; break; }
        const j = parseJson(extractText(r.json));
        const clean = t => String(t || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 110);
        const frames = j && Array.isArray(j.frames) ? j.frames.map(clean).filter(f => f.length > 2).slice(0, 4) : [];
        if (frames.length < 2) break;
        const air = frames.map((_, i) => !!(Array.isArray(j.air) && j.air[i]));
        const name = String(j.name || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
        res.json({ frames, once: frames.length > 2 ? j.once !== false : !!j.once, air, name }); return;
      }
      // the planner couldn't run: fall back to a simple two-frame loop
      res.json({ frames: [desc, `${desc}, the next moment of the motion`], once: false, air: [false, false], name: '', fallback: true }); return;
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); return; }
  }

  if (b.step === 'move') {
    if (who.rec && !(who.rec.credits >= MOVE_COST)) { res.status(402).json({ error: `A short move uses ${MOVE_COST} credits and you have ${who.rec.credits || 0}.`, credits: who.rec.credits || 0 }); return; }
    const id = String(b.id || ''), desc = String(b.desc || '').trim().slice(0, 160);
    const frames = (Array.isArray(b.frames) ? b.frames : []).map(f => String(f || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 110)).filter(f => f.length > 2).slice(0, 4);
    if (!/^[a-z0-9]{6,24}$/.test(id)) { res.status(400).json({ error: 'Unknown mascot.' }); return; }
    if (desc.length < 3 || frames.length < 2) { res.status(400).json({ error: 'Describe the move and give it at least 2 frames.' }); return; }
    if (!who.owner && !(who.rec.mascots || []).some(m => m.id === id)) { res.status(403).json({ error: 'This mascot was saved with a different key.' }); return; }
    try {
      const block = await moderate({ key, desc: `${desc}. ${frames.join('. ')}`, photo: null, visionModels: VISION_MODELS() });
      if (block) { res.status(422).json({ error: block.message, blocked: block.reason }); return; }
      const stop = await guard(who, 'pose');
      if (stop) { res.status(429).json({ error: stop }); return; }
      const ref = await poseReference(id);
      if (!ref) { res.status(404).json({ error: 'Mascot not found.' }); return; }
      if (!ref.png) { res.status(409).json({ error: 'Open this mascot on the paint page and save it again first, so its poses are prepared.' }); return; }
      const L = MOVE_LAYOUT(frames.length), sharp = (await import('sharp')).default;
      let last = null, miss = null;
      const paintOnce = async () => {
        for (const model of IMAGE_MODELS()) {
          let noTransparent = false, noHiFi = false;
          for (const [transparent, hiFi] of [[true, true], [true, false], [false, true], [false, false]]) {
            if ((transparent && noTransparent) || (hiFi && noHiFi)) continue;
            const fd = new FormData();
            fd.append('model', model); fd.append('prompt', MOVE_PROMPT(desc, frames, transparent));
            fd.append('image', new Blob([ref.png], { type: 'image/png' }), 'mascot.png');
            fd.append('size', L.size); fd.append('quality', 'medium'); fd.append('output_format', 'png'); fd.append('n', '1');
            if (transparent) fd.append('background', 'transparent');
            if (hiFi) fd.append('input_fidelity', 'high');
            const r = await call(`${API}/images/edits`, { method: 'POST', headers: auth, body: fd });
            if (r.ok && r.json && r.json.data && r.json.data[0]) { await counted(who, 'pose'); return { image: r.json.data[0].b64_json, model }; }
            last = r;
            if (/fidelity/i.test(r.msg || '')) { noHiFi = true; continue; }
            if (/background|transparen/i.test(r.msg || '')) { noTransparent = true; continue; }
            if (tryNext(r.status, r.msg)) break;
            return null;
          }
        }
        return null;
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt && await guard(who, 'pose')) break;
        const out = await paintOnce();
        if (!out) break;
        // cut the sheet into its panels
        const sheet = sharp(Buffer.from(out.image, 'base64')), meta = await sheet.metadata(), cw = Math.floor(meta.width / L.cols), ch = Math.floor(meta.height / L.rows);
        const panels = [];
        for (let i = 0; i < frames.length; i++) panels.push((await sharp(Buffer.from(out.image, 'base64')).extract({ left: (i % L.cols) * cw, top: Math.floor(i / L.cols) * ch, width: cw, height: ch }).png().toBuffer()).toString('base64'));
        const same = await looksSame(key, ref.png, panels[0]);
        if (same.ok) { const credits = await spend(who, MOVE_COST).catch(() => null); res.json({ images: panels, mime: 'image/png', model: out.model, credits, body: same.body || null }); return; }
        miss = same; console.log('move off-model', attempt, same.score, same.why);
      }
      if (miss) { res.status(422).json({ error: 'It didn’t come out looking like your mascot, so we didn’t keep it and your credits weren’t used. Try describing the move a different way.', offModel: true }); return; }
      res.status((last && last.status) || 500).json({ error: (last && last.msg) || 'Painting failed. Your credits weren’t used.' }); return;
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); return; }
  }

  if (b.step === 'pose2') {
    if (who.rec && !(who.rec.credits >= 1)) { res.status(402).json({ error: 'Animating a pose uses 1 credit and you’re out.', credits: 0 }); return; }
    const id = String(b.id || ''), change = String(b.change || '').trim().slice(0, 160);
    const seq = b.seq && typeof b.seq === 'object' ? { desc: String(b.seq.desc || '').trim().slice(0, 160), i: Math.max(2, Math.min(4, Number(b.seq.i) || 2)), n: Math.max(2, Math.min(4, Number(b.seq.n) || 2)) } : null;
    if (!/^[a-z0-9]{6,24}$/.test(id)) { res.status(400).json({ error: 'Unknown mascot.' }); return; }
    if (change.length < 3) { res.status(400).json({ error: 'Say what should move.' }); return; }
    if (!b.image || b.image.length > 8e6) { res.status(400).json({ error: 'Paint the pose first.' }); return; }
    if (!who.owner && !(who.rec.mascots || []).some(m => m.id === id)) { res.status(403).json({ error: 'This mascot was saved with a different key.' }); return; }
    try {
      const stop = await guard(who, 'pose');
      if (stop) { res.status(429).json({ error: stop }); return; }
      const block = await moderate({ key, desc: seq && seq.desc ? `${seq.desc}. ${change}` : change, photo: null, visionModels: VISION_MODELS() });
      if (block) { res.status(422).json({ error: block.message, blocked: block.reason }); return; }
      const ref = Buffer.from(b.image, 'base64');
      let last = null;
      for (const model of IMAGE_MODELS()) {
        let noTransparent = false, noHiFi = false, next = false;
        for (const [transparent, hiFi] of [[true, true], [true, false], [false, true], [false, false]]) {
          if ((transparent && noTransparent) || (hiFi && noHiFi)) continue;
          const fd = new FormData();
          fd.append('model', model); fd.append('prompt', seq ? SEQ_PROMPT(seq.desc || change, change, seq.i, seq.n, transparent) : FRAME2_PROMPT(change, transparent));
          fd.append('image', new Blob([ref], { type: 'image/png' }), 'frame1.png');
          fd.append('size', '1024x1024'); fd.append('quality', 'medium'); fd.append('output_format', 'png'); fd.append('n', '1');
          if (transparent) fd.append('background', 'transparent');
          if (hiFi) fd.append('input_fidelity', 'high');
          const r = await call(`${API}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
          if (r.ok && r.json && r.json.data && r.json.data[0]) { await counted(who, 'pose'); const credits = await spend(who, 1).catch(() => null); res.json({ image: r.json.data[0].b64_json, mime: 'image/png', model, credits }); return; }
          last = r;
          if (/fidelity/i.test(r.msg || '')) { noHiFi = true; continue; }
          if (/background|transparen/i.test(r.msg || '')) { noTransparent = true; continue; }
          if (tryNext(r.status, r.msg)) { next = true; break; }
          res.status(r.status || 500).json({ error: r.msg || 'Painting failed. Your credit wasn’t used.' }); return;
        }
        if (!next) break;
      }
      res.status((last && last.status) || 500).json({ error: (last && last.msg) || 'Painting failed. Your credit wasn’t used.' }); return;
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); return; }
  }

  if ((b.step === 'base' || b.step === 'reference') && who.rec && !(who.rec.credits >= MASCOT_COST)) { res.status(402).json({ error: `A new mascot uses ${MASCOT_COST} credits and you have ${who.rec.credits || 0}.`, credits: who.rec.credits || 0 }); return; }

  try {
    // Screen what the person typed (and any photo) before painting, so a blocked request never uses a paint.
    if (b.step === 'base' || b.step === 'reference' || b.step === 'edit') {
      const stop = await guard(who, 'image');
      if (stop) { res.status(429).json({ error: stop }); return; }
    }
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
          if (r.ok && r.json && r.json.data && r.json.data[0]) { await counted(who, 'image'); const credits = await spend(who, MASCOT_COST).catch(() => null); res.json({ image: r.json.data[0].b64_json, mime: 'image/webp', model, size, credits }); return; }
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
            if (r.ok && r.json && r.json.data && r.json.data[0]) { await counted(who, 'image'); const credits = await spend(who, MASCOT_COST).catch(() => null); res.json({ image: r.json.data[0].b64_json, mime: 'image/webp', model, size, credits }); return; }
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
          if (r.ok && r.json && r.json.data && r.json.data[0]) { await counted(who, 'image'); res.json({ image: r.json.data[0].b64_json, mime: 'image/webp', model, masked: useMask, hiFi }); return; }
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
