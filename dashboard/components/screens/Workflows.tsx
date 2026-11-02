'use client';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import { MATES } from '../../lib/mates';
import type { MateKey } from '../../lib/types';
import { Btn, Card, confirmThen, Empty, ErrorNote, Grid, Loading, MateAvatar, Page } from '../ui/ui';

export function Workflows() {
  const { items, loading, error, remove, create } = useRepo(api.workflows);
  const router = useRouter();
  const run = async (id: string, name: string) => { const r = await api.runs.start({ prompt: `Run workflow: ${name}`, workflowId: id, askFirst: true }); router.push(`/run?id=${r.id}`); };
  return (
    <Page title="Workflows" sub="Saved chains of Mates you can run, schedule or trigger." actions={<Btn variant="primary" href="/studio">New workflow</Btn>}>
      <ErrorNote message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <Empty title="No workflows yet" text="Build one in Studio by placing Mates on a canvas and connecting them." action={<Btn variant="primary" href="/studio">Open Studio</Btn>} />
      ) : (
        <Grid>
          {items.map((w) => {
            const mates = [...new Set(w.nodes.filter((n) => n.mate).map((n) => n.mate as MateKey))];
            return (
              <Card key={w.id}>
                <div style={{ display: 'flex', gap: -8 }}>{mates.slice(0, 5).map((m) => <MateAvatar key={m} mate={m} size={36} />)}</div>
                <p style={{ fontWeight: 700, margin: '10px 0 2px' }}>{w.name}</p>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5 }}>{w.description || 'No description'}</p>
                <p style={{ margin: '6px 0 12px', color: 'var(--muted)', fontSize: 12 }}>{mates.map((m) => MATES[m].name).join(' → ') || 'Empty'} · edited {ago(w.updatedAt)}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn small variant="primary" onClick={() => run(w.id, w.name)}>Run</Btn>
                  <Btn small href={`/studio?id=${w.id}`}>Open</Btn>
                  <Btn small onClick={() => create({ name: `${w.name} copy`, description: w.description, nodes: w.nodes, edges: w.edges })}>Duplicate</Btn>
                  <Btn small variant="danger" onClick={() => confirmThen(`Delete “${w.name}”?`, () => remove(w.id))}>Delete</Btn>
                </div>
              </Card>
            );
          })}
        </Grid>
      )}
    </Page>
  );
}
