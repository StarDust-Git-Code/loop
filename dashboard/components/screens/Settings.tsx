'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo, useSession, useSettings } from '../../lib/hooks';
import { fetchModelList, modelKey, PRESET, PRESETS, type Preset } from '../../lib/providers';
import type { ProviderCfg, SettingsData } from '../../lib/types';
import { ModelPicker } from '../ui/ModelPicker';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, Loading, Page, Tabs, Toggle } from '../ui/ui';
import s from './settings.module.css';

type Sec = 'general' | 'models' | 'safety' | 'notify' | 'data' | 'dev';
const SECS: { id: Sec; label: string; icon: string }[] = [{ id: 'general', label: 'General', icon: '◐' }, { id: 'models', label: 'Models & providers', icon: '✦' }, { id: 'safety', label: 'Safety & limits', icon: '⛨' }, { id: 'notify', label: 'Notifications', icon: '◔' }, { id: 'data', label: 'Data & account', icon: '▤' }, { id: 'dev', label: 'Developer options', icon: '⌘' }];
const TINT = ['#ECE7FF', '#FFF3D6', '#E3F0FF', '#E6F4EA', '#FDE8EE', '#E4EAFF'];
const tint = (id: string) => TINT[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINT.length];

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return <div className={s.row}><div className={s.t}><b>{label}</b>{sub && <p>{sub}</p>}</div>{children}</div>;
}

export function Settings() {
  const q = useSearchParams().get('s');
  const [sec, setSec] = useState<Sec>(SECS.some((x) => x.id === q) ? (q as Sec) : 'general');
  const { settings, update } = useSettings();
  const idx = SECS.findIndex((x) => x.id === sec);
  return (
    <Page fill title="Settings" sub="Changes save as you make them.">
      {!settings ? <Loading /> : (
        <div className={s.wrap}>
          <nav className={s.rail} aria-label="Settings sections">
            <span className={s.railBar} style={{ transform: `translateY(${idx * 50}px)` }} aria-hidden="true" />
            {SECS.map((x) => <button key={x.id} className={s.railBtn} aria-current={x.id === sec} onClick={() => setSec(x.id)}><span aria-hidden="true" style={{ width: 18, textAlign: 'center' }}>{x.icon}</span>{x.label}</button>)}
          </nav>
          <div key={sec} className={s.pane}>
            {sec === 'general' && <General st={settings} set={update} />}
            {sec === 'models' && <Models st={settings} set={update} />}
            {sec === 'safety' && <Safety st={settings} set={update} />}
            {sec === 'notify' && <Notify st={settings} set={update} />}
            {sec === 'data' && <Data />}
            {sec === 'dev' && <Dev st={settings} set={update} />}
          </div>
        </div>)}
    </Page>
  );
}

type P = { st: SettingsData; set: (p: Partial<SettingsData>) => Promise<SettingsData> };
const zones = (() => { try { return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []; } catch { return []; } })();

