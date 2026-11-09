import { DARK, LIGHT, RADIUS } from './tokens';

// Colours come from design/tokens.json (node design/build-tokens.mjs).
export { DARK, LIGHT };
/** Live colour table. applyScheme() rewrites it and the app tree is remounted, so every style picks up the new values. */
export const C: typeof LIGHT = { ...LIGHT };
export const applyScheme = (s: 'light' | 'dark') => { Object.assign(C, s === 'dark' ? DARK : LIGHT); };
export const R = RADIUS;
export const SHADOW = { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 } as const;

