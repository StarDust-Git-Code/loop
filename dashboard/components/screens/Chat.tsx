'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';
import { useRepo, useSettings } from '../../lib/hooks';
import { GRAD, MATES, MATE_DEFS, mateImg, mateName } from '../../lib/mates';
import type { ChatEvent, Conversation, MateKey } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Badge, Btn, Pill, Tabs, Toggle, confirmThen } from '../ui/ui';

const SLASH = [
  { cmd: '/btw', desc: 'Ask a side question without stopping the run' }, { cmd: '/ultracode', desc: 'Hand a coding task to a Mate for a long run' },
  { cmd: '/plan', desc: 'Only plan, do not execute' }, { cmd: '/skill', desc: 'Pick a skill to use in this chat' },
  { cmd: '/whatsapp', desc: 'Let agents read selected chats' }, { cmd: '/telegram', desc: 'Ping me when this run needs me' },
];
const TOOL_LABEL: Record<string, string> = { web_search: 'Searching the web', fetch_url: 'Reading a page', memory_save: 'Saving a memory', memory_recall: 'Checking memories', knowledge_search: 'Searching knowledge', calendar_add: 'Adding to calendar', calendar_list: 'Reading calendar', task_add: 'Adding a task', task_list: 'Reading tasks', file_write: 'Saving a file', calculate: 'Calculating', watchdog: 'Running watchdog', console_tail: 'Reading the console', system_status: 'Checking system status', runs_active: 'Checking active runs', runs_failed: 'Checking failed runs', runs_recent: 'Reading recent runs', run_status: 'Reading a run', run_log: 'Reading a run log', approvals_pending: 'Checking approvals', jobs_upcoming: 'Checking scheduled jobs', automations_list: 'Reading automations', connections_status: 'Checking connections', files_list: 'Listing files', knowledge_list: 'Listing knowledge', llm_status: 'Checking LLM providers', mates_list: 'Reading the roster', time_now: 'Checking the time', task_done: 'Completing a task', run_stop: 'Stopping a run', run_pause: 'Pausing a run', run_resume: 'Resuming a run', workflow_list: 'Listing workflows', workflow_get: 'Reading a workflow', workflow_save: 'Saving the workflow', chat_history: 'Looking back in this chat' };
type Mode = 'chat' | 'plan' | 'ultracode';
const MODE_NOTE: Record<Mode, string> = { chat: 'Chat: talk it through, the Mate answers.', plan: 'Plan: the Mate plans the work and waits for you.', ultracode: 'Ultracode: long autonomous coding run with checkpoints and tests' };
const Dot = ({ k, s = 42 }: { k: MateKey; s?: number }) => <img src={mateImg(k)} alt="" width={s} height={s} style={{ flex: 'none' }} />;  


/** Collapsible reasoning. While the Mate is still thinking it is open and streaming; once the answer starts it folds away. */
function Thought({ text, live, answering }: { text: string; live?: boolean; answering?: boolean }) {
  const [manual, setManual] = useState<boolean | null>(null);
  const thinking = !!live && !answering;
  const open = manual ?? thinking;
  return (
    <div style={{ marginBottom: 8 }}>
      <button type="button" onClick={() => setManual(!open)} aria-expanded={open} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, background: thinking ? '#ECE7FF' : '#F4F2FA', color: '#4F34D6', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 600 }}>
        <span aria-hidden="true" style={{ display: 'inline-block', animation: thinking ? 'lm-pulse 1.4s ease-in-out infinite' : 'none', width: 8, height: 8, borderRadius: 99, background: '#6A4DF4' }} />
        {thinking ? 'Thinking…' : 'Thought process'}<span aria-hidden="true" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && <div style={{ marginTop: 8, borderLeft: '3px solid #CFC5FF', padding: '4px 0 4px 14px', fontSize: 13.5, lineHeight: 1.55, color: '#6B6572', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto', animation: 'lm-up .25s ease both' }}>{text}</div>}
    </div>
  );
}

