'use client';
import { LeaderPanel } from './LeaderPanel';
import { useAgents } from '../../lib/agents';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { api } from '../../lib/api';
import { useRepo, useSession, useSettings } from '../../lib/hooks';
import { MATES, mateImg } from '../../lib/mates';
import type { MateKey, Question, Run } from '../../lib/types';
import s from './home.module.css';

type Mode = 'chat' | 'run';
type Busy = { kind: 'working' | 'needs'; what: string };
const LIVE: Run['status'][] = ['running', 'queued', 'waiting_approval'];
/** Shown when the owner has not set up the team yet. */
const DEFAULT_TEAM: MateKey[] = ['planner', 'research', 'code', 'writer', 'mimo', 'halo', 'browser', 'ops', 'flow'];

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const noSub = () => () => {};
const crewOf = (r: Run) => [...new Set(r.steps.map((x) => x.mate))].slice(0, 4);

/** What a run is doing right now, in one line: "Research → Writer" on a hand-off, else the current step. */
function nowLine(r: Run) {
  if (r.status === 'queued') return r.steps.length ? 'Queued, starts soon' : 'Planner is splitting this up';
  if (r.status === 'waiting_approval') { const a = r.approvals.find((x) => x.status === 'pending'); return a ? `${MATES[a.mate].name} is waiting for your approval` : 'Waiting for your approval'; }
  const i = r.steps.findIndex((x) => x.status === 'running');
  if (i < 0) return 'Working';
  const cur = r.steps[i], prev = r.steps.slice(0, i).reverse().find((x) => x.status === 'done');
  return prev && prev.mate !== cur.mate ? `${MATES[prev.mate].name} → ${MATES[cur.mate].name}: ${cur.label}` : `${MATES[cur.mate].name}: ${cur.label}`;
}

