'use client';
// Company: the people your agents help you manage. You stay the boss; agents keep the directory, hand out and follow up
// work, ask people for status on Telegram (with your OK), and write the digests.
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo, useSettings } from '../../lib/hooks';
import type { Assignment, AssignmentIn, Person, PersonIn, Team } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, Empty, ErrorNote, Field, Input, Loading, Modal, Page, Select, Tabs, Textarea, Toggle } from '../ui/ui';

type Tab = 'people' | 'work' | 'checkins' | 'settings';
const box = { background: '#fff', border: '1px solid rgba(15,23,42,.14)', borderRadius: 16 } as const;
const COLS: AssignmentIn['status'][] = ['todo', 'doing', 'blocked', 'done'];
const COL_NAME = { todo: 'To do', doing: 'Doing', blocked: 'Blocked', done: 'Done' } as const;
const blankPerson: PersonIn = { name: '', role: '', teamId: '', managerId: '', contact: {}, skills: [], status: 'active' };

export function Company() {
  const [tab, setTab] = useState<Tab>('people');
  const people = useRepo(api.people), teams = useRepo(api.teams);
  return (
    <Page title="Company" sub="The people your agents help you manage. Ask your leader for a standup, a weekly report, or to hand out work; nothing reaches an employee without your OK unless you allow it."
      actions={<Tabs value={tab} onChange={setTab} options={[{ id: 'people', label: 'People' }, { id: 'work', label: 'Work' }, { id: 'checkins', label: 'Check-ins' }, { id: 'settings', label: 'Settings' }]} />}>
      <ErrorNote message={people.error || teams.error} />
      {people.loading ? <Loading /> : tab === 'people' ? <People people={people.items} teams={teams.items} repo={people} teamRepo={teams} />
        : tab === 'work' ? <Work people={people.items} /> : tab === 'checkins' ? <Checkins people={people.items} /> : <CompanySettings />}
    </Page>
  );
}

