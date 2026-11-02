'use client';
import { api } from '../../lib/api';
import { useSession, useSettings } from '../../lib/hooks';
import { MODELS } from '../../lib/mates';
import type { SettingsData } from '../../lib/types';
import { Btn, Card, Field, Input, Loading, Page, Select, Toggle } from '../ui/ui';

const Row = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>{label}</b>{sub && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12.5 }}>{sub}</p>}</div>{children}</div>);

export function Settings() {
  const { settings, update } = useSettings();
  const session = useSession();
  if (!settings) return <Page title="Settings"><Loading /></Page>;
  const set = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) => void update({ [k]: v });
  return (
    <Page title="Settings" sub="Changes save automatically.">
      <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <Card><b>Profile</b><div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <Field label="Display name"><Input defaultValue={settings.displayName} onBlur={(e) => set('displayName', e.target.value)} /></Field>
          <Field label="Email"><Input type="email" defaultValue={settings.email} onBlur={(e) => set('email', e.target.value)} /></Field>
          <Field label="Workspace name"><Input defaultValue={settings.workspaceName} onBlur={(e) => set('workspaceName', e.target.value)} /></Field>
          <Field label="Time zone"><Input defaultValue={settings.timezone} onBlur={(e) => set('timezone', e.target.value)} /></Field></div></Card>
        <Card><b>Mates and safety</b>
          <Row label="Default model"><Select style={{ width: 200 }} value={settings.model} onChange={(e) => set('model', e.target.value)}>{MODELS.map((m) => <option key={m}>{m}</option>)}</Select></Row>
          <Row label="Ask before risky actions" sub="File writes, purchases and anything outside the sandbox wait for your OK."><Toggle label="Ask before risky actions" checked={settings.askBeforeRisky} onChange={(v) => set('askBeforeRisky', v)} /></Row>
          <Row label="Allow web access"><Toggle label="Allow web access" checked={settings.allowNetwork} onChange={(v) => set('allowNetwork', v)} /></Row>
          <Row label="Max steps per run"><Input style={{ width: 90 }} type="number" min={1} max={500} defaultValue={settings.maxSteps} onBlur={(e) => set('maxSteps', Math.max(1, Number(e.target.value) || 1))} /></Row>
          <Row label="Stop a run after (minutes)"><Input style={{ width: 90 }} type="number" min={1} defaultValue={settings.stopAfterMinutes} onBlur={(e) => set('stopAfterMinutes', Math.max(1, Number(e.target.value) || 1))} /></Row></Card>
        <Card><b>Notifications</b>
          <Row label="Telegram"><Toggle label="Telegram notifications" checked={settings.notifyTelegram} onChange={(v) => set('notifyTelegram', v)} /></Row>
          <Row label="Email"><Toggle label="Email notifications" checked={settings.notifyEmail} onChange={(v) => set('notifyEmail', v)} /></Row></Card>
        <Card><b>Account</b><p style={{ color: 'var(--muted)', fontSize: 13 }}>{session?.signedIn ? `Signed in as ${session.name ?? ''}` : 'Not signed in. Sign-in arrives with the backend.'}</p>
          {session?.signedIn && <Btn onClick={() => api.auth.signOut().then(() => location.reload())}>Sign out</Btn>}</Card>
      </div>
    </Page>
  );
}
