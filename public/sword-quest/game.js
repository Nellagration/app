'use strict';
/* =====================================================================
   SWORD QUEST — a tiny NES-Zelda-style learning adventure
   for young heroes learning colors, shapes, letters and numbers.
   Everything (graphics, sound, font) is generated in code: no assets.
   ===================================================================== */

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const TILE = 16, COLS = 16, ROWS = 12;   // map grid (256 x 192)
const MY = 48;                           // map y-offset under the HUD
let frame = 0;

/* ---------------------------- save data ---------------------------- */
let save = { gems: {}, sword: false, doorOpen: false };
try {
  const s = localStorage.getItem('swordquest-save');
  if (s) save = Object.assign(save, JSON.parse(s));
} catch (e) { /* private mode etc. */ }
function persist() {
  try { localStorage.setItem('swordquest-save', JSON.stringify(save)); } catch (e) {}
}
const GEM_ORDER = ['color', 'shape', 'letter', 'number'];
function gemCount() { return GEM_ORDER.filter(k => save.gems[k]).length; }

document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Erase all progress and start over?')) {
    try { localStorage.removeItem('swordquest-save'); } catch (e) {}
    location.reload();
  }
});

/* ----------------------------- audio ------------------------------- */
let AC = null;
function audioOn() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(freq, dur, delay, type, vol) {
  if (!AC) return;
  const t = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  blip()  { tone(880, 0.04, 0, 'square', 0.04); },
  bump()  { tone(130, 0.07, 0, 'triangle', 0.10); },
  enter() { tone(330, 0.08); tone(440, 0.10, 0.07); tone(660, 0.12, 0.15); },
  wrong() { tone(233, 0.16, 0, 'sawtooth', 0.07); tone(175, 0.22, 0.13, 'sawtooth', 0.07); },
  right() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, i * 0.09)); },
  gem()   { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.15, i * 0.10)); },
  open()  { [262, 330, 392, 523].forEach((f, i) => tone(f, 0.12, i * 0.08, 'triangle', 0.13)); },
  cut()   { tone(600, 0.05); tone(900, 0.05, 0.04); },
  heart() { tone(1047, 0.08); tone(1319, 0.12, 0.07); },
  fanfare() {
    let t = 0;
    [[392, .18], [392, .18], [392, .18], [523, .55]].forEach(([f, d]) => {
      tone(f, d, t); tone(f * 2, d, t, 'triangle', 0.05); t += d;
    });
    [659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 1.35 + i * 0.18));
  },
};

/* ----------------------------- speech ------------------------------ */
let voiceOn = true;
const voiceBtn = document.getElementById('voiceBtn');
voiceBtn.addEventListener('click', () => {
  voiceOn = !voiceOn;
  voiceBtn.innerHTML = voiceOn ? '&#128266; Voice: ON' : '&#128263; Voice: OFF';
  if (!voiceOn && 'speechSynthesis' in window) speechSynthesis.cancel();
});
function say(text) {
  if (!voiceOn || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85; u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ----------------------------- input ------------------------------- */
const keys = { up: false, down: false, left: false, right: false };
let actionPressed = false, anyPressed = false;
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};
window.addEventListener('keydown', e => {
  audioOn();
  anyPressed = true;
  if (KEYMAP[e.key]) { keys[KEYMAP[e.key]] = true; e.preventDefault(); }
  if ((e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X' ||
       e.key === ' ' || e.key === 'Enter') && !e.repeat) {
    actionPressed = true; e.preventDefault();
  }
});
window.addEventListener('keyup', e => { if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false; });

document.querySelectorAll('.db').forEach(el => {
  const k = el.dataset.k;
  const on = e => { e.preventDefault(); audioOn(); anyPressed = true; keys[k] = true; };
  const off = e => { e.preventDefault(); keys[k] = false; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
});
const press = e => { e.preventDefault(); audioOn(); anyPressed = true; actionPressed = true; };
document.getElementById('abtn').addEventListener('pointerdown', press);
cvs.addEventListener('pointerdown', press);

function consumeAction() { const a = actionPressed; actionPressed = false; return a; }
function consumeAny() { const a = anyPressed; anyPressed = false; actionPressed = false; return a; }

/* --------------------------- pixel font ---------------------------- */
/* 5x7 glyphs, one int per row, bit 4 = leftmost pixel */
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 30, 17, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 30, 16, 16, 16, 31], F: [31, 16, 30, 16, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 31, 17, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 18, 18, 12],
  K: [17, 18, 28, 18, 17, 17, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 18, 17, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 21, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31], '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 30, 17, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 1, 14],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 6, 4, 0, 4],
  '.': [0, 0, 0, 0, 0, 0, 4], ',': [0, 0, 0, 0, 0, 4, 8],
  ':': [0, 0, 4, 0, 0, 4, 0], "'": [4, 4, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
};
function drawText(s, x, y, color, scale) {
  scale = scale || 1;
  ctx.fillStyle = color;
  for (let c = 0; c < s.length; c++) {
    const g = FONT[s[c].toUpperCase()] || FONT['?'];
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 5; i++)
        if (g[j] & (1 << (4 - i)))
          ctx.fillRect(x + c * 6 * scale + i * scale, y + j * scale, scale, scale);
  }
}
function textW(s, scale) { return s.length * 6 * (scale || 1) - (scale || 1); }
function drawTextC(s, y, color, scale) { drawText(s, Math.round((256 - textW(s, scale)) / 2), y, color, scale); }
/* a prompt made of colored segments, centered */
function drawSegs(segs, y, scale) {
  scale = scale || 1;
  const total = segs.reduce((w, sg) => w + sg[0].length, 0) * 6 * scale - scale;
  let x = Math.round((256 - total) / 2);
  segs.forEach(sg => { drawText(sg[0], x, y, sg[1], scale); x += sg[0].length * 6 * scale; });
}

/* ----------------------------- sprites ----------------------------- */
const PAL = {
  g: '#3fae34', G: '#1b7c14',   // tunic greens
  s: '#fca044',                 // skin
  h: '#7a4612',                 // hair / boots
  k: '#181818',                 // eyes / dark
  w: '#ffffff', o: '#d8542c',   // old man robe
  b: '#3cbcfc', B: '#1054b8',   // sword blade / hilt
  y: '#f8d870',
};
function sprite(rows) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const col = PAL[r[i]];
      if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); }
    }
  });
  return c;
}
function flipH(src) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  g.translate(16, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}
function rot(src, quarter) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  g.translate(8, 8); g.rotate(quarter * Math.PI / 2); g.drawImage(src, -8, -8);
  return c;
}

