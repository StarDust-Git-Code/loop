'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useSettings } from '../../lib/hooks';
import { AGENT, BRAND } from '../../lib/dashboard/brand';
import { Mate } from './Mate';
import s from './dashboard.module.css';

export function TaskComposer() {
  const fieldId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { settings } = useSettings();
  const [task, setTask] = useState('');
  const [askOverride, setAskOverride] = useState<boolean | null>(null);
  const askFirst = askOverride ?? settings?.askBeforeRisky ?? true;
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sent, setSent] = useState<string | null>(null);

  const canRun = task.trim().length > 0;

  async function run() {
    if (!canRun || busy) return;
    setBusy(true);
    try {
      const r = await api.runs.start({ prompt: task.trim(), askFirst, files });
      router.push(`/run?id=${r.id}`);
    } catch (e) {
      setSent(e instanceof Error ? e.message : 'Could not start the run.');
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  }

  return (
    <div className={s.composer}>
      <label htmlFor={fieldId} className={s.srOnly}>
        Task
      </label>
      <textarea
        id={fieldId}
        rows={3}
        value={task}
        onChange={(e) => {
          setTask(e.target.value);
          setSent(null);
        }}
        onKeyDown={onKeyDown}
        className={s.composerField}
        placeholder={`Describe the task for ${BRAND}`}
      />

      {files.length > 0 && (
        <ul className={s.fileList} aria-label="Attached files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className={s.fileChip}>
              <span className={s.fileName}>{f.name}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                className={s.fileRemove}
                onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={s.composerBar}>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) setFiles((cur) => [...cur, ...picked]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          aria-label="Attach file"
          className={s.attachBtn}
          onClick={() => fileInput.current?.click()}
        >
          +
        </button>

        <span className={s.chip}>
          <Mate mate="planner" size={20} />
          Planner {AGENT} routes the work
        </span>

        <button
          type="button"
          aria-pressed={askFirst}
          className={`${s.chip} ${s.chipBtn} ${askFirst ? s.chipOn : ''}`}
          onClick={() => setAskOverride(!askFirst)}
        >
          Ask before risky actions
        </button>

        <div className={s.grow} />

        <button type="button" aria-label="Voice input (not available yet)" className={s.iconBtn} disabled>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>

        <button type="button" className={s.runBtn} disabled={!canRun || busy} onClick={run}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4l14 8-14 8z" />
          </svg>
          {busy ? 'Starting…' : `Run in ${BRAND}`}
        </button>
      </div>

      <p className={s.composerNote} role="status" aria-live="polite">
        {sent}
      </p>
    </div>
  );
}
