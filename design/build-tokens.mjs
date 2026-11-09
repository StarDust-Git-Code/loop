// Turns design/tokens.json into the dashboard's CSS variables and the mobile theme. Run: node design/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const t = JSON.parse(readFileSync(new URL('design/tokens.json', root), 'utf8'));
const kebab = (k) => k.replace(/([A-Z0-9])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '');
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
const NOTE = '/* Generated from design/tokens.json by design/build-tokens.mjs. Do not edit by hand. */\n';

// Dashboard: the light palette on :root (the dashboard is light-only for now; the dark set is ready for it).
const L = t.color.light;
const vars = Object.entries(L).map(([k, v]) => `  --${kebab(k)}: ${v};`);
vars.push(`  --accent-rgb: ${rgb(L.accent)};`, `  --line-soft: ${L.lineSoft};`, `  --done: ${L.good};`, `  --failed: ${L.bad};`, `  --chip: ${L.field};`, '  --card: rgba(255, 255, 255, 0.86);');
for (const [k, v] of Object.entries(t.radius)) vars.push(`  --radius-${k}: ${v}px;`);
for (const [k, v] of Object.entries(t.space)) vars.push(`  --space-${k}: ${v}px;`);
for (const [k, v] of Object.entries(t.type.size)) vars.push(`  --text-${k}: ${v}px;`);
for (const [k, v] of Object.entries(t.motion)) vars.push(`  --motion-${k}: ${v};`);
vars.push(`  --font: '${t.type.family} Variable';`, '  --shadow-float: 0 1px 2px rgba(15, 23, 42, 0.04), 0 18px 48px rgba(var(--accent-rgb), 0.12);');
writeFileSync(new URL('dashboard/app/tokens.css', root), `${NOTE}:root {\n${vars.join('\n')}\n}\n`);

// Mobile: LIGHT and DARK palettes with the names the app already uses.
const rn = (c) => ({ bg: c.bg === '#FFFFFF' ? '#FAFBFD' : c.bg, card: c.card, ink: c.ink, ink2: c.ink2, muted: c.muted, line: c.lineSoft, line2: c.line, brand: c.accent, brandDeep: c.accentInk, tint: c.tint, tint2: c.tint2, soft: c.surface, field: c.field, pill: c === L ? 'rgba(255,255,255,0.97)' : 'rgba(18,26,46,0.97)', good: c.good, goodBg: c.goodBg, bad: c.bad, badBg: c.badBg, warn: c.warn, warnBg: c.warnBg });
writeFileSync(new URL('mobile/src/lib/tokens.ts', root), `${NOTE.replace('/*', '//').replace(' */', '')}export const LIGHT = ${JSON.stringify(rn(L), null, 2)};\nexport const DARK: typeof LIGHT = ${JSON.stringify(rn(t.color.dark), null, 2)};\nexport const RADIUS = ${JSON.stringify({ sm: t.radius.sm, md: t.radius.md, lg: t.radius.lg, xl: t.radius.xl })};\n`);
console.log('wrote dashboard/app/tokens.css and mobile/src/lib/tokens.ts');