const heroDown1 = sprite([
  '......gggg......',
  '.....gggggg.....',
  '....gggggggg....',
  '....ssssssss....',
  '....sskssks.....',
  '.....ssssss.....',
  '....gggggggg....',
  '..gggggggggggg..',
  '..sggggggggggs..',
  '..sggggggggggs..',
  '....gggggggg....',
  '....GGGGGGGG....',
  '....sss..sss....',
  '....sss..sss....',
  '...hhh....hhh...',
  '...hhh....hhh...',
]);
const heroDown2 = sprite([
  '................',
  '......gggg......',
  '.....gggggg.....',
  '....gggggggg....',
  '....ssssssss....',
  '....sskssks.....',
  '.....ssssss.....',
  '..gggggggggggg..',
  '..sggggggggggs..',
  '..sggggggggggs..',
  '....gggggggg....',
  '....GGGGGGGG....',
  '.....ss..ss.....',
  '....sss..sss....',
  '...hhh....hhh...',
  '...hhh....hhh...',
]);
const heroUp1 = sprite([
  '......gggg......',
  '.....gggggg.....',
  '....gggggggg....',
  '....gggggggg....',
  '....hhhhhhhh....',
  '.....hhhhhh.....',
  '....gggggggg....',
  '..gggggggggggg..',
  '..sggggggggggs..',
  '..sggggggggggs..',
  '....gggggggg....',
  '....GGGGGGGG....',
  '....sss..sss....',
  '....sss..sss....',
  '...hhh....hhh...',
  '...hhh....hhh...',
]);
const heroUp2 = sprite([
  '................',
  '......gggg......',
  '.....gggggg.....',
  '....gggggggg....',
  '....gggggggg....',
  '....hhhhhhhh....',
  '.....hhhhhh.....',
  '..gggggggggggg..',
  '..sggggggggggs..',
  '..sggggggggggs..',
  '....gggggggg....',
  '....GGGGGGGG....',
  '.....ss..ss.....',
  '....sss..sss....',
  '...hhh....hhh...',
  '...hhh....hhh...',
]);
const heroRight1 = sprite([
  '......gggg......',
  '.....gggggg.....',
  '....gggggggg....',
  '....ssssssss....',
  '....ssssssks....',
  '.....ssssss.....',
  '....gggggggg....',
  '...gggggggggg...',
  '...ggggggggss...',
  '...gggggggggg...',
  '....gggggggg....',
  '....GGGGGGGG....',
  '.....ssssss.....',
  '.....ssssss.....',
  '....hhhhhh......',
  '....hhhhhh......',
]);
const heroRight2 = sprite([
  '................',
  '......gggg......',
  '.....gggggg.....',
  '....gggggggg....',
  '....ssssssss....',
  '....ssssssks....',
  '.....ssssss.....',
  '...gggggggggg...',
  '...ggggggggss...',
  '...gggggggggg...',
  '....gggggggg....',
  '....GGGGGGGG....',
  '.....ssssss.....',
  '....sss..sss....',
  '...hhh....hhh...',
  '...hhh....hhh...',
]);
const HERO = {
  down:  [heroDown1, heroDown2],
  up:    [heroUp1, heroUp2],
  right: [heroRight1, heroRight2],
  left:  [flipH(heroRight1), flipH(heroRight2)],
};
const oldMan = sprite([
  '......wwww......',
  '.....wwwwww.....',
  '....wssssssw....',
  '....sskssks.....',
  '....swwwwws.....',
  '.....wwwww......',
  '....oooooooo....',
  '...oooooooooo...',
  '...oooooooooo...',
  '...oooooooooo...',
  '...oooooooooo...',
  '...oooooooooo...',
  '....oooooooo....',
  '....oooooooo....',
  '....oo....oo....',
  '....oo....oo....',
]);
const swordUp = sprite([
  '.......ww.......',
  '.......wb.......',
  '.......wb.......',
  '.......wb.......',
  '.......wb.......',
  '.......wb.......',
  '.......wb.......',
  '.......wb.......',
  '.......wb.......',
  '.......wb.......',
  '....BBBBBBBB....',
  '.......BB.......',
  '.......BB.......',
  '......yBBy......',
  '................',
  '................',
]);
const SWORD = {
  up: swordUp, right: rot(swordUp, 1),
  down: rot(swordUp, 2), left: rot(swordUp, 3),
};

/* shapes for the shape shrine (pixel masks) */
const SHAPES = {
  CIRCLE: ['...XXXXXX...', '..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXXXXXXXXXX',
           'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', '.XXXXXXXXXX.',
           '..XXXXXXXX..', '...XXXXXX...'],
  SQUARE: ['XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX',
           'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX',
           'XXXXXXXXXXXX', 'XXXXXXXXXXXX'],
  TRIANGLE: ['.....XX.....', '.....XX.....', '....XXXX....', '...XXXXXX...',
             '...XXXXXX...', '..XXXXXXXX..', '..XXXXXXXX..', '.XXXXXXXXXX.',
             '.XXXXXXXXXX.', 'XXXXXXXXXXXX'],
  STAR: ['.....XX.....', '.....XX.....', '....XXXX....', 'XXXXXXXXXXXX',
         '.XXXXXXXXXX.', '..XXXXXXXX..', '..XXXXXXXX..', '.XXXX..XXXX.',
         '.XX......XX.', 'X..........X'],
  HEART: ['.XXX....XXX.', 'XXXXX..XXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX',
          'XXXXXXXXXXXX', '.XXXXXXXXXX.', '..XXXXXXXX..', '...XXXXXX...',
          '....XXXX....', '.....XX.....'],
};
function drawMask(rows, x, y, color) {
  ctx.fillStyle = color;
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++)
      if (r[i] === 'X') ctx.fillRect(x + i, y + j, 1, 1);
  });
}
function drawHeartIcon(x, y, color) { drawMask(SHAPES.HEART, x, y, color || '#e83030'); }
function drawGemIcon(x, y, color) {
  ctx.fillStyle = color;
  const rows = [[3, 6], [1, 10], [0, 12], [1, 10], [2, 8], [3, 6], [4, 4], [5, 2]];
  rows.forEach(([off, w], j) => ctx.fillRect(x + off, y + j, w, 1));
}

/* ------------------------------ world ------------------------------ */
/* Interiors are 14x10; row 0/11 and col 0/15 borders are generated.
   Tiles: . grass  T tree  W water  R rock  S sand  P path
          F flower B bush  C cave   D sealed door                     */