function General({ st, set }: P) {
  const toast = useToast();
  const field = (k: 'displayName' | 'email' | 'workspaceName', label: string, type = 'text') => <Row label={label}><input type={type} className={s.inp} style={{ width: 280 }} defaultValue={st[k]} aria-label={label} onBlur={(e) => e.target.value !== st[k] && set({ [k]: e.target.value }).then(() => toast('Saved'))} /></Row>;
  return (
    <div className={s.card}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Profile and workspace</h2>
      {field('displayName', 'Your name')}{field('email', 'Email', 'email')}{field('workspaceName', 'Workspace name')}
      <Row label="Time zone" sub="Used for schedules and daily digests.">
        {zones.length ? <select className={s.inp} style={{ width: 280 }} value={st.timezone} aria-label="Time zone" onChange={(e) => void set({ timezone: e.target.value })}>{!zones.includes(st.timezone) && <option value={st.timezone}>{st.timezone || 'Choose…'}</option>}{zones.map((z) => <option key={z}>{z}</option>)}</select> : <input className={s.inp} defaultValue={st.timezone} onBlur={(e) => void set({ timezone: e.target.value })} aria-label="Time zone" />}
        <Btn small onClick={() => void set({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>Detect</Btn>
      </Row>
    </div>
  );
}

function Safety({ st, set }: P) {
  const num = (k: 'maxSteps' | 'stopAfterMinutes' | 'retriesOnFailure', label: string, sub: string) => <Row label={label} sub={sub}><input type="number" min={0} className={s.inp} style={{ width: 96 }} defaultValue={st[k]} aria-label={label} onBlur={(e) => void set({ [k]: Math.max(0, Number(e.target.value) || 0) })} /></Row>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className={s.card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>How much freedom Mates get</h2>
        <Tabs value={st.permissionMode} onChange={(v) => void set({ permissionMode: v })} options={[{ id: 'ask', label: 'Ask first' }, { id: 'auto', label: 'Auto-edit' }, { id: 'plan', label: 'Plan only' }]} />
        <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55, margin: '12px 0 0' }}>{{ ask: 'Mates stop and ask before they write files outside the workspace, send messages or spend anything.', auto: 'Mates edit files inside the workspace on their own. Sending and spending still ask.', plan: 'Mates only plan. Nothing runs until you approve each step.' }[st.permissionMode]}</p>
        <Row label="Ask before risky actions" sub="File writes, purchases and anything outside the sandbox wait for your OK."><Toggle label="Ask before risky actions" checked={st.askBeforeRisky} onChange={(v) => void set({ askBeforeRisky: v })} /></Row>
        <Row label="Allow web access" sub="Lets Mates search and open pages."><Toggle label="Allow web access" checked={st.allowNetwork} onChange={(v) => void set({ allowNetwork: v })} /></Row>
      </div>
      <div className={s.card}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Limits</h2>
        {num('maxSteps', 'Max steps per run', 'A run stops after this many steps.')}{num('retriesOnFailure', 'Retries on failure', 'How often a failed step is tried again.')}{num('stopAfterMinutes', 'Stop after minutes without progress', '0 turns it off.')}
        <p style={{ margin: '12px 0 0', fontSize: 13.5 }}>Hooks and guardrails live in <Link href="/skills" style={{ color: '#4F34D6' }}>Skills & MCP → Agent harness</Link>.</p>
      </div>
    </div>
  );
}

function Dev({ st, set }: P) {
  const numRow = (k: 'maxContextTokens' | 'maxOutputTokens', label: string, sub: string, ph: string) => (
    <Row label={label} sub={sub}><input type="number" min={0} step={256} className={s.inp} style={{ width: 120 }} defaultValue={st[k] || ''} placeholder={ph} aria-label={label} onBlur={(e) => void set({ [k]: Math.max(0, Number(e.target.value) || 0) })} /></Row>
  );
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className={s.card}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Model limits</h2>
        {numRow('maxContextTokens', 'Max context window (tokens)', 'How much chat history is sent with each message. Older messages are dropped (Mates can still look them up). Empty = automatic. Allowed: 1,000 to 2,000,000. Set it at or below what your model supports.', 'Auto')}
        {numRow('maxOutputTokens', 'Max output (tokens)', 'The longest answer a Mate may write. Empty = automatic (grows with the thinking level). Allowed: 64 to 64,000. When set, it is used exactly, and models that think before answering spend part of it on thinking.', 'Auto')}
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)' }}>Tokens are estimated at about 4 characters each, so treat the context limit as approximate.</p>
      </div>
      <div className={s.card}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Thinking</h2>
        <Row label="Show reasoning" sub="Stream the model's thinking into the chat as a collapsible block and keep it with the message. Only models that share their reasoning show anything."><Toggle label="Show reasoning" checked={st.showReasoning} onChange={(v) => void set({ showReasoning: v })} /></Row>
        <Row label="Default thinking level" sub="Used when neither the chat nor the Mate sets one. Change it per chat from the composer, or per Mate in Agents.">
          <Tabs value={st.defaultThinking} onChange={(v) => void set({ defaultThinking: v })} options={[{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }, { id: 'xhigh', label: 'XHigh' }]} />
        </Row>
      </div>
    </div>
  );
}

