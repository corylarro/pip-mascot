// "Describe a moment": turns a sentence into a short choreography for the mascot, plus the code to paste.
// POST /api/choreo { text } -> { steps: [...] }
// The AI can only pick from the moves below, so the result is always safe to run.
import { moderate } from './_moderate.js';
import { readJson, writeJson, ipTag } from './_keys.js';

const MODELS = () => [...new Set([process.env.OPENAI_TEXT_MODEL, 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini'].filter(Boolean))];
const PER_HOUR = 30;

const STATES = ['idle', 'thinking', 'success', 'error', 'surprised', 'confused', 'love', 'wave', 'sleeping', 'dance', 'sad', 'peek'];
const EMOTES = ['spark', 'note', 'dust', 'bang', 'sweat', 'smoke', 'drops', 'confetti', 'hearts'];
const MOVES = ['jump', 'bigjump', 'flip', 'spin', 'shake', 'grow'];
const POOF = ['home', 'center', 'left', 'right', 'random'];

const PROMPT = `You choreograph a cute animated app mascot. Turn the request into a short sequence of steps (3 to 8) the mascot can perform.
Steps (JSON objects):
- {"do":"react","state":S,"ms":N}  a mood that plays while the next steps run. S is one of: ${STATES.join(', ')}. ms 800-5000.
- {"do":"say","text":"..."}  a speech bubble, at most 60 characters, friendly, no emoji.
- {"do":"jump"} small hop. {"do":"bigjump"} high leap. {"do":"flip"} backflip. {"do":"spin"} twirl. {"do":"shake"} wet-dog shake. {"do":"grow"} pop up bigger then back.
- {"do":"emote","kind":K}  K is one of: ${EMOTES.join(', ')} (spark = sparkles, note = music note, bang = "!", sweat = sweat drop, smoke = puff, drops = water drops).
- {"do":"prop","emoji":"🍕","ms":N}  hold up one emoji as a prop for anything the moves can't show (food, instruments, weather, objects). ms 1000-5000.
- {"do":"poof","to":T}  vanish in smoke and reappear. T is one of: ${POOF.join(', ')}. If it poofs away, end with a poof home.
- {"do":"wait","ms":N}  pause, 200-3000.
react, say, emote and prop start and keep going while the next step runs; moves, poof and wait take their time.
Keep it playful and all-ages. Interpret creatively and use props for things you can't animate. If the request is inappropriate, hurtful or not something a mascot should do, return a short confused reaction saying it can't do that one.
Reply with ONLY JSON: {"steps":[...]}`;

const clampN = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : d; };
const clean = s => String(s || '').replace(/[<>]/g, '').trim();

function sanitize(steps) {
  const out = [];
  for (const st of Array.isArray(steps) ? steps.slice(0, 10) : []) {
    const d = String(st && st.do || '').toLowerCase();
    if (d === 'react' && STATES.includes(st.state)) out.push({ do: 'react', state: st.state, ms: clampN(st.ms, 800, 5000, 2400) });
    else if (d === 'say' && clean(st.text)) out.push({ do: 'say', text: clean(st.text).slice(0, 60) });
    else if (MOVES.includes(d)) out.push({ do: d });
    else if (d === 'backflip') out.push({ do: 'flip' });
    else if (d === 'emote' && EMOTES.includes(st.kind)) out.push({ do: 'emote', kind: st.kind });
    else if (d === 'prop' && clean(st.emoji)) out.push({ do: 'prop', emoji: [...clean(st.emoji)].slice(0, 2).join(''), ms: clampN(st.ms, 1000, 5000, 2600) });
    else if (d === 'poof') out.push({ do: 'poof', to: POOF.includes(st.to) ? st.to : 'random' });
    else if (d === 'wait') out.push({ do: 'wait', ms: clampN(st.ms, 200, 3000, 600) });
  }
  // anything that poofed away comes back
  const poofs = out.filter(s => s.do === 'poof');
  if (poofs.length && poofs[poofs.length - 1].to !== 'home') out.push({ do: 'wait', ms: 1200 }, { do: 'poof', to: 'home' });
  return out;
}

const textOf = j => !j ? '' : typeof j.output_text === 'string' ? j.output_text : (j.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');

async function overLimit(req) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  const hour = Math.floor(Date.now() / 3600000), path = `rate/choreo/${ipTag(req)}-${hour}.json`;
  try {
    const rec = (await readJson(path)) || { n: 0 };
    if (rec.n >= PER_HOUR) return true;
    await writeJson(path, { n: rec.n + 1 });
  } catch (e) {}
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(500).json({ error: 'Not set up yet.' }); return; }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const text = clean(b && b.text).slice(0, 200);
  if (text.length < 3) { res.status(400).json({ error: 'Describe what the mascot should do.' }); return; }
  if (await overLimit(req)) { res.status(429).json({ error: 'That’s a lot of moments! Try again in a bit.' }); return; }

  const block = await moderate({ key, desc: text, visionModels: [] }).catch(() => null);
  if (block && block.reason === 'unsafe') { res.status(422).json({ error: 'Let’s keep it friendly. Try a different moment.' }); return; }

  for (const model of MODELS()) {
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: [{ role: 'system', content: PROMPT }, { role: 'user', content: text }] })
      });
      if (!r.ok) continue;
      const t = textOf(await r.json());
      const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      const steps = sanitize(j.steps);
      if (steps.length) { res.json({ steps }); return; }
    } catch (e) {}
  }
  res.status(502).json({ error: 'Couldn’t dream that one up right now. Try again?' });
}
