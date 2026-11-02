/** Tiny natural-language time parser for "Gym tomorrow at 6am", "Call Sam friday 14:30". No AI, no network. */
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export function parseWhen(input: string, base = new Date()): { title: string; start: Date; end: Date; understood: boolean } {
  let t = ` ${input.trim()} `; const d = new Date(base); d.setSeconds(0, 0); let understood = false; let hour = 9, min = 0, timed = false;
  const day = t.match(/\b(today|tomorrow|tonight)\b/i) ?? t.match(new RegExp(`\\b(${DOW.join('|')}|${DOW.map((x) => x.slice(0, 3)).join('|')})\\b`, 'i'));
  if (day) {
    const w = day[1].toLowerCase(); understood = true; t = t.replace(day[0], ' ');
    if (w === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (w === 'tonight') { hour = 20; timed = true; }
    else if (w !== 'today') { const i = DOW.findIndex((x) => x.startsWith(w.slice(0, 3))); let add = (i - d.getDay() + 7) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add); }
  }
  const tm = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ?? t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i) ?? t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (tm) {
    hour = +tm[1]; min = tm[2] ? +tm[2] : 0; const ap = tm[3]?.toLowerCase(); if (ap === 'pm' && hour < 12) hour += 12; if (ap === 'am' && hour === 12) hour = 0;
    if (hour <= 23) { timed = true; understood = true; t = t.replace(tm[0], ' '); }
  }
  d.setHours(hour, min, 0, 0);
  if (!day && timed && d < base) d.setDate(d.getDate() + 1);
  const title = t.replace(/\s+/g, ' ').replace(/\b(on|at)\s*$/i, '').trim() || input.trim();
  return { title: title.charAt(0).toUpperCase() + title.slice(1), start: d, end: new Date(d.getTime() + 36e5), understood };
}