const WORLD = {
  '0,0': { b: { n: 'R', s: 'T', e: 'R', w: 'R' }, shrine: 'color', rows: [
    'RRRRRRCCRRRRRR',
    'RR.........RRR',
    'R...F...F....R',
    'R............R',
    '......TT......',
    'R.....TT......',
    'R............R',
    'R..F......F..R',
    'RR...........R',
    'RRR..........R',
  ]},
  '1,0': { b: { n: 'R', s: 'T', e: 'R', w: 'R' }, shrine: 'sword', rows: [
    'RRRRRRDDRRRRRR',
    'RR..........RR',
    'R....F..F....R',
    'R............R',
    '.....PPPP.....',
    '.....PPPP.....',
    'R............R',
    'R..T......T..R',
    'RR..........RR',
    'R.....FF.....R',
  ]},
  '2,0': { b: { n: 'R', s: 'T', e: 'R', w: 'R' }, shrine: 'shape', rows: [
    'RRRRRRRCCRRRRR',
    'RRR.........RR',
    'R....F...F...R',
    'R............R',
    '..............',
    '......RR......',
    'R.....RR.....R',
    'R..F......F..R',
    'R............R',
    'RR...........R',
  ]},
  '0,1': { b: { n: 'T', s: 'T', e: 'T', w: 'T' }, rows: [
    'T....T....T..T',
    '..T.....B...T.',
    '....T..T......',
    '.T..........T.',
    '..............',
    '.....T..T.....',
    '.T...B........',
    '....T....T..T.',
    '.T..B....T....',
    '..T...........',
  ]},
  '1,1': { b: { n: 'T', s: 'T', e: 'T', w: 'T' }, rows: [
    '..T.........T.',
    '....F....F....',
    '..............',
    '......PP......',
    '..F...PP...F..',
    '......PP......',
    '..T...PP...T..',
    '....F....F....',
    '..B........B..',
    '..T.........T.',
  ]},
  '2,1': { b: { n: 'T', s: 'T', e: 'T', w: 'T' }, rows: [
    '..............',
    '....WWWWW.....',
    '...WWWWWWW....',
    '...WWWWWWW....',
    '..............',
    '......F.....B.',
    '...F......F...',
    '....WWWW......',
    '...WWWWWW...B.',
    '..............',
  ]},
  '0,2': { b: { n: 'T', s: 'W', e: 'T', w: 'W' }, shrine: 'letter', rows: [
    '..............',
    '...RRCCRR.....',
    '..............',
    '......F.......',
    'S.............',
    'SS........F...',
    'SSS...........',
    'SSSS....SSSSSS',
    'SSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSS',
  ]},
  '1,2': { b: { n: 'T', s: 'W', e: 'T', w: 'T' }, rows: [
    '..............',
    '...F......F...',
    '......B.......',
    '..T........T..',
    '..............',
    '..............',
    'S.....SS.....S',
    'SSS..SSSS..SSS',
    'SSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSS',
  ]},
  '2,2': { b: { n: 'T', s: 'W', e: 'R', w: 'T' }, shrine: 'number', rows: [
    '..............',
    '....RRCCRR....',
    '..............',
    '...F.....F....',
    '..............',
    '.........T....',
    '..T...........',
    '......F.......',
    '.....SSSS.....',
    '...SSSSSSSS...',
  ]},
};
const SOLID = { T: 1, W: 1, R: 1, B: 1, C: 1, D: 1, '#': 1 };

const screens = {};
function buildScreen(key) {
  const def = WORLD[key];
  const [sx, sy] = key.split(',').map(Number);
  const m = [];
  for (let y = 0; y < ROWS; y++) m.push(new Array(COLS).fill('.'));
  for (let y = 0; y < 10; y++) {
    const r = (def.rows[y] || '').padEnd(14, '.');
    for (let x = 0; x < 14; x++) m[y + 1][x + 1] = r[x];
  }
  for (let x = 0; x < COLS; x++) { m[0][x] = def.b.n; m[ROWS - 1][x] = def.b.s; }
  for (let y = 0; y < ROWS; y++) { m[y][0] = def.b.w; m[y][COLS - 1] = def.b.e; }
  if (WORLD[sx + ',' + (sy - 1)]) { m[0][7] = '.'; m[0][8] = '.'; }
  if (WORLD[sx + ',' + (sy + 1)]) { m[ROWS - 1][7] = '.'; m[ROWS - 1][8] = '.'; }
  if (WORLD[(sx - 1) + ',' + sy]) { m[5][0] = '.'; m[6][0] = '.'; }
  if (WORLD[(sx + 1) + ',' + sy]) { m[5][COLS - 1] = '.'; m[6][COLS - 1] = '.'; }
  if (key === '1,0' && save.doorOpen) {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
      if (m[y][x] === 'D') m[y][x] = 'C';
  }
  return m;
}
function getScreen(key) { return screens[key] || (screens[key] = buildScreen(key)); }

/* --------------------------- tile drawing -------------------------- */
function speck(px, py, seed) { return ((px * 7 + py * 13 + seed) % 5) === 0; }
function blob(px, py, widths, color) {
  ctx.fillStyle = color;
  widths.forEach((w, j) => ctx.fillRect(px + Math.floor((16 - w) / 2), py + j, w, 1));
}
function drawTile(ch, tx, ty) {
  const px = tx * TILE, py = ty * TILE + MY;
  // ground base
  ctx.fillStyle = (ch === 'S') ? '#ecd8a4' : (ch === 'P') ? '#d8b870' :
                  (ch === 'W') ? '#2068d8' : '#52a644';
  ctx.fillRect(px, py, TILE, TILE);
  switch (ch) {
    case '.':
      ctx.fillStyle = '#469838';
      for (let j = 2; j < 16; j += 5)
        for (let i = 2; i < 16; i += 5)
          if (speck(tx * 16 + i, ty * 16 + j, 3)) ctx.fillRect(px + i, py + j, 2, 1);
      break;
    case 'S':
      ctx.fillStyle = '#d8bc80';
      ctx.fillRect(px + 3, py + 4, 2, 1); ctx.fillRect(px + 10, py + 9, 2, 1);
      ctx.fillRect(px + 6, py + 13, 2, 1);
      break;
    case 'P':
      ctx.fillStyle = '#c0a058';
      ctx.fillRect(px + 2, py + 3, 2, 2); ctx.fillRect(px + 11, py + 10, 2, 2);
      break;
    case 'W': {
      ctx.fillStyle = '#78c8f8';
      const ph = (Math.floor(frame / 20) % 2) * 4;
      ctx.fillRect(px + 1 + ph, py + 4, 6, 1);
      ctx.fillRect(px + 7 - ph, py + 11, 6, 1);
      break;
    }
    case 'T':
      ctx.fillStyle = '#7a4612';
      ctx.fillRect(px + 6, py + 11, 4, 5);
      blob(px, py, [6, 10, 12, 14, 14, 14, 12, 12, 10, 8, 6], '#1b7c14');
      blob(px, py + 1, [4, 8, 10, 8], '#2f9c22');
      break;
    case 'R':
      blob(px, py + 2, [8, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14], '#9c7048');
      ctx.fillStyle = '#c89868';
      ctx.fillRect(px + 4, py + 4, 5, 3);
      ctx.fillStyle = '#5c3c18';
      ctx.fillRect(px + 1, py + 13, 14, 3);
      break;
    case 'B':
      blob(px, py + 4, [6, 10, 12, 12, 12, 12, 10, 8], '#2c8c24');
      blob(px, py + 5, [4, 8, 6], '#6cc84c');
      break;
    case 'F': {
      const fc = ((tx + ty) % 2) ? '#f05858' : '#f8d020';
      const bob = (Math.floor(frame / 30) % 2);
      ctx.fillStyle = fc;
      ctx.fillRect(px + 3, py + 4 + bob, 3, 3);
      ctx.fillRect(px + 10, py + 9 - bob, 3, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 4, py + 5 + bob, 1, 1);
      ctx.fillRect(px + 11, py + 10 - bob, 1, 1);
      break;
    }
    case 'C':
      blob(px, py, [10, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], '#9c7048');
      ctx.fillStyle = '#000';
      blob(px, py + 6, [6, 8, 10, 10, 10, 10, 10, 10, 10, 10], '#000');
      break;
    case 'D':
      blob(px, py, [10, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], '#9c7048');
      ctx.fillStyle = '#787878';
      ctx.fillRect(px + 4, py + 6, 8, 10);
      ctx.fillStyle = '#f8d020';
      ctx.fillRect(px + 6, py + 9, 4, 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + 7, py + 10, 2, 2);
      break;
  }
}

