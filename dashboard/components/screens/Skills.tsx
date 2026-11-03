'use client';
import { useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useRepo, useSettings } from '../../lib/hooks';
import { MATE_DEFS, mateImg } from '../../lib/mates';
import { CATALOG, CATS, type Cat } from '../../lib/mcpCatalog';
import type { McpIn, MateKey, McpServer, SettingsData, SkillIn } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, Chips, confirmThen, Empty, ErrorNote, Field, Input, Loading, Modal, Page, Tabs, Textarea, Toggle } from '../ui/ui';
import { Icon } from '../ui/Icon';

const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)' } as const;
const cap = { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#6B6572', margin: '0 0 12px' } as const;
const blankSkill: SkillIn = { name: '', description: '', instructions: '', enabled: true, mates: [] };
const blankMcp: McpIn = { name: '', transport: 'http', url: '', command: '', description: '', enabled: true, status: 'unverified', tools: [] };
const ST = { connected: ['Connected', '#E6F4EA', '#1E7A46'], unverified: ['Needs setup', '#FFF3D6', '#8A5A00'], error: ['Error', '#FDE8E8', '#B3261E'], off: ['Off', '#ECE9F4', '#6B6572'] } as const;
const HOOKS = [['before tool', 'hookBeforeTool'], ['after step', 'hookAfterStep'], ['on finish', 'hookOnFinish'], ['on failure', 'hookOnFailure']] as const;
const GUARDS = [['Stay inside the agent container', 'guardContainer'], ['Block purchases and account changes', 'guardPurchases'], ['Show every tool call in the run log', 'guardLog']] as const;

export function Skills() {
  const skills = useRepo(api.skills), mcp = useRepo(api.mcp);
  const { settings, update } = useSettings(); const toast = useToast();
  const [sk, setSk] = useState<(SkillIn & { id?: string }) | null>(null);
  const [mc, setMc] = useState<(McpIn & { id?: string }) | null>(null);
  const [cat, setCat] = useState(false);
  const [draft, setDraft] = useState<Partial<SettingsData>>({});
  const pick = useRef<HTMLInputElement>(null);
  const h = { ...settings, ...draft } as SettingsData;
  const d = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) => setDraft((x) => ({ ...x, [k]: v }));
  const names = MATE_DEFS.map((m) => m.name);
  const state = (m: McpServer) => (!m.enabled ? 'off' : m.status);
  const verify = async (m: McpServer) => { const r = await api.mcp.verify(m.id); await mcp.reload(); toast(r.status === 'connected' ? `${m.name} is reachable` : api.capabilities.backend ? `${m.name} could not be reached` : 'Verifying needs the backend'); };
  const importSkill = async (f: File) => { const t = await f.text(); await skills.create({ ...blankSkill, name: f.name.replace(/\.[^.]+$/, ''), description: t.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').slice(0, 120) ?? '', instructions: t }); toast(`Imported ${f.name}`); };

  return (
    <Page fill title="Skills, MCP and Harness" sub="What Mates know how to do, which tools they can reach, and the rules they run under." actions={<>
      <Btn onClick={() => pick.current?.click()}>Import skill</Btn><Btn variant="primary" onClick={() => setCat(true)}>Add MCP server</Btn>
      <input ref={pick} type="file" accept=".md,.txt,.markdown" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importSkill(f); e.target.value = ''; }} /></>}>
      <ErrorNote message={skills.error ?? mcp.error} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(300px,380px)', gap: 24, overflow: 'auto' }}>
        <section style={{ minWidth: 0 }}>
          <p style={cap}>SKILLS</p>
          {skills.loading ? <Loading /> : skills.items.length === 0 ? <Empty mate="spark" title="No skills yet" text="Write instructions once, like how you want reports formatted, and attach them to Mates. Or import a .md file." action={<Btn variant="primary" onClick={() => setSk({ ...blankSkill })}>New skill</Btn>} /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
              {skills.items.map((s, i) => (
                <div key={s.id} style={{ ...card, padding: 18, animation: `lm-up .35s ${Math.min(i, 8) * 40}ms ease both`, opacity: s.enabled ? 1 : 0.8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ width: 34, height: 34, borderRadius: 9, background: '#ECE7FF', color: '#4F34D6', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{s.name[0]?.toUpperCase()}</span><b style={{ flex: 1, fontSize: 15, minWidth: 0 }}>{s.name}</b><Toggle label={`Enable ${s.name}`} checked={s.enabled} onChange={(v) => skills.update(s.id, { enabled: v })} /></div>
                  <p style={{ color: '#6B6572', fontSize: 13.5, lineHeight: 1.5, margin: '10px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description || s.instructions}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#6B6572' }}>
                    <span style={{ display: 'flex' }}>{s.mates.slice(0, 3).map((m, k) => <img key={m} src={mateImg(m)} alt="" width={22} height={22} style={{ marginLeft: k ? -5 : 0 }} />)}</span><span style={{ flex: 1 }}>{s.mates.length ? s.mates.map((m) => MATE_DEFS.find((x) => x.key === m)?.name).join(', ') : 'All Mates'}</span>
                    <button onClick={() => setSk(s)} style={{ border: 0, background: 'none', color: '#4F34D6', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                    <button aria-label={`Delete ${s.name}`} onClick={() => confirmThen(`Delete “${s.name}”?`, () => skills.remove(s.id))} style={{ border: 0, background: 'none', color: '#6B6572', cursor: 'pointer' }}><Icon name="close" size={16} /></button>
                  </div>
                </div>))}
              <button onClick={() => setSk({ ...blankSkill })} style={{ border: '1.5px dashed rgba(27,24,34,.25)', borderRadius: 16, background: 'none', minHeight: 130, cursor: 'pointer', font: 'inherit', color: '#6B6572', transition: 'background .2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#F4F0FF')} onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>+ New skill</button>
            </div>)}
        </section>

        <section style={{ minWidth: 0 }}>
          <p style={cap}>MCP SERVERS</p>
          {mcp.loading ? <Loading /> : mcp.items.length === 0 ? <Empty mate="byte" title="No MCP servers" text="Pick from the catalog or add your own server to give Mates new tools." action={<Btn variant="primary" onClick={() => setCat(true)}>Browse catalog</Btn>} /> : (
            <div style={{ ...card, padding: '4px 16px' }}>
              {mcp.items.map((m, i) => { const st = ST[state(m)]; return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: i < mcp.items.length - 1 ? '1px solid rgba(31,26,23,.08)' : 0, animation: `lm-up .3s ${i * 30}ms ease both` }}>
                  <span style={{ width: 36, height: 36, borderRadius: 9, background: '#F1EFF6', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{m.name[0]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14.5 }}>{m.name}</b><div style={{ color: '#6B6572', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description || m.url || m.command}</div></div>
                  <button onClick={() => verify(m)} title="Verify" style={{ background: st[1], color: st[2], border: 0, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{st[0]}</button>
                  <Toggle label={`Enable ${m.name}`} checked={m.enabled} onChange={(v) => mcp.update(m.id, { enabled: v })} />
                  <button aria-label={`Edit ${m.name}`} onClick={() => setMc(m)} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#6B6572' }}><Icon name="edit" size={16} /></button>
                  <button aria-label={`Remove ${m.name}`} onClick={() => confirmThen(`Remove “${m.name}”?`, () => mcp.remove(m.id))} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#6B6572' }}><Icon name="close" size={16} /></button>
                </div>); })}
            </div>)}
          <div style={{ background: '#F4F0FF', border: '1px solid rgba(106,77,244,.25)', borderRadius: 14, padding: 16, fontSize: 13.5, lineHeight: 1.55, color: '#3D3946', marginTop: 14 }}>Each Mate only sees the servers you attach to it. Tools that write or send need approval under the harness rules.</div>
        </section>

        <aside style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start', minWidth: 0 }}>
          <div style={{ display: 'flex' }}><p style={{ ...cap, margin: 0, flex: 1 }}>AGENT HARNESS</p><span style={{ fontSize: 12.5, color: '#6B6572' }}>Applies to all Mates</span></div>
          {!settings ? <Loading /> : <>
            <p style={{ ...cap, margin: 0, fontWeight: 500, letterSpacing: 0 }}>Permission mode</p>
            <Tabs value={h.permissionMode} onChange={(v) => d('permissionMode', v)} options={[{ id: 'ask', label: 'Ask first' }, { id: 'auto', label: 'Auto-edit' }, { id: 'plan', label: 'Plan only' }]} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([['Max steps per run', 'maxSteps'], ['Retries on failure', 'retriesOnFailure']] as const).map(([l, k]) => <label key={k} style={{ background: '#F4F2FA', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#6B6572' }}>{l}<input type="number" min={0} value={h[k]} onChange={(e) => d(k, Math.max(0, +e.target.value || 0))} style={{ display: 'block', width: '100%', border: 0, background: 'none', font: 'inherit', fontSize: 20, fontWeight: 600, color: '#1B1822', outline: 0 }} /></label>)}
            </div>
            <p style={{ ...cap, margin: '6px 0 0', fontWeight: 500, letterSpacing: 0 }}>Hooks <span style={{ fontWeight: 400 }}>(plain-language rules the harness applies)</span></p>
            {HOOKS.map(([l, k]) => <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderTop: '1px solid rgba(31,26,23,.08)', paddingTop: 10 }}><span className="mono" style={{ background: '#ECE7FF', color: '#4F34D6', borderRadius: 6, padding: '3px 8px', fontSize: 12, whiteSpace: 'nowrap' }}>{l}</span><textarea rows={2} value={h[k]} onChange={(e) => d(k, e.target.value)} aria-label={`Hook ${l}`} placeholder="No rule" style={{ flex: 1, border: 0, outline: 0, font: 'inherit', fontSize: 13.5, lineHeight: 1.45, minWidth: 0, background: 'none', resize: 'none' }} /></label>)}
            <p style={{ ...cap, margin: '6px 0 0', fontWeight: 500, letterSpacing: 0 }}>Guardrails</p>
            {GUARDS.map(([l, k]) => <div key={k} style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(31,26,23,.08)', padding: '10px 0', fontSize: 14 }}><span style={{ flex: 1 }}>{l}</span><Toggle label={l} checked={h[k]} onChange={(v) => d(k, v)} /></div>)}
            <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(31,26,23,.08)', padding: '10px 0', fontSize: 14 }}><span style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>{h.stopAfterMinutes > 0 ? `Stop a run after ${h.stopAfterMinutes} minutes without progress` : 'Stop a run after a while without progress'}</span><Toggle label="Stop after inactivity" checked={h.stopAfterMinutes > 0} onChange={(v) => d('stopAfterMinutes', v ? 20 : 0)} /></div>
            <Btn variant="primary" style={{ height: 48 }} disabled={Object.keys(draft).length === 0} onClick={async () => { await update(draft); setDraft({}); toast('Harness rules saved'); }}>Save harness rules</Btn>
          </>}
        </aside>
      </div>

      {sk && <Modal title={sk.id ? 'Edit skill' : 'New skill'} onClose={() => setSk(null)} canSubmit={!!sk.name.trim() && !!sk.instructions.trim()} onSubmit={async () => { const { id, ...x } = sk; await (id ? skills.update(id, x) : skills.create(x)); setSk(null); }}>
        <Field label="Name"><Input value={sk.name} onChange={(e) => setSk({ ...sk, name: e.target.value })} /></Field>
        <Field label="When should it be used?"><Input value={sk.description} onChange={(e) => setSk({ ...sk, description: e.target.value })} /></Field>
        <Field label="Instructions"><Textarea style={{ minHeight: 160 }} value={sk.instructions} onChange={(e) => setSk({ ...sk, instructions: e.target.value })} /></Field>
        <Field label="Mates (none selected = all)"><Chips options={names} value={sk.mates.map((k) => MATE_DEFS.find((m) => m.key === k)!.name)} onChange={(v) => setSk({ ...sk, mates: v.map((n) => MATE_DEFS.find((m) => m.name === n)!.key as MateKey) })} /></Field></Modal>}
      {mc && <Modal title={mc.id ? 'Edit server' : 'Add a custom MCP server'} onClose={() => setMc(null)} canSubmit={!!mc.name.trim() && (mc.transport === 'http' ? /^https?:\/\//.test(mc.url) : !!mc.command.trim())} onSubmit={async () => { const { id, ...x } = mc; await (id ? mcp.update(id, { ...x, status: 'unverified' }) : mcp.create(x)); setMc(null); }}>
        <Field label="Name"><Input value={mc.name} onChange={(e) => setMc({ ...mc, name: e.target.value })} /></Field>
        <Field label="Transport"><Tabs value={mc.transport} onChange={(v) => setMc({ ...mc, transport: v })} options={[{ id: 'http', label: 'Remote (HTTP)' }, { id: 'stdio', label: 'Command (stdio)' }]} /></Field>
        {mc.transport === 'http' ? <Field label="Server URL"><Input type="url" placeholder="https://…/mcp" value={mc.url} onChange={(e) => setMc({ ...mc, url: e.target.value })} /></Field> : <Field label="Command (runs on the backend host)"><Input placeholder="npx -y @scope/server" value={mc.command} onChange={(e) => setMc({ ...mc, command: e.target.value })} /></Field>}
        <Field label="What does it do?"><Input value={mc.description} onChange={(e) => setMc({ ...mc, description: e.target.value })} /></Field></Modal>}
      {cat && <Catalog onClose={() => setCat(false)} have={new Set(mcp.items.map((m) => m.catalogId))} onAdd={async (c) => { await mcp.create({ name: c.name, transport: c.transport, url: c.url ?? '', command: c.command ?? '', description: c.text, catalogId: c.id, enabled: true, status: 'unverified', tools: [] }); toast(`${c.name} added`); }} onCustom={() => { setCat(false); setMc({ ...blankMcp }); }} />}
    </Page>
  );
}

function Catalog({ onClose, have, onAdd, onCustom }: { onClose: () => void; have: Set<string | undefined>; onAdd: (c: (typeof CATALOG)[number]) => Promise<void>; onCustom: () => void }) {
  const [q, setQ] = useState(''); const [c, setC] = useState<Cat | 'All'>('All');
  const list = useMemo(() => CATALOG.filter((x) => (c === 'All' || x.cat === c) && (x.name + x.text).toLowerCase().includes(q.toLowerCase())), [q, c]);
  return (
    <Modal title="Add an MCP server" onClose={onClose} onSubmit={onCustom} submitLabel="Add a custom server instead">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search connectors" aria-label="Search connectors" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(['All', ...CATS] as const).map((x) => <button key={x} onClick={() => setC(x)} style={{ border: 0, borderRadius: 99, padding: '5px 12px', font: 'inherit', fontSize: 12.5, cursor: 'pointer', background: c === x ? '#6A4DF4' : '#ECE9F4', color: c === x ? '#fff' : '#3D3946', transition: 'background .2s' }}>{x}</button>)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.length === 0 && <p style={{ color: '#6B6572' }}>No match. Use “Add a custom server instead”.</p>}
        {list.map((x) => (
          <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(27,24,34,.12)', borderRadius: 12, padding: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: '#F1EFF6', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{x.name[0]}</span>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{x.name}</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>{x.text} · {x.transport === 'http' ? 'Remote' : 'Command'} · {x.auth}</div></div>
            <Btn small disabled={have.has(x.id)} onClick={() => void onAdd(x)}>{have.has(x.id) ? 'Added' : 'Add'}</Btn>
          </div>))}
      </div>
    </Modal>
  );
}