function Notify({ st, set }: P) {
  return (
    <div className={s.card}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Where Loop reaches you</h2>
      <Row label="Telegram" sub="Run finished, approval needed, run stuck. Pick the exact triggers on Connections."><Toggle label="Telegram notifications" checked={st.notifyTelegram} onChange={(v) => void set({ notifyTelegram: v })} /></Row>
      <Row label="Email" sub="A daily summary and anything that needs you."><Toggle label="Email notifications" checked={st.notifyEmail} onChange={(v) => void set({ notifyEmail: v })} /></Row>
      <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>Nothing is sent until a backend is connected. Set up channels on <Link href="/connections" style={{ color: '#4F34D6' }}>Connections</Link>.</p>
    </div>
  );
}

function Data() {
  const session = useSession(); const toast = useToast();
  const keys = () => Object.keys(localStorage).filter((k) => k.startsWith('lm:v1:'));
  const exportAll = () => {
    const out: Record<string, unknown> = {};
    for (const k of keys()) { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); out[k] = k.endsWith('providers') && Array.isArray(v) ? v.map((p: Record<string, unknown>) => ({ ...p, apiKey: p.apiKey ? '••••' : '' })) : v; } catch { /* skip unreadable keys */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); a.download = 'loopmates-export.json'; a.click(); URL.revokeObjectURL(a.href); toast('Exported (API keys are masked)');
  };
  const clear = () => confirmThen('Delete everything stored in this browser? This cannot be undone.', () => { keys().forEach((k) => localStorage.removeItem(k)); location.reload(); });
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className={s.card}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Backend</h2>
        <Row label={api.capabilities.backend ? 'Connected' : 'Not connected'} sub={api.capabilities.backend ? 'Your data and runs live on your backend.' : 'Everything is saved in this browser only, and nothing runs yet. Set NEXT_PUBLIC_API_URL to connect one.'}><span style={{ width: 10, height: 10, borderRadius: '50%', background: api.capabilities.backend ? '#2FA562' : '#D79A2B' }} /></Row>
        <Row label="Account" sub={session?.signedIn ? `Signed in as ${session.name ?? ''}` : 'Not signed in.'}>{session?.signedIn && <Btn onClick={() => api.auth.signOut().then(() => location.reload())}>Sign out</Btn>}</Row>
      </div>
      <div className={s.card}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Your data</h2>
        <Row label="Export everything" sub="Downloads one JSON file with all workspace data held in this browser. API keys are masked."><Btn onClick={exportAll}>Export</Btn></Row>
        <Row label="Delete local data" sub="Removes everything this browser stores for Loop, including provider keys."><Btn variant="danger" onClick={clear}>Delete</Btn></Row>
      </div>
    </div>
  );
}

/* ---------------- Models & providers ---------------- */
function Models({ st, set }: P) {
  const { items, create, update, remove } = useRepo(api.providers);
  const [sel, setSel] = useState('openai');
  const saved = (p: Preset) => items.find((i) => i.preset === p.id && p.id !== 'custom');
  const customs = items.filter((i) => i.preset === 'custom');
  const cur: { preset: Preset; saved?: ProviderCfg } | null = (() => {
    if (sel === 'new-custom') return { preset: PRESET.custom };
    const c = customs.find((x) => x.id === sel); if (c) return { preset: PRESET.custom, saved: c };
    const p = PRESET[sel]; return p ? { preset: p, saved: saved(p) } : null;
  })();
  const groups = ['Frontier', 'Open & hosting', 'Local'] as const;
  const row = (id: string, name: string, ini: string, state: 'on' | 'off' | '') => <button key={id} className={s.pbtn} aria-current={sel === id} onClick={() => setSel(id)}><span className={s.ini} style={{ background: tint(id) }}>{ini}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span><i className={`${s.dot} ${state ? s[state] : ''}`} /></button>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className={s.card} style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}><b style={{ fontSize: 16 }}>Default model</b><p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>Used by any Mate that does not pick its own. Only models from providers you set up below can be chosen.</p></div>
        <div style={{ width: 'min(340px,100%)' }}><ModelPicker value={st.model} onChange={(v) => void set({ model: v })} allowDefault={false} /></div>
      </div>
      <div className={s.prov}>
        <div className={s.plist} role="list" aria-label="Providers">
          {groups.map((g) => <div key={g}><p className={s.pgrp}>{g.toUpperCase()}</p>{PRESETS.filter((p) => p.group === g && p.id !== 'custom').map((p) => { const sv = saved(p); return row(p.id, p.name, p.name[0], sv ? (sv.enabled ? 'on' : 'off') : ''); })}</div>)}
          <p className={s.pgrp}>CUSTOM (OPENAI-COMPATIBLE)</p>
          {customs.map((c) => row(c.id, c.name || 'Custom', 'C', c.enabled ? 'on' : 'off'))}
          <button className={s.pbtn} aria-current={sel === 'new-custom'} onClick={() => setSel('new-custom')} style={{ color: '#4F34D6', fontWeight: 600 }}><span className={s.ini} style={{ background: '#ECE7FF' }}>+</span>Add custom provider</button>
        </div>
        {cur && <Editor key={sel + (cur.saved?.id ?? '')} preset={cur.preset} saved={cur.saved} st={st} set={set}
          onSave={async (d) => { const r = cur.saved ? await update(cur.saved.id, d) : await create(d); if (!cur.saved && cur.preset.id === 'custom') setSel(r.id); return r; }}
          onRemove={cur.saved ? async () => { await remove(cur.saved!.id); if (cur.preset.id === 'custom') setSel('openai'); } : undefined} />}
      </div>
    </div>
  );
}

