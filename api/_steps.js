// What a play() sequence may contain. Shared by the studio's AI and saved no-code moments.
export const STATES = ['idle', 'thinking', 'success', 'error', 'surprised', 'confused', 'love', 'wave', 'sleeping', 'dance', 'sad', 'peek'];
export const EMOTES = ['spark', 'note', 'dust', 'bang', 'sweat', 'smoke', 'drops', 'confetti', 'hearts'];
export const MOVES = ['jump', 'bigjump', 'flip', 'spin', 'shake', 'grow'];
export const POOF = ['home', 'center', 'left', 'right', 'random'];

const clampN = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : d; };
export const clean = s => String(s || '').replace(/[<>]/g, '').trim();

export function sanitize(steps) {
  const out = [];
  for (const st of Array.isArray(steps) ? steps.slice(0, 12) : []) {
    const d = String(st && st.do || '').toLowerCase();
    if (d === 'react' && STATES.includes(st.state)) out.push({ do: 'react', state: st.state, ms: clampN(st.ms, 800, 5000, 2400) });
    else if (d === 'say' && clean(st.text)) out.push({ do: 'say', text: clean(st.text).slice(0, 70) });
    else if (MOVES.includes(d)) out.push({ do: d });
    else if (d === 'backflip') out.push({ do: 'flip' });
    else if (d === 'emote' && EMOTES.includes(st.kind)) out.push({ do: 'emote', kind: st.kind });
    else if (d === 'prop' && clean(st.emoji)) out.push({ do: 'prop', emoji: [...clean(st.emoji)].slice(0, 2).join(''), ms: clampN(st.ms, 2000, 5000, 3000) });
    else if (d === 'poof') out.push({ do: 'poof', to: POOF.includes(st.to) ? st.to : 'random' });
    else if (d === 'wait') out.push({ do: 'wait', ms: clampN(st.ms, 200, 3000, 600) });
  }
  // anything that poofed away comes back
  const poofs = out.filter(s => s.do === 'poof');
  if (poofs.length && poofs[poofs.length - 1].to !== 'home') out.push({ do: 'wait', ms: 1200 }, { do: 'poof', to: 'home' });
  return out;
}

