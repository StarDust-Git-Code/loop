import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Markdown } from '../../components/Markdown';
import { Avatar, Chip, ErrorNote, Icon, Press } from '../../components/ui';
import { api, sendStream } from '../../lib/api';
import { MATE_DEFS, mateName, type MateKey } from '../../lib/mates';
import { C, R } from '../../lib/theme';
import type { ChatEvent, Conversation, Message } from '../../lib/types';

type Seg = { key: string; mate: MateKey; text: string; thought: string; tools: string[]; round?: number; summary?: boolean };
type Row = { key: string; kind: 'msg'; m: Message } | { key: string; kind: 'live'; s: Seg } | { key: string; kind: 'round'; n: number };
const MODES = ['chat', 'plan', 'ultracode', 'brainstorm'] as const;
const THINK = ['default', 'low', 'high'];
const TOOL_LABEL = (n: string) => n.replace(/_/g, ' ');

const Thought = memo(function Thought({ text, live, answering }: { text: string; live?: boolean; answering?: boolean }) {
  const [manual, setManual] = useState<boolean | null>(null);
  const thinking = !!live && !answering; const open = manual ?? thinking;
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Press onPress={() => setManual(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: thinking ? C.tint : C.soft, borderRadius: 999, paddingHorizontal: 12, minHeight: 32 }}>
        <Text style={{ color: C.brandDeep, fontWeight: '800', fontSize: 12.5 }}>{thinking ? 'Thinking…' : 'Thought process'}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Icon name="chevron" size={12} color={C.brandDeep} stroke={2.4} /></View>
      </Press>
      {open ? <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 19, color: C.muted, fontStyle: 'italic' }}>{text}</Text> : null}
    </View>);
});

