import { useMemo, useState } from 'react';
import { FlatList, Modal, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Caption, Chip, Empty, ErrorNote, Press, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { ago, useList } from '../../lib/hooks';
import { C, R } from '../../lib/theme';
import type { Memory } from '../../lib/types';

const KINDS: [string, string[]][] = [['All', []], ['Notes', ['note', 'journal', 'link']], ['Ideas', ['idea']], ['Decisions', ['decision']], ['Facts', ['fact']]];
const BADGE: Record<string, [string, string]> = { decision: [C.brandDeep, C.tint], idea: ['#0B5E4A', '#D6F3EA'], fact: [C.ink2, '#EEECF3'], note: ['#7A4A00', '#FFEBC8'], journal: ['#7A4A00', '#FFEBC8'], link: ['#7A4A00', '#FFEBC8'] };

export default function MySpace() {
  const insets = useSafeAreaInsets();
  const mem = useList(() => api.memories.list());
  const [tab, setTab] = useState(0); const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false); const [draft, setDraft] = useState(''); const [kind, setKind] = useState<Memory['kind']>('note'); const [err, setErr] = useState<string | null>(null);
  const rows = useMemo(() => {
    const ks = KINDS[tab][1]; const n = q.trim().toLowerCase();
    return [...(mem.data ?? [])].filter((m) => (!ks.length || ks.includes(m.kind)) && (!n || m.text.toLowerCase().includes(n)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt));
  }, [mem.data, tab, q]);
  const save = async () => {
    if (!draft.trim()) return;
    try { const m = await api.memories.create({ kind, text: draft.trim(), scope: 'private' }); mem.setData((p) => [m, ...(p ?? [])]); setDraft(''); setAdding(false); setErr(null); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); }
  };
  const pin = async (m: Memory) => { mem.setData((p) => (p ?? []).map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x))); try { await api.memories.patch(m.id, { pinned: !m.pinned }); } catch { mem.reload(); } };
  const del = async (m: Memory) => { mem.setData((p) => (p ?? []).filter((x) => x.id !== m.id)); try { await api.memories.remove(m.id); } catch { mem.reload(); } };
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
      <View style={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title sub="Everything your Mates remember about you">My Space</Title>
          <Btn icon="plus" onPress={() => setAdding(true)} style={{ borderRadius: R.md }} />
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search memories" placeholderTextColor={C.muted} style={{ minHeight: 46, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>{KINDS.map(([l], i) => <Chip key={l} label={l} on={tab === i} onPress={() => setTab(i)} />)}</View>
        <ErrorNote message={mem.error} onRetry={mem.reload} />
      </View>
      <FlatList data={rows} keyExtractor={(m) => m.id} onRefresh={mem.refresh} refreshing={mem.refreshing}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 10 }}
        ListEmptyComponent={mem.loading ? <Empty text="Loading…" /> : <Empty text="No memories here yet." />}
        renderItem={({ item: m }) => {
          const [fg, bg] = BADGE[m.kind] ?? BADGE.note;
          return (
            <View style={{ backgroundColor: '#fff', borderRadius: R.lg, borderWidth: 1, borderColor: m.pinned ? 'rgba(106,77,244,0.35)' : C.line, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.7, color: fg, backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' }}>{m.kind.toUpperCase()}</Text>
                <Text style={{ flex: 1, fontSize: 11.5, color: C.muted }}>{m.pinned ? 'Pinned · ' : ''}{m.by ?? 'You'} · {ago(m.createdAt)}</Text>
                <Press onPress={() => pin(m)} accessibilityLabel={m.pinned ? 'Unpin' : 'Pin'} style={{ minHeight: 32, justifyContent: 'center' }}><Text style={{ color: C.brandDeep, fontWeight: '800', fontSize: 12.5 }}>{m.pinned ? 'Unpin' : 'Pin'}</Text></Press>
                <Press onPress={() => del(m)} accessibilityLabel="Delete" style={{ minHeight: 32, justifyContent: 'center' }}><Text style={{ color: C.bad, fontWeight: '800', fontSize: 12.5 }}>Delete</Text></Press>
              </View>
              <Text selectable style={{ fontSize: 14.5, lineHeight: 21, marginTop: 8, color: C.ink }}>{m.text}</Text>
            </View>);
        }} />
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 12, paddingBottom: insets.bottom + 18 }}>
            <Caption>NEW MEMORY</Caption>
            <View style={{ flexDirection: 'row', gap: 8 }}>{(['note', 'idea', 'decision', 'fact'] as const).map((k) => <Chip key={k} label={k} on={kind === k} onPress={() => setKind(k)} />)}</View>
            <TextInput value={draft} onChangeText={setDraft} multiline autoFocus placeholder="What should your Mates remember?" placeholderTextColor={C.muted} style={{ minHeight: 100, maxHeight: 200, textAlignVertical: 'top', borderRadius: R.md, borderWidth: 1, borderColor: C.line2, padding: 12, fontSize: 15 }} />
            <ErrorNote message={err} />
            <View style={{ flexDirection: 'row', gap: 10 }}><Btn label="Cancel" kind="ghost" onPress={() => setAdding(false)} style={{ flex: 1 }} /><Btn label="Save" onPress={save} disabled={!draft.trim()} style={{ flex: 1 }} /></View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