export function Chat() {
  const router = useRouter();
  const toast = useToast();
  const sp = useSearchParams();
  const { items, update, remove, create } = useRepo(api.conversations);
  const cfgs = useRepo(api.mateConfigs).items, know = useRepo(api.knowledge).items, skills = useRepo(api.skills).items;
  const { settings } = useSettings();
  const cid = sp.get('c') ?? (sp.get('new') ? null : items[0]?.id ?? null);
  const conv = items.find((c) => c.id === cid);
  const [text, setText] = useState(() => sp.get('draft') ?? '');
  const [menu, setMenu] = useState(false);
  const [sel, setSel] = useState(0);
  const [list, setList] = useState(false);
  const [live, setLive] = useState<{ cid: string; segs: { mate: MateKey; text: string; thought: string; tools: string[]; doneId?: string }[] } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [conv?.messages.length, live?.segs.map((s) => s.text.length).join(',')]);

  const mate: MateKey = conv?.mate ?? 'planner';
  const mode = conv?.mode ?? 'chat';
  const members = [...new Set<MateKey>([mate, ...(conv?.members ?? [])])];
  const slash = text.startsWith('/') && !text.includes(' ') ? SLASH.filter((s) => s.cmd.startsWith(text.toLowerCase())) : [];
  const mm = /(?:^|\s)@([a-z]*)$/i.exec(text);
  const ready = MATE_DEFS.filter((d) => cfgs.find((c) => c.mate === d.key)?.enabled ?? d.core);
  const mentionOpts = mm ? ready.filter((d) => d.key.startsWith(mm[1].toLowerCase()) || d.name.toLowerCase().startsWith(mm[1].toLowerCase())) : [];
  const showMention = menu && mentionOpts.length > 0;
  const showMenu = menu && !showMention && slash.length > 0;
  const pickMention = (k: MateKey) => { setText(text.replace(/@[a-z]*$/i, `@${k} `)); setMenu(false); };

  const start = async (m: MateKey) => { const c = await create({ title: `Chat with ${MATES[m].name}`, mate: m, messages: [], mode: 'chat', members: [] }); router.push(`/chat?c=${c.id}`); };
  const patch = (p: Partial<Conversation>) => conv && update(conv.id, p);
  const pickCmd = (cmd: string) => {
    if (cmd === '/plan') { void patch({ mode: 'plan' }); setText(''); toast('Plan mode on'); }
    else if (cmd === '/ultracode') { void patch({ mode: 'ultracode' }); setText(''); toast('Ultracode mode on'); }
    else if (cmd === '/skill') { setText(''); router.push('/skills'); }
    else if (cmd === '/whatsapp' || cmd === '/telegram') { setText(''); router.push('/connections'); }
    else setText(`${cmd} `);
    setMenu(false);
  };
  const send = async () => {
    const t = text.trim(); if (!t || !conv) return;
    setText(''); setMenu(false);
    if (conv.messages.length === 0) await update(conv.id, { title: t.replace(/^\/btw\s*/, '').slice(0, 42) });
    if (t.startsWith('/btw') || !api.capabilities.backend) { await api.conversations.send(conv.id, t, mate); return; }
    setLive({ cid: conv.id, segs: [{ mate, text: '', thought: '', tools: [] }] });
    const onEvent = (e: ChatEvent) => setLive((p) => {
      if (!p) return p;
      const segs = p.segs.map((s) => ({ ...s })); const cur = segs[segs.length - 1];
      if (e.type === 'mate') { if (cur.doneId || cur.text || cur.thought || cur.tools.length) segs.push({ mate: e.mate, text: '', thought: '', tools: [] }); else cur.mate = e.mate; }
      else if (e.type === 'delta') cur.text += e.text;
      else if (e.type === 'think') cur.thought += e.text;
      else if (e.type === 'reset') cur.text = '';
      else if (e.type === 'tool') { cur.text = ''; cur.tools.push(e.name); }
      else if (e.type === 'done') cur.doneId = e.message.id;
      return { ...p, segs };
    });
    try { await api.conversations.sendStream(conv.id, t, mate, onEvent); }
    catch (err) { toast(err instanceof Error ? err.message : 'Could not send', 'bad'); setLive(null); }
  };
  const startRun = async () => {
    const last = [...(conv?.messages ?? [])].reverse().find((m) => m.role === 'user' && !m.text.startsWith('/btw'));
    if (!last) return toast('Send a message first', 'bad');
    const r = await api.runs.start({ prompt: last.text, askFirst: settings?.permissionMode !== 'auto' });
    router.push(`/run?id=${r.id}`);
  };

  if (!conv) {
    return (
      <main style={{ padding: '0 32px 40px', minHeight: '100dvh' }}>
        <header style={{ minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Chat</h1><p style={{ margin: '4px 0 0', color: '#6B6572' }}>Who do you want to talk to?</p></div>
          {items.length > 0 && <Btn href={`/chat?c=${items[0].id}`}>Open latest chat</Btn>}</header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
          {[...MATE_DEFS].sort((a, b) => Number(!!cfgs.find((c) => c.mate === b.key)?.enabled) - Number(!!cfgs.find((c) => c.mate === a.key)?.enabled)).map((m, i) => (
            <button key={m.key} type="button" onClick={() => start(m.key)} style={{ border: '1px solid rgba(27,24,34,.17)', background: GRAD[m.key], borderRadius: 18, padding: 16, textAlign: 'left', animation: `lm-pop .4s ${Math.min(i, 14) * 30}ms cubic-bezier(.22,1,.36,1) both`, transition: 'transform .2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
              <Dot k={m.key} s={72} /><div style={{ fontWeight: 600, fontSize: 15, marginTop: 8 }}>{mateName(m.key)}</div><div style={{ fontSize: 12, color: '#3D3946', marginTop: 2 }}>{m.blurb}</div>
            </button>))}
        </div>
      </main>
    );
  }

  return (
    <main style={{ display: 'flex', height: '100dvh', minWidth: 0 }}>
      <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '0 32px 24px' }}>
        <header style={{ minHeight: 88, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={() => setList((o) => !o)} aria-expanded={list} style={{ border: 0, background: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.title}</h1>
              <span style={{ color: '#6B6572', transition: 'transform .2s', transform: list ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6B6572' }}>{settings?.workspaceName} · started {new Date(conv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', paddingLeft: 10 }}>{members.map((m) => <span key={m} style={{ marginLeft: -10 }}><Dot k={m} s={36} /></span>)}</div>
            <Btn onClick={startRun}>Start a run</Btn><Btn href="/studio">Open in Studio</Btn>
          </div>
          {list && (
            <div style={{ position: 'absolute', top: 76, left: 0, width: 360, maxHeight: 420, overflow: 'auto', background: '#fff', border: '1px solid rgba(31,26,23,.14)', borderRadius: 16, boxShadow: '0 16px 40px rgba(31,26,23,.16)', padding: 8, zIndex: 20, animation: 'lm-pop .2s ease both' }}>
              <button type="button" onClick={() => { setList(false); router.push('/chat?new=1'); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: '#F4F0FF', color: '#4F34D6', borderRadius: 10, fontWeight: 600 }}>+ New chat</button>
              {items.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link href={`/chat?c=${c.id}`} onClick={() => setList(false)} style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, textDecoration: 'none', background: c.id === conv.id ? '#F3F1F8' : 'transparent' }}>
                    <Dot k={c.mate ?? 'planner'} s={30} /><span style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</b><small style={{ color: '#6B6572' }}>{ago(c.messages.at(-1)?.at ?? c.createdAt)}</small></span>
                  </Link>
                  <button type="button" aria-label={`Delete ${c.title}`} onClick={() => confirmThen('Delete this chat?', () => { void remove(c.id); setList(false); if (c.id === conv.id) router.replace('/chat'); })} style={{ border: 0, background: 'none', color: '#B3261E', fontSize: 16, width: 32 }}>×</button>
                </div>))}
            </div>)}
        </header>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 12 }}>
          {conv.messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#6B6572', animation: 'lm-up .5s ease both' }}>
              <div style={{ display: 'inline-block', animation: 'lm-bob 3.6s ease-in-out infinite' }}><Dot k={mate} s={96} /></div>
              <p style={{ margin: '10px 0 0', fontSize: 15 }}><b style={{ color: '#1B1822' }}>{mateName(mate)}</b>. {MATES[mate].blurb}</p><p style={{ margin: '4px 0 0', fontSize: 13 }}>Type <code>/</code> for commands.</p>
            </div>)}
          {conv.messages.map((m) => {
            const mine = m.role === 'user', side = m.text.startsWith('/btw');
            if (side) return (
              <div key={m.id} style={{ marginLeft: 56, maxWidth: 600, background: '#fff', border: '1.5px dashed rgba(106,77,244,.5)', borderRadius: 16, padding: '12px 16px', animation: 'lm-pop .3s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#4F34D6', background: '#ECE7FF', borderRadius: 6, padding: '3px 8px' }}>/BTW</span><span style={{ fontSize: 12, color: '#6B6572' }}>Side question. A running task keeps going.</span></div>
                <div style={{ fontSize: 14, color: '#2A2631' }}><b>You:</b> {m.text.replace(/^\/btw\s*/, '')}</div>
                {m.state === 'pending' && <div style={{ fontSize: 12, color: '#6B6572', marginTop: 4 }}>{api.capabilities.backend ? 'Answering…' : 'Waiting for backend'}</div>}
              </div>);
            return mine ? (
              <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: 560, animation: 'lm-pop .3s cubic-bezier(.22,1,.36,1) both' }}>
                <div style={{ background: '#ECE7FF', border: '1px solid rgba(106,77,244,.25)', borderRadius: '18px 18px 4px 18px', padding: '14px 18px', fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.text.split(/(@[a-z]+)/gi).map((part, i) => (/^@[a-z]+$/i.test(part) ? <b key={i} style={{ color: '#4F34D6' }}>{part}</b> : part))}</div>
                <small style={{ color: '#6B6572', display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>{ago(m.at)}{m.state === 'pending' && <Badge>{api.capabilities.backend ? 'Sending…' : 'Waiting for backend'}</Badge>}{m.state === 'error' && <Badge tone="bad">Failed</Badge>}</small>
              </div>
            ) : (
              <div key={m.id} style={{ display: 'flex', gap: 14, maxWidth: 820, animation: 'lm-pop .3s ease both' }}>
                <Dot k={m.mate ?? mate} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{mateName(m.mate ?? mate)}</div>{m.thought && <Thought text={m.thought} />}<div style={{ fontSize: 15, lineHeight: 1.6, color: '#2A2631', whiteSpace: 'pre-wrap' }}>{m.text}</div></div>
              </div>);
          })}
          {live && live.cid === conv.id && live.segs.filter((s) => !(s.doneId && conv.messages.some((m) => m.id === s.doneId))).map((s, i, arr) => (
            <div key={`${s.mate}-${i}`} style={{ display: 'flex', gap: 14, maxWidth: 820, animation: 'lm-pop .3s ease both' }}>
              <Dot k={s.mate} /><div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{mateName(s.mate)}</div>
                {s.thought && <Thought text={s.thought} live answering={!!s.text} />}
                {s.tools.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>{s.tools.map((n, j) => <span key={j} className="mono" style={{ fontSize: 11.5, background: '#ECE7FF', color: '#4F34D6', borderRadius: 7, padding: '3px 8px' }}>{TOOL_LABEL[n] ?? n}{j === s.tools.length - 1 && !s.text && !s.doneId ? '…' : ''}</span>)}</div>}
                <div style={{ fontSize: 15, lineHeight: 1.6, color: '#2A2631', whiteSpace: 'pre-wrap' }}>{s.text || (s.tools.length === 0 && !s.doneId && !s.thought ? <span style={{ color: '#6B6572' }}>Thinking…</span> : null)}{!s.doneId && s.text && i === arr.length - 1 && <span style={{ opacity: .5 }}>▍</span>}</div>
              </div>
            </div>))}
          <div ref={end} />
        </div>

        <div style={{ flex: 'none', position: 'relative' }}>
          {showMention && (
            <div style={{ position: 'absolute', left: 0, bottom: '100%', marginBottom: 8, width: 460, maxWidth: '100%', maxHeight: 300, overflow: 'auto', background: '#fff', border: '1px solid rgba(31,26,23,.16)', borderRadius: 14, padding: 6, boxShadow: '0 16px 40px rgba(31,26,23,.14)', animation: 'lm-pop .18s ease both', zIndex: 5 }}>
              {mentionOpts.map((d, i) => (
                <button key={d.key} type="button" onMouseEnter={() => setSel(i)} onClick={() => pickMention(d.key)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, minHeight: 44, padding: '4px 10px', border: 0, borderRadius: 9, background: i === sel % mentionOpts.length ? '#ECE7FF' : 'transparent', textAlign: 'left' }}>
                  <Dot k={d.key} s={30} /><span style={{ fontSize: 13.5, fontWeight: 600, width: 84 }}>@{d.key}</span><span style={{ fontSize: 12.5, color: '#3D3946', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.blurb}</span>
                </button>))}
            </div>)}
          {showMenu && (
            <div style={{ position: 'absolute', left: 0, bottom: '100%', marginBottom: 8, width: 460, maxWidth: '100%', background: '#fff', border: '1px solid rgba(31,26,23,.16)', borderRadius: 14, padding: 6, boxShadow: '0 16px 40px rgba(31,26,23,.14)', animation: 'lm-pop .18s ease both', zIndex: 5 }}>
              {slash.map((s, i) => (
                <button key={s.cmd} type="button" onMouseEnter={() => setSel(i)} onClick={() => pickCmd(s.cmd)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, minHeight: 44, padding: '4px 10px', border: 0, borderRadius: 9, background: i === sel % slash.length ? '#ECE7FF' : 'transparent', textAlign: 'left' }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: '#4F34D6', width: 96 }}>{s.cmd}</span><span style={{ fontSize: 13, color: '#3D3946' }}>{s.desc}</span>
                </button>))}
            </div>)}
          <div style={{ background: '#fff', border: '1px solid rgba(31,26,23,.16)', borderRadius: 18, padding: '12px 14px', boxShadow: '0 8px 24px rgba(106,77,244,.08)' }}>
            <form onSubmit={(e) => { e.preventDefault(); if (showMention) pickMention(mentionOpts[sel % mentionOpts.length].key); else if (showMenu) pickCmd(slash[sel % slash.length].cmd); else void send(); }} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input ref={fileIn} type="file" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await api.files.upload(f); await api.conversations.send(conv.id, `📎 ${f.name}`, mate); } e.target.value = ''; }} />
              <button type="button" aria-label="Attach" onClick={() => fileIn.current?.click()} style={{ width: 44, height: 44, borderRadius: 12, background: '#F3F1F8', border: '1px solid rgba(31,26,23,.1)', fontSize: 20 }}>+</button>
              <input value={text} aria-label="Message" placeholder={`Message ${MATES[mate].name}, @ to bring in a Mate, / for commands`} autoComplete="off"
                onChange={(e) => { setText(e.target.value); setMenu(true); setSel(0); }}
                onKeyDown={(e) => { const n = showMention ? mentionOpts.length : slash.length; const open = showMention || showMenu; if (open && e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => x + 1); } if (open && e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => x + n - 1); } if (open && e.key === 'Tab') { e.preventDefault(); if (showMention) pickMention(mentionOpts[sel % n].key); else pickCmd(slash[sel % n].cmd); } if (e.key === 'Escape') setMenu(false); }}
                style={{ flex: 1, minWidth: 0, height: 44, background: 'none', border: 0, outline: 0, fontSize: 15, fontFamily: 'inherit' }} />
              <button type="submit" aria-label="Send" disabled={!text.trim()} style={{ width: 44, height: 44, borderRadius: 12, background: '#6A4DF4', border: 0, color: '#fff', fontSize: 20, opacity: text.trim() ? 1 : 0.4, transition: 'opacity .15s, transform .15s' }}>↑</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <Tabs value={mode} onChange={(m) => patch({ mode: m })} options={[{ id: 'chat', label: 'Chat' }, { id: 'plan', label: 'Plan' }, { id: 'ultracode', label: 'Ultracode' }]} />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#3D3946' }}>Thinking
                <select value={conv.thinking ?? 'default'} onChange={(e) => void patch({ thinking: e.target.value as Conversation['thinking'] })} aria-label="Thinking level" style={{ height: 34, borderRadius: 10, border: '1px solid rgba(31,26,23,.16)', background: '#fff', padding: '0 8px', font: 'inherit', fontSize: 12.5 }}>
                  {[['default', 'Default'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'XHigh']].map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </label>
              <span style={{ fontSize: 12, color: '#6B6572' }}>{MODE_NOTE[mode]}</span>
            </div>
          </div>
        </div>
      </section>

      <aside aria-label="Chat context" style={{ width: 360, flex: 'none', background: '#FAF9FD', borderLeft: '1px solid rgba(31,26,23,.1)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
        <Sec title="AGENTS IN THIS CHAT">
          {members.map((m) => { const on = cfgs.find((c) => c.mate === m)?.enabled; return (
            <Link key={m} href={`/agents?mate=${m}`} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 48, background: '#fff', border: '1px solid rgba(31,26,23,.1)', borderRadius: 12, padding: '0 12px', textDecoration: 'none', color: 'inherit', marginBottom: 6, transition: 'transform .15s' }}>
              <Dot k={m} s={30} /><span style={{ flex: 1, fontWeight: 500 }}>{mateName(m)}</span><span style={{ fontSize: 12, fontWeight: 600, color: on ? '#1E7A46' : '#6B6572' }}>{on ? 'Ready' : 'Off'}</span></Link>); })}
          <select aria-label="Invite a Mate" value="" onChange={(e) => e.target.value && patch({ members: [...(conv.members ?? []), e.target.value as MateKey] })} style={{ width: '100%', height: 40, borderRadius: 10, border: '1px dashed rgba(106,77,244,.5)', background: '#fff', color: '#4F34D6', fontWeight: 600, padding: '0 10px' }}>
            <option value="">+ Invite a Mate</option>{MATE_DEFS.filter((m) => !members.includes(m.key)).map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
          </select>
        </Sec>
        <Sec title="KNOWLEDGE ATTACHED">
          <div style={{ background: '#fff', border: '1px solid rgba(31,26,23,.1)', borderRadius: 12, padding: '4px 12px' }}>
            {know.length === 0 ? <p style={{ fontSize: 13, color: '#6B6572', lineHeight: 1.5 }}>Nothing yet. <Link href="/knowledge" style={{ color: '#4F34D6' }}>Add sources</Link> and toggle them here.</p> :
              know.slice(0, 8).map((k) => { const on = !(conv.detached ?? []).includes(k.id); return (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, borderBottom: '1px solid rgba(31,26,23,.07)', fontSize: 13 }}>
                  <span style={{ flex: 1, color: '#2A2631', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
                  <Toggle label={k.name} checked={on} onChange={(v) => patch({ detached: v ? (conv.detached ?? []).filter((x) => x !== k.id) : [...(conv.detached ?? []), k.id] })} /></div>); })}
          </div>
        </Sec>
        <Sec title="SKILLS ACTIVE">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {skills.filter((s) => s.enabled && (s.mates.length === 0 || s.mates.includes(mate))).map((s) => <span key={s.id} style={{ fontSize: 12.5, color: '#4F34D6', background: '#ECE7FF', borderRadius: 8, padding: '6px 10px', fontWeight: 500 }}>{s.name}</span>)}
            {skills.filter((s) => s.enabled).length === 0 && <span style={{ fontSize: 13, color: '#6B6572' }}>None. <Link href="/skills" style={{ color: '#4F34D6' }}>Add a skill</Link>.</span>}
          </div>
        </Sec>
        <div style={{ background: '#F4F0FF', border: '1px solid rgba(106,77,244,.35)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Harness: {settings?.permissionMode === 'auto' ? 'auto-edit' : settings?.permissionMode === 'plan' ? 'plan only' : 'ask before risky actions'}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#3D3946', marginBottom: 10 }}>File writes and external messages wait for your OK. Reading and searching run freely.</div>
          <Btn href="/skills" style={{ width: '100%', justifyContent: 'center' }}>Change permissions</Btn>
        </div>
        <Pill tone="violet">{conv.messages.length} messages</Pill>
      </aside>
    </main>
  );
}

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><h2 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, letterSpacing: '.06em', color: '#6B6572' }}>{title}</h2>{children}</div>
);
