/* =========================================================================
   stamps.js: passport entry stamps as inline SVG.
   Shape, ink and tilt are derived from the country name, so each country
   always gets "its" stamp, the way real border posts do.
   ========================================================================= */

const INKS = ['--ink-violet', '--ink-green', '--ink-red', '--ink-blue', '--ink-brown'];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let uid = 0;

/** Splits a long name into at most two balanced lines. */
function lines(name) {
  if (name.length <= 11 || !name.includes(' ')) return [name];
  const words = name.split(' ');
  let best = [name], bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const d = Math.abs(a.length - b.length);
    if (d < bestDiff) { bestDiff = d; best = [a, b]; }
  }
  return best;
}

/**
 * @param {string} name   country name
 * @param {object} opts   { n: crossing number, time: date label, kind: 'entry'|'start'|'goal', captions, locale }
 * @returns {{ svg: string, rotate: number }}
 */
export function stampSVG(name, { n = 1, time = '', kind = 'entry', captions = { entry: 'ENTRY', start: 'DEPARTED', goal: 'ARRIVED' }, locale = 'en' } = {}) {
  const h = hash(name);
  const shape = h % 3;
  const ink = kind === 'goal' ? '--ink-red' : kind === 'start' ? '--ink-green' : INKS[(h >>> 3) % INKS.length];
  const rotate = ((h >>> 7) % 25) - 12;
  const color = `var(${ink})`;
  const id = `st${uid++}`;
  const upper = esc(name.toLocaleUpperCase(locale));
  const caption = captions[kind] ?? captions.entry;
  const num = String(n).padStart(2, '0');

  let body;
  if (shape === 0) {
    // Round stamp: name on the upper arc, number in the middle.
    const fs = Math.max(6.5, Math.min(12, 130 / name.length));
    body = `
      <circle cx="50" cy="50" r="45" stroke-width="3.2"/>
      <circle cx="50" cy="50" r="37.5" stroke-width="1.2"/>
      <path id="${id}" d="M 17 52 A 33 33 0 0 1 83 52" fill="none" stroke="none"/>
      <text font-size="${fs}" font-weight="800" letter-spacing="1" text-anchor="middle" stroke="none" fill="${color}">
        <textPath href="#${id}" startOffset="50%">${upper}</textPath>
      </text>
      <text x="50" y="66" font-size="19" font-weight="900" text-anchor="middle" stroke="none" fill="${color}">${num}</text>
      <text x="50" y="78" font-size="6.5" font-weight="700" letter-spacing="1.5" text-anchor="middle" stroke="none" fill="${color}">${caption} ${esc(time)}</text>`;
  } else {
    // Rectangular or octagonal stamp: name in the middle.
    const frame = shape === 1
      ? `<rect x="6" y="16" width="88" height="68" rx="9" stroke-width="3.2"/><rect x="12" y="22" width="76" height="56" rx="5" stroke-width="1.1"/>`
      : `<polygon points="30,8 70,8 92,30 92,70 70,92 30,92 8,70 8,30" stroke-width="3.2"/><polygon points="33,15 67,15 85,33 85,67 67,85 33,85 15,67 15,33" stroke-width="1.1"/>`;
    const ls = lines(name.toLocaleUpperCase(locale));
    const longest = Math.max(...ls.map(l => l.length));
    const fs = Math.max(6.5, Math.min(13, 118 / longest));
    const y0 = ls.length === 1 ? 52 : 46;
    const nameText = ls.map((l, i) =>
      `<text x="50" y="${y0 + i * (fs + 1.5)}" font-size="${fs}" font-weight="850" text-anchor="middle" stroke="none" fill="${color}">${esc(l)}</text>`).join('');
    body = `${frame}
      <text x="50" y="${shape === 1 ? 33 : 32}" font-size="6.5" font-weight="700" letter-spacing="1.5" text-anchor="middle" stroke="none" fill="${color}">${caption} ${num}</text>
      ${nameText}
      <text x="50" y="${shape === 1 ? 73 : 74}" font-size="6.5" font-weight="700" letter-spacing="1.2" text-anchor="middle" stroke="none" fill="${color}">${esc(time)}</text>`;
  }

  const svg = `<svg viewBox="0 0 100 100" role="img" aria-label="${esc(name)}" style="color:${color}">
    <g fill="none" stroke="${color}" filter="url(#ink-wear)" font-family="Archivo, system-ui, sans-serif" style="font-variation-settings:'wdth' 75">${body}</g>
  </svg>`;
  return { svg, rotate };
}

/** One shared SVG filter that gives every stamp a worn-ink texture. */
export function installInkFilter() {
  if (document.getElementById('ink-wear')) return;
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.setAttribute('width', '0'); holder.setAttribute('height', '0');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.position = 'absolute';
  holder.innerHTML = `
    <filter id="ink-wear" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 2.75" result="speckle"/>
      <feComposite in="SourceGraphic" in2="speckle" operator="in" result="worn"/>
      <feTurbulence type="turbulence" baseFrequency=".06" numOctaves="1" seed="3" result="warp"/>
      <feDisplacementMap in="worn" in2="warp" scale="1"/>
    </filter>`;
  document.body.prepend(holder);
}