function People({ people, teams, repo, teamRepo }: { people: Person[]; teams: Team[]; repo: ReturnType<typeof useRepo<Person, PersonIn>>; teamRepo: ReturnType<typeof useRepo<Team, { name: string; description: string }>> }) {
  const toast = useToast();
  const [edit, setEdit] = useState<(PersonIn & { id?: string }) | null>(null); const [csv, setCsv] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ name: string; command: string } | null>(null); const [view, setView] = useState<'list' | 'chart'>('list'); const [q, setQ] = useState('');
  const team = (id?: string) => teams.find((t) => t.id === id)?.name ?? '';
  const name = (id?: string) => people.find((p) => p.id === id)?.name ?? '';
  const rows = people.filter((p) => !q || [p.name, p.role, team(p.teamId)].some((x) => x?.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name));
  const tree = (mgr: string | undefined, depth: number): React.ReactNode => people.filter((p) => (p.managerId || '') === (mgr || '') && (depth > 0 || !people.some((x) => x.id === p.managerId))).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
    <li key={p.id}><span style={{ fontWeight: 600 }}>{p.name}</span> <span style={{ color: '#5B6474', fontSize: 12.5 }}>{p.role}{team(p.teamId) ? ` · ${team(p.teamId)}` : ''}</span>{depth < 8 && people.some((x) => x.managerId === p.id) && <ul style={{ margin: '4px 0 4px 18px', paddingLeft: 12, borderLeft: '2px solid #E4EAF5', listStyle: 'none' }}>{tree(p.id, depth + 1)}</ul>}</li>));
  return <>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" style={{ flex: 1, minWidth: 180 }} />
      <Tabs value={view} onChange={setView} options={[{ id: 'list', label: 'List' }, { id: 'chart', label: 'Org chart' }]} />
      <Btn onClick={() => setCsv('name,role,team,manager,email\n')}>Import CSV</Btn>
      <Btn variant="primary" onClick={() => setEdit({ ...blankPerson })}>+ Person</Btn>
    </div>
    {!people.length ? <Empty title="No people yet" text="Add the people in your company, or import a CSV with name, role, team, manager and email. Your agents use it to hand out work and follow up." /> : view === 'chart' ? (
      <div style={{ ...box, padding: 16 }}><ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>{tree(undefined, 0)}</ul></div>
    ) : (
      <div style={{ ...box, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead><tr style={{ textAlign: 'left', color: '#5B6474', fontSize: 12 }}>{['Name', 'Role', 'Team', 'Reports to', 'Telegram', ''].map((h) => <th key={h} style={{ padding: '10px 12px', fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id} style={{ borderTop: '1px solid rgba(15,23,42,.07)' }}>
              <td style={{ padding: '9px 12px', fontWeight: 600 }}>{p.name}</td><td style={{ padding: '9px 12px' }}>{p.role}</td><td style={{ padding: '9px 12px' }}>{team(p.teamId)}</td><td style={{ padding: '9px 12px' }}>{name(p.managerId)}</td>
              <td style={{ padding: '9px 12px' }}>{p.contact?.telegramChatId ? <span style={{ color: '#1E7A46' }}>Joined</span> : <button type="button" onClick={() => api.company.invite(p.id).then((r) => setInvite({ name: p.name, command: r.command })).catch((e: Error) => toast(e.message, 'bad'))} style={{ border: 0, background: 'none', padding: 0, color: 'var(--accent-ink)', fontWeight: 600 }}>Invite</button>}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}><Btn small onClick={() => setEdit({ ...blankPerson, ...p })}>Edit</Btn> <Btn small onClick={() => confirmThen(`Remove ${p.name} from the directory?`, () => { repo.remove(p.id).catch((e: Error) => toast(e.message, 'bad')); })}>Remove</Btn></td>
            </tr>))}</tbody>
        </table>
      </div>)}
    {edit && <Modal title={edit.id ? 'Edit person' : 'Add a person'} onClose={() => setEdit(null)} canSubmit={!!edit.name.trim()} onSubmit={async () => {
      let teamId = edit.teamId;
      if (teamId.startsWith('new:')) { const t = await teamRepo.create({ name: teamId.slice(4), description: '' }); teamId = t.id; }
      const { id, ...x } = { ...edit, teamId }; await (id ? repo.update(id, x) : repo.create(x)); setEdit(null); }}>
      <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
      <Field label="Role"><Input value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} placeholder="Designer" /></Field>
      <Field label="Team"><Select value={edit.teamId.startsWith('new:') ? '__new' : edit.teamId} onChange={(e) => setEdit({ ...edit, teamId: e.target.value === '__new' ? `new:${window.prompt('New team name')?.trim() || 'New team'}` : e.target.value })}><option value="">No team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}<option value="__new">+ New team…</option></Select></Field>
      <Field label="Reports to"><Select value={edit.managerId ?? ''} onChange={(e) => setEdit({ ...edit, managerId: e.target.value })}><option value="">Nobody</option>{people.filter((p) => p.id !== edit.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Email"><Input type="email" value={edit.contact.email ?? ''} onChange={(e) => setEdit({ ...edit, contact: { ...edit.contact, email: e.target.value } })} /></Field>
      <Field label="Skills (comma separated)"><Input value={edit.skills.join(', ')} onChange={(e) => setEdit({ ...edit, skills: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
    </Modal>}
    {csv !== null && <Modal title="Import people" submitLabel="Import" onClose={() => setCsv(null)} canSubmit={csv.split('\n').filter(Boolean).length > 1} onSubmit={async () => { const r = await api.company.importCsv(csv); toast(`${r.added} added, ${r.updated} updated`); setCsv(null); repo.reload(); teamRepo.reload(); }}>
      <p style={{ margin: 0, color: '#5B6474', fontSize: 13 }}>One person per line. The first line names the columns: name, role, team, manager, email. Managers are matched by name. Up to 2,000 people.</p>
      <Field label="CSV"><Textarea rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} /></Field>
      <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setCsv); }} />
    </Modal>}
    {invite && <Modal title={`Invite ${invite.name}`} submitLabel="Done" onClose={() => setInvite(null)} onSubmit={async () => setInvite(null)}>
      <p style={{ margin: 0, fontSize: 14 }}>Ask {invite.name} to open your Telegram bot and send:</p>
      <p style={{ fontFamily: 'var(--mono, monospace)', fontSize: 18, background: '#F6F8FB', padding: 12, borderRadius: 10 }}>{invite.command}</p>
      <p style={{ margin: 0, color: '#5B6474', fontSize: 13 }}>The code works for 7 days. Once joined, they get check-ins there, can list their work with /tasks, and can ask questions answered only from Knowledge items you marked Company.</p>
    </Modal>}
  </>;
}

