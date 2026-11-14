const fs = require('fs');
global.window = {};
require('../audio/vo/words.js');

const norm = s => s.toLowerCase().replace(/[^a-z0-9']/g, '');
const W = window.VOW.map(w => ({ w: norm(w.word), start: w.start, end: w.end }));
const idx = (phrase, k = 0) => {
  const p = phrase.split(/\s+/).map(norm); let n = 0;
  for (let i = 0; i + p.length <= W.length; i++) {
    if (p.every((s, j) => W[i + j].w === s) && n++ === k) return i;
  }
  throw new Error('cue not found in the voice-over: ' + phrase);
};

const code = fs.readFileSync('./film.js', 'utf8');
const regex = /(?:F|say)\s*\(\s*(?:[^,\(\)]+,\s*)?['"]([^'"]+)['"]/g;
let m;
const missing = [];
while ((m = regex.exec(code)) !== null) {
  const phrase = m[1];
  try {
    idx(phrase);
  } catch (e) {
    if (!missing.includes(phrase)) missing.push(phrase);
  }
}

console.log('Total words:', W.length);
console.log('Missing cues count:', missing.length);
if (missing.length) {
  console.log('Missing phrases:');
  missing.forEach(p => console.log(' -', p));
}

