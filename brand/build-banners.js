// Composes the X header, README hero, and GitHub social preview from the canonical
// crest artwork, then renders each to PNG. Edit the crest and re-run — banners follow.
//   npm install @resvg/resvg-js
//   node build-banners.js
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const SVG_DIR = path.join(__dirname, 'svg');
const PNG_DIR = path.join(__dirname, 'png');
fs.mkdirSync(PNG_DIR, { recursive: true });

const raw = fs.readFileSync(path.join(SVG_DIR, 'alayra-nexus-crest.svg'), 'utf8');
const crest = raw
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>[\s\S]*$/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .replace(/<desc>[\s\S]*?<\/desc>/, '');

// The crest is authored around cx=340, cy=180. Re-seat it anywhere.
const placeCrest = (cx, cy, s) =>
  `<g transform="translate(${(cx - 340 * s).toFixed(2)} ${(cy - 180 * s).toFixed(2)}) scale(${s})">${crest}</g>`;

const FONT = 'Segoe UI, Segoe UI Semibold, Arial, sans-serif';
const CY = '#4ecfd6', BR = '#c9a15f', SEP = '#3f5a63';
const T1 = '#7fa9b8', T2 = '#4f7382', T3 = '#3a5563';

const defs = (w, h, gx, gy, gr) => `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#08121c"/><stop offset="55%" stop-color="#0b1622"/><stop offset="100%" stop-color="#0d1e2b"/>
</linearGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="#22d3ee" stop-opacity="0.16"/>
<stop offset="60%" stop-color="#22d3ee" stop-opacity="0.05"/>
<stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
</radialGradient>
<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
<circle cx="1.6" cy="1.6" r="1.1" fill="#3ce8e5" fill-opacity="0.07"/>
</pattern>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<rect width="${w}" height="${h}" fill="url(#dots)"/>
<circle cx="${gx}" cy="${gy}" r="${gr}" fill="url(#glow)"/>`;

const wordmark = (x, y, size, ls, anchor = 'start') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="600" letter-spacing="${ls}">` +
  `<tspan fill="${BR}">ALAYRA</tspan><tspan fill="${SEP}"> &#183; </tspan><tspan fill="${CY}">NEXUS</tspan></text>`;

const rule = (x1, x2, y, sw = 1, op = 0.45) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${BR}" stroke-width="${sw}" stroke-opacity="${op}"/>`;
const txt = (x, y, size, fill, s, anchor = 'start', ls = 0) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" fill="${fill}" letter-spacing="${ls}">${s}</text>`;

const TAG = 'The Enterprise AI Gateway';
const SUB = 'One OpenAI-compatible endpoint. Every model. Zero key chaos.';
const FOOT = 'Apache-2.0  &#183;  github.com/Alayra-Systems-Pvt-Limited/Alayra-Nexus';

// X / Twitter header. Two constraints drive this layout:
//   1. The profile avatar (already the crest) sits bottom-left, so the banner's crest
//      moves right - otherwise two crests stack in the same corner.
//   2. X renders the header far smaller than its 1500px canvas, then transcodes to JPEG.
//      Type is sized up and the micro footer dropped; hairlines do not survive that.
const xBanner = `<svg width="1500" height="500" viewBox="0 0 1500 500" xmlns="http://www.w3.org/2000/svg" role="img">
<title>Alayra Nexus - The Enterprise AI Gateway</title>
${defs(1500, 500, 1190, 250, 360)}
${placeCrest(1190, 250, 1.15)}
${wordmark(300, 200, 64, 8)}
${rule(302, 930, 234, 1.8, 0.65)}
${txt(300, 288, 30, '#9fc4d1', TAG, 'start', 1)}
${txt(300, 332, 21, '#6e93a3', SUB)}
</svg>`;

const readmeBanner = `<svg width="1280" height="400" viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" role="img">
<title>Alayra Nexus - The Enterprise AI Gateway</title>
${defs(1280, 400, 215, 200, 285)}
${placeCrest(215, 200, 0.92)}
${wordmark(430, 178, 48, 6)}
${rule(432, 906, 206)}
${txt(430, 244, 23, T1, TAG, 'start', 1)}
${txt(430, 278, 17, T2, SUB)}
${txt(430, 338, 14, T3, FOOT)}
</svg>`;

// Many providers in, one gateway out.
const flow = (mirror) => {
  const paths = [
    'M0 120 C 200 140, 300 200, 430 228',
    'M0 180 C 220 190, 320 215, 432 232',
    'M0 235 C 200 235, 320 235, 434 235',
    'M0 290 C 220 280, 320 255, 432 238',
    'M0 350 C 200 330, 300 270, 430 242',
  ];
  const g = paths.map((d) => `<path d="${d}" fill="none" stroke="#22d3ee" stroke-width="1.2" stroke-opacity="0.20"/>`).join('');
  const dots = [120, 180, 235, 290, 350].map((y) => `<circle cx="6" cy="${y}" r="2.4" fill="#3ce8e5" fill-opacity="0.5"/>`).join('');
  return mirror ? `<g transform="translate(1280 0) scale(-1 1)">${g}${dots}</g>` : `<g>${g}${dots}</g>`;
};

const social = `<svg width="1280" height="640" viewBox="0 0 1280 640" xmlns="http://www.w3.org/2000/svg" role="img">
<title>Alayra Nexus - The Enterprise AI Gateway</title>
${defs(1280, 640, 640, 235, 380)}
${flow(false)}${flow(true)}
${placeCrest(640, 235, 1.25)}
${wordmark(640, 502, 54, 8, 'middle')}
${rule(390, 890, 526)}
${txt(640, 566, 26, T1, TAG, 'middle', 1)}
${txt(640, 602, 18, T2, SUB, 'middle')}
</svg>`;

// [svgName, svg, [[renderWidth, filenameSuffix], ...]]
// The first entry of each is the file you should actually upload. X and GitHub both
// render on high-DPI displays, so the unsuffixed export is already 2x.
const files = [
  ['alayra-nexus-banner-x.svg', xBanner, [[3000, ''], [1500, '-1x']]],
  ['alayra-nexus-banner-readme.svg', readmeBanner, [[2560, ''], [1280, '-1x']]],
  ['alayra-nexus-social-preview.svg', social, [[1280, '']]],
];

for (const [name, svg, sizes] of files) {
  fs.writeFileSync(path.join(SVG_DIR, name), svg + '\n');
  const base = name.replace(/\.svg$/, '');
  for (const [w, suffix] of sizes) {
    const r = new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { loadSystemFonts: true } });
    const png = r.render().asPng();
    const out = path.join(PNG_DIR, `${base}${suffix}.png`);
    fs.writeFileSync(out, png);
    console.log(`${out}  ${(png.length / 1024).toFixed(0)} KB`);
  }
}
console.log('Rendered banners to', PNG_DIR);
