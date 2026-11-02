'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { ALL_TOOLS, MATES, MATE_DEFS, MODELS } from '../../lib/mates';
import type { MateConfig } from '../../lib/types';
import { Badge, Card, Chips, ErrorNote, Field, Grid, MateAvatar, Modal, Page, Select, Textarea, Toggle, Btn, Loading } from '../ui/ui';

export function Agents() {
  const { items, loading, error, update } = useRepo(api.mateConfigs);
  const router = useRouter();
  const open = useSearchParams().get('mate');
  const editing = items.find((c) => c.mate === open);
  const [draft, setDraft] = useState<MateConfig | null>(null);
  const cur = draft ?? editing;
  const close = () => { setDraft(null); router.replace('/agents'); };
  const cfgOf = (k: string) => items.find((c) => c.mate === k);

  return (
    <Page title="Agents" sub="Eighteen Mates. Each has a job, a model and the tools it is allowed to use. Turn on the ones you want in your sidebar.">
      <ErrorNote message={error} />
      {loading ? <Loading /> : (
        <Grid>
          {MATE_DEFS.map((d) => {
            const c = cfgOf(d.key);
            return (
              <Card key={d.key}>
                <div className="row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <MateAvatar mate={d.key} size={56} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{d.name} Mate</p>
                    <Badge>{d.role}</Badge>
                  </div>
                  {c && <Toggle label={`Enable ${d.name}`} checked={c.enabled} onChange={(v) => update(c.id, { enabled: v })} />}
                </div>
                <p style={{ margin: '10px 0', color: 'var(--muted)', lineHeight: 1.5, fontSize: 13 }}>{d.blurb}</p>
                <Btn small onClick={() => router.replace(`/agents?mate=${d.key}`)}>Configure</Btn>
              </Card>
            );
          })}
        </Grid>
      )}
      {cur && (
        <Modal title={`Configure ${MATES[cur.mate].name} Mate`} onClose={close} onSubmit={async () => { await update(cur.id, { enabled: cur.enabled, instructions: cur.instructions, model: cur.model, tools: cur.tools }); close(); }}>
          <Field label="Model"><Select value={cur.model} onChange={(e) => setDraft({ ...cur, model: e.target.value })}>{MODELS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Extra instructions"><Textarea value={cur.instructions} placeholder="Always cite sources. Prefer short answers." onChange={(e) => setDraft({ ...cur, instructions: e.target.value })} /></Field>
          <Field label="Tools this Mate may use"><Chips options={ALL_TOOLS} value={cur.tools} onChange={(tools) => setDraft({ ...cur, tools })} /></Field>
        </Modal>
      )}
    </Page>
  );
}