/* ------------------------------ player ----------------------------- */
const player = { x: 120, y: 96, dir: 'down', step: 0, swing: 0 };
let curKey = '1,1';
let mode = 'title';          // title | play | room | itemget | win
let dialog = null, trans = null, room = null;
let itemTimer = 0, winTimer = 0;
let bumpCool = 0;
let pickups = [], particles = [], butterflies = [];
let returnPos = null;
let feedback = null;         // {segs, t} small message in puzzle rooms

function spawnButterflies() {
  butterflies = [];
  for (let i = 0; i < 3; i++)
    butterflies.push({
      x: 30 + Math.random() * 190, y: 30 + Math.random() * 130,
      t: Math.random() * 100, c: ['#f8d020', '#f08858', '#b8a0f8'][i],
    });
}
spawnButterflies();

function tileAt(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return ' ';
  return (mode === 'room' ? room.map : getScreen(curKey))[ty][tx];
}
function solidEntityAt(x, y, w, h) {
  const ents = currentSolidEntities();
  for (const e of ents)
    if (x < e.x + e.w && x + w > e.x && y < e.y + e.h && y + h > e.y) return e;
  return null;
}
function currentSolidEntities() {
  if (mode === 'room') return room.solids;
  if (curKey === '1,1') return [{ x: 80, y: 80, w: 16, h: 16, kind: 'oldman' }];
  return [];
}
/* feet hitbox: x+3..x+12, y+8..y+15 */
function blockedTile(nx, ny) {
  const pts = [[nx + 3, ny + 8], [nx + 12, ny + 8], [nx + 3, ny + 15], [nx + 12, ny + 15]];
  for (const [qx, qy] of pts) {
    const ch = tileAt(qx, qy);
    if (SOLID[ch]) return ch;
  }
  return null;
}

function movePlayer() {
  if (player.swing > 0) { player.swing--; return; }
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (dx) player.dir = dx > 0 ? 'right' : 'left';
  else if (dy) player.dir = dy > 0 ? 'down' : 'up';
  if (dx || dy) player.step++;
  if (bumpCool > 0) bumpCool--;
  const sp = 1.5;

  // horizontal then vertical, sliding along walls
  for (const [mx, my] of [[dx * sp, 0], [0, dy * sp]]) {
    if (!mx && !my) continue;
    const nx = player.x + mx, ny = player.y + my;
    const ch = blockedTile(nx, ny);
    const ent = solidEntityAt(nx + 3, ny + 8, 10, 8);
    if (!ch && !ent) { player.x = nx; player.y = ny; }
    else if (bumpCool === 0) {
      bumpCool = 25;
      if (ent) onBumpEntity(ent);
      else onBumpTile(ch, nx, ny);
    }
  }
  player.x = Math.max(-4, Math.min(244, player.x));
  player.y = Math.max(-4, Math.min(180, player.y));

  if (mode === 'play') {
    if (player.x <= -4) startTrans(-1, 0);
    else if (player.x >= 244) startTrans(1, 0);
    else if (player.y <= -4) startTrans(0, -1);
    else if (player.y >= 180) startTrans(0, 1);
  } else if (mode === 'room' && player.y >= 178) {
    exitRoom();
  }

  // sword swing input
  if (consumeAction()) {
    if (save.sword && player.swing === 0) {
      player.swing = 14;
      sfx.cut();
      swingCheck();
    } else {
      // maybe talking to someone right in front
      const ent = entityAhead();
      if (ent) onBumpEntity(ent);
    }
  }

  // pickups
  pickups = pickups.filter(p => {
    if (Math.abs(p.x - player.x) < 12 && Math.abs(p.y - player.y) < 12) {
      sfx.heart();
      burst(p.x + 8, p.y + 8, '#f86868');
      return false;
    }
    return true;
  });

  // gem in puzzle room
  if (mode === 'room' && room.gem && !room.gem.taken) {
    if (Math.abs(room.gem.x - player.x) < 12 && Math.abs(room.gem.y - player.y) < 12)
      takeGem();
  }
}

function entityAhead() {
  const d = { up: [0, -10], down: [0, 10], left: [-10, 0], right: [10, 0] }[player.dir];
  return solidEntityAt(player.x + 3 + d[0], player.y + 8 + d[1], 10, 8);
}

function swingCheck() {
  if (mode !== 'play') return;
  const d = { up: [0, -12], down: [0, 14], left: [-12, 0], right: [14, 0] }[player.dir];
  const cx = player.x + 8 + d[0], cy = player.y + 11 + d[1];
  const tx = Math.floor(cx / TILE), ty = Math.floor(cy / TILE);
  const m = getScreen(curKey);
  if (ty >= 0 && ty < ROWS && tx >= 0 && tx < COLS && m[ty][tx] === 'B') {
    m[ty][tx] = '.';
    burst(tx * TILE + 8, ty * TILE + 8, '#6cc84c');
    if (Math.random() < 0.4) pickups.push({ x: tx * TILE, y: ty * TILE });
  }
}

