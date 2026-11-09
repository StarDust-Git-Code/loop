'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { useAgents } from '../../lib/agents';
import { ALL_TOOLS, AVATARS, GRAD, MATES, MATE_VOICE, PERSONALITIES, VOICE_NAMES, isBuiltin, mateImg, mateName } from '../../lib/mates';
import type { Access, MateConfigIn, MateKey } from '../../lib/types';
import { ModelPicker } from '../ui/ModelPicker';
import { useToast } from '../ui/toast';
import { Btn, ErrorNote, Field, Input, Loading, Modal, Page, Select, Tabs, Textarea, Toggle, confirmThen } from '../ui/ui';
import { Icon } from '../ui/Icon';

type Filter = 'all' | 'Core' | 'Personal' | 'Creative' | 'Dev' | 'Custom';
type Tab = 'config' | 'tools' | 'memory' | 'journal';
const TOOL_TEXT: Record<string, string> = {
  'Web Search': 'Search the web and read results', Browser: 'Open pages, click and fill forms', 'File System': 'Read and write files in the workspace', Terminal: 'Run commands in a sandbox',
  'Code Interpreter': 'Run code to analyse data', 'Vector Search': 'Search your Knowledge by meaning', Memory: 'Read and write My Space memories', Calendar: 'Read and add Schedule events', Workflows: 'Create and edit workflows on the Studio canvas', Company: 'People directory, assign work to people, check-ins, reports (the leader always has it)', Delegation: 'Ask other agents, start runs, keep watch (the leader always has it)', 'Run Control': 'Stop, pause and resume runs (Ops, Halo and Planner always have it)',
  Notes: 'Obsidian vault and Notion pages (once set up in Connections)', Google: 'Google Calendar and Gmail drafts (once allowed in Connections)', 'Team Chat': 'Read and post in Slack channels (posting asks you first)',
  'Task Apps': 'Todoist to-dos and Linear issues', Music: 'Spotify: what you play, and real playlists', Feeds: 'RSS, Atom and YouTube feeds and transcripts',
  Health: 'Your daily sleep, steps and heart-rate summary (read only)', Home: 'Home Assistant devices; locks, alarms and garage doors ask you first',
};