function Work({ people }: { people: Person[] }) {
  const toast = useToast(); const { items, update, create, remove } = useRepo(api.assignments);
  const [who, setWho] = useState(''); const [add, setAdd] = useState<AssignmentIn | null>(null); const [nowT] = useState(() => Date.now());
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? '?';
  const rows = items.filter((a) => !who || a.assigneeId === who);
  const overdue = (a: Assignment) => a.status !== 'done' && !!a.due && Date.parse(a.due) < nowT;
  return <>
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person" style={{ width: 220 }}><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <div style={{ flex: 1 }} />
      <Btn variant="primary" disabled={!people.length} onClick={() => setAdd({ title: '', detail: '', assigneeId: who || people[0]?.id || '', status: 'todo', due: '' })}>+ Assignment</Btn>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
      {COLS.map((c) => (
        <section key={c} style={{ ...box, padding: 12, minHeight: 120 }} aria-label={COL_NAME[c]}>
          <h3 style={{ margin: '0 0 8px', fontSize: 13.5 }}>{COL_NAME[c]} <span style={{ color: '#5B6474', fontWeight: 500 }}>{rows.filter((a) => a.status === c).length}</span></h3>
          {rows.filter((a) => a.status === c).slice(0, 60).map((a) => (
            <div key={a.id} style={{ border: '1px solid rgba(15,23,42,.1)', borderRadius: 12, padding: '8px 10px', marginBottom: 8, background: overdue(a) ? '#FFF7ED' : '#fff' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: '#5B6474' }}>{name(a.assigneeId)}{a.due ? ` · due ${a.due.slice(0, 10)}` : ''}{overdue(a) ? ' · overdue' : ''}{a.by ? ` · from ${a.by}` : ''}</div>
              {a.note && <div style={{ fontSize: 12, marginTop: 4 }}>{a.note}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <Select value={a.status} onChange={(e) => update(a.id, { status: e.target.value as AssignmentIn['status'] }).catch((er: Error) => toast(er.message, 'bad'))} aria-label={`Status of ${a.title}`} style={{ height: 30, fontSize: 12, flex: 1 }}>{COLS.map((x) => <option key={x} value={x}>{COL_NAME[x]}</option>)}</Select>
                <Btn small onClick={() => api.checkins.create({ personId: a.assigneeId, assignmentId: a.id, question: `How is "${a.title}" going?`, status: 'draft' }).then(() => toast('Check-in drafted: send it from Check-ins')).catch((er: Error) => toast(er.message, 'bad'))}>Ask</Btn>
                <Btn small onClick={() => confirmThen('Delete this assignment?', () => { remove(a.id).catch(() => {}); })}>×</Btn>
              </div>
            </div>))}
        </section>))}
    </div>
    {add && <Modal title="New assignment" onClose={() => setAdd(null)} canSubmit={!!add.title.trim() && !!add.assigneeId} onSubmit={async () => { await create({ ...add, due: add.due ? new Date(add.due).toISOString() : '' }); setAdd(null); }}>
      <Field label="What"><Input value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} /></Field>
      <Field label="Who"><Select value={add.assigneeId} onChange={(e) => setAdd({ ...add, assigneeId: e.target.value })}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Due"><Input type="date" value={add.due ?? ''} onChange={(e) => setAdd({ ...add, due: e.target.value })} /></Field>
      <Field label="Details"><Textarea rows={3} value={add.detail} onChange={(e) => setAdd({ ...add, detail: e.target.value })} /></Field>
    </Modal>}
  </>;
}