const MateBubble = memo(function MateBubble({ mate, text, thought, tools, live, summary, onSave }: { mate: MateKey; text: string; thought?: string; tools?: string[]; live?: boolean; summary?: boolean; onSave?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, maxWidth: '96%' }}>
      <View style={{ alignSelf: 'flex-start' }}><Avatar k={mate} size={34} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '800', marginBottom: 5, color: C.ink }}>{mateName(mate)}{summary ? ' · Round-table summary' : ''}</Text>
        {thought ? <Thought text={thought} live={live} answering={!!text} /> : null}
        {tools?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>{tools.map((t, i) => <Text key={i} style={{ fontFamily: 'monospace', fontSize: 11.5, backgroundColor: C.tint, color: C.brandDeep, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' }}>{TOOL_LABEL(t)}</Text>)}</View> : null}
        <View style={summary ? { marginTop: 6, backgroundColor: C.tint2, borderWidth: 1, borderColor: 'rgba(106,77,244,0.3)', borderRadius: R.lg, padding: 12 } : { marginTop: 6 }}>
          {text ? <Markdown text={text} /> : live ? <Text style={{ color: C.muted }}>…</Text> : null}
          {summary && onSave ? <Press onPress={onSave} style={{ marginTop: 10, alignSelf: 'flex-start', minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(106,77,244,0.4)', backgroundColor: '#fff', paddingHorizontal: 14, justifyContent: 'center' }}><Text style={{ color: C.brandDeep, fontWeight: '800', fontSize: 13 }}>Save to memory</Text></Press> : null}
        </View>
      </View>
    </View>);
});

const UserBubble = memo(function UserBubble({ m }: { m: Message }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '84%' }}>
      <View style={{ backgroundColor: C.tint, borderWidth: 1, borderColor: 'rgba(106,77,244,0.25)', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 11 }}>
        <Text selectable style={{ fontSize: 14.5, lineHeight: 21, color: C.ink }}>{m.text}</Text></View>
      <Text style={{ fontSize: 11.5, color: C.muted, textAlign: 'right', marginTop: 3 }}>{m.state === 'error' ? 'Not sent' : new Date(m.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text>
    </View>);
});

const RoundMark = ({ n }: { n: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(106,77,244,0.25)' }} /><Text style={{ color: C.brandDeep, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ROUND {n}</Text><View style={{ flex: 1, height: 1, backgroundColor: 'rgba(106,77,244,0.25)' }} /></View>);

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const insets = useSafeAreaInsets();
  const [conv, setConv] = useState<Conversation | null>(null); const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState(''); const [segs, setSegs] = useState<Seg[] | null>(null); const [toast, setToast] = useState<string | null>(null);
  const abort = useRef<(() => void) | null>(null); const round = useRef<number | undefined>(undefined);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const load = useCallback(async () => { try { setConv(await api.conversations.get(id)); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load this chat'); } }, [id]);
  useEffect(() => { void load(); return () => abort.current?.(); }, [load]);

  const patch = async (b: Partial<Conversation>) => { setConv((c) => c && { ...c, ...b }); try { await api.conversations.patch(id, b); } catch { flash('Could not save that'); } };
  const mate = (conv?.mate ?? 'planner') as MateKey;
  const mode = conv?.mode ?? 'chat';
  const mention = /(?:^|\s)@(\w*)$/.exec(text);
  const suggestions = mention ? MATE_DEFS.filter((m) => m.key.startsWith(mention[1].toLowerCase()) || m.name.toLowerCase().startsWith(mention[1].toLowerCase())).slice(0, 8) : [];

  const send = async () => {
    const t = text.trim(); if (!t || !conv || segs) return;
    setText(''); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const optimistic: Message = { id: `tmp${Date.now()}`, role: 'user', text: t, at: new Date().toISOString(), state: 'sent' };
    setConv((c) => c && { ...c, messages: [...c.messages, optimistic] });
    if (conv.messages.length === 0) void api.conversations.patch(id, { title: t.slice(0, 42) }).catch(() => undefined);
    round.current = undefined;
    setSegs([{ key: 's0', mate, text: '', thought: '', tools: [] }]);
    const fin = async (e?: string) => { abort.current = null; setSegs(null); if (e) flash(e); await load(); };
    abort.current = sendStream(id, t, mate, (ev: ChatEvent) => setSegs((p) => {
      if (!p) return p; const next = p.map((s) => ({ ...s })); const cur = next[next.length - 1];
      switch (ev.type) {
        case 'round': round.current = ev.n; break;
        case 'mate': if (cur.text || cur.thought || cur.tools.length) next.push({ key: `s${next.length}`, mate: ev.mate, text: '', thought: '', tools: [], round: round.current, summary: ev.summary }); else { cur.mate = ev.mate; cur.round = round.current; cur.summary = ev.summary; } break;
        case 'delta': cur.text += ev.text; break;
        case 'think': cur.thought += ev.text; break;
        case 'reset': cur.text = ''; break;
        case 'tool': cur.text = ''; cur.tools = [...cur.tools, ev.name]; break;
      }
      return next;
    }), (e) => void fin(e));
  };
  const stop = () => { abort.current?.(); abort.current = null; setSegs(null); void load(); };

  const attach = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (r.canceled || !r.assets[0]) return; const f = r.assets[0];
      const texty = /^text\//.test(f.mimeType ?? '') || /\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css|yml|yaml|xml|log|sql|c|cpp|h|ino|java|go|rs|sh|toml|ini)$/i.test(f.name);
      if (!texty) return flash('Only text and code files can be attached for now.');
      if ((f.size ?? 0) > 60_000) return flash('That file is over 60 KB. Attach a smaller one.');
      const body = await (await fetch(f.uri)).text();
      setText((t) => `${t}${t ? '\n\n' : ''}File: ${f.name}\n\`\`\`\n${body}\n\`\`\`\n`);
    } catch { flash('Could not read that file.'); }
  };
  const saveMemory = async (m: string) => { try { await api.memories.create({ kind: 'decision', text: m.slice(0, 1500), scope: 'private' }); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); flash('Saved to memory'); } catch { flash('Could not save'); } };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []; let lastRound: number | undefined;
    for (const m of conv?.messages ?? []) {
      if (m.round && m.round !== lastRound) { out.push({ key: `r${m.id}`, kind: 'round', n: m.round }); lastRound = m.round; }
      out.push({ key: m.id, kind: 'msg', m });
    }
    for (const s of segs ?? []) { if (s.round && s.round !== lastRound) { out.push({ key: `rl${s.key}`, kind: 'round', n: s.round }); lastRound = s.round; } out.push({ key: `l${s.key}`, kind: 'live', s }); }
    return out.reverse();
  }, [conv, segs]);

  const members = (conv?.members ?? []).filter(Boolean);
  const subtitle = [members.length ? members.map((k) => MATE_DEFS.find((d) => d.key === k)?.name ?? k).join(', ') : mateName(mate), mode !== 'chat' ? mode[0].toUpperCase() + mode.slice(1) : ''].filter(Boolean).join(' · ');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Press onPress={() => router.back()} accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} /></Press>
        <Avatar k={mate} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{conv?.title ?? 'Chat'}</Text><Text numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{subtitle}</Text></View>
        <Press onPress={() => router.push({ pathname: '/call', params: { mate, conv: id } })} accessibilityLabel={`Call ${mateName(mate)}`} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={20} color="#fff" /></Press>
      </View>

      <FlatList inverted data={rows} keyExtractor={(r) => r.key} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 14 }} initialNumToRender={12} windowSize={9} removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={<View>{err ? <ErrorNote message={err} onRetry={load} /> : null}</View>}
        ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }], alignItems: 'center', padding: 40, gap: 10 }}><Avatar k={mate} size={72} /><Text style={{ color: C.muted, textAlign: 'center' }}>Say hello to {mateName(mate)}.{'\n'}Use @ to bring in more agents.</Text></View>}
        renderItem={({ item }) => item.kind === 'round' ? <RoundMark n={item.n} /> : item.kind === 'live' ? (
          <MateBubble mate={item.s.mate} text={item.s.text} thought={item.s.thought} tools={item.s.tools} live summary={item.s.summary} />
        ) : item.m.role === 'user' ? (
          <Animated.View entering={FadeInDown.duration(160)}><UserBubble m={item.m} /></Animated.View>
        ) : (
          <MateBubble mate={(item.m.mate ?? mate) as MateKey} text={item.m.text} thought={item.m.thought} summary={item.m.summary} onSave={item.m.summary ? () => saveMemory(item.m.text) : undefined} />
        )} />

      {toast ? <Animated.View entering={FadeInDown} style={{ position: 'absolute', alignSelf: 'center', bottom: 150, backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 }}><Text style={{ color: '#fff', fontSize: 13.5 }}>{toast}</Text></Animated.View> : null}

      <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) }}>
        {suggestions.length > 0 ? <FlatList horizontal keyboardShouldPersistTaps="handled" data={suggestions} keyExtractor={(m) => m.key} showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}
          renderItem={({ item }) => <Chip label={`@${item.key}`} onPress={() => setText((t) => t.replace(/@\w*$/, `@${item.key} `))} />} /> : null}
        <FlatList horizontal data={[...MODES]} keyExtractor={(m) => m} showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <Chip label={item[0].toUpperCase() + item.slice(1)} on={mode === item} onPress={() => patch({ mode: item })} />}
          ListFooterComponent={<View style={{ marginLeft: 6 }}><Chip label={`Thinking: ${conv?.thinking ?? 'default'}`} onPress={() => patch({ thinking: THINK[(THINK.indexOf(conv?.thinking ?? 'default') + 1) % THINK.length] })} /></View>} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderColor: C.line2, borderRadius: 18, padding: 6 }}>
          <Press onPress={attach} accessibilityLabel="Attach a file" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F1F8', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={20} /></Press>
          <TextInput value={text} onChangeText={setText} multiline placeholder={mode === 'brainstorm' ? 'Give the table a topic, and @ two or more agents' : `Message ${mateName(mate)}`} placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 44, maxHeight: 140, fontSize: 15, paddingTop: 10, paddingBottom: 10, color: C.ink }} accessibilityLabel="Message" />
          {segs ? <Press onPress={stop} accessibilityLabel="Stop" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 14, height: 14, backgroundColor: '#fff', borderRadius: 3 }} /></Press>
            : <Press onPress={send} disabled={!text.trim()} accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.45 }}><Icon name="send" size={20} color="#fff" /></Press>}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
