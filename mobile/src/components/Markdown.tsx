import { memo, useMemo, type ReactNode } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { C } from '../lib/theme';

type Block = { t: 'p' | 'h' | 'ul' | 'ol' | 'code' | 'quote' | 'hr'; text?: string; items?: string[]; level?: number };

function blocks(src: string): Block[] {
  const out: Block[] = []; const lines = src.replace(/\r/g, '').split('\n'); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const code: string[] = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; out.push({ t: 'code', text: code.join('\n') }); continue; }
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l); if (h) { out.push({ t: 'h', text: h[2], level: h[1].length }); i++; continue; }
    if (/^\s*([-*+])\s+/.test(l)) { const items: string[] = []; while (i < lines.length && /^\s*([-*+])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, '')); out.push({ t: 'ul', items }); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const items: string[] = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, '')); out.push({ t: 'ol', items }); continue; }
    if (/^>\s?/.test(l)) { const q: string[] = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); out.push({ t: 'quote', text: q.join('\n') }); continue; }
    if (/^---+$/.test(l.trim())) { out.push({ t: 'hr' }); i++; continue; }
    if (/^\|.*\|$/.test(l.trim())) { const rows: string[] = []; while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(lines[i++]); out.push({ t: 'code', text: rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r.trim())).map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join('   |   ')).join('\n') }); continue; }
    const p: string[] = []; while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*[-*+]\s|\s*\d+[.)]\s|>|\|)/.test(lines[i])) p.push(lines[i++]); out.push({ t: 'p', text: p.join(' ') });
  }
  return out;
}

function inline(s: string, key = ''): ReactNode[] {
  const nodes: ReactNode[] = []; const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g; let last = 0, m: RegExpExecArray | null, n = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) nodes.push(s.slice(last, m.index));
    const tok = m[0]; const k = `${key}${n++}`;
    if (tok.startsWith('**')) nodes.push(<Text key={k} style={{ fontWeight: '700' }}>{inline(tok.slice(2, -2), k)}</Text>);
    else if (tok.startsWith('`')) nodes.push(<Text key={k} style={{ fontFamily: 'monospace', backgroundColor: C.soft, fontSize: 13.5 }}>{tok.slice(1, -1)}</Text>);
    else if (tok.startsWith('[')) { const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!; nodes.push(<Text key={k} style={{ color: C.brandDeep, textDecorationLine: 'underline' }} onPress={() => { if (/^https?:/.test(lm[2])) void Linking.openURL(lm[2]); }}>{lm[1]}</Text>); }
    else nodes.push(<Text key={k} style={{ fontStyle: 'italic' }}>{inline(tok.slice(1, -1), k)}</Text>);
    last = m.index + tok.length;
  }
  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}

/** Small, dependency-free Markdown renderer for chat replies. Only produces Text and View, never HTML. */
export const Markdown = memo(function Markdown({ text, color = C.ink }: { text: string; color?: string }) {
  const bs = useMemo(() => blocks(text), [text]);
  const base = { fontSize: 15, lineHeight: 22, color } as const;
  return (
    <View style={{ gap: 8 }}>
      {bs.map((b, i) => {
        if (b.t === 'h') return <Text key={i} style={{ ...base, fontWeight: '800', fontSize: b.level === 1 ? 20 : b.level === 2 ? 18 : 16, marginTop: 4 }}>{inline(b.text!, `h${i}`)}</Text>;
        if (b.t === 'code') return <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#1F1B2B', borderRadius: 12 }} contentContainerStyle={{ padding: 12 }}><Text selectable style={{ fontFamily: 'monospace', fontSize: 12.5, lineHeight: 18, color: '#EDE9FF' }}>{b.text}</Text></ScrollView>;
        if (b.t === 'quote') return <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: C.brand, paddingLeft: 10 }}><Text style={{ ...base, color: C.ink2 }}>{inline(b.text!, `q${i}`)}</Text></View>;
        if (b.t === 'hr') return <View key={i} style={{ height: 1, backgroundColor: C.line }} />;
        if (b.t === 'ul' || b.t === 'ol') return (
          <View key={i} style={{ gap: 4 }}>{b.items!.map((it, j) => (
            <View key={j} style={{ flexDirection: 'row', gap: 8 }}><Text style={{ ...base, width: 20, color: C.brandDeep, fontWeight: '700' }}>{b.t === 'ol' ? `${j + 1}.` : '-'}</Text><Text style={{ ...base, flex: 1 }}>{inline(it, `l${i}${j}`)}</Text></View>))}</View>);
        return <Text key={i} selectable style={base}>{inline(b.text!, `p${i}`)}</Text>;
      })}
    </View>
  );
});
