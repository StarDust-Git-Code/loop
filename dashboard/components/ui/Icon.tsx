import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  hangup: 'M3 14c4-4 14-4 18 0l-2.5 2.5-3-1.5v-2.5a9 9 0 0 0-5 0V15l-3 1.5z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  micoff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5 2M15 10V6a3 3 0 0 0-5.5-1.7M6 11a6 6 0 0 0 9 5M12 17v4',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  check: 'M5 12.5l4.5 4.5L19 7',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  clip: 'M20 11l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8',
  chevron: 'M6 9l6 6 6-6',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  tool: 'M14 6a4 4 0 0 0 4.5 5.5L9 21l-3-3 9.5-9.5A4 4 0 0 0 14 6z',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  send: 'M4 12l16-8-6 16-3-7z',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  contrast: 'M12 3a9 9 0 1 0 0 18zM12 3v18',
  pin: 'M9 4h6l-1 5 3 3H7l3-3zM12 12v8',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7',
  input: 'M4 6h16v10H9l-5 4z',
  branch: 'M7 4v10a4 4 0 0 0 4 4h6M7 8a2 2 0 1 0 0-.01M17 14l3 4-3 4',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  flag: 'M5 21V4h12l-2 4 2 4H5',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  play: 'M7 4l13 8-13 8z',
  speaker: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6',
};

export function Icon({ name, size = 18, stroke = 1.8, style }: { name: keyof typeof P | string; size?: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      <path d={P[name] ?? P.spark} />
    </svg>
  );
}
