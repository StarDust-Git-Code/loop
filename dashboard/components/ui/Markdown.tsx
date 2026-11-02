'use client';
import type { ReactNode } from 'react';
import s from './markdown.module.css';

/** Small, safe Markdown renderer (no HTML injection: everything becomes React elements). Tolerates half-streamed text. */

const SAFE = /^(https?:\/\/|mailto:)/i;

function inline(src: string, k = 'i'): ReactNode[] {
  const out: ReactNode[] = []; let rest = src; let n = 0;
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)|(~~[^~\n]+?~~)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>)]+)/;
  while (rest) {
    const m = re.exec(rest);
    if (!m) { out.push(rest); break; }
    if (m.index) out.push(rest.slice(0, m.index));
    const t = m[0]; const key = `${k}${n++}`;
    if (m[1]) out.push(<code key={key} className={s.code}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{inline(t.slice(2, -2), key)}</strong>);
    else if (m[3]) out.push(<em key={key}>{inline(t.slice(1, -1), key)}</em>);
    else if (m[4]) out.push(<del key={key}>{inline(t.slice(2, -2), key)}</del>);
    else if (m[5]) { const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)!; out.push(SAFE.test(mm[2]) ? <a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer">{inline(mm[1], key)}</a> : mm[1]); }
    else out.push(<a key={key} href={t} target="_blank" rel="noopener noreferrer">{t}</a>);
    rest = rest.slice(m.index + t.length);
  }
  return out;
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');
const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = []; let i = 0; let key = 0;
  const K = () => `b${key++}`;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^\s*(```|~~~)\s*([\w+-]*)/.exec(line);
    if (fence) { // code block (an unclosed fence, e.g. while streaming, runs to the end)
      const body: string[] = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      blocks.push(<pre key={K()} className={s.pre}>{fence[2] && <span className={s.lang}>{fence[2]}</span>}<code>{body.join('\n')}</code></pre>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { const L = h[1].length; blocks.push(<div key={K()} role="heading" aria-level={L} className={`${s.h} ${s[`h${Math.min(L, 4)}`]}`}>{inline(h[2])}</div>); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push(<hr key={K()} className={s.hr} />); i++; continue; }
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line); const rows: string[][] = []; i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(<div key={K()} className={s.tableWrap}><table className={s.table}><thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead><tbody>{rows.map((r, a) => <tr key={a}>{head.map((_, j) => <td key={j}>{inline(r[j] ?? '')}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(<blockquote key={K()} className={s.quote}>{inline(q.join(' '))}</blockquote>);
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = /\d/.test(li[2]); const items: { depth: number; text: string }[] = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (m) { items.push({ depth: Math.min(2, Math.floor(m[1].length / 2)), text: m[3] }); i++; }
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += ` ${lines[i].trim()}`; i++; }
        else break;
      }
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(<Tag key={K()} className={s.list}>{items.map((it, a) => <li key={a} style={{ marginLeft: it.depth * 18 }}>{inline(it.text)}</li>)}</Tag>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>\s?|([-*+]|\d+[.)])\s)/.test(lines[i]) && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) { para.push(lines[i++]); }
    blocks.push(<p key={K()} className={s.p}>{para.map((p, a) => <span key={a}>{a > 0 && <br />}{inline(p)}</span>)}</p>);
  }
  return <div className={`${s.md} ${className ?? ''}`}>{blocks}</div>;
}
