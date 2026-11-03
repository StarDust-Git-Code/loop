'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { mateImg, mateName } from '../../lib/mates';
import type { Connection, MateKey, Provider } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, ErrorNote, Field, Input, Loading, Modal, Page, Toggle } from '../ui/ui';
import { Icon } from '../ui/Icon';

const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 20, boxShadow: '0 2px 6px rgba(31,26,23,.05)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 } as const;
const cap = { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#3D3946', margin: 0 } as const;
const OTHER: Partial<Record<Provider, { name: string; text: string; fields: { key: string; label: string; secret?: boolean }[] }>> = {
  gdrive: { name: 'Google Drive', text: 'Search and read files from your Drive.', fields: [{ key: 'folder', label: 'Folder to share (optional)' }] },
  github: { name: 'GitHub', text: 'Let Code Mate open pull requests and read repos.', fields: [{ key: 'token', label: 'Personal access token', secret: true }, { key: 'repo', label: 'Default repo (owner/name)' }] },
  email: { name: 'Email', text: 'Send summaries to your inbox.', fields: [{ key: 'address', label: 'Email address' }] },
};
const WHEN = [['A run finishes', 'n_finish'], ['An agent needs my approval', 'n_approval'], ['A run fails or gets stuck', 'n_fail'], ['Daily digest at 20:00', 'n_digest'], ['Quiet hours 23:00 to 07:00', 'n_quiet']] as const;
const CORE: MateKey[] = ['research', 'code', 'planner', 'writer', 'browser', 'ops'];
const pill = (c?: Connection) => { const ok = c?.status === 'connected'; return <span style={{ background: ok ? '#E6F4EA' : c ? '#FFF3D6' : '#ECE9F4', color: ok ? '#1E7A46' : c ? '#8A5A00' : '#6B6572', fontSize: 12, fontWeight: 600, borderRadius: 99, padding: '4px 12px', whiteSpace: 'nowrap' }}>{ok ? 'Connected' : c ? (c.status === 'error' ? 'Error' : 'Waiting for backend') : 'Not connected'}</span>; };

export function Connections() {
  const { items, loading, error, create, update, remove, reload } = useRepo(api.connections);
  const toast = useToast();
  const wa = items.find((c) => c.provider === 'whatsapp'), tg = items.find((c) => c.provider === 'telegram');
  const [sheet, setSheet] = useState<Provider | null>(null); const [cfg, setCfg] = useState<Record<string, string>>({});
  const [chats, setChats] = useState<{ id: string; name: string; meta: string }[]>([]);
  useEffect(() => { let on = true; if (wa) api.connections.chats(wa.id).then((c) => on && setChats(c)).catch(() => on && setChats([])); return () => { on = false; }; }, [wa]);

  const save = async (provider: Provider, label: string, config: Record<string, string>, ex?: Connection) => {
    const d = { provider, label, status: 'pending' as const, config }; const c = ex ? await update(ex.id, d) : await create(d); await api.connections.test(c.id); return c;
  };
  const patch = (c: Connection, k: string, v: string) => void update(c.id, { config: { ...c.config, [k]: v } });
  const sel = (wa?.config.chats ?? '').split(',').filter(Boolean);
  const toggleChat = (id: string) => wa && patch(wa, 'chats', (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]).join(','));
  const on = (c: Connection, k: string) => (c.config[k] ?? 'on') === 'on';
  const mates = (tg?.config.mates ?? CORE.join(',')).split(',').filter(Boolean);
  const [link, setLink] = useState<{ code: string; bot: string | null; expiresInMinutes: number } | null>(null); const [linking, setLinking] = useState(false);
  useEffect(() => { if (!link || tg) return; const t = setInterval(() => { void reload(); }, 3000); return () => clearInterval(t); }, [link, tg, reload]);
  const def = sheet && OTHER[sheet];

  return (
    <Page fill title="Connections" sub="Let agents read the chats you choose, and reach you where you already are." actions={<Btn onClick={() => setSheet('gdrive')}>Add connection</Btn>}>
      <ErrorNote message={error} />
      <div style={{ background: '#F1ECFF', border: '1px solid rgba(106,77,244,.3)', borderRadius: 12, padding: '12px 18px', fontSize: 14, marginBottom: 16 }}><b>You stay in control.</b> Agents only read chats you tick, never send as you, and every outgoing message waits for your approval.</div>
      {loading ? <Loading /> : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(480px,100%),1fr))', gap: 20, overflow: 'auto' }}>
          <section style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 48, height: 48, borderRadius: 12, background: '#DFF3E3', color: '#1E7A46', fontWeight: 700, display: 'grid', placeItems: 'center' }}>WA</span><div style={{ flex: 1 }}><b style={{ fontSize: 20 }}>WhatsApp</b><div style={{ color: '#6B6572', fontSize: 13.5 }}>Linked through a local, read-only bridge on your machine</div></div>{pill(wa)}</div>
            {!wa ? <div style={{ margin: 'auto', textAlign: 'center', color: '#6B6572', maxWidth: 340 }}><img src={mateImg('recall')} alt="" width={64} style={{ display: 'block', margin: '0 auto 6px', animation: 'lm-bob 3.6s ease-in-out infinite' }} /><p style={{ lineHeight: 1.55 }}>Not linked. Once linked, the chats your bridge can see appear here and you tick the ones agents may read.</p><Btn variant="primary" onClick={() => { setCfg({}); setSheet('whatsapp'); }}>Link WhatsApp</Btn></div> : <>
              <div style={{ display: 'flex' }}><p style={{ ...cap, flex: 1 }}>CHOOSE CHATS AGENTS CAN READ</p><span style={{ color: '#4F34D6', fontSize: 13, fontWeight: 600 }}>{sel.length} of {chats.length} selected</span></div>
              <div style={{ border: '1px solid rgba(27,24,34,.12)', borderRadius: 14, overflow: 'auto', flex: 1, minHeight: 120 }}>
                {chats.length === 0 ? <p style={{ color: '#6B6572', padding: 20, margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{api.capabilities.backend ? 'The bridge has not listed any chats yet. Check that it is running.' : 'Chats are listed by the bridge, so this needs the backend.'}</p> : chats.map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid rgba(31,26,23,.08)', background: sel.includes(c.id) ? '#F4F0FF' : 'none', cursor: 'pointer', transition: 'background .2s' }}>
                    <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggleChat(c.id)} style={{ width: 20, height: 20, accentColor: '#6A4DF4' }} /><span style={{ width: 36, height: 36, borderRadius: '50%', background: '#F1EFF6', display: 'grid', placeItems: 'center', fontWeight: 600 }}>{c.name[0]}</span>
                    <div style={{ flex: 1 }}><b style={{ fontSize: 14.5 }}>{c.name}</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>{c.meta}</div></div><span style={{ fontSize: 12.5, color: sel.includes(c.id) ? '#4F34D6' : '#6B6572' }}>{sel.includes(c.id) ? 'Shared' : 'Not shared'}</span>
                  </label>))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {([['History window', 'history', ['Last 24 hours', 'Last 7 days', 'Last 30 days']], ['Media', 'media', ['Text only', 'Text and images']], ['Access', 'access', ['Read-only']]] as const).map(([l, k, o]) => <label key={k} style={{ background: '#F4F2FA', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#6B6572' }}>{l}<select value={wa.config[k] ?? o[Math.min(1, o.length - 1)]} onChange={(e) => patch(wa, k, e.target.value)} style={{ display: 'block', width: '100%', border: 0, background: 'none', font: 'inherit', fontSize: 15, fontWeight: 600, color: '#1B1822', outline: 0 }}>{o.map((x) => <option key={x}>{x}</option>)}</select></label>)}
              </div>
              <p style={{ color: '#6B6572', fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>WhatsApp has no official personal-account API, so this bridge relies on an unofficial route. Use it at your own risk and keep the chat list short.</p>
              <Btn small variant="danger" style={{ alignSelf: 'flex-start' }} onClick={() => confirmThen('Unlink WhatsApp?', () => remove(wa.id))}>Unlink</Btn>
            </>}
          </section>

          <section style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 48, height: 48, borderRadius: 12, background: '#DCEBFF', color: '#1F5FBF', fontWeight: 700, display: 'grid', placeItems: 'center' }}>TG</span><div style={{ flex: 1 }}><b style={{ fontSize: 20 }}>Telegram</b><div style={{ color: '#6B6572', fontSize: 13.5 }}>Your Loop bot messages you and takes quick replies</div></div>{pill(tg)}</div>
            {!tg ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 'auto', width: 'min(440px,100%)' }}>
                <p style={{ color: '#6B6572', margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>The bot itself is set up on the server. To link <b>your</b> Telegram chat: get a code here, then send it to the bot as <b>/start CODE</b>.</p>
                {!link ? <Btn variant="primary" disabled={linking} onClick={async () => { setLinking(true); try { setLink(await api.connections.telegramLinkCode()); } catch (e) { toast(e instanceof Error ? e.message : 'Could not get a code'); } finally { setLinking(false); } }}>{linking ? 'Getting a code…' : 'Get link code'}</Btn> : (
                  <div style={{ background: '#F4F0FF', border: '1px solid rgba(106,77,244,.3)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={cap}>SEND THIS TO {(link.bot ?? 'YOUR BOT').toUpperCase()}</p>
                    <code style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.04em', userSelect: 'all' }}>/start {link.code}</code>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn small onClick={() => { void navigator.clipboard.writeText(`/start ${link.code}`); toast('Copied'); }}>Copy</Btn>
                      {link.bot && <Btn small onClick={() => window.open(`https://t.me/${link.bot!.replace(/^@/, '')}`, '_blank', 'noopener')}>Open Telegram</Btn>}
                      <Btn small onClick={() => setLink(null)}>New code</Btn>
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#6B6572' }}>Expires in {link.expiresInMinutes} minutes. This page updates by itself once the bot says "Linked".</p>
                  </div>)}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,250px) minmax(0,1fr)', gap: 18, flex: 1, minHeight: 0, overflow: 'auto' }}>
                <div style={{ background: '#EBE3D3', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'start' }} aria-label="Preview of Telegram messages">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}><img src={mateImg('research')} width={22} alt="" />Loop bot <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: '#6B6572' }}>preview</span></div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.45 }}>Writer Mate finished <b>Script: episode 3</b>. One file is ready.</div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.45 }}>Browser Mate wants to open a page and generate 4 images. Approve?</div>
                  <div style={{ display: 'flex', gap: 6 }}><span style={{ flex: 1, background: '#6A4DF4', color: '#fff', borderRadius: 10, padding: 9, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Approve</span><span style={{ flex: 1, background: '#fff', borderRadius: 10, padding: 9, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Deny</span></div>
                  <div style={{ alignSelf: 'flex-end', background: '#E3DCFF', borderRadius: 12, padding: '8px 12px', fontSize: 13 }}>/btw how long left?</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={cap}>MESSAGE ME WHEN</p>
                  {WHEN.map(([l, k]) => <div key={k} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(31,26,23,.08)', fontSize: 14.5 }}><span style={{ flex: 1 }}>{l}</span><Toggle label={l} checked={on(tg, k)} onChange={(v) => patch(tg, k, v ? 'on' : 'off')} /></div>)}
                </div>
              </div>)}
            {tg && <>
              <p style={cap}>WHICH DOTS MAY MESSAGE ME</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{CORE.map((m) => { const a = mates.includes(m); return <button key={m} onClick={() => patch(tg, 'mates', (a ? mates.filter((x) => x !== m) : [...mates, m]).join(','))} aria-pressed={a} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(27,24,34,.17)', borderRadius: 99, padding: '5px 14px 5px 6px', background: a ? '#F4F0FF' : '#fff', opacity: a ? 1 : 0.55, font: 'inherit', fontSize: 14, cursor: 'pointer', transition: 'all .2s' }}><img src={mateImg(m)} alt="" width={26} height={26} />{mateName(m).replace(' Mate', '')}</button>; })}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                <Btn style={{ flex: 1, height: 48 }} onClick={async () => { await api.connections.test(tg.id); toast(api.capabilities.backend ? 'Test message sent' : 'Needs the backend to send') }}>Send test message</Btn>
                <Btn variant="primary" style={{ flex: 1, height: 48 }} onClick={() => toast('Telegram settings saved')}>Save</Btn>
                <Btn variant="danger" small aria-label="Disconnect Telegram" onClick={() => confirmThen('Disconnect Telegram?', () => remove(tg.id))}><Icon name="close" size={16} /></Btn>
              </div></>}
          </section>

          {(Object.keys(OTHER) as Provider[]).some((p) => items.some((c) => c.provider === p)) && (
            <section style={{ ...card, gridColumn: '1 / -1' }}>
              <p style={cap}>OTHER CONNECTIONS</p>
              {items.filter((c) => OTHER[c.provider]).map((c) => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(31,26,23,.08)' }}><b style={{ flex: 1 }}>{c.label}</b>{pill(c)}<Btn small onClick={() => { setCfg(c.config); setSheet(c.provider); }}>Edit</Btn><Btn small variant="danger" onClick={() => confirmThen(`Disconnect ${c.label}?`, () => remove(c.id))}><Icon name="close" size={16} /></Btn></div>)}
            </section>)}
        </div>)}

      {sheet === 'whatsapp' && <Modal title="Link WhatsApp" submitLabel="Link" onClose={() => setSheet(null)} canSubmit={!!cfg.phone?.trim()} onSubmit={async () => { await save('whatsapp', 'WhatsApp', { phone: cfg.phone, history: 'Last 7 days', media: 'Text only', access: 'Read-only' }); setSheet(null); toast('WhatsApp saved. Start the local bridge to list chats'); }}>
        <Field label="Phone number"><Input value={cfg.phone ?? ''} onChange={(e) => setCfg({ ...cfg, phone: e.target.value })} /></Field><p style={{ margin: 0, fontSize: 12.5, color: '#6B6572' }}>Read-only. Nothing is sent as you.</p></Modal>}
      {sheet && sheet !== 'whatsapp' && (def ? (
        <Modal title={`Connect ${def.name}`} submitLabel="Save and test" onClose={() => setSheet(null)} canSubmit={def.fields.some((f) => cfg[f.key]?.trim())} onSubmit={async () => { await save(sheet, def.name, cfg, items.find((c) => c.provider === sheet)); setSheet(null); toast(`${def.name} saved`); }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(Object.keys(OTHER) as Provider[]).map((p) => <button key={p} onClick={() => { setSheet(p); setCfg(items.find((c) => c.provider === p)?.config ?? {}); }} style={{ border: 0, borderRadius: 99, padding: '5px 14px', font: 'inherit', fontSize: 13, cursor: 'pointer', background: sheet === p ? '#6A4DF4' : '#ECE9F4', color: sheet === p ? '#fff' : '#3D3946' }}>{OTHER[p]!.name}</button>)}</div>
          <p style={{ margin: 0, color: '#6B6572', fontSize: 13 }}>{def.text}</p>
          {def.fields.map((f) => <Field key={f.key} label={f.label}><Input type={f.secret ? 'password' : 'text'} autoComplete="off" value={cfg[f.key] ?? ''} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })} /></Field>)}
          {!api.capabilities.backend && <p style={{ margin: 0, fontSize: 12, color: '#6B6572' }}>Saved in this browser only until a backend is connected. Do not enter real secrets in this mode.</p>}
        </Modal>) : null)}
    </Page>
  );
}
