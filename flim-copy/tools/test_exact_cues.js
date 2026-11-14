const fs = require('fs');
global.window = {};
require('../audio/vo/words.js');

const norm = s => s.toLowerCase().replace(/[^a-z0-9']/g, '');
const W = window.VOW.map(w => ({ w: norm(w.word) }));
const idx = (phrase, k = 0) => {
  const p = phrase.split(/\s+/).map(norm); let n = 0;
  for (let i = 0; i + p.length <= W.length; i++) {
    if (p.every((s, j) => W[i + j].w === s) && n++ === k) return i;
  }
  throw new Error('cue not found: ' + phrase);
};

const code = fs.readFileSync('./film.js', 'utf8');

// Match F('...') or F("...")
const doubleQuoted = [...code.matchAll(/F\s*\(\s*"([^"]+)"(?:\s*,\s*(\d+))?\s*\)/g)].map(m => ({ text: m[1], k: m[2] ? parseInt(m[2]) : 0 }));
const singleQuoted = [...code.matchAll(/F\s*\(\s*'([^']+)'(?:\s*,\s*(\d+))?\s*\)/g)].map(m => ({ text: m[1], k: m[2] ? parseInt(m[2]) : 0 }));

// Match say(sel, "...") or say(sel, '...')
const sayDouble = [...code.matchAll(/say\s*\(\s*[^,]+,\s*"([^"]+)"(?:\s*,\s*(\d+))?\s*\)/g)].map(m => ({ text: m[1], k: m[2] ? parseInt(m[2]) : 0 }));
const saySingle = [...code.matchAll(/say\s*\(\s*[^,]+,\s*'([^']+)'(?:\s*,\s*(\d+))?\s*\)/g)].map(m => ({ text: m[1], k: m[2] ? parseInt(m[2]) : 0 }));

const allCues = [...doubleQuoted, ...singleQuoted, ...sayDouble, ...saySingle];

console.log('Testing', allCues.length, 'cues...');
const failed = [];
for (const c of allCues) {
  try {
    idx(c.text, c.k);
  } catch (e) {
    failed.push(c);
  }
}

if (failed.length === 0) {
  console.log('ALL CUES PASSED PERFECTLY!');
} else {
  console.log('FAILED CUES:');
  failed.forEach(f => console.log(' ', f.text, '(k=' + f.k + ')'));
}