function burst(x, y, color) {
  for (let i = 0; i < 10; i++)
    particles.push({
      x, y, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 2.4 - 0.6,
      t: 22 + Math.random() * 12, c: color,
    });
}
function updateParticles() {
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.05;
    return --p.t > 0;
  });
}

/* --------------------------- bump handlers -------------------------- */
function onBumpTile(ch, nx, ny) {
  if (ch === 'C') {
    if (mode !== 'play') return;
    const def = WORLD[curKey];
    if (def && def.shrine) enterRoom(def.shrine);
  } else if (ch === 'D') {
    if (gemCount() >= 4) {
      save.doorOpen = true; persist();
      const m = getScreen(curKey);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
        if (m[y][x] === 'D') m[y][x] = 'C';
      sfx.open();
      openDialog(['YOU HAVE ALL 4 GEMS! THE BIG DOOR IS OPENING!'],
        'You have all four gems! The big door is opening!');
    } else {
      sfx.bump();
      const need = 4 - gemCount();
      openDialog(
        ['THE DOOR IS LOCKED.', 'FIND ' + need + ' MORE MAGIC GEM' + (need > 1 ? 'S' : '') + ' IN THE CAVES!'],
        'The door is locked. Find ' + need + ' more magic ' + (need > 1 ? 'gems' : 'gem') + ' in the caves!');
    }
  } else {
    sfx.bump();
  }
}

function onBumpEntity(ent) {
  if (ent.kind === 'oldman') {
    const n = gemCount();
    if (save.sword)
      openDialog(['YOU ARE A TRUE HERO! GO PLAY AND CUT SOME BUSHES!'],
        'You are a true hero! Go play and cut some bushes!');
    else if (n === 0)
      openDialog(
        ['HELLO LITTLE HERO!',
         'FIND THE 4 MAGIC GEMS HIDDEN IN 4 CAVES.',
         'THEN THE BIG DOOR IN THE NORTH WILL OPEN, AND THE SWORD WILL BE YOURS!'],
        'Hello little hero! Find the four magic gems hidden in four caves. Then the big door in the north will open, and the sword will be yours!');
    else if (n < 4)
      openDialog(
        ['GREAT JOB! YOU HAVE ' + n + ' GEM' + (n > 1 ? 'S' : '') + '.',
         'FIND ' + (4 - n) + ' MORE!'],
        'Great job! You have ' + n + (n > 1 ? ' gems.' : ' gem.') + ' Find ' + (4 - n) + ' more!');
    else
      openDialog(['YOU HAVE ALL 4 GEMS! GO NORTH TO THE BIG DOOR!'],
        'You have all four gems! Go north to the big door!');
  } else if (ent.kind === 'wiseman') {
    openDialog(["IT'S DANGEROUS TO GO ALONE!", 'TAKE THIS!'],
      "It's dangerous to go alone! Take this!");
  } else if (ent.kind === 'sword') {
    startItemGet();
  } else if (ent.kind === 'pedestal') {
    answer(ent.idx);
  }
}

/* --------------------------- screen slide --------------------------- */
function startTrans(dx, dy) {
  const [sx, sy] = curKey.split(',').map(Number);
  const nk = (sx + dx) + ',' + (sy + dy);
  if (!WORLD[nk]) { // shouldn't happen: world edges are walled
    player.x = Math.max(0, Math.min(240, player.x));
    player.y = Math.max(0, Math.min(176, player.y));
    return;
  }
  let dest = { x: player.x, y: player.y };
  if (dx === 1) dest.x = 1; else if (dx === -1) dest.x = 239;
  if (dy === 1) dest.y = 1; else if (dy === -1) dest.y = 175;
  trans = { t: 0, dur: 26, dx, dy, oldKey: curKey, newKey: nk, dest };
  sfx.blip();
}
function updateTrans() {
  trans.t++;
  if (trans.t >= trans.dur) {
    curKey = trans.newKey;
    player.x = trans.dest.x; player.y = trans.dest.y;
    trans = null;
    pickups = []; particles = [];
    spawnButterflies();
  }
}

/* --------------------------- dialog boxes --------------------------- */
function wrap(s, width) {
  const words = s.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + (cur ? ' ' : '') + w).length > width) { lines.push(cur); cur = w; }
    else cur += (cur ? ' ' : '') + w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function openDialog(pages, speech, onClose) {
  dialog = { pages, page: 0, ci: 0, onClose: onClose || null };
  say(speech || pages.join(' '));
}
function updateDialog() {
  const text = dialog.pages[dialog.page];
  if (dialog.ci < text.length) {
    dialog.ci += 1;
    if (dialog.ci % 3 === 0) sfx.blip();
    if (consumeAction()) dialog.ci = text.length;
  } else if (consumeAction()) {
    dialog.page++;
    dialog.ci = 0;
    if (dialog.page >= dialog.pages.length) {
      const cb = dialog.onClose;
      dialog = null;
      bumpCool = 45;   // don't instantly re-trigger the same conversation
      if (cb) cb();
    }
  }
}
function renderDialog() {
  const text = dialog.pages[dialog.page].slice(0, dialog.ci);
  ctx.fillStyle = '#000';
  ctx.fillRect(8, 160, 240, 72);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.strokeRect(9, 161, 238, 70);
  const lines = wrap(text, 36);
  lines.slice(0, 4).forEach((ln, i) => drawText(ln, 16, 168 + i * 12, '#fff'));
  if (dialog.ci >= dialog.pages[dialog.page].length && Math.floor(frame / 20) % 2)
    drawText('-', 236, 218, '#f8d020', 1);
}

/* --------------------------- puzzle rooms --------------------------- */
const COLORS = [
  ['RED', '#f83800'], ['BLUE', '#3cbcfc'], ['YELLOW', '#f8d020'],
  ['GREEN', '#3fae34'], ['PURPLE', '#b868f8'], ['ORANGE', '#f88030'],
];
const SHAPE_NAMES = ['CIRCLE', 'SQUARE', 'TRIANGLE', 'STAR', 'HEART'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GEM_COLORS = { color: '#f83800', shape: '#3cbcfc', letter: '#f8d020', number: '#3fae34' };
const PRAISE = ['GREAT JOB!', 'YOU DID IT!', 'AWESOME!', 'SUPER!', 'WOW! AMAZING!'];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function buildRoomMap() {
  const m = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++)
      row.push((y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1) ? '#' : '.');
    m.push(row);
  }
  m[ROWS - 1][7] = '.'; m[ROWS - 1][8] = '.';   // exit gap
  return m;
}