function Checkins({ people }: { people: Person[] }) {
  const toast = useToast(); const { items, update, reload } = useRepo(api.checkins);
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? '?';
  const drafts = items.filter((c) => c.status === 'draft'), sent = items.filter((c) => c.status === 'sent'), answered = items.filter((c) => c.status === 'answered').sort((a, b) => String(b.answeredAt).localeCompare(String(a.answeredAt)));
  const row = { ...box, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } as const;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <section><h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Waiting for your OK ({drafts.length})</h3>
      {drafts.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{drafts.map((c) => (
        <div key={c.id} style={row}><span style={{ flex: '1 1 260px' }}><b>{name(c.personId)}</b>: {c.question}{c.error && <span style={{ display: 'block', color: '#B42318', fontSize: 12 }}>{c.error}</span>}{c.by && <span style={{ display: 'block', color: '#5B6474', fontSize: 12 }}>Drafted by {c.by}</span>}</span>
          <Btn small variant="primary" onClick={() => api.company.sendCheckin(c.id).then((r) => { toast(r.status === 'sent' ? 'Sent' : r.error || 'Not sent', r.status === 'sent' ? undefined : 'bad'); reload(); }).catch((e: Error) => toast(e.message, 'bad'))}>Send</Btn>
          <Btn small onClick={() => update(c.id, { status: 'discarded' })}>Discard</Btn></div>))}
        {drafts.length > 1 && <Btn onClick={async () => { let n = 0; for (const c of drafts) { const r = await api.company.sendCheckin(c.id).catch(() => null); if (r?.status === 'sent') n++; } toast(`Sent ${n} of ${drafts.length}`); reload(); }}>Send all</Btn>}</div> : <p style={{ color: '#5B6474', fontSize: 13, margin: 0 }}>Nothing to approve. Ask your leader to “check in with the design team about the launch”.</p>}
    </section>
    <section><h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Sent, no reply yet ({sent.length})</h3>
      {sent.slice(0, 30).map((c) => <div key={c.id} style={{ ...row, marginBottom: 6 }}><b>{name(c.personId)}</b><span style={{ flex: 1 }}>{c.question}</span><span style={{ color: '#5B6474', fontSize: 12 }}>{c.sentAt?.slice(0, 16).replace('T', ' ')}</span></div>)}
    </section>
    <section><h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Replies</h3>
      {answered.length ? answered.slice(0, 40).map((c) => <div key={c.id} style={{ ...row, marginBottom: 6 }}><span style={{ flex: '1 1 260px' }}><b>{name(c.personId)}</b> {c.replyStatus && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: c.replyStatus === 'blocked' ? '#FDE8E8' : '#EAF1FF', color: c.replyStatus === 'blocked' ? '#B42318' : '#1F55E6' }}>{c.replyStatus}</span>}<span style={{ display: 'block', fontSize: 13.5 }}>{c.reply}</span><span style={{ display: 'block', color: '#5B6474', fontSize: 12 }}>Asked: {c.question}</span></span></div>) : <p style={{ color: '#5B6474', fontSize: 13, margin: 0 }}>No replies yet.</p>}
    </section>
  </div>;
}

function CompanySettings() {
  const { settings, update } = useSettings(); const toast = useToast();
  if (!settings) return <Loading />;
  const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid rgba(15,23,42,.08)' } as const;
  return <div style={{ ...box, padding: '4px 16px', maxWidth: 720 }}>
    <div style={row}><div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>Send check-ins without asking me</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>Off: every check-in an agent writes waits here for your OK. On: agents message employees directly.</div></div><Toggle label="Send check-ins without asking" checked={settings.companyCheckinsAuto} onChange={(v) => void update({ companyCheckinsAuto: v }).then(() => toast('Saved'))} /></div>
    <div style={row}><div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>AI calls a day for employee chats</b><div style={{ color: '#5B6474', fontSize: 12.5 }}>Reading replies and answering employees&apos; questions uses your model quota. When it runs out, the bot gives a short fixed answer until tomorrow.</div></div><Input type="number" min={0} max={100000} value={settings.companyDailyLlmBudget} onChange={(e) => void update({ companyDailyLlmBudget: Number(e.target.value) })} style={{ width: 110 }} aria-label="AI calls a day" /></div>
    <div style={row}><div style={{ flex: 1, color: '#5B6474', fontSize: 12.5 }}>Employees only ever see their own work and Knowledge items you marked <b>Company</b> (Knowledge → the Private/Company switch). They never reach your memories, your agents&apos; tools, runs or files.</div></div>
  </div>;
}