export function Agents() {
  const router = useRouter();
  const toast = useToast();
  const open = useSearchParams().get('mate') as MateKey | null;
  const { items, loading, error, update, defs, leader, isOn, removed, makeLeader, remove, restore, createAgent } = useAgents();
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const cards = defs.filter((m) => filter === 'all' || m.role === filter).sort((a, b) => Number(b.key === leader) - Number(a.key === leader));
  const [lvl, setLvl] = useState<NonNullable<MateConfigIn['thinking']>>('default'); const [busy, setBusy] = useState(false);
  const applyAll = async () => {
    setBusy(true);
    try { for (const c of items) if ((c.thinking ?? 'default') !== lvl) await update(c.id, { thinking: lvl }); toast(`Thinking set to ${lvl === 'default' ? 'Default (high)' : lvl} for all ${items.length} agents`); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not update every agent', 'bad'); }
    setBusy(false);
  };
  const same = items.length > 0 && items.every((c) => (c.thinking ?? 'default') === lvl);

  return (
    <Page title="Agents" sub={`${defs.length} agents, led by ${MATES[leader].name}. Give each one a job, a model, and the tools it is allowed to use.`}
      actions={<><Tabs value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All' }, { id: 'Core', label: 'Core' }, { id: 'Personal', label: 'Personal' }, { id: 'Creative', label: 'Creative' }, { id: 'Dev', label: 'Dev' }, { id: 'Custom', label: 'Custom' }]} />
        <Btn variant="primary" onClick={() => setCreating(true)}>+ New agent</Btn></>}>
      <ErrorNote message={error} />
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'linear-gradient(160deg,#F1ECFF,#FAF8FF)', border: '1px solid rgba(47,107,255,.2)', borderRadius: 16, padding: '12px 16px', marginBottom: 14 }}>
          <span aria-hidden="true" style={{ color: '#1F55E6', display: 'grid' }}><Icon name="brain" size={22} /></span>
          <div style={{ flex: 1, minWidth: 220 }}><b style={{ fontSize: 14.5 }}>Reasoning for every agent</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>Every agent thinks at <b>High</b> unless you change it. Set one level for all of them here, or tune each agent in Configure.</div></div>
          <Select value={lvl} onChange={(e) => setLvl(e.target.value as typeof lvl)} aria-label="Thinking level for all agents" style={{ width: 190 }}>{[['default', 'Default (high)'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'XHigh']].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select>
          <Btn variant="primary" onClick={() => void applyAll()} disabled={busy || same}>{busy ? 'Applying…' : same ? 'Applied' : 'Apply to all'}</Btn>
        </div>)}
      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14 }}>
          {cards.map((d, i) => {
            const c = items.find((x) => x.id === d.key);
            const on = isOn(d.key); const lead = d.key === leader;
            return (
              <article key={d.key} style={{ background: '#fff', border: '1px solid rgba(15,23,42,.17)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(15,23,42,.05)', animation: `lm-pop .45s ${Math.min(i, 12) * 35}ms cubic-bezier(.22,1,.36,1) both`, transition: 'transform .2s, box-shadow .2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
                <div style={{ height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GRAD[d.key], position: 'relative' }}>
                  { }
                  <img src={mateImg(d.key)} alt="" width={102} height={102} style={{ transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)' }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1) rotate(-4deg)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')} />
                  <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10.5, fontWeight: 700, color: lead ? '#fff' : d.core ? '#334155' : '#1F55E6', background: lead ? '#2F6BFF' : d.core ? 'rgba(255,253,247,.9)' : '#EAF1FF', borderRadius: 999, padding: '2px 9px' }}>{lead ? 'Leader' : d.custom ? 'Custom' : d.core ? 'Core' : 'New'}</span>
                </div>
                <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{mateName(d.key)}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.4, color: '#5B6474', minHeight: 50 }}>{d.blurb}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button type="button" onClick={() => router.replace(`/agents?mate=${d.key}`)} style={{ flex: 1, height: 40, background: '#F3F5F9', border: '1px solid rgba(15,23,42,.1)', borderRadius: 10, color: '#0F172A', fontSize: 12.5, fontWeight: 500 }}>Configure</button>
                    <button type="button" aria-pressed={on} disabled={lead} title={lead ? 'The leader is always on' : undefined} onClick={() => c && update(c.id, { enabled: !on }).then(() => toast(on ? `${d.name} switched off` : `${d.name} switched on`)).catch((e: Error) => toast(e.message, 'bad'))}
                      style={{ flex: 1, height: 40, background: on ? '#2F6BFF' : '#EAF1FF', border: `1px solid ${on ? '#2F6BFF' : 'rgba(47,107,255,.4)'}`, borderRadius: 10, color: on ? '#fff' : '#1F55E6', fontSize: 12.5, fontWeight: 600, transition: 'background .2s, color .2s' }}>{on ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={14} />Added</span> : 'Add'}</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 12 }}>
                    {!lead && <button type="button" onClick={() => makeLeader(d.key).then(() => toast(`${d.name} now leads the team`)).catch((e: Error) => toast(e.message, 'bad'))} style={{ border: 0, background: 'none', padding: 0, color: 'var(--accent-ink)', fontWeight: 600 }}>Make leader</button>}
                    {!lead && <button type="button" onClick={() => confirmThen(d.custom ? `Delete ${d.name}? This cannot be undone.` : `Remove ${d.name}? You can restore it later.`, () => { remove(d.key).then(() => toast(`${d.name} ${d.custom ? 'deleted' : 'removed'}`)).catch((e: Error) => toast(e.message, 'bad')); })} style={{ border: 0, background: 'none', padding: 0, color: '#B42318', fontWeight: 600, marginLeft: 'auto' }}>{d.custom ? 'Delete' : 'Remove'}</button>}
                    {lead && <span style={{ color: '#5B6474' }}>Leads the team and is your first contact.</span>}
                  </div>
                </div>
              </article>);
          })}
        </div>
      )}
      {!loading && removed.length > 0 && (
        <div style={{ marginTop: 18, color: '#5B6474', fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span>Removed:</span>
          {removed.map((c) => <Btn key={c.id} small onClick={() => restore(c.id).then(() => toast(`${MATES[c.id].name} restored`)).catch((e: Error) => toast(e.message, 'bad'))}>Restore {MATES[c.id].name}</Btn>)}
        </div>)}
      {open && defs.some((d) => d.key === open) && <Configure mate={open} onClose={() => router.replace('/agents')} />}
      {creating && <NewAgent onClose={() => setCreating(false)} onCreate={async (input) => { const a = await createAgent(input); toast(`${a.name ?? input.name} is ready`); setCreating(false); router.replace(`/agents?mate=${a.id}`); }} />}
    </Page>
  );
}