type Draft = { name: string; baseUrl: string; apiKey: string; models: string[]; enabled: boolean };
function Editor({ preset, saved, st, set, onSave, onRemove }: { preset: Preset; saved?: ProviderCfg; st: SettingsData; set: P['set']; onSave: (d: Draft & { preset: string; fetchedAt?: string }) => Promise<ProviderCfg>; onRemove?: () => Promise<void> }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>({ name: saved?.name ?? (preset.id === 'custom' ? '' : preset.name), baseUrl: saved?.baseUrl ?? preset.baseUrl, apiKey: saved?.apiKey ?? '', models: saved?.models ?? [], enabled: saved?.enabled ?? true });
  const [avail, setAvail] = useState<string[] | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [find, setFind] = useState(''); const [show, setShow] = useState(false); const [manual, setManual] = useState('');
  const custom = preset.id === 'custom';
  const list = (avail ?? [...new Set([...d.models, ...preset.models])]).filter((m) => m.toLowerCase().includes(find.toLowerCase()));
  const dirty = !saved || saved.name !== d.name || saved.baseUrl !== d.baseUrl || saved.apiKey !== d.apiKey || saved.enabled !== d.enabled || saved.models.join() !== d.models.join();
  const toggle = (m: string) => setD((x) => ({ ...x, models: x.models.includes(m) ? x.models.filter((y) => y !== m) : [...x.models, m] }));
  const valid = /^https?:\/\//.test(d.baseUrl) && (custom ? !!d.name.trim() : true) && (preset.keyless || !!d.apiKey.trim());

  const save = async () => { await onSave({ preset: preset.id, ...d, name: d.name.trim() || preset.name, fetchedAt: avail ? new Date().toISOString() : saved?.fetchedAt }); toast(`${d.name || preset.name} saved`); };
  const fetchModels = async () => {
    setBusy(true); setErr(null);
    try {
      let ids: string[];
      if (api.capabilities.backend) { const r = saved ?? (await onSave({ preset: preset.id, ...d, name: d.name.trim() || preset.name })); ids = await api.providers.fetchModels(r.id); }
      else ids = await fetchModelList({ baseUrl: d.baseUrl, apiKey: d.apiKey, auth: preset.auth });
      setAvail(ids); toast(`${ids.length} models found`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not fetch models.'); } finally { setBusy(false); }
  };

  return (
    <section className={s.card} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className={s.ini} style={{ background: tint(preset.id), width: 44, height: 44, fontSize: 16, borderRadius: 12 }}>{(d.name || preset.name)[0]}</span>
        <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 20 }}>{custom ? d.name || 'New custom provider' : preset.name}</b><div style={{ color: 'var(--muted)', fontSize: 13 }}>{custom ? preset.hint : `Get a key at ${preset.hint}`}</div></div>
        {saved && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>Enabled<Toggle label="Enabled" checked={d.enabled} onChange={(v) => setD({ ...d, enabled: v })} /></label>}
      </div>
      {custom && <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' }}>Name<input className={s.inp} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. My vLLM box" /></label>}
      <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' }}>Base URL<input className={s.inp} value={d.baseUrl} onChange={(e) => setD({ ...d, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" spellCheck={false} /></label>
      {!preset.keyless && <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' }}>API key
        <span style={{ display: 'flex', gap: 8 }}><input className={s.inp} style={{ flex: 1 }} type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={d.apiKey} onChange={(e) => setD({ ...d, apiKey: e.target.value })} placeholder="sk-…" /><Btn type="button" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</Btn></span></label>}
      {!api.capabilities.backend && !preset.keyless && <div style={{ background: '#FFF8E5', border: '1px solid #F0D58A', borderRadius: 12, padding: '10px 14px', fontSize: 13, lineHeight: 1.5, color: '#5E4300' }}>No backend yet, so this key is stored in this browser (localStorage), readable by anything running on this site. Use a key with a low spend limit, and move to the backend before using real keys.</div>}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <b style={{ fontSize: 15 }}>Models</b><span style={{ color: 'var(--muted)', fontSize: 13 }}>{d.models.length} enabled{avail ? ` · ${avail.length} found` : ''}</span><span style={{ flex: 1 }} />
          <input className={s.inp} style={{ height: 36, width: 160 }} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Filter" aria-label="Filter models" />
          <Btn onClick={fetchModels} disabled={busy || !/^https?:\/\//.test(d.baseUrl) || (!preset.keyless && !d.apiKey.trim())}>{busy ? 'Fetching…' : 'Fetch models'}</Btn>
        </div>
        {err && <div role="alert" style={{ background: '#FDE8E8', color: '#8E1C14', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, marginBottom: 10, lineHeight: 1.5 }}>{err}</div>}
        {!avail && list.length > 0 && <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)' }}>{d.models.length ? 'Your enabled models, plus suggestions.' : 'Suggestions only. Press Fetch models to see exactly what this provider offers.'}</p>}
        {list.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0 }}>{preset.models.length === 0 && !avail ? 'No models yet. Press Fetch models, or add an ID by hand below.' : 'No models match.'}</p> : (
          <div className={s.mgrid}>{list.map((m) => <button type="button" key={m} className={`${s.mchip} ${d.models.includes(m) ? s.on : ''}`} aria-pressed={d.models.includes(m)} onClick={() => toggle(m)} title={m}><input type="checkbox" readOnly tabIndex={-1} checked={d.models.includes(m)} style={{ accentColor: '#6A4DF4' }} /><span className="mono">{m}</span>{saved && d.models.includes(m) && st.model === modelKey(saved.id, m) && <b style={{ marginLeft: 'auto', fontSize: 11, color: '#4F34D6' }}>default</b>}</button>)}</div>)}
        <form onSubmit={(e) => { e.preventDefault(); const m = manual.trim(); if (m && !d.models.includes(m)) setD({ ...d, models: [...d.models, m] }); setManual(''); }} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className={s.inp} style={{ flex: 1, height: 38 }} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Add a model ID by hand" aria-label="Add a model ID" /><Btn type="submit" disabled={!manual.trim()}>Add</Btn>
          {avail && <Btn type="button" onClick={() => setD({ ...d, models: avail })}>Select all</Btn>}{d.models.length > 0 && <Btn type="button" onClick={() => setD({ ...d, models: [] })}>Clear</Btn>}
        </form>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(31,26,23,.08)', paddingTop: 16 }}>
        {onRemove && <Btn variant="danger" onClick={() => confirmThen(`Remove ${saved?.name}? Mates using its models fall back to the default.`, () => void onRemove())}>Remove</Btn>}
        {saved && d.models.length > 0 && <select className={s.inp} style={{ height: 40, maxWidth: 260 }} aria-label="Use as default model" value="" onChange={(e) => { if (e.target.value) { void set({ model: modelKey(saved.id, e.target.value) }); toast('Default model set'); } }}><option value="">Use as default model…</option>{saved.models.map((m) => <option key={m}>{m}</option>)}</select>}
        <span style={{ flex: 1 }} />
        <Btn variant="primary" style={{ minWidth: 140 }} disabled={!valid || !dirty} onClick={save}>{saved ? 'Save changes' : 'Save provider'}</Btn>
      </div>
    </section>
  );
}
