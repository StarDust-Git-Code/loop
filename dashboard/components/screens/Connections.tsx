'use client';
// Connections: one step-by-step flow per channel, each ending with a Test. The steps match section 8 of the agents'
// system prompt, so an agent explaining "how do I link Drive?" and this screen say the same thing.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { serverUrl } from '../../lib/serverUrl';
import type { Connection, HarnessKey, Harnesses, HarnessTest, Integration, Provider, ServerField } from '../../lib/types';
import { useSettings } from '../../lib/hooks';
import { useToast } from '../ui/toast';
import { confirmThen } from '../ui/ui';
import s from './connections.module.css';

type Key = 'telegram' | 'discord' | 'gdrive' | 'github' | 'coder' | 'whatsapp';
const META: Record<Key, { name: string; badge: string; bg: string; fg: string; what: string }> = {
  telegram: { name: 'Telegram', badge: 'TG', bg: '#DCEBFF', fg: '#1F5FBF', what: 'Your own bot messages you when runs finish or need you, rings you for calls, and answers when you write to it.' },
  discord: { name: 'Discord', badge: 'DC', bg: '#E4E7FF', fg: '#3B45C4', what: 'Slash commands /ask, /run and /status, plus run updates and tap-to-answer questions in a DM.' },
  gdrive: { name: 'Google Drive', badge: 'GD', bg: '#E6F4EA', fg: '#1E7A46', what: 'Agents read and write files inside one folder you pick, and run deliverables are saved there.' },
  github: { name: 'GitHub', badge: 'GH', bg: '#EEF0F3', fg: '#0F172A', what: 'The coder clones the repositories you allow, commits on a branch and opens a pull request.' },
  coder: { name: 'Coding harness', badge: '</>', bg: '#EAF1FF', fg: '#1F55E6', what: 'Pick what does coding steps: the built-in coder, or Claude Code, Codex or OpenCode signed in with your own account on this computer. The Code Mate supervises it: it writes a brief, checks the changes and the tests, and sends the work back until it passes.' },
  whatsapp: { name: 'WhatsApp', badge: 'WA', bg: '#DFF3E3', fg: '#1E7A46', what: 'Read-only: agents can read the chats you tick. Nothing is ever sent as you.' },
};
const ORDER: Key[] = ['telegram', 'discord', 'gdrive', 'github', 'coder', 'whatsapp'];

