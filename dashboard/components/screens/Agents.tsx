'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { ALL_TOOLS, GRAD, MATES, MATE_DEFS, mateImg, mateName } from '../../lib/mates';
import type { MateConfigIn, MateKey } from '../../lib/types';
import { ModelPicker } from '../ui/ModelPicker';
import { useToast } from '../ui/toast';
import { Btn, ErrorNote, Field, Loading, Modal, Page, Select, Tabs, Textarea, Toggle } from '../ui/ui';

type Filter = 'all' | 'Core' | 'Personal' | 'Creative' | 'Dev';
type Tab = 'config' | 'tools' | 'memory';
const TOOL_TEXT: Record<string, string> = {
  'Web Search': 'Search the web and read results', Browser: 'Open pages, click and fill forms', 'File System': 'Read and write files in the workspace', Terminal: 'Run commands in a sandbox',
  'Code Interpreter': 'Run code to analyse data', 'Vector Search': 'Search your Knowledge by meaning', Memory: 'Read and write My Space memories', Calendar: 'Read and add Schedule events', Workflows: 'Create and edit workflows on the Studio canvas', 'Run Control': 'Stop, pause and resume runs (Ops, Halo and Planner always have it)',
};

export function Agents() {
  const router = useRouter();
  const toast = useToast();
  const open = useSearchParams().get('mate') as MateKey | null;
  const { items, loading, error, update } = useRepo(api.mateConfigs);
  const [filter, setFilter] = useState<Filter>('all');
  const cards = MATE_DEFS.filter((m) => filter === 'all' || m.role === filter);
  const [lvl, setLvl] = useState<NonNullable<MateConfigIn['thinking']>>('default'); const [busy, setBusy] = useState(false);
  const applyAll = async () => {
    setBusy(true);
    try { for (const c of items) if ((c.thinking ?? 'default') !== lvl) await update(c.id, { thinking: lvl }); toast(`Thinking set to ${lvl === 'default' ? 'Default (high)' : lvl} for all ${items.length} agents`); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not update every agent', 'bad'); }
    setBusy(false);
  };
  const same = items.length > 0 && items.every((c) => (c.thinking ?? 'default') === lvl);

  return (
    <Page title="Agents" sub={`${MATE_DEFS.length} Mates. Give each one a job, a model, and the tools it is allowed to use.`}
      actions={<><Tabs value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All' }, { id: 'Core', label: 'Core' }, { id: 'Personal', label: 'Personal' }, { id: 'Creative', label: 'Creative' }, { id: 'Dev', label: 'Dev' }]} />
        <Btn variant="primary" disabled title="Custom Mates arrive with the backend">+ New agent</Btn></>}>
      <ErrorNote message={error} />
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'linear-gradient(160deg,#F1ECFF,#FAF8FF)', border: '1px solid rgba(106,77,244,.2)', borderRadius: 16, padding: '12px 16px', marginBottom: 14 }}>
          <span aria-hidden="true" style={{ fontSize: 20 }}>🧠</span>
          <div style={{ flex: 1, minWidth: 220 }}><b style={{ fontSize: 14.5 }}>Reasoning for every agent</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>Every agent thinks at <b>High</b> unless you change it. Set one level for all of them here, or tune each agent in Configure.</div></div>
          <Select value={lvl} onChange={(e) => setLvl(e.target.value as typeof lvl)} aria-label="Thinking level for all agents" style={{ width: 190 }}>{[['default', 'Default (high)'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'XHigh']].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select>
          <Btn variant="primary" onClick={() => void applyAll()} disabled={busy || same}>{busy ? 'Applying…' : same ? 'Applied' : 'Apply to all'}</Btn>
        </div>)}
      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14 }}>
          {cards.map((d, i) => {
            const c = items.find((x) => x.mate === d.key);
            const on = !!c?.enabled;
            return (
              <article key={d.key} style={{ background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(31,26,23,.05)', animation: `lm-pop .45s ${Math.min(i, 12) * 35}ms cubic-bezier(.22,1,.36,1) both`, transition: 'transform .2s, box-shadow .2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
                <div style={{ height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GRAD[d.key], position: 'relative' }}>
                  { }
                  <img src={mateImg(d.key)} alt="" width={102} height={102} style={{ transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)' }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1) rotate(-4deg)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')} />
                  <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10.5, fontWeight: 700, color: d.core ? '#3D3946' : '#4F34D6', background: d.core ? 'rgba(255,253,247,.9)' : '#ECE7FF', borderRadius: 999, padding: '2px 9px' }}>{d.core ? 'Core' : 'New'}</span>
                </div>
                <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{mateName(d.key)}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.4, color: '#6B6572', minHeight: 50 }}>{d.blurb}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button type="button" onClick={() => router.replace(`/agents?mate=${d.key}`)} style={{ flex: 1, height: 40, background: '#F3F1F8', border: '1px solid rgba(31,26,23,.1)', borderRadius: 10, color: '#1B1822', fontSize: 12.5, fontWeight: 500 }}>Configure</button>
                    <button type="button" aria-pressed={on} onClick={() => c && update(c.id, { enabled: !on }).then(() => toast(on ? `${d.name} removed from your sidebar` : `${d.name} added to your sidebar`))}
                      style={{ flex: 1, height: 40, background: on ? '#6A4DF4' : '#ECE7FF', border: `1px solid ${on ? '#6A4DF4' : 'rgba(106,77,244,.4)'}`, borderRadius: 10, color: on ? '#fff' : '#4F34D6', fontSize: 12.5, fontWeight: 600, transition: 'background .2s, color .2s' }}>{on ? 'Added ✓' : 'Add'}</button>
                  </div>
                </div>
              </article>);
          })}
        </div>
      )}
      {open && open in MATES && <Configure mate={open} onClose={() => router.replace('/agents')} />}
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
  if (!cfg) return null;
  const v = { ...cfg, ...draft };
  const set = (p: Partial<MateConfigIn>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = Object.keys(draft).length > 0;
  return (
    <Modal title="" bg={`linear-gradient(180deg, ${/#[0-9a-f]{6}/i.exec(GRAD[mate])?.[0] ?? def.tint} 0%, ${def.tint} 100%)`} onClose={onClose} submitLabel="Save changes" canSubmit={dirty} onSubmit={async () => { await update(cfg.id, draft); toast('Saved'); onClose(); }}>
      <div style={{ padding: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 16 }}>
        { }
        <img src={mateImg(mate)} alt="" width={84} height={84} style={{ animation: 'lm-bob 4s ease-in-out infinite' }} />
        <div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: 22 }}>{mateName(mate)}</h2><p style={{ margin: '2px 0 0', color: '#3D3946', fontSize: 13 }}>{def.role}</p></div>
        <Toggle label={`Enable ${def.name}`} checked={v.enabled} onChange={(x) => set({ enabled: x })} />
      </div>
      <div style={{ marginTop: 16 }}><Tabs value={tab} onChange={setTab} options={[{ id: 'config', label: 'Config' }, { id: 'tools', label: 'Tools' }, { id: 'memory', label: 'Memory' }]} /></div>
      <div key={tab} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, animation: 'lm-up .3s ease both' }}>
        {tab === 'config' && <>
          <Field label="Description"><Textarea rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          <Field label="Model"><ModelPicker value={v.model} onChange={(m) => set({ model: m })} /></Field>
          <Field label="Persona / system prompt"><Textarea rows={7} value={v.instructions} placeholder="Always cite sources. Prefer short answers." onChange={(e) => set({ instructions: e.target.value })} /></Field>
          <Field label="Thinking"><Select value={v.thinking ?? 'default'} onChange={(e) => set({ thinking: e.target.value as MateConfigIn['thinking'] })}>{[['default', 'Default (high)'], ['low', 'Low: fast, direct'], ['medium', 'Medium: brief reasoning'], ['high', 'High: careful'], ['xhigh', 'XHigh: draft, critique, revise']].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select></Field>
          <Field label="Output format"><Select value={v.outputFormat} onChange={(e) => set({ outputFormat: e.target.value })}>{['Markdown', 'Plain text', 'JSON', 'Table'].map((f) => <option key={f}>{f}</option>)}</Select></Field>
        </>}
        {tab === 'tools' && ALL_TOOLS.map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(31,26,23,.07)' }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>{t}</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>{TOOL_TEXT[t]}</div></div>
            <Toggle label={t} checked={v.tools.includes(t)} onChange={(on) => set({ tools: on ? [...v.tools, t] : v.tools.filter((x) => x !== t) })} />
          </div>))}
        {tab === 'memory' && <>
          <p style={{ margin: 0, color: '#6B6572', fontSize: 13, lineHeight: 1.5 }}>Controls who can see what {def.name} remembers.</p>
          <Tabs value={v.memoryScope} onChange={(m) => set({ memoryScope: m })} options={[{ id: 'private', label: 'Private' }, { id: 'shared', label: 'Shared' }, { id: 'project', label: 'Project' }]} />
          <p style={{ margin: 0, color: '#6B6572', fontSize: 13, lineHeight: 1.5 }}>{{ private: `${def.name} keeps its own notes. Nobody else sees them.`, shared: `${def.name} keeps its own notes, and any Mate in this workspace can read the ones marked shared.`, project: `${def.name}'s notes are visible only inside the project they were made in.` }[v.memoryScope]}</p>
        </>}
      </div>
    </Modal>
  );
}
