// Tiny PDF writer for tests: one page per entry, each a list of [x, y, text] lines in Helvetica 10 pt (A4, y from the top).
// Only what the research harness tests need; real datasheets come from the web or the owner's uploads.
export function makePdf(pages) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pagesId = objs.length + 1 + pages.length * 2; // filled after the page objects
  const kids = [];
  for (const lines of pages) {
    const ops = lines.map(([x, y, t]) => `BT /F1 10 Tf ${x} ${842 - y} Td (${esc(t)}) Tj ET`).join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\nstream\n${ops}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((b, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${b}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