function enterRoom(type) {
  sfx.enter();
  returnPos = { key: curKey, x: player.x, y: player.y + 4 };
  mode = 'room';
  room = {
    type,
    map: buildRoomMap(),
    solids: [],
    rounds: 0,
    need: 3,
    gem: null,
    cool: 0,
    sayTimer: 0,
  };
  player.x = 120; player.y = 152; player.dir = 'up';
  feedback = null;

  if (type === 'sword') {
    room.solids = [
      { x: 112, y: 44, w: 16, h: 16, kind: 'wiseman' },
      { x: 64, y: 44, w: 16, h: 16, kind: 'fire' },
      { x: 176, y: 44, w: 16, h: 16, kind: 'fire' },
      { x: 120, y: 92, w: 16, h: 16, kind: 'sword' },
    ];
    say("It's dangerous to go alone! Take this!");
  } else {
    [3, 6, 9, 12].forEach((tx, i) =>
      room.solids.push({ x: tx * TILE, y: 5 * TILE, w: 16, h: 16, kind: 'pedestal', idx: i }));
    newRound();
  }
}
function exitRoom() {
  mode = 'play';
  curKey = returnPos.key;
  player.x = returnPos.x; player.y = returnPos.y;
  player.dir = 'down';
  room = null; feedback = null;
  pickups = []; particles = [];
  spawnButterflies();
}

function newRound() {
  const r = room;
  r.cool = 0;
  if (r.type === 'color') {
    const opts = shuffle(COLORS.slice()).slice(0, 4);
    r.target = pick(opts);
    r.options = opts;
    r.prompt = [['TOUCH ', '#fff'], [r.target[0], r.target[1]], ['!', '#fff']];
    r.speech = 'Touch the ' + r.target[0].toLowerCase() + ' square!';
  } else if (r.type === 'shape') {
    const opts = shuffle(SHAPE_NAMES.slice()).slice(0, 4);
    r.target = pick(opts);
    r.options = opts;
    r.prompt = [['FIND THE ', '#fff'], [r.target, '#f8d020'], ['!', '#fff']];
    r.speech = 'Find the ' + r.target.toLowerCase() + '!';
  } else if (r.type === 'letter') {
    const opts = shuffle(LETTERS.split('')).slice(0, 4);
    r.target = pick(opts);
    r.options = opts;
    r.prompt = [['FIND THE LETTER ', '#fff'], [r.target, '#7cc8fc'], ['!', '#fff']];
    r.speech = 'Find the letter ' + r.target + '!';
  } else if (r.type === 'number') {
    r.count = 1 + Math.floor(Math.random() * 5);
    const opts = [r.count];
    while (opts.length < 4) {
      const n = 1 + Math.floor(Math.random() * 6);
      if (!opts.includes(n)) opts.push(n);
    }
    r.target = r.count;
    r.options = shuffle(opts);
    r.prompt = [['COUNT THE HEARTS!', '#fff']];
    r.speech = 'Count the hearts! How many hearts do you see?';
  }
  r.sayTimer = 0;
  say(r.speech);
}

function answer(idx) {
  const r = room;
  if (r.cool > 0 || r.gem) return;
  r.cool = 30;
  const chosen = r.options[idx];
  if (chosen === r.target) {
    sfx.right();
    burst(r.solids[idx].x + 8, r.solids[idx].y - 20, '#f8d020');
    r.rounds++;
    const praise = pick(PRAISE);
    feedback = { segs: [[praise, '#6cf86c']], t: 80 };
    if (r.rounds >= r.need) {
      feedback = null;
      say(pick(['Great job!', 'You did it!', 'Awesome!']));
      r.gem = { x: 120, y: 104, taken: false };
      setTimeout(() => say('You found the magic gem! Walk to it!'), 1200);
    } else {
      say(praise.toLowerCase().replace('!', '') + '!');
      setTimeout(() => { if (mode === 'room' && room === r && !r.gem) newRound(); }, 900);
    }
  } else {
    sfx.wrong();
    let name;
    if (r.type === 'color') name = 'THAT IS ' + chosen[0];
    else if (r.type === 'shape') name = 'THAT IS A ' + chosen;
    else if (r.type === 'letter') name = 'THAT IS THE LETTER ' + chosen;
    else name = 'THAT IS ' + chosen;
    feedback = { segs: [[name + '. TRY AGAIN!', '#f8a868']], t: 110 };
    let sp;
    if (r.type === 'color') sp = "That's " + chosen[0].toLowerCase() + '. ' + r.speech;
    else if (r.type === 'shape') sp = "That's a " + chosen.toLowerCase() + '. ' + r.speech;
    else if (r.type === 'letter') sp = "That's the letter " + chosen + '. ' + r.speech;
    else sp = "That's " + chosen + '. Count again! ' + r.speech;
    say(sp);
  }
}

function takeGem() {
  const r = room;
  r.gem.taken = true;
  sfx.gem();
  burst(r.gem.x + 8, r.gem.y + 8, GEM_COLORS[r.type]);
  const first = !save.gems[r.type];
  if (first) { save.gems[r.type] = true; persist(); }
  const n = gemCount();
  const colorName = { color: 'RED', shape: 'BLUE', letter: 'YELLOW', number: 'GREEN' }[r.type];
  if (first) {
    const msg = n >= 4
      ? ['YOU GOT THE ' + colorName + ' GEM!', 'YOU HAVE ALL 4 GEMS! GO NORTH TO THE BIG DOOR!']
      : ['YOU GOT THE ' + colorName + ' GEM!', 'YOU HAVE ' + n + ' OF 4 GEMS!'];
    const sp = n >= 4
      ? 'You got the ' + colorName.toLowerCase() + ' gem! You have all four gems! Go north to the big door!'
      : 'You got the ' + colorName.toLowerCase() + ' gem! You have ' + n + ' of 4 gems!';
    openDialog(msg, sp);
  } else {
    openDialog(['GREAT PRACTICE! YOU ARE SO SMART!'], 'Great practice! You are so smart!');
  }
}

/* ----------------------------- item get ----------------------------- */
function startItemGet() {
  if (save.sword) return;
  mode = 'itemget';
  itemTimer = 170;
  room.solids = room.solids.filter(e => e.kind !== 'sword');
  sfx.fanfare();
  say('You got the magic sword!');
}
function finishItemGet() {
  save.sword = true; persist();
  mode = 'room';
  openDialog(
    ['YOU GOT THE MAGIC SWORD!',
     'PRESS THE A BUTTON OR THE Z KEY TO SWING IT. YOU CAN CUT BUSHES!'],
    'You got the magic sword! Press the A button or the Z key to swing it. You can cut bushes!',
    () => {
      mode = 'win';
      winTimer = 360;
      for (let i = 0; i < 40; i++)
        particles.push({
          x: Math.random() * 256, y: Math.random() * 100 + 60,
          vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.5,
          t: 60 + Math.random() * 120,
          c: pick(['#f8d020', '#f83800', '#3cbcfc', '#6cf86c', '#fff']),
        });
      say('You did it! You are a real hero!');
    });
}

