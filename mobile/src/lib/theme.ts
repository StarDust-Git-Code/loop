export const LIGHT = {
  bg: '#FAF9FD', card: '#FFFFFF', ink: '#1B1822', ink2: '#3D3946', muted: '#6B6572',
  line: 'rgba(31,26,23,0.12)', line2: 'rgba(31,26,23,0.18)',
  brand: '#6A4DF4', brandDeep: '#4F34D6', tint: '#ECE7FF', tint2: '#F4F0FF', soft: '#F4F2FA', field: '#F3F1F8', pill: 'rgba(255,255,255,0.97)',
  good: '#1E6B3A', goodBg: '#DDF3E4', bad: '#C62828', badBg: '#FBE4E2', warn: '#8A5A00', warnBg: '#FFEBC8',
};
export const DARK: typeof LIGHT = {
  bg: '#0F0D16', card: '#1A1724', ink: '#F3F1FA', ink2: '#D6D2E3', muted: '#9B94AD',
  line: 'rgba(255,255,255,0.10)', line2: 'rgba(255,255,255,0.18)',
  brand: '#7C62FF', brandDeep: '#B9A8FF', tint: '#2B2354', tint2: '#201B38', soft: '#242031', field: '#242031', pill: 'rgba(30,26,44,0.97)',
  good: '#6FD39A', goodBg: '#183A27', bad: '#FF8A80', badBg: '#43201E', warn: '#FFC966', warnBg: '#3F2F10',
};
/** Live colour table. applyScheme() rewrites it and the app tree is remounted, so every style picks up the new values. */
export const C: typeof LIGHT = { ...LIGHT };
export const applyScheme = (s: 'light' | 'dark') => { Object.assign(C, s === 'dark' ? DARK : LIGHT); };
export const R = { sm: 10, md: 14, lg: 18, xl: 24 };
export const SHADOW = { shadowColor: '#1F1A17', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 } as const;
export const API_URL = 'https://loopmates-api-82ub.onrender.com';
export const DEFAULT_VOICE_URL = 'https://loopmates-voice.onrender.com';
