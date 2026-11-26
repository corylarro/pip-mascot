// "Describe a moment": turns a sentence into a short choreography for the mascot, plus the code to paste.
// POST /api/choreo { text } -> { steps: [...] }
// The AI can only pick from the moves below, so the result is always safe to run.
import { moderate } from './_moderate.js';
import { readJson, writeJson, ipTag } from './_keys.js';
import { STATES, EMOTES, MOVES, POOF, clean, sanitize } from './_steps.js';

const MODELS = () => [...new Set([process.env.OPENAI_TEXT_MODEL, 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini'].filter(Boolean))];
const PER_HOUR = 30;

const PROMPT = `You choreograph a cute animated app mascot. Turn the request into a short sequence of steps (3 to 8) the mascot can perform.
Steps (JSON objects):
- {"do":"react","state":S,"ms":N}  a mood that plays while the next steps run. S is one of: ${STATES.join(', ')}. ms 800-5000.
- {"do":"say","text":"..."}  a speech bubble, at most 60 characters, friendly, no emoji.
- {"do":"jump"} small hop. {"do":"bigjump"} high leap. {"do":"flip"} backflip. {"do":"spin"} twirl. {"do":"shake"} wet-dog shake. {"do":"grow"} pop up bigger then back.
- {"do":"emote","kind":K}  K is one of: ${EMOTES.join(', ')} (spark = sparkles, note = music note, bang = "!", sweat = sweat drop, smoke = puff, drops = water drops).
- {"do":"prop","emoji":"🍕","ms":N}  hold up one emoji as a prop for anything the moves can't show (food, instruments, weather, objects). ms 2000-5000. Whenever the request names a thing (pizza, cake, trophy, coffee, a package…), you MUST include a prop step showing it, early in the sequence.
- {"do":"poof","to":T}  vanish in smoke and reappear. T is one of: ${POOF.join(', ')}. If it poofs away, end with a poof home.
- {"do":"wait","ms":N}  pause, 200-3000.
react, say, emote and prop start and keep going while the next step runs; moves, poof and wait take their time.
If the request includes a value that changes each time (a level, a name, a streak length, a score, an item), write it as a placeholder in curly braces in the say text, like {level} or {name}, and give a realistic example for each in "values".
Keep it playful and all-ages. Interpret creatively and use props for things you can't animate. If the request is inappropriate, hurtful or not something a mascot should do, return a short confused reaction saying it can't do that one.
Reply with ONLY JSON: {"steps":[...],"values":{}}`;

// If the request names a thing but the AI forgot to hold it up, add the prop ourselves.
const PROPS = [[/pizza/, '🍕'], [/birthday|cake/, '🎂'], [/trophy|award|prize|win(ner)?\b/, '🏆'], [/coffee|latte|espresso/, '☕'], [/tea\b/, '🍵'],
  [/gift|present/, '🎁'], [/package|parcel|order|ship|deliver|box\b/, '📦'], [/rocket|launch/, '🚀'], [/guitar/, '🎸'], [/music|song|sing/, '🎵'],
  [/umbrella|rain/, '☂️'], [/snow/, '❄️'], [/sun\b|sunny|summer/, '☀️'], [/money|cash|paid|payment|sale/, '💰'], [/crown|king|queen/, '👑'],
  [/balloon|party/, '🎈'], [/book|read/, '📚'], [/ice ?cream/, '🍦'], [/taco/, '🌮'], [/burger/, '🍔'], [/donut|doughnut/, '🍩'], [/popcorn|movie/, '🍿'],
  [/flower|bloom|garden/, '🌸'], [/heart|love/, '❤️'], [/star\b|stars/, '⭐'], [/fire|streak/, '🔥'], [/medal/, '🥇'], [/coin/, '🪙'], [/key\b/, '🔑'],
  [/mail|email|letter|message/, '✉️'], [/phone|call/, '📱'], [/bell|notification|reminder/, '🔔'], [/camera|photo/, '📸'], [/plant|seed/, '🌱'],
  [/cookie/, '🍪'], [/apple/, '🍎'], [/banana/, '🍌'], [/carrot/, '🥕'], [/water|drink|hydrat/, '💧'], [/sleep|bed|night/, '🌙'], [/dumbbell|workout|gym|lift/, '🏋️'],
  [/ball\b|soccer|football/, '⚽'], [/basketball/, '🏀'], [/game|controller/, '🎮'], [/pencil|write|note/, '✏️'], [/lock|password/, '🔒'], [/check|done|complete/, '✅']];
function ensureProp(text, steps) {
  if (steps.some(s => s.do === 'prop')) return steps;
  const t = text.toLowerCase(), hit = PROPS.find(([re]) => re.test(t));
  if (!hit) return steps;
  const at = Math.max(0, steps.findIndex(s => s.do !== 'react'));
  steps.splice(at, 0, { do: 'prop', emoji: hit[1], ms: 3200 });
  return steps.slice(0, 13);
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
      const steps = ensureProp(text, sanitize(j.steps));
      // example values for any {placeholders} the steps use
      const used = new Set(steps.flatMap(s => [...String(s.text || '').matchAll(/\{(\w{1,20})\}/g)].map(m => m[1])));
      const values = {};
      for (const k of used) { const v = j.values && j.values[k]; values[k] = typeof v === 'number' ? v : String(v == null ? (k === 'name' ? 'Sam' : 5) : v).slice(0, 24); }
      if (steps.length) { res.json({ steps, values }); return; }
    } catch (e) {}
  }
  res.status(502).json({ error: 'Couldn’t dream that one up right now. Try again?' });
}