/* ------------------------------ render ------------------------------ */
function drawHUD() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, MY);
  drawText('-LIFE-', 14, 6, '#f86868');
  for (let i = 0; i < 3; i++) drawHeartIcon(12 + i * 14, 18, '#e83030');
  drawText('GEMS', 96, 6, '#7cc8fc');
  GEM_ORDER.forEach((k, i) => {
    drawGemIcon(94 + i * 16, 18, save.gems[k] ? GEM_COLORS[k] : '#404040');
  });
  if (save.sword) {
    drawText('SWORD', 96, 34, '#f8d020');
    ctx.drawImage(SWORD.up, 134, 28);
  }
  // minimap
  const mx = 200, my = 12;
  ctx.fillStyle = '#283828';
  ctx.fillRect(mx - 2, my - 2, 3 * 14 + 4, 3 * 8 + 4);
  for (let sy = 0; sy < 3; sy++)
    for (let sx = 0; sx < 3; sx++) {
      const key = sx + ',' + sy;
      ctx.fillStyle = WORLD[key].shrine ? '#6c8c5c' : '#48663e';
      ctx.fillRect(mx + sx * 14, my + sy * 8, 12, 6);
    }
  if (mode === 'play' && Math.floor(frame / 15) % 2) {
    const [sx, sy] = curKey.split(',').map(Number);
    ctx.fillStyle = '#6cf86c';
    ctx.fillRect(mx + sx * 14 + 4, my + sy * 8 + 1, 4, 4);
  }
}

function drawPlayer(ox, oy) {
  ox = ox || 0; oy = oy || 0;
  const moving = keys.up || keys.down || keys.left || keys.right;
  const f = (moving && player.swing === 0) ? Math.floor(player.step / 8) % 2 : 0;
  const img = HERO[player.dir][f];
  const px = Math.round(player.x + ox), py = Math.round(player.y + oy) + MY;
  if (player.swing > 0) {
    const d = { up: [0, -14], down: [0, 14], left: [-14, 0], right: [14, 0] }[player.dir];
    ctx.drawImage(SWORD[player.dir], px + d[0], py + d[1]);
  }
  ctx.drawImage(img, px, py);
}

function drawWorld() {
  const m = getScreen(curKey);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) drawTile(m[y][x], x, y);
  // old man on the start screen
  if (curKey === '1,1') ctx.drawImage(oldMan, 80, 80 + MY);
  // pickups (hearts from bushes)
  pickups.forEach(p => {
    const bob = Math.floor(frame / 15) % 2;
    drawHeartIcon(p.x + 2, p.y + 3 + bob + MY, '#e83030');
  });
  // butterflies
  butterflies.forEach(b => {
    b.t += 0.05;
    const bx = b.x + Math.sin(b.t) * 16, by = b.y + Math.sin(b.t * 1.7) * 10;
    ctx.fillStyle = b.c;
    const w = Math.floor(frame / 6) % 2;
    ctx.fillRect(bx - 1 - w, by + MY, 2, 2);
    ctx.fillRect(bx + 1 + w, by + MY, 2, 2);
  });
}

function drawRoom() {
  const r = room;
  // floor
  ctx.fillStyle = '#101028';
  ctx.fillRect(0, MY, 256, 192);
  ctx.fillStyle = '#181838';
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++)
      if ((x + y) % 2) ctx.fillRect(x * TILE, y * TILE + MY, TILE, TILE);
  // walls
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (r.map[y][x] !== '#') continue;
      const px = x * TILE, py = y * TILE + MY;
      ctx.fillStyle = '#3050c8';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#5078e8';
      ctx.fillRect(px + 1, py + 1, 14, 14);
      ctx.fillStyle = '#3050c8';
      ctx.fillRect(px + 3, py + 3, 10, 10);
    }
  // exit glow
  ctx.fillStyle = '#101028';
  ctx.fillRect(7 * TILE, 11 * TILE + MY, 32, 16);
  if (Math.floor(frame / 25) % 2) {
    ctx.fillStyle = '#283858';
    ctx.fillRect(7 * TILE + 4, 11 * TILE + MY + 6, 24, 4);
  }

  if (r.type === 'sword') {
    drawSegs([['THE HERO', '#f8d020'], ["'S CAVE", '#fff']], MY + 12, 1);
    // fires
    r.solids.forEach(e => {
      if (e.kind !== 'fire') return;
      const fl = Math.floor(frame / 8) % 2;
      blob(e.x, e.y + MY + 2 + fl, [4, 8, 10, 12, 12, 10, 8], '#f86820');
      blob(e.x, e.y + MY + 6 + fl, [4, 6, 6, 4], '#f8d020');
    });
    ctx.drawImage(oldMan, 112, 44 + MY);
    const sw = r.solids.find(e => e.kind === 'sword');
    if (sw) {
      ctx.fillStyle = '#787878';
      ctx.fillRect(sw.x + 1, sw.y + MY + 10, 14, 6);
      ctx.drawImage(SWORD.up, sw.x, sw.y + MY - 6);
      if (Math.floor(frame / 20) % 2) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(sw.x + 3, sw.y + MY - 4, 1, 1);
        ctx.fillRect(sw.x + 12, sw.y + MY + 2, 1, 1);
      }
    }
    return;
  }

  // prompt
  drawSegs(r.prompt, MY + 12, 1);
  // round progress dots
  for (let i = 0; i < r.need; i++) {
    ctx.fillStyle = i < r.rounds ? '#f8d020' : '#404060';
    ctx.fillRect(220 + i * 9, MY + 10, 6, 6);
  }
  // hearts to count
  if (r.type === 'number' && !r.gem) {
    const n = r.count, spacing = 18;
    const x0 = 128 - (n * spacing - 6) / 2;
    for (let i = 0; i < n; i++) {
      const bob = Math.floor((frame + i * 7) / 20) % 2;
      drawHeartIcon(x0 + i * spacing, MY + 36 + bob, '#f85878');
    }
  }
  // pedestals + answers
  r.solids.forEach(e => {
    if (e.kind !== 'pedestal') return;
    const px = e.x, py = e.y + MY;
    ctx.fillStyle = '#888';
    ctx.fillRect(px + 1, py + 4, 14, 12);
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(px + 1, py + 4, 14, 3);
    const opt = r.options[e.idx];
    const iy = py - 16;
    if (r.type === 'color') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 1, iy + 1, 14, 14);
      ctx.fillStyle = opt[1];
      ctx.fillRect(px + 2, iy + 2, 12, 12);
    } else if (r.type === 'shape') {
      drawMask(SHAPES[opt], px + 2, iy + 3, '#f8d020');
    } else if (r.type === 'letter') {
      drawText(opt, px + 3, iy + 1, '#fff', 2);
    } else {
      drawText(String(opt), px + 3, iy + 1, '#fff', 2);
    }
  });
  // gem reward
  if (r.gem && !r.gem.taken) {
    const bob = Math.floor(frame / 15) % 2;
    drawGemIcon(r.gem.x + 2, r.gem.y + MY + 4 + bob, GEM_COLORS[r.type]);
    if (Math.floor(frame / 10) % 2) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(r.gem.x, r.gem.y + MY, 2, 2);
      ctx.fillRect(r.gem.x + 14, r.gem.y + MY + 10, 2, 2);
    }
  }
  // feedback
  if (feedback) {
    drawSegs(feedback.segs, MY + 118, 1);
    if (--feedback.t <= 0) feedback = null;
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x), Math.round(p.y) + MY, 2, 2);
  });
}