function Configure({ mate, onClose }: { mate: MateKey; onClose: () => void }) {
  const toast = useToast();
  const { items, update } = useRepo(api.mateConfigs);
  const cfg = items.find((c) => c.mate === mate);
  const def = MATES[mate];
  const [tab, setTab] = useState<Tab>('config');
  const [draft, setDraft] = useState<Partial<MateConfigIn>>({});
  const [cards, setCards] = useState<Record<string, string>>({});
  useEffect(() => { api.server.mateCards().then(setCards).catch(() => {}); }, []);
  if (!cfg) return null;
  const v = { ...cfg, ...draft };
  const set = (p: Partial<MateConfigIn>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = Object.keys(draft).length > 0;
  return (
    <Modal title="" bg={`linear-gradient(180deg, ${/#[0-9a-f]{6}/i.exec(GRAD[mate])?.[0] ?? def.tint} 0%, ${def.tint} 100%)`} onClose={onClose} submitLabel="Save changes" canSubmit={dirty} onSubmit={async () => { await update(cfg.id, draft); toast('Saved'); onClose(); }}>
      <div style={{ padding: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 16 }}>
        { }
        <img src={mateImg(mate)} alt="" width={84} height={84} />
        <div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: 22 }}>{mateName(mate)}</h2><p style={{ margin: '2px 0 0', color: '#334155', fontSize: 13 }}>{def.role}</p></div>
        <Toggle label={`Enable ${def.name}`} checked={v.enabled} onChange={(x) => set({ enabled: x })} />
      </div>
      <div style={{ marginTop: 16 }}><Tabs value={tab} onChange={setTab} options={[{ id: 'config', label: 'Config' }, { id: 'tools', label: 'Tools' }, { id: 'memory', label: 'Access' }, { id: 'journal', label: 'Journal' }]} /></div>
      <div key={tab} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, animation: 'lm-up .3s ease both' }}>
        {tab === 'config' && <>
          <Field label="Description"><Textarea rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          <Field label="Model"><ModelPicker value={v.model} onChange={(m) => set({ model: m })} /></Field>
          <Field label="Role card: what this Mate does, must not do, and who it hands work to"><Textarea rows={6} value={v.card || cards[mate] || ''} placeholder="Loads the built-in card from your server." onChange={(e) => set({ card: e.target.value })} /></Field>
          {v.card && cards[mate] && v.card !== cards[mate] && <button type="button" onClick={() => set({ card: '' })} style={{ alignSelf: 'flex-start', border: 0, background: 'none', color: 'var(--accent-ink)', fontWeight: 600, fontSize: 13, padding: 0 }}>Reset to the built-in card</button>}
          <Field label="Personality: how it sounds everywhere (optional, overrides the card's Voice line)"><Input value={v.personality ?? ''} maxLength={400} placeholder="Warm and encouraging, like a supportive coach." onChange={(e) => set({ personality: e.target.value })} /></Field>
          <VoicePicker mate={mate} value={v.voice ?? ''} personality={v.personality ?? ''} onChange={(voice) => set({ voice })} />
          <Field label="Extra instructions (override the defaults)"><Textarea rows={7} value={v.instructions} placeholder="Always cite sources. Prefer short answers." onChange={(e) => set({ instructions: e.target.value })} /></Field>
          <Field label="Thinking"><Select value={v.thinking ?? 'default'} onChange={(e) => set({ thinking: e.target.value as MateConfigIn['thinking'] })}>{[['default', 'Default (high)'], ['low', 'Low: fast, direct'], ['medium', 'Medium: brief reasoning'], ['high', 'High: careful'], ['xhigh', 'XHigh: draft, critique, revise']].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select></Field>
          <Field label="Output format"><Select value={v.outputFormat} onChange={(e) => set({ outputFormat: e.target.value })}>{['Markdown', 'Plain text', 'JSON', 'Table'].map((f) => <option key={f}>{f}</option>)}</Select></Field>
        </>}
        {tab === 'tools' && ALL_TOOLS.map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(15,23,42,.07)' }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>{t}</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>{TOOL_TEXT[t]}</div></div>
            <Toggle label={t} checked={v.tools.includes(t)} onChange={(on) => set({ tools: on ? [...v.tools, t] : v.tools.filter((x) => x !== t) })} />
          </div>))}
        {tab === 'memory' && <AccessPanel name={def.name} value={v.access} onChange={(access) => set({ access })} />}
        {tab === 'journal' && <Journal mate={mate} name={def.name} />}
      </div>
    </Modal>
  );
}

