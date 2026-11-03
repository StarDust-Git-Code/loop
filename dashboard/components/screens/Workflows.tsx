'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import { mateImg, mateName } from '../../lib/mates';
import { chain, TEMPLATES } from '../../lib/templates';
import type { MateKey, Workflow } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, Empty, ErrorNote, Loading, Page, Tabs } from '../ui/ui';
import { Icon } from '../ui/Icon';

type F = 'all' | 'scheduled' | 'manual' | 'draft';
const STATE = { active: ['Active', '#E6F4EA', '#1E7A46'], scheduled: ['Scheduled', '#E6F4EA', '#1E7A46'], manual: ['Manual', '#ECE9F4', '#6B6572'], draft: ['Draft', '#FFF3D6', '#8A5A00'] } as const;
const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)' } as const;
const tag = { background: '#F1EFF6', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: '#3D3946' } as const;

export function Workflows() {
  const { items, loading, error, remove, create } = useRepo(api.workflows);
  const runs = useRepo(api.runs).items;
  const router = useRouter(); const toast = useToast();
  const [f, setF] = useState<F>('all'); const [q, setQ] = useState('');
  const shown = useMemo(() => items.filter((w) => (f === 'all' || (w.state ?? 'manual') === f) && (w.name + w.description).toLowerCase().includes(q.toLowerCase())), [items, f, q]);
  const lastRun = (w: Workflow) => runs.filter((r) => r.workflowId === w.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const run = async (w: Workflow) => { const r = await api.runs.start({ prompt: `Run workflow: ${w.name}`, workflowId: w.id, askFirst: true }); router.push(`/run?id=${r.id}`); };
  const fromTemplate = async (i: number) => {
    const t = TEMPLATES[i]; const w = await create({ name: t.name, description: t.description, trigger: t.trigger, state: 'draft', ...chain(t.mates, mateName) });
    toast(`Created “${t.name}”`); router.push(`/studio?id=${w.id}`);
  };
  return (
    <Page title="Workflows" sub="Saved chains of Mates you can run again, schedule, or trigger."
      actions={<><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search workflows" placeholder="Search workflows" style={{ width: 260, height: 42, border: '1px solid rgba(27,24,34,.17)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontSize: 14, background: '#fff' }} /><Btn variant="primary" href="/studio">+ New workflow</Btn></>}>
      <ErrorNote message={error} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px,360px)', gap: 28, alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: 14 }}><Tabs value={f} onChange={setF} options={[{ id: 'all', label: 'All' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'manual', label: 'Manual' }, { id: 'draft', label: 'Drafts' }]} /></div>
          {loading ? <Loading /> : shown.length === 0 ? (
            <Empty mate="planner" title={items.length ? 'Nothing matches' : 'No workflows yet'} text={items.length ? 'Try another filter or search.' : 'Start from a template on the right, or build one on the Studio canvas.'} action={<Btn variant="primary" href="/studio">Open Studio</Btn>} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {shown.map((w, i) => {
                const mates = w.nodes.filter((n) => n.mate).map((n) => n.mate as MateKey); const st = STATE[w.state ?? 'manual']; const lr = lastRun(w);
                return (
                  <div key={w.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, padding: 20, animation: `lm-up .35s ${Math.min(i, 8) * 40}ms ease both`, transition: 'transform .2s, box-shadow .2s' }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
                    <div style={{ background: '#F4F2FA', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4, minWidth: 96, minHeight: 64 }}>
                      {mates.length === 0 && <span style={{ color: '#6B6572', fontSize: 12 }}>Empty</span>}
                      {mates.slice(0, 5).map((m, k) => <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{k > 0 && <i style={{ width: 10, height: 2, background: '#B9ABF8' }} />}<img src={mateImg(m)} alt="" width={36} height={36} /></span>)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 16 }}>{w.name}</b>
                      <div style={{ color: '#6B6572', fontSize: 13, margin: '2px 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.description || 'No description'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span style={tag}>Trigger: {w.trigger || 'manual'}</span><span style={tag}>{lr ? `Last run ${ago(lr.createdAt)}` : 'Never run'}</span></div>
                    </div>
                    <span style={{ background: st[1], color: st[2], fontSize: 12, fontWeight: 600, borderRadius: 99, padding: '4px 12px' }}>{st[0]}</span>
                    <Btn href={`/studio?id=${w.id}`}>Open</Btn>
                    <Btn variant="primary" onClick={() => run(w)}>Run</Btn>
                    <Btn variant="danger" small aria-label={`Delete ${w.name}`} onClick={() => confirmThen(`Delete “${w.name}”?`, () => remove(w.id))}><Icon name="close" size={16} /></Btn>
                  </div>);
              })}
            </div>)}
        </div>
        <aside>
          <h2 style={{ fontSize: 15, margin: '6px 0 12px' }}>Start from a template</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TEMPLATES.map((t, i) => (
              <button key={t.name} onClick={() => fromTemplate(i)} style={{ textAlign: 'left', background: t.tint, border: '1px solid rgba(27,24,34,.1)', borderRadius: 16, padding: 16, cursor: 'pointer', font: 'inherit', transition: 'transform .2s', animation: `lm-up .4s ${150 + i * 60}ms ease both` }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
                <div style={{ display: 'flex', marginBottom: 8 }}>{t.mates.map((m, k) => <img key={m} src={mateImg(m)} alt="" width={34} height={34} style={{ marginLeft: k ? -4 : 0 }} />)}</div>
                <b style={{ fontSize: 15 }}>{t.name}</b><div style={{ color: '#3D3946', fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{t.description}</div>
              </button>))}
          </div>
        </aside>
      </div>
    </Page>
  );
}
