// Checks a paint request before any painting happens (so a blocked request never uses a paint).
// 1. A list of names of existing characters, mascots and brands (instant, free).
// 2. OpenAI's moderation check on the description and any uploaded photo (sexual, hateful, violent, etc.).
// 3. A quick AI read for descriptions that clearly add up to an existing character without naming it.
// Returns null when the request is fine, or { reason, message } when it isn't.

const API = 'https://api.openai.com/v1';

// Lowercase, accents stripped, punctuation turned into spaces, so "Pikachu!" and "pi-ka-chu" style tricks are caught.
const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5|\$/g, 's')
  .replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ') + ' ';
const squash = s => norm(s).replace(/ /g, '');

// Names that only ever mean the protected thing. Common words (apple, sonic, frozen, link) are left to the AI check.
const NAMES = [
  // studios and franchises
  'disney', 'pixar', 'marvel', 'dc comics', 'dreamworks', 'nintendo', 'pokemon', 'sanrio', 'studio ghibli', 'ghibli', 'looney tunes', 'warner bros',
  'sesame street', 'muppet', 'muppets', 'star wars', 'harry potter', 'hogwarts', 'paw patrol', 'my little pony', 'care bears', 'teletubbies', 'teletubby',
  'transformers', 'ninja turtles', 'tmnt', 'minecraft', 'roblox', 'fortnite', 'among us', 'dragon ball', 'one piece', 'sailor moon', 'naruto', 'animal crossing', 'zelda',
  // characters
  'mickey mouse', 'minnie mouse', 'donald duck', 'winnie the pooh', 'pooh bear', 'tigger', 'eeyore', 'olaf', 'elsa', 'simba', 'buzz lightyear', 'lightning mcqueen',
  'pikachu', 'eevee', 'jigglypuff', 'charmander', 'bulbasaur', 'squirtle', 'mario', 'luigi', 'princess peach', 'bowser', 'yoshi', 'toad nintendo', 'kirby', 'donkey kong', 'pac man', 'pacman',
  'sonic the hedgehog', 'tails the fox', 'hello kitty', 'kuromi', 'my melody', 'cinnamoroll', 'pompompurin', 'keroppi',
  'spongebob', 'patrick star', 'squidward', 'shrek', 'garfield', 'snoopy', 'charlie brown', 'scooby doo', 'scooby', 'bugs bunny', 'daffy duck', 'tweety', 'tom and jerry',
  'batman', 'superman', 'spiderman', 'spider man', 'iron man', 'hulk', 'captain america', 'deadpool', 'groot', 'baby yoda', 'grogu', 'yoda', 'darth vader', 'r2d2', 'r2 d2', 'c3po', 'bb8', 'bb 8', 'chewbacca',
  'peppa pig', 'bluey', 'bingo heeler', 'elmo', 'cookie monster', 'kermit', 'miss piggy', 'barney', 'dora the explorer', 'totoro', 'doraemon', 'goku', 'luffy', 'steve minecraft',
  'labubu', 'squishmallow', 'squishmallows', 'furby', 'tamagotchi', 'barbie', 'lego', 'smurf', 'smurfs', 'paddington', 'peter rabbit', 'moomin', 'gudetama', 'rilakkuma', 'pusheen', 'molang',   // brand mascots and logos
  'duolingo', 'duo the owl', 'octocat', 'clippy', 'ronald mcdonald', 'mcdonalds', 'mc donalds', 'geico', 'pillsbury', 'doughboy', 'tony the tiger', 'kool aid', 'michelin man', 'bibendum', 'mr peanut',   'starbucks', 'coca cola', 'pepsi', 'nike', 'adidas', 'chick fil a', 'kfc', 'colonel sanders', 'wendys', 'burger king', 'taco bell', 'chuck e cheese', 'energizer bunny', 'aflac', 'pringles', 'mr clean', 'jolly green giant',
  'mailchimp', 'freddie mailchimp', 'reddit', 'snoo', 'discord', 'wumpus', 'github', 'bugdroid', 'twitter', 'tiktok', 'instagram', 'facebook', 'snapchat', 'ghostface chillah', 'chrome dino',
  'linux tux', 'gopher go', 'docker whale', 'moby dock', 'openai', 'chatgpt', 'anthropic', ];
const NAME_RE = new RegExp(' (' + NAMES.map(n => norm(n).trim().replace(/ /g, ' ?')).join('|') + ') ');
const SQUASHED = NAMES.map(squash).filter(n => n.length >= 7);

function nameHit(text) {
  const n = norm(text), m = n.match(NAME_RE);
  if (m) return m[1];
  const s = squash(text);
  return SQUASHED.find(x => s.includes(x)) || null;
}

const IP_PROMPT = `You review requests to a tool that designs ORIGINAL cartoon mascots for apps. Decide whether this request asks for an existing, recognizable copyrighted character, brand mascot or logo (from games, films, TV, books, comics, toys, or companies), or a real, identifiable person.
Only flag it when the request names one, or describes a clear combination of signature features that unmistakably points to one specific existing character (for example "a yellow electric mouse with red cheeks and a lightning tail", or "a blue hedgehog who runs super fast with red sneakers"). Generic animals, objects and styles are fine even if some colors overlap with a famous character ("a green owl", "a blue cat", "a cute yellow mouse" are fine). If a photo is attached, also flag it when the photo itself shows a known character, toy of one, brand mascot or logo. A photo of someone's own pet, object or drawing is fine.
Reply with ONLY this JSON: {"flag":false,"what":""} where "what" names the character, brand or kind of person when flag is true.`;

async function post(path, key, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, json: j };
}
const textOf = j => !j ? '' : typeof j.output_text === 'string' ? j.output_text : (j.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');

export async function moderate({ key, desc, photo, photoMime, visionModels }) {
  const text = String(desc || '').slice(0, 2000);

  const hit = text && nameHit(text);
  if (hit) return { reason: 'name', message: `Critterkit makes original mascots, so it can’t paint existing characters, mascots or brands (it spotted “${hit}”). Describe your own character instead. No paint was used.` };

  const img = photo ? `data:${photoMime || 'image/jpeg'};base64,${photo}` : null;

  // Safety check (sexual, hateful, violent, self-harm...). If the check itself is unreachable, painting goes ahead;
  // the image model applies its own safety rules as well.
  const input = [...(text ? [{ type: 'text', text }] : []), ...(img ? [{ type: 'image_url', image_url: { url: img } }] : [])];
  if (input.length) {
    const m = await post('/moderations', key, { model: 'omni-moderation-latest', input }).catch(() => null);
    const res = m && m.ok && m.json && m.json.results && m.json.results[0];
    if (res && res.flagged) return { reason: 'unsafe', message: 'That description or photo can’t be used. Critterkit only paints friendly, all-ages mascots. Try a different idea. No paint was used.' };
  }

  // Existing characters described without their name, or shown in the photo.
  for (const model of visionModels) {
    const content = [{ type: 'input_text', text: IP_PROMPT + '\n\nRequest: ' + (text || '(no description, photo only)') }];
    if (img) content.push({ type: 'input_image', image_url: img });
    const r = await post('/responses', key, { model, input: [{ role: 'user', content }] }).catch(() => null);
    if (!r || !r.ok) continue;
    let v = null; try { const t = textOf(r.json); v = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (e) {}
    if (v && v.flag) return { reason: 'existing', message: `This looks like ${v.what ? `“${String(v.what).slice(0, 60)}”` : 'an existing character or brand'}. Critterkit makes original mascots only, so describe something of your own. No paint was used.` };
    break;
  }
  return null;
}