export function Home() {
  const { defs: AGENTS, leader } = useAgents();
  const router = useRouter();
  const fieldId = useId();
  const fileIn = useRef<HTMLInputElement>(null);
  const session = useSession();
  const { settings } = useSettings();
  const cfgs = useRepo(api.mateConfigs).items;
  const { items: runs } = useRepo(api.runs);
  const { create: createConv } = useRepo(api.conversations);

  const [text, setText] = useState('');
  const [picked, setPicked] = useState<MateKey[]>([]);
  const [mode, setMode] = useState<Mode>('run');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // The time of day is read only in the browser (prerendering has no clock for the visitor).
  const hello = useSyncExternalStore(noSub, greeting, () => 'Hello');
  const name = (session?.name || settings?.displayName || '').split(' ')[0];
  const enabled = cfgs.filter((c) => c.enabled).map((c) => c.mate);
  const team = (enabled.length ? AGENTS.filter((d) => enabled.includes(d.key)).map((d) => d.key) : DEFAULT_TEAM);
  const live = runs.filter((r) => LIVE.includes(r.status));
  const pending = runs.flatMap((r) => r.approvals.filter((a) => a.status === 'pending').map((a) => ({ run: r, a })));
  // Questions from ask_owner: checked every 15 s (and right after answering).
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answering, setAnswering] = useState('');
  useEffect(() => {
    let on = true;
    const load = () => api.inbox.questions().then((q) => { if (on) setQuestions(q); }).catch(() => {});
    void load(); const t = setInterval(load, 15_000);
    return () => { on = false; clearInterval(t); };
  }, []);
  const answer = async (q: Question, a: string) => {
    setAnswering(q.id);
    try { await api.inbox.answer(q.id, a); setQuestions((qs) => qs.filter((x) => x.id !== q.id)); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send the answer.'); } finally { setAnswering(''); }
  };

  // Each agent's state comes from the live runs: a pending approval = needs you, a running step = working.
  const state = useMemo(() => {
    const m = new Map<MateKey, Busy>();
    for (const { a } of pending) m.set(a.mate, { kind: 'needs', what: 'waiting for your approval' });
    for (const q of questions) m.set(q.mate, { kind: 'needs', what: 'asked you a question' });
    for (const r of live) for (const st of r.steps) if (st.status === 'running' && !m.has(st.mate)) m.set(st.mate, { kind: 'working', what: st.label });
    return m;
  }, [live, pending, questions]);
  const working = [...state.values()].filter((x) => x.kind === 'working').length;
  const needs = [...state.values()].filter((x) => x.kind === 'needs').length;

  const toggle = (k: MateKey) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function go() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setErr('');
    try {
      if (mode === 'chat') {
        const [lead, ...rest] = picked.length ? picked : ([leader] as MateKey[]);
        const c = await createConv({ title: t.slice(0, 42), mate: lead, members: rest, messages: [], mode: rest.length ? 'brainstorm' : 'chat' });
        router.push(`/chat?c=${c.id}&send=1&draft=${encodeURIComponent(t)}`);
      } else {
        const team = picked.length ? `Team for this run: ${picked.map((k) => MATES[k].name).join(', ')}.\n\n` : '';
        const r = await api.runs.start({ prompt: team + t, askFirst: settings?.permissionMode !== 'auto', files });
        router.push(`/run?id=${r.id}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start that. Try again.');
      setBusy(false);
    }
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void go(); } };

  return (
    <main className={s.page}>
      <section aria-labelledby="ask" className={s.hero}>
        <div className={s.hello}>{hello}{name ? `, ${name}` : ''}</div>
        <h1 id="ask" className={s.h1}>What should your team work on?</h1>

        <form className={s.composer} onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <label htmlFor={fieldId} className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Describe the task</label>
          <textarea id={fieldId} rows={2} className={s.field} value={text} onKeyDown={onKey}
            onChange={(e) => { setText(e.target.value); setErr(''); }}
            placeholder={mode === 'run' ? 'Describe a goal. Your agents split it up and work on it together.' : 'Ask something. Pick agents below to bring them into the chat.'} />
          <div className={s.row}>
            <span className={s.with}>With</span>
            {picked.map((k) => (
              <span key={k} className={s.chip} style={{ background: MATES[k].tint }}>
                <img src={mateImg(k)} alt="" />{MATES[k].name}
                <button type="button" className={s.chipX} aria-label={`Remove ${MATES[k].name}`} onClick={() => toggle(k)}>×</button>
              </span>
            ))}
            {picked.length === 0 && <span className={s.hint}>{mode === 'run' ? 'Planner picks the team' : 'Mimo answers'}</span>}
            {files.length > 0 && <span className={s.files}>· {files.length} file{files.length > 1 ? 's' : ''} attached</span>}
            <div className={s.spacer} />
            {mode === 'run' && (
              <>
                <input ref={fileIn} type="file" multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) setFiles((c) => [...c, ...f]); e.target.value = ''; }} />
                <button type="button" className={s.iconBtn} aria-label="Attach files" onClick={() => fileIn.current?.click()}>+</button>
              </>
            )}
            <div role="group" aria-label="How to start" className={s.seg}>
              <button type="button" aria-pressed={mode === 'chat'} onClick={() => setMode('chat')}>Chat</button>
              <button type="button" aria-pressed={mode === 'run'} onClick={() => setMode('run')}>Run</button>
            </div>
            <button type="submit" className={s.send} aria-label={mode === 'run' ? 'Start the run' : 'Send'} disabled={!text.trim() || busy}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
            </button>
          </div>
          <p className={s.note} role="status" aria-live="polite">{err}</p>
        </form>
      </section>

      <section aria-labelledby="team" className={s.team}>
        <div className={s.head}>
          <h2 id="team" className={s.h2}>Your team</h2>
          <span className={s.sub}>{[working && `${working} working`, needs && `${needs} need${needs === 1 ? 's' : ''} you`, 'tap to add to the task'].filter(Boolean).join(' · ')}</span>
          <div className={s.grow} />
          <Link href="/agents" className={s.more}>Manage</Link>
        </div>
        <div className={s.grid}>
          {team.map((k) => {
            const st = state.get(k);
            return (
              <button key={k} type="button" className={s.tile} aria-pressed={picked.includes(k)} onClick={() => toggle(k)}>
                <span className={s.face}>
                  {st?.kind === 'working' && <span className={s.ring} aria-hidden="true" />}
                  <img src={mateImg(k)} alt="" />
                  {st?.kind === 'needs' && <span className={s.dot} aria-hidden="true" />}
                </span>
                <span className={s.name}>{MATES[k].name}</span>
                <span className={s.what}>{st ? st.what : 'ready'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className={s.panels}>
        <LeaderPanel />
        <section aria-labelledby="needs" className={s.panel}>
          <div className={s.panelHead}><h2 id="needs" className={s.h3}>Needs you</h2></div>
          {questions.slice(0, 4).map((q) => (
            <div key={q.id} className={s.item}>
              <img src={mateImg(q.mate)} alt="" />
              <div className={s.itemText}>
                <div className={s.itemTitle}>{q.question}</div>
                <div className={s.itemMeta}>{MATES[q.mate]?.name ?? 'A Mate'} is asking · uses “{q.fallback}” at {new Date(q.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} if you do not answer</div>
              </div>
              <div className={s.acts}>
                {q.options.map((o) => <button key={o} type="button" className={s.ghost} disabled={answering === q.id} onClick={() => void answer(q, o)}>{o}</button>)}
              </div>
            </div>
          ))}
          {pending.length === 0 && questions.length === 0 ? <p className={s.empty}>Nothing is waiting for you. Approvals and questions from your agents show up here.</p> : pending.slice(0, 4).map(({ run, a }) => (
            <div key={a.id} className={s.item}>
              <img src={mateImg(a.mate)} alt="" />
              <div className={s.itemText}>
                <div className={s.itemTitle}>{a.text}</div>
                <div className={s.itemMeta}>{MATES[a.mate].name} is asking · {run.title}</div>
              </div>
              <div className={s.acts}>
                <button type="button" className={s.primary} onClick={() => void api.runs.decide(run.id, a.id, 'approved')}>Approve</button>
                <button type="button" className={s.ghost} onClick={() => void api.runs.decide(run.id, a.id, 'denied')}>Deny</button>
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="progress" className={s.panel}>
          <div className={s.panelHead}>
            <h2 id="progress" className={s.h3}>Working on it</h2>
            <div className={s.grow} />
            <Link href="/run" className={s.more}>All runs</Link>
          </div>
          {live.length === 0 ? <p className={s.empty}>No runs are going. Describe a goal above and press Run.</p> : live.slice(0, 4).map((r) => {
            const done = r.steps.filter((x) => x.status === 'done').length, total = r.steps.length;
            const crew = crewOf(r);
            return (
              <Link key={r.id} href={`/run?id=${r.id}`} className={s.run}>
                <span className={s.runTop}>
                  <span className={s.crew}>{(crew.length ? crew : (['planner'] as MateKey[])).map((k) => <img key={k} src={mateImg(k)} alt="" />)}</span>
                  <span className={s.runText}>
                    <span className={s.itemTitle}>{r.title}</span>
                    <span className={s.itemMeta}>{nowLine(r)}</span>
                  </span>
                  {total > 0 && <span className={s.step}>{done}/{total}</span>}
                </span>
                <span className={s.track} role="img" aria-label={total ? `${done} of ${total} steps done` : 'Not started'}>
                  <span className={s.fill} style={{ width: `${total ? Math.round((done / total) * 100) : 4}%` }} />
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