function drawTransition() {
  const t = trans.t / trans.dur;
  const ox = -trans.dx * 256 * t, oy = -trans.dy * 192 * t;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, MY, 256, 192);
  ctx.clip();
  // old screen
  const om = getScreen(trans.oldKey);
  ctx.save(); ctx.translate(ox, oy);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) drawTile(om[y][x], x, y);
  ctx.restore();
  // new screen
  const nm = getScreen(trans.newKey);
  ctx.save(); ctx.translate(ox + trans.dx * 256, oy + trans.dy * 192);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) drawTile(nm[y][x], x, y);
  // player slides in with the new screen
  const f = Math.floor(frame / 8) % 2;
  ctx.drawImage(HERO[player.dir][f], Math.round(trans.dest.x), Math.round(trans.dest.y) + MY);
  ctx.restore();
  ctx.restore();
}

function drawTitle() {
  ctx.fillStyle = '#080818';
  ctx.fillRect(0, 0, 256, 240);
  // triforce-ish triangles
  const ty = 36, s = 14;
  ctx.fillStyle = '#f8d020';
  for (let j = 0; j < s; j++) {
    const w = Math.floor((j / s) * s) * 2 + 2;
    ctx.fillRect(128 - w / 2, ty + j, w, 1);             // top
    ctx.fillRect(128 - s - w / 2, ty + s + j, w, 1);     // bottom-left
    ctx.fillRect(128 + s - w / 2, ty + s + j, w, 1);     // bottom-right
  }
  drawTextC('SWORD QUEST', 80, '#f8d020', 2);
  drawTextC('A LITTLE HERO ADVENTURE', 104, '#7cc8fc', 1);
  ctx.drawImage(HERO.down[Math.floor(frame / 20) % 2], 104, 124);
  ctx.drawImage(SWORD.up, 130, 122);
  const hasSave = gemCount() > 0 || save.sword;
  if (Math.floor(frame / 25) % 2)
    drawTextC(hasSave ? 'TAP OR PRESS A KEY TO CONTINUE' : 'TAP OR PRESS ANY KEY', 170, '#fff', 1);
  drawTextC('COLORS - SHAPES - LETTERS - NUMBERS', 200, '#6cf86c', 1);
  drawTextC('MADE FOR BRAVE LITTLE HEROES', 214, '#888', 1);
}

function drawWin() {
  ctx.fillStyle = 'rgba(0,0,16,0.75)';
  ctx.fillRect(0, 0, 256, 240);
  drawParticles();
  drawTextC('YOU DID IT!', 84, '#f8d020', 3);
  drawTextC('YOU ARE A REAL HERO!', 130, '#fff', 1);
  drawTextC('KEEP EXPLORING AND HAVE FUN!', 150, '#6cf86c', 1);
}

function drawItemGet() {
  drawRoom();
  const px = Math.round(player.x), py = Math.round(player.y) + MY;
  ctx.drawImage(HERO.down[0], px, py);
  ctx.drawImage(SWORD.up, px, py - 16);
  // radiant sparkles
  if (Math.floor(frame / 6) % 2) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 6, py - 12, 2, 2);
    ctx.fillRect(px + 20, py - 8, 2, 2);
    ctx.fillRect(px + 8, py - 24, 2, 2);
  }
  drawTextC('YOU GOT THE MAGIC SWORD!', MY + 150, '#f8d020', 1);
}

/* ---------------------------- main loop ----------------------------- */
function startGame() {
  audioOn();
  mode = 'play';
  if (gemCount() === 0 && !save.sword) {
    openDialog(
      ['HELLO LITTLE HERO! I AM THE WISE MAN.',
       'FIND THE 4 MAGIC GEMS HIDDEN IN 4 CAVES, AND THE MAGIC SWORD WILL BE YOURS!',
       'WALK WITH THE ARROWS OR THE GRAY BUTTONS. GOOD LUCK!'],
      'Hello little hero! I am the wise man. Find the four magic gems hidden in four caves, and the magic sword will be yours! Walk with the arrows or the gray buttons. Good luck!');
  }
}

function update() {
  frame++;
  if (mode === 'title') { if (consumeAny()) startGame(); return; }
  if (dialog) { updateDialog(); updateParticles(); return; }
  if (trans) { updateTrans(); return; }
  if (mode === 'itemget') {
    if (--itemTimer <= 0) finishItemGet();
    return;
  }
  if (mode === 'win') {
    updateParticles();
    if (--winTimer <= 0 || consumeAction()) { mode = 'room'; particles = []; }
    return;
  }
  if (mode === 'play' || mode === 'room') {
    movePlayer();
    if (room && room.cool > 0) room.cool--;
    if (room && room.type !== 'sword' && !room.gem) {
      room.sayTimer++;
      if (room.sayTimer > 700) { room.sayTimer = 0; say(room.speech); }
    }
    updateParticles();
  }
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 240);
  if (mode === 'title') { drawTitle(); return; }
  drawHUD();
  if (trans) { drawTransition(); return; }
  if (mode === 'itemget') { drawItemGet(); return; }
  if (mode === 'play') { drawWorld(); drawPlayer(); drawParticles(); }
  else if (mode === 'room' || mode === 'win') { drawRoom(); drawPlayer(); drawParticles(); }
  if (mode === 'win') drawWin();
  if (dialog) renderDialog();
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}
loop();