export function Connections() {
  const { items, create, update, remove, reload } = useRepo(api.connections);
  const [sel, setSel] = useState<Key | `int:${string}`>('telegram');
  const [cfg, setCfg] = useState<ServerField[]>([]);
  const [cfgErr, setCfgErr] = useState('');
  const [ints, setInts] = useState<Integration[]>([]);
  const loadInts = useCallback(() => api.integrations.list().then(setInts).catch(() => {}), []);
  const loadCfg = useCallback(() => { void loadInts(); return api.server.config().then((c) => { setCfg(c); setCfgErr(''); }).catch((e: Error) => setCfgErr(e.message)); }, [loadInts]);
  useEffect(() => { void loadCfg(); }, [loadCfg]);
  const selInt = typeof sel === 'string' && sel.startsWith('int:') ? ints.find((i) => `int:${i.key}` === sel) : undefined;
  const field = (k: string) => cfg.find((f) => f.key === k);
  const conn = (p: Provider) => items.find((c) => c.provider === p);

  const state = (k: Key): { label: string; tone: 'on' | 'wait' | 'off' } => {
    if (k === 'coder') return { label: 'Pick an engine', tone: 'on' };
    const c = conn(k);
    if (k === 'gdrive') return field('GOOGLE_REFRESH_TOKEN')?.set ? (field('DRIVE_ROOT_FOLDER_ID')?.value ? { label: 'Connected', tone: 'on' } : { label: 'Pick a folder', tone: 'wait' }) : field('GOOGLE_CLIENT_ID')?.set ? { label: 'Sign in next', tone: 'wait' } : { label: 'Not connected', tone: 'off' };
    if (c?.status === 'connected') return { label: 'Connected', tone: 'on' };
    if (k === 'telegram' && field('TELEGRAM_BOT_TOKEN')?.set) return { label: 'Bot ready, link your chat', tone: 'wait' };
    if (k === 'discord' && field('DISCORD_BOT_TOKEN')?.set) return { label: 'Bot ready, link your account', tone: 'wait' };
    if (c) return { label: c.status === 'error' ? 'Error' : 'Waiting', tone: 'wait' };
    return { label: 'Not connected', tone: 'off' };
  };

  return (
    <main className={s.page}>
      <div className={s.head}>
        <h1 className={s.h1}>Connections</h1>
        <p className={s.lede}>Link the places your agents may reach you or work in. Tokens are stored encrypted on your own server, never in this browser.</p>
      </div>
      {cfgErr && <div className={s.warn}>{cfgErr}</div>}
      <div className={s.layout}>
        <div className={s.list} role="tablist" aria-label="Channels">
          {ORDER.map((k) => {
            const st = state(k);
            return (
              <button key={k} type="button" role="tab" aria-selected={sel === k} className={s.tab} onClick={() => setSel(k)}>
                <span className={s.badge} style={{ background: META[k].bg, color: META[k].fg }} aria-hidden="true">{META[k].badge}</span>
                <span className={s.tabText}><span className={s.tabName}>{META[k].name}</span><span className={s.tabState}>{st.label}</span></span>
                <span className={`${s.dot} ${st.tone === 'on' ? s.dotOn : st.tone === 'wait' ? s.dotWait : ''}`} aria-hidden="true" />
              </button>
            );
          })}
          {ints.length > 0 && <p className={s.hint} style={{ margin: '14px 4px 6px', fontWeight: 600 }}>Apps</p>}
          {ints.map((i) => {
            const k = `int:${i.key}` as const; const linked = conn(i.key as Provider)?.status === 'connected';
            const tone = i.ready ? (i.linkCode && !linked ? 'wait' : 'on') : 'off';
            return (
              <button key={k} type="button" role="tab" aria-selected={sel === k} className={s.tab} onClick={() => setSel(k)}>
                <span className={s.badge} style={{ background: i.bg, color: i.fg }} aria-hidden="true">{i.badge}</span>
                <span className={s.tabText}><span className={s.tabName}>{i.name}</span><span className={s.tabState}>{i.ready ? (i.linkCode && !linked ? 'Ready, link your account' : 'Ready') : 'Not set up'}</span></span>
                <span className={`${s.dot} ${tone === 'on' ? s.dotOn : tone === 'wait' ? s.dotWait : ''}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {selInt ? <IntegrationPanel key={selInt.key} i={selInt} field={field} onSaved={loadCfg} linked={conn(selInt.key as Provider)?.status === 'connected'} reload={reload} /> : !String(sel).startsWith('int:') && (() => { const k = sel as Key; return (
        <section className={s.panel} role="tabpanel" aria-label={META[k].name}>
          <div className={s.panelHead}>
            <span className={s.badge} style={{ background: META[k].bg, color: META[k].fg }} aria-hidden="true">{META[k].badge}</span>
            <h2 className={s.h2}>{META[k].name}</h2>
          </div>
          <p className={s.what}>{META[k].what}</p>
          {sel === 'telegram' && <Telegram conn={conn('telegram')} field={field} onSaved={loadCfg} reload={reload} remove={remove} />}
          {sel === 'discord' && <Discord conn={conn('discord')} field={field} onSaved={loadCfg} reload={reload} remove={remove} />}
          {sel === 'gdrive' && <Drive conn={conn('gdrive')} field={field} onSaved={loadCfg} create={create} update={update} />}
          {sel === 'github' && <GitHub conn={conn('github')} field={field} onSaved={loadCfg} create={create} update={update} remove={remove} />}
          {sel === 'coder' && <Coder />}
          {sel === 'whatsapp' && <p className={s.stepText}>WhatsApp has no official API for personal accounts. The read-only bridge on your server links with your phone number and an 8-character code, then you tick the chats agents may read. It uses an unofficial route, so keep the chat list short. Ask Mimo “link WhatsApp” to start it. To chat with your Mates in WhatsApp instead, use the official WhatsApp app under Apps.</p>}
        </section>); })()}
      </div>
    </main>
  );
}

type FieldFn = (k: string) => ServerField | undefined;

/** One optional app, drawn from its server-side description: steps, settings, extras (manifest, webhook, link code, sign-in, health key), and a test. */
function IntegrationPanel({ i, field, onSaved, linked, reload }: { i: Integration; field: FieldFn; onSaved: () => void; linked: boolean; reload: () => void }) {
  const toast = useToast();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState('');
  const [link, setLink] = useState<{ command: string } | null>(null);
  const [key, setKey] = useState<{ key: string; url: string } | null>(null); const [csv, setCsv] = useState('');
  useEffect(() => { if (!link || linked) return; const t = setInterval(reload, 3000); return () => clearInterval(t); }, [link, linked, reload]);
  const doIt = async (label: string, fn: () => Promise<{ ok?: boolean; text?: string } | void>) => {
    setBusy(label); setMsg(null);
    try { const r = await fn(); if (r && 'text' in r && r.text) setMsg({ ok: r.ok !== false, t: r.text }); onSaved(); } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : 'Failed' }); } finally { setBusy(''); }
  };
  const copy = (t: string) => { void navigator.clipboard.writeText(t); toast('Copied'); };
  const box = { whiteSpace: 'pre-wrap', fontSize: 12, background: '#F6F8FB', border: '1px solid var(--line)', borderRadius: 10, padding: 10, marginTop: 8, maxHeight: 220, overflow: 'auto' } as const;
  return (
    <section className={s.panel} role="tabpanel" aria-label={i.name}>
      <div className={s.panelHead}>
        <span className={s.badge} style={{ background: i.bg, color: i.fg }} aria-hidden="true">{i.badge}</span>
        <h2 className={s.h2}>{i.name}</h2>
      </div>
      <p className={s.what}>{i.what}</p>
      <ol className={s.steps}>
        {i.steps.map((st, n) => (
          <li key={st.title} className={`${s.step} ${i.ready && (n < i.steps.length - 1 || !i.linkCode || linked) ? s.stepDone : ''}`}><div>
            <h3 className={s.stepTitle}>{st.title}</h3>
            <p className={s.stepText}>{st.text}</p>
            {n === 0 && i.manifest && <><pre style={box}>{i.manifest}</pre><div className={s.row}><button type="button" className={s.ghost} onClick={() => copy(i.manifest!)}>Copy manifest</button></div></>}
            {n === 0 && i.oauth && <p className={s.stepText} style={{ marginTop: 8 }}>Redirect URI: <span className={s.mono}>{i.oauth.redirect}</span>{i.oauth.publicRedirect && <> (or <span className={s.mono}>{i.oauth.publicRedirect}</span> from another device)</>}</p>}
            {i.webhookUrl !== undefined && /webhook/i.test(st.title) && <p className={s.stepText} style={{ marginTop: 8 }}>Callback URL: {i.webhookUrl ? <><span className={s.mono}>{i.webhookUrl}</span> <button type="button" className={s.ghost} onClick={() => copy(i.webhookUrl!)}>Copy</button></> : <b>start a public address first (Server → Public address)</b>}</p>}
          </div></li>
        ))}
        {i.fields.length > 0 && <li className={`${s.step} ${i.fields.every((f) => field(f.key)?.set) ? s.stepDone : ''}`}><div>
          <h3 className={s.stepTitle}>Settings on your server</h3>
          <ServerFields keys={i.fields} field={field} onSaved={onSaved} />
        </div></li>}
        {(i.oauth || i.linkCode || i.actions?.length || i.ingestUrl !== undefined) && <li className={s.step}><div>
          {i.oauth && <>
            <div className={s.row}>
              <button type="button" className={s.primary} disabled={!!busy} onClick={() => void doIt('oauth', async () => { const r = await api.integrations.spotifyStart(true); window.open(r.url, '_blank', 'noopener'); })}>{i.oauth.label} (on the server computer)</button>
              {i.oauth.publicRedirect && <button type="button" className={s.ghost} disabled={!!busy} onClick={() => void doIt('oauth', async () => { const r = await api.integrations.spotifyStart(false); window.open(r.url, '_blank', 'noopener'); })}>From this device</button>}
              <button type="button" className={s.ghost} onClick={onSaved}>I signed in</button>
            </div>
            <p className={s.hint}>The first button uses the 127.0.0.1 redirect, which never changes: open this page on the computer that runs Loopmates. &ldquo;From this device&rdquo; uses your public address, which changes with a quick tunnel.</p>
          </>}
          {i.linkCode && (link ? <div className={s.row}><span className={s.code}>{link.command}</span><button type="button" className={s.ghost} onClick={() => copy(link.command)}>Copy</button>{linked && <span className={s.ok}>Linked.</span>}</div>
            : <div className={s.row}><button type="button" className={s.primary} disabled={!i.ready || !!busy} onClick={() => void doIt('link', async () => { setLink(await api.integrations.linkCode(i.key)); })}>{linked ? 'Link another account' : 'Get a link code'}</button>{!i.ready && <span className={s.hint}>Save the settings first.</span>}{linked && <span className={s.ok}>Linked.</span>}</div>)}
          {i.actions?.map((a) => <div key={a.id} className={s.row}><button type="button" className={s.ghost} disabled={!i.ready || !!busy} onClick={() => void doIt(a.id, () => api.integrations.obsidianSync())}>{busy === a.id ? 'Working…' : a.label}</button></div>)}
          {i.ingestUrl !== undefined && <>
            <div className={s.row}><button type="button" className={s.primary} disabled={!!busy} onClick={() => void doIt('key', async () => { setKey(await api.integrations.healthKey()); })}>{key ? 'Make a new key' : 'Make an ingest key'}</button></div>
            {key && <><p className={s.stepText}>Shown once. Making a new key turns the old one off.</p><div className={s.row}><span className={s.code}>{key.key}</span><button type="button" className={s.ghost} onClick={() => copy(key.key)}>Copy</button></div>
              <p className={s.stepText}>Post to: <span className={s.mono}>{key.url || `${serverUrl()}/health/ingest`}</span></p></>}
            <label style={{ display: 'block', marginTop: 10 }}><span className={s.label}>Or paste a CSV export</span><textarea className={s.input} style={{ minHeight: 80, fontFamily: 'monospace', fontSize: 12 }} placeholder={'date,steps,sleepHours,restingHr\n2026-11-08,8400,7.2,58'} value={csv} onChange={(e) => setCsv(e.target.value)} /></label>
            <div className={s.row}><button type="button" className={s.ghost} disabled={!csv.trim() || !!busy} onClick={() => void doIt('csv', async () => { const r = await api.integrations.healthImport(csv); setCsv(''); return { ok: r.saved > 0, text: `Imported ${r.saved} day(s).` }; })}>Import CSV</button></div>
          </>}
        </div></li>}
        <li className={s.step}><div>
          <h3 className={s.stepTitle}>Test</h3>
          <p className={s.stepText}>{i.note}{i.tools.length ? ` · Agents get: ${i.tools.join(', ')}` : ''}</p>
          <div className={s.row}><button type="button" className={s.ghost} disabled={!!busy} onClick={() => void doIt('test', () => api.integrations.test(i.key))}>{busy === 'test' ? 'Testing…' : 'Test'}</button>{msg && <span className={msg.ok ? s.ok : s.bad} role="status">{msg.t}</span>}</div>
        </div></li>
      </ol>
    </section>
  );
}
type Repo = ReturnType<typeof useRepo<Connection, Parameters<typeof api.connections.create>[0]>>;

/** Server settings fields with one Save button (secrets: empty = keep). */
function ServerFields({ keys, field, onSaved, button = 'Save' }: { keys: { key: string; label: string; placeholder?: string }[]; field: FieldFn; onSaved: () => void; button?: string }) {
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const save = async () => {
    const patch = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]).filter(([, x]) => x));
    if (!Object.keys(patch).length) return setMsg({ ok: false, t: 'Type a value first.' });
    setBusy(true); setMsg(null);
    try { await api.server.saveConfig(patch); setV({}); setMsg({ ok: true, t: 'Saved on your server.' }); onSaved(); } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : 'Could not save.' }); } finally { setBusy(false); }
  };
  return (
    <div className={s.fields}>
      {keys.map((k) => {
        const f = field(k.key);
        return (
          <label key={k.key}>
            <span className={s.label}>{k.label}{f?.set ? ' · saved' : ''}</span>
            <input className={s.input} type={f?.secret ? 'password' : 'text'} autoComplete="off" placeholder={f?.secret && f.set ? f.value : (f?.value || k.placeholder || '')} value={v[k.key] ?? ''} onChange={(e) => setV({ ...v, [k.key]: e.target.value })} />
          </label>
        );
      })}
      <div className={s.row}><button type="button" className={s.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : button}</button>{msg && <span className={msg.ok ? s.ok : s.bad}>{msg.t}</span>}</div>
    </div>
  );
}

function TestButton({ id, label = 'Send a test' }: { id?: string; label?: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  if (!id) return null;
  return (
    <div className={s.row}>
      <button type="button" className={s.ghost} disabled={busy} onClick={async () => { setBusy(true); setMsg(null); try { const r = await api.connections.test(id) as Connection & { error?: string }; setMsg(r.status === 'connected' ? { ok: true, t: 'Working.' } : { ok: false, t: r.error || r.status }); } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : 'Test failed' }); } finally { setBusy(false); } }}>{busy ? 'Testing…' : label}</button>
      {msg && <span className={msg.ok ? s.ok : s.bad} role="status">{msg.t}</span>}
    </div>
  );
}

function Telegram({ conn, field, onSaved, reload, remove }: { conn?: Connection; field: FieldFn; onSaved: () => void; reload: () => void; remove: Repo['remove'] }) {
  const toast = useToast();
  const [link, setLink] = useState<{ code: string; bot: string | null; expiresInMinutes: number } | null>(null);
  useEffect(() => { if (!link || conn?.status === 'connected') return; const t = setInterval(reload, 3000); return () => clearInterval(t); }, [link, conn, reload]);
  const bot = !!field('TELEGRAM_BOT_TOKEN')?.set; const linked = conn?.status === 'connected';
  return (
    <ol className={s.steps}>
      <li className={`${s.step} ${bot ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Create your bot</h3>
        <p className={s.stepText}>In Telegram, open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>, send <span className={s.mono}>/newbot</span>, pick a name and a username ending in “bot”. Paste the token it gives you. Your server reads messages by itself, so no web address is needed.</p>
        <ServerFields keys={[{ key: 'TELEGRAM_BOT_TOKEN', label: 'Bot token', placeholder: '123456:ABC…' }]} field={field} onSaved={onSaved} />
      </div></li>
      <li className={`${s.step} ${linked ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Link your chat</h3>
        <p className={s.stepText}>Get a code, then send it to your bot as <span className={s.mono}>/start CODE</span>. This page updates when the bot replies “Linked”.</p>
        {link ? (
          <div className={s.row}>
            <span className={s.code}>/start {link.code}</span>
            <button type="button" className={s.ghost} onClick={() => { void navigator.clipboard.writeText(`/start ${link.code}`); toast('Copied'); }}>Copy</button>
            {link.bot && <a className={s.ghost} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`https://t.me/${link.bot.replace(/^@/, '')}?start=${link.code}`} target="_blank" rel="noreferrer">Open {link.bot}</a>}
          </div>
        ) : <div className={s.row}><button type="button" className={s.primary} disabled={!bot} onClick={async () => { try { setLink(await api.connections.telegramLinkCode()); } catch (e) { toast(e instanceof Error ? e.message : 'Could not get a code'); } }}>Get a link code</button>{!bot && <span className={s.hint}>Save the bot token first.</span>}</div>}
      </div></li>
      <li className={`${s.step}`}><div>
        <h3 className={s.stepTitle}>Test</h3>
        <p className={s.stepText}>Sends “Loopmates test message: connected” to your chat. Choose which notifications go to Telegram in Settings → Notifications.</p>
        <TestButton id={conn?.id} />
        {conn && <div className={s.row}><button type="button" className={`${s.ghost} ${s.danger}`} onClick={() => confirmThen('Unlink this Telegram chat?', () => remove(conn.id))}>Unlink chat</button></div>}
      </div></li>
    </ol>
  );
}

function Discord({ conn, field, onSaved, reload, remove }: { conn?: Connection; field: FieldFn; onSaved: () => void; reload: () => void; remove: Repo['remove'] }) {
  const toast = useToast();
  const [link, setLink] = useState<{ code: string; command: string; invite: string | null } | null>(null);
  useEffect(() => { if (!link || conn?.status === 'connected') return; const t = setInterval(reload, 3000); return () => clearInterval(t); }, [link, conn, reload]);
  const bot = !!field('DISCORD_BOT_TOKEN')?.set && !!field('DISCORD_APP_ID')?.value; const linked = conn?.status === 'connected';
  return (
    <ol className={s.steps}>
      <li className={`${s.step} ${bot ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Create the application</h3>
        <p className={s.stepText}>On <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">discord.com/developers</a> press New Application. Copy the <b>Application ID</b> and <b>Public Key</b> from General Information, then open Bot → Reset Token and copy the token. Leave “Interactions Endpoint URL” empty: your server connects out to Discord.</p>
        <ServerFields keys={[{ key: 'DISCORD_APP_ID', label: 'Application ID' }, { key: 'DISCORD_PUBLIC_KEY', label: 'Public key' }, { key: 'DISCORD_BOT_TOKEN', label: 'Bot token' }]} field={field} onSaved={onSaved} />
      </div></li>
      <li className={`${s.step} ${linked ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Invite the bot and link your account</h3>
        <p className={s.stepText}>Get a code, add the bot to a server you own (or use it in a DM), then send the <span className={s.mono}>/link</span> command with the code.</p>
        {link ? (
          <div className={s.row}>
            <span className={s.code}>{link.command}</span>
            <button type="button" className={s.ghost} onClick={() => { void navigator.clipboard.writeText(link.command); toast('Copied'); }}>Copy</button>
            {link.invite && <a className={s.ghost} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={link.invite} target="_blank" rel="noreferrer">Add the bot</a>}
          </div>
        ) : <div className={s.row}><button type="button" className={s.primary} disabled={!bot} onClick={async () => { try { setLink(await api.connections.discordLinkCode()); } catch (e) { toast(e instanceof Error ? e.message : 'Could not get a code'); } }}>Get a link code</button>{!bot && <span className={s.hint}>Save the three values first.</span>}</div>}
      </div></li>
      <li className={s.step}><div>
        <h3 className={s.stepTitle}>Test</h3>
        <TestButton id={conn?.id} />
        {conn && <div className={s.row}><button type="button" className={`${s.ghost} ${s.danger}`} onClick={() => confirmThen('Unlink Discord?', () => remove(conn.id))}>Unlink</button></div>}
      </div></li>
    </ol>
  );
}

function Drive({ conn, field, onSaved, create, update }: { conn?: Connection; field: FieldFn; onSaved: () => void; create: Repo['create']; update: Repo['update'] }) {
  const [err, setErr] = useState('');
  const [folders, setFolders] = useState<{ parent: string; items: { id: string; name: string }[] } | null>(null);
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const client = !!field('GOOGLE_CLIENT_ID')?.value && !!field('GOOGLE_CLIENT_SECRET')?.set;
  const signedIn = !!field('GOOGLE_REFRESH_TOKEN')?.set;
  const folderId = field('DRIVE_ROOT_FOLDER_ID')?.value ?? '';
  const redirect = `${serverUrl()}/drive/oauth/callback`;
  const open = async (id = '', name = '') => {
    setErr('');
    try { setFolders(await api.server.driveFolders(id)); setTrail(id ? [...trail.filter((t) => t.id !== id), { id, name }] : []); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not list folders'); }
  };
  const pick = async (id: string, name: string) => {
    await api.server.driveFolder(id, name); setFolders(null); onSaved();
    const c = conn ? await update(conn.id, { config: { ...conn.config, folder: name } }) : await create({ provider: 'gdrive', label: 'Google Drive', status: 'pending', config: { folder: name } });
    await api.connections.test(c.id).catch(() => {});
  };
  return (
    <ol className={s.steps}>
      <li className={`${s.step} ${client ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Make your own Google sign-in</h3>
        <p className={s.stepText}>In <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud console</a>: create a project, enable the <b>Google Drive API</b>, set up the OAuth consent screen (External, add yourself as a test user), then Credentials → Create OAuth client ID → <b>Web application</b> with this authorized redirect URI:</p>
        <p className={s.stepText} style={{ marginTop: 8 }}><span className={s.mono}>{redirect}</span></p>
        <p className={s.hint}>Using a quick tunnel? Its address changes on restart, so do this step from the setup page on your computer instead (it uses a localhost address that never changes).</p>
        <ServerFields keys={[{ key: 'GOOGLE_CLIENT_ID', label: 'Client ID' }, { key: 'GOOGLE_CLIENT_SECRET', label: 'Client secret' }]} field={field} onSaved={onSaved} />
      </div></li>
      <li className={`${s.step} ${signedIn ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Sign in with Google</h3>
        <p className={s.stepText}>A Google page opens; allow Drive access. While the consent screen is in “Testing”, Google ends this sign-in after 7 days: publish the app (no review needed for your own use) or sign in again weekly.</p>
        <div className={s.row}><button type="button" className={s.primary} disabled={!client} onClick={async () => { try { const r = await api.server.driveStart(); window.open(r.url, '_blank', 'noopener'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start'); } }}>{signedIn ? 'Sign in again' : 'Sign in with Google'}</button><button type="button" className={s.ghost} onClick={onSaved}>I signed in</button></div>
      </div></li>
      <li className={`${s.step} ${folderId ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Pick the folder</h3>
        <p className={s.stepText}>Agents may only use this folder and what is inside it. {folderId ? <>Current: <b>{conn?.config.folder || folderId}</b>.</> : 'None picked yet (a “Loopmates” folder is created).'}</p>
        <div className={s.row}><button type="button" className={s.ghost} disabled={!signedIn} onClick={() => void open()}>Choose a folder</button></div>
        {folders && (
          <>
            <div className={s.folders}>
              {trail.length > 0 && <button type="button" onClick={() => void open()}>← My Drive</button>}
              {folders.items.map((f) => <button key={f.id} type="button" onClick={() => void open(f.id, f.name)}>📁 {f.name}</button>)}
              {folders.items.length === 0 && <p className={s.hint} style={{ padding: 10 }}>No folders here.</p>}
            </div>
            {trail.length > 0 && <div className={s.row}><button type="button" className={s.primary} onClick={() => void pick(trail.at(-1)!.id, trail.at(-1)!.name)}>Use “{trail.at(-1)!.name}”</button></div>}
          </>
        )}
        {err && <p className={s.bad}>{err}</p>}
        <TestButton id={conn?.id} label="Test Drive" />
      </div></li>
    </ol>
  );
}

function GitHub({ conn, field, onSaved, create, update, remove }: { conn?: Connection; field: FieldFn; onSaved: () => void; create: Repo['create']; update: Repo['update']; remove: Repo['remove'] }) {
  const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const saveToken = async () => {
    if (!token.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const repos = field('GITHUB_REPOS')?.value ?? '';
      const c = conn ? await update(conn.id, { config: { ...conn.config, token: token.trim(), repos } }) : await create({ provider: 'github', label: 'GitHub', status: 'pending', config: { token: token.trim(), repos } });
      const r = await api.connections.test(c.id) as Connection & { error?: string };
      setToken(''); setMsg(r.status === 'connected' ? { ok: true, t: `Working${r.config.login ? ` as ${r.config.login}` : ''}. ${r.config.check ?? ''}` } : { ok: false, t: r.error || 'The token did not work.' });
    } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : 'Could not save' }); } finally { setBusy(false); }
  };
  return (
    <ol className={s.steps}>
      <li className={`${s.step} ${field('GITHUB_REPOS')?.value ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Choose the repositories</h3>
        <p className={s.stepText}>The coder may only clone and push these. Write them as <span className={s.mono}>owner/name</span>, separated by commas.</p>
        <ServerFields keys={[{ key: 'GITHUB_REPOS', label: 'Allowed repositories', placeholder: 'you/project, you/notes' }, { key: 'DEFAULT_REPO', label: 'Default repository (https://github.com/owner/name)' }]} field={field} onSaved={onSaved} />
      </div></li>
      <li className={`${s.step} ${conn?.status === 'connected' ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Make a fine-grained token</h3>
        <p className={s.stepText}>On <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">github.com → Fine-grained tokens</a>: Repository access → <b>Only select repositories</b> (the same ones), Permissions → <b>Contents</b> and <b>Pull requests</b>: Read and write. Paste it here; it is encrypted on your server.</p>
        <div className={s.fields}>
          <label><span className={s.label}>Token{conn?.config.token ? ' · saved' : ''}</span><input className={s.input} type="password" autoComplete="off" placeholder={conn?.config.token || 'github_pat_…'} value={token} onChange={(e) => setToken(e.target.value)} /></label>
          <div className={s.row}><button type="button" className={s.primary} disabled={busy || !token.trim()} onClick={() => void saveToken()}>{busy ? 'Checking…' : 'Save and test'}</button>{msg && <span className={msg.ok ? s.ok : s.bad}>{msg.t}</span>}</div>
        </div>
        <TestButton id={conn?.id} label="Test again" />
        {conn && <div className={s.row}><button type="button" className={`${s.ghost} ${s.danger}`} onClick={() => confirmThen('Remove the GitHub token?', () => remove(conn.id))}>Remove token</button></div>}
      </div></li>
    </ol>
  );
}

const HARNESS: { key: HarnessKey; name: string; note: string }[] = [
  { key: 'builtin', name: 'Built-in coder', note: 'Uses your model providers. Small edits, always available.' },
  { key: 'claude', name: 'Claude Code', note: 'Your Claude subscription or API key. Strong on large changes.' },
  { key: 'codex', name: 'Codex', note: 'Your ChatGPT plan or OpenAI key. Runs in its own workspace-write sandbox.' },
  { key: 'opencode', name: 'OpenCode', note: 'Works with many providers, including free models.' },
];

/** Coding harness: detected CLIs, the default for coding steps, where it runs, and a test job. */
function Coder() {
  const { settings, update } = useSettings(); const toast = useToast();
  const [hz, setHz] = useState<Harnesses | null>(null); const [err, setErr] = useState('');
  const [test, setTest] = useState<HarnessTest | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback((fresh: boolean) => api.server.harnesses(fresh).then((h) => { setHz(h); setErr(''); }).catch((e: Error) => setErr(e.message)), []);
  useEffect(() => { void load(false); }, [load]);
  if (!settings) return null;
  const cur = settings.coderHarness ?? 'builtin'; const sb = settings.coderSandbox ?? 'auto';
  const save = (p: Partial<typeof settings>) => update(p).then(() => toast('Saved')).catch((e: Error) => toast(e.message, 'bad'));
  return (
    <ol className={s.steps}>
      <li className={`${s.step} ${hz ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Pick the engine for coding steps</h3>
        <p className={s.stepText}>Install one on the computer that runs Loopmates and sign in to it once in a terminal. A workflow&apos;s Code step can still choose its own.</p>
        {err && <p className={s.bad}>{err}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {HARNESS.map((h) => { const info = hz?.[h.key]; const ok = h.key === 'builtin' || !!info?.ok; return (
            <label key={h.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: `1px solid ${cur === h.key ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 12, background: cur === h.key ? 'var(--tint)' : '#fff', opacity: ok ? 1 : 0.75 }}>
              <input type="radio" name="harness" checked={cur === h.key} disabled={!ok} onChange={() => void save({ coderHarness: h.key })} style={{ marginTop: 3 }} />
              <span style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{h.name}</b> <span style={{ color: ok ? 'var(--ok, #1E7A46)' : '#8A5A00', fontSize: 12 }}>{h.key === 'builtin' ? 'always available' : !hz ? 'checking…' : ok ? info?.version : 'not installed'}</span>
                <span style={{ display: 'block', color: '#5B6474', fontSize: 12.5 }}>{h.note}</span>
                {!ok && info?.install && <span style={{ display: 'block', fontSize: 12.5, marginTop: 4 }}>Install: <span className={s.mono}>{info.install}</span></span>}</span>
            </label>); })}
        </div>
        <div className={s.row}><button type="button" className={s.ghost} onClick={() => void load(true)}>Check again</button></div>
      </div></li>
      <li className={`${s.step} ${s.stepDone}`}><div>
        <h3 className={s.stepTitle}>Choose where it runs</h3>
        <p className={s.stepText}><b>Docker</b> runs it in a container that only sees the job folder and a copy of the harness login. <b>This computer</b> runs it in a throwaway job folder with the harness&apos;s own safe mode and no Loopmates secrets. <b>Auto</b> uses Docker when the image is built. Code steps still wait for your approval unless permission mode is Auto.</p>
        <div className={s.row} role="radiogroup" aria-label="Where the harness runs">
          {(['auto', 'docker', 'host'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={sb === k} className={sb === k ? s.primary : s.ghost} onClick={() => void save({ coderSandbox: k })}>{{ auto: 'Auto', docker: 'Docker', host: 'This computer' }[k]}</button>)}
        </div>
        {hz && <p className={s.stepText} style={{ marginTop: 8 }}>{hz.docker.ok ? `Docker image ${hz.docker.image} is ready.` : hz.docker.error}</p>}
      </div></li>
      <li className={`${s.step} ${test?.ok ? s.stepDone : ''}`}><div>
        <h3 className={s.stepTitle}>Test it</h3>
        <p className={s.stepText}>Runs a tiny job (write one file) through {HARNESS.find((h) => h.key === cur)?.name}, with the same review loop as a real run. It uses your harness account.</p>
        <div className={s.row}><button type="button" className={s.primary} disabled={busy} onClick={async () => { setBusy(true); setTest(null); try { setTest(await api.server.testHarness(cur, sb)); } catch (e) { setTest({ ok: false, summary: e instanceof Error ? e.message : 'Test failed', files: [], logs: [] }); } finally { setBusy(false); } }}>{busy ? 'Running… (up to a few minutes)' : 'Run a test job'}</button>
          {test && <span className={test.ok ? s.ok : s.bad} role="status">{test.ok ? 'Working.' : 'Did not pass.'}</span>}</div>
        {test && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#F6F8FB', border: '1px solid var(--line)', borderRadius: 10, padding: 10, marginTop: 8, maxHeight: 260, overflow: 'auto' }}>{[test.summary, '', ...test.logs].join('\n')}</pre>}
      </div></li>
    </ol>
  );
}