function NewAgent({ onClose, onCreate }: { onClose: () => void; onCreate: (input: Partial<MateConfigIn> & { name: string }) => Promise<void> }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [card, setCard] = useState('');
  const [tools, setTools] = useState<string[]>(['Memory', 'Web Search']); const [avatar, setAvatar] = useState<(typeof AVATARS)[number]>('orbit');
  const [personality, setPersonality] = useState(''); const [voice, setVoice] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const preset = PERSONALITIES.some(([p]) => p === personality);
  return (
    <Modal title="New agent" onClose={onClose} submitLabel="Create agent" canSubmit={!!name.trim()} onSubmit={async () => { setErr(null); try { await onCreate({ name: name.trim(), description, card, tools, avatar, personality, voice }); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create the agent'); } }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ErrorNote message={err} />
        <Field label="Name"><Input value={name} maxLength={40} placeholder="Hira" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Job, in one line"><Input value={description} maxLength={300} placeholder="Screens candidates, books interviews and chases feedback." onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Role card: what it owns, what it must not do, who it hands work to"><Textarea rows={5} value={card} placeholder={'Owns hiring. Never sends offers without the owner. Hands scheduling to Orbit.\nVoice: upbeat and organised.\nEnds with: the next interview on the calendar.'} onChange={(e) => setCard(e.target.value)} /></Field>
        <Field label="Personality">
          <Select value={preset ? personality : 'custom'} onChange={(e) => setPersonality(e.target.value === 'custom' ? ' ' : e.target.value)}>{PERSONALITIES.map(([p, n]) => <option key={n} value={p}>{n}</option>)}<option value="custom">Write my own…</option></Select>
          {!preset && <Input style={{ marginTop: 8 }} value={personality.trimStart()} maxLength={400} placeholder="Dry humour, very short answers, loves a good checklist." onChange={(e) => setPersonality(e.target.value)} />}
        </Field>
        <VoicePicker mate={null} value={voice} onChange={setVoice} />
        <Field label="Tools">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{ALL_TOOLS.map((t) => { const on = tools.includes(t); return <button key={t} type="button" aria-pressed={on} onClick={() => setTools(on ? tools.filter((x) => x !== t) : [...tools, t])} style={{ height: 34, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? '#2F6BFF' : 'rgba(15,23,42,.14)'}`, background: on ? '#EAF1FF' : '#fff', color: on ? '#1F55E6' : '#334155', fontSize: 12.5, fontWeight: 600 }}>{t}</button>; })}</div>
        </Field>
        <Field label="Picture">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{AVATARS.map((a) => <button key={a} type="button" aria-label={`Use the ${MATES[a].name} picture`} aria-pressed={avatar === a} onClick={() => setAvatar(a)} style={{ width: 44, height: 44, borderRadius: 12, border: `2px solid ${avatar === a ? '#2F6BFF' : 'transparent'}`, background: MATES[a].tint, display: 'grid', placeItems: 'center', padding: 0 }}><img src={mateImg(a)} alt="" width={34} height={34} /></button>)}</div>
        </Field>
      </div>
    </Modal>
  );
}

/** The Gemini Live voice used on calls. '' = the agent's own default (built-in voice, or a spare one for a custom agent). */
function VoicePicker({ mate, value, personality = '', onChange }: { mate: MateKey | null; value: string; personality?: string; onChange: (v: string) => void }) {
  const toast = useToast(); const [playing, setPlaying] = useState(false);
  const builtin = mate && isBuiltin(mate) ? MATE_VOICE[mate as keyof typeof MATE_VOICE] : undefined;
  const ownerOf = (n: string) => Object.entries(MATE_VOICE).find(([, x]) => x === n)?.[0] as MateKey | undefined;
  const play = async () => {
    if (!mate) return; setPlaying(true);
    try { const url = await api.voicePreview(mate, value, personality); const a = new Audio(url); a.onended = () => { setPlaying(false); URL.revokeObjectURL(url); }; await a.play(); }
    catch (e) { setPlaying(false); toast(e instanceof Error ? e.message : 'Could not play the preview'); }
  };
  return (
    <Field label="Voice on calls">
      <div style={{ display: 'flex', gap: 8 }}>
        <Select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
          <option value="">{builtin ? `Default (${builtin})` : 'Default (a voice no built-in agent uses)'}</option>
          {VOICE_NAMES.map((n) => { const o = ownerOf(n); return <option key={n} value={n}>{n}{o && o !== mate ? ` (also ${MATES[o].name})` : ''}</option>; })}
        </Select>
        {mate && <Btn onClick={() => void play()} disabled={playing} aria-label="Play a sample of this voice">{playing ? 'Playing…' : '▶ Play'}</Btn>}
      </div>
    </Field>
  );
}

/** What this agent has learned about how you like its work: its personal notes ("your note" memories). */
function Journal({ mate, name }: { mate: MateKey; name: string }) {
  const { items, remove } = useRepo(api.memories);
  const mine = items.filter((m) => m.scope === 'personal' && m.mate === mate).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return <>
    <p style={{ margin: 0, color: '#5B6474', fontSize: 13, lineHeight: 1.5 }}>{name} keeps these notes from your feedback (&ldquo;shorter please&rdquo;, &ldquo;always add sources&rdquo;) and follows them every time. Delete any that are wrong.</p>
    {mine.length ? mine.map((m) => (
      <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(15,23,42,.07)' }}>
        <span style={{ flex: 1, fontSize: 13.5 }}>{m.text}<span style={{ display: 'block', color: '#5B6474', fontSize: 12 }}>{String(m.createdAt).slice(0, 10)}</span></span>
        <button type="button" onClick={() => confirmThen('Delete this note?', () => remove(m.id))} style={{ border: 0, background: 'none', color: '#B42318', fontSize: 12.5, fontWeight: 600 }}>Delete</button>
      </div>)) : <p style={{ color: '#5B6474', fontSize: 13 }}>No notes yet. Tell {name} what you like or dislike about its work and it will remember.</p>}
  </>;
}

const DEFAULT_ACCESS: Access ={ memory: { personal: true, shared: 'write' }, graph: 'write', skills: 'all', mcp: 'all', knowledge: true };
const LEVELS = [['none', 'No access'], ['read', 'Read only'], ['write', 'Read and write']] as const;

/** What this agent may reach: memory, graph, Knowledge, skills and MCP servers. The server enforces it. */
function AccessPanel({ name, value, onChange }: { name: string; value?: Access; onChange: (a: Access) => void }) {
  const a: Access = { ...DEFAULT_ACCESS, ...value, memory: { ...DEFAULT_ACCESS.memory, ...value?.memory } };
  const skills = useRepo(api.skills).items, servers = useRepo(api.mcp).items;
  const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(15,23,42,.07)' } as const;
  const pickList = (label: string, cur: Access['skills'], all: { id: string; name: string }[], set: (v: Access['skills']) => void) => (
    <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(15,23,42,.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <b style={{ fontSize: 13.5, flex: 1 }}>{label}</b>
        <Select value={Array.isArray(cur) ? 'some' : cur} onChange={(e) => set(e.target.value === 'some' ? [] : (e.target.value as 'all' | 'none'))} aria-label={label} style={{ width: 170 }}>
          <option value="all">All</option><option value="some">Only these</option><option value="none">None</option>
        </Select>
      </div>
      {Array.isArray(cur) && (all.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{all.map((x) => { const on = cur.includes(x.id); return <button key={x.id} type="button" aria-pressed={on} onClick={() => set(on ? cur.filter((y) => y !== x.id) : [...cur, x.id])} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? '#2F6BFF' : 'rgba(15,23,42,.14)'}`, background: on ? '#EAF1FF' : '#fff', color: on ? '#1F55E6' : '#334155', fontSize: 12.5, fontWeight: 600 }}>{x.name}</button>; })}</div> : <p style={{ margin: '6px 0 0', color: '#5B6474', fontSize: 12.5 }}>None added yet.</p>)}
    </div>);
  return <>
    <p style={{ margin: 0, color: '#5B6474', fontSize: 13, lineHeight: 1.5 }}>{name}&apos;s prompt only lists what is allowed here, and the server refuses anything else. {name} loads details with tools when it needs them.</p>
    <div style={row}><div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>Shared memory</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>Facts about you, your people and your work that every agent uses.</div></div>
      <Select value={a.memory.shared} onChange={(e) => onChange({ ...a, memory: { ...a.memory, shared: e.target.value as Access['memory']['shared'] } })} aria-label="Shared memory" style={{ width: 170 }}>{LEVELS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select></div>
    <div style={row}><div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>Personal notes</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>Notes only {name} can see, for its own job.</div></div>
      <Toggle label="Personal notes" checked={a.memory.personal} onChange={(x) => onChange({ ...a, memory: { ...a.memory, personal: x } })} /></div>
    <div style={row}><div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>Knowledge graph</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>People, teams, projects and how they connect.</div></div>
      <Select value={a.graph} onChange={(e) => onChange({ ...a, graph: e.target.value as Access['graph'] })} aria-label="Knowledge graph" style={{ width: 170 }}>{LEVELS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select></div>
    <div style={row}><div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>Knowledge library</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>Your notes, links and files in Knowledge.</div></div>
      <Toggle label="Knowledge library" checked={a.knowledge} onChange={(x) => onChange({ ...a, knowledge: x })} /></div>
    {pickList('Skills', a.skills, skills.map((x) => ({ id: x.id, name: x.name })), (v) => onChange({ ...a, skills: v }))}
    {pickList('MCP servers', a.mcp, servers.map((x) => ({ id: x.id, name: x.name })), (v) => onChange({ ...a, mcp: v }))}
  </>;
}
