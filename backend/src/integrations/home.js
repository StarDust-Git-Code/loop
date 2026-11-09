// Home Assistant: the server runs at home, so it can reach the owner's Home Assistant on the local network. Only the
// one address in HA_URL is ever contacted (the agent never picks a URL). Everyday devices (lights, switches, media,
// climate, scenes) can be controlled with home_control; anything that affects safety or access (locks, alarms,
// covers like garage doors, valves, sirens, scripts, automations) goes through home_control_secure, which needs the
// owner's approval unless permission mode is auto.
import { env } from '../lib/env.js';
import { bad, str, clip, data, http } from './util.js';

export const homeReady = () => !!(env('HA_URL') && env('HA_TOKEN'));
const base = () => env('HA_URL').replace(/\/+$/, '');
const ha = (path, init = {}) => http('Home Assistant', `${base()}/api${path}`, { timeout: 15_000, ...init, headers: { authorization: `Bearer ${env('HA_TOKEN')}`, ...(init.headers ?? {}) } });

export const SAFE_DOMAINS = ['light', 'switch', 'fan', 'media_player', 'climate', 'scene', 'input_boolean', 'input_number', 'input_select', 'vacuum', 'humidifier', 'water_heater', 'button', 'select', 'number', 'remote'];
export const SECURE_DOMAINS = ['lock', 'alarm_control_panel', 'cover', 'valve', 'siren', 'script', 'automation', 'camera'];
const ENTITY = /^[a-z_]+\.[a-z0-9_]+$/;
const SERVICE = /^[a-z_]+$/;
const label = (s) => `${s.entity_id} | ${s.attributes?.friendly_name ?? ''} | ${s.state}${s.attributes?.unit_of_measurement ? ` ${s.attributes.unit_of_measurement}` : ''}`;

async function control(a, allowed) {
  const entity = str(a.entity_id, 120).trim(); if (!ENTITY.test(entity)) throw bad('entity_id looks like light.kitchen (find it with home_find)');
  const domain = entity.split('.')[0];
  const service = str(a.action || a.service, 60).trim(); if (!SERVICE.test(service)) throw bad('action is a service like turn_on, turn_off, toggle, set_temperature');
  if (!allowed.includes(domain)) throw bad(SECURE_DOMAINS.includes(domain) ? `${domain} devices affect safety or access: use home_control_secure, which asks the owner first.` : `Loopmates does not control ${domain} devices.`);
  let extra = a.data; if (typeof extra === 'string') { try { extra = JSON.parse(extra); } catch { throw bad('data must be a JSON object, e.g. {"brightness_pct": 40}'); } }
  if (extra && (typeof extra !== 'object' || Array.isArray(extra))) throw bad('data must be a JSON object');
  const body = { ...(extra ?? {}), entity_id: entity };
  await ha(`/services/${domain}/${service}`, { method: 'POST', body });
  const s = await ha(`/states/${entity}`).catch(() => null);
  return `Done: ${domain}.${service} on ${entity}.${s ? ` Now: ${s.state}.` : ''}`;
}

const HOME_TOOLS = {
  home_find: { group: 'Home', ready: homeReady, desc: 'Find devices and sensors in the owner\'s Home Assistant by words or domain (light, switch, sensor, climate, lock, media_player…). Returns entity ids and their states.', args: '{"query?": "words like kitchen or temperature", "domain?": "light|switch|sensor|…", "limit?": 30}', run: async (_c, a) => {
    const states = await ha('/states'); const q = str(a.query, 80).toLowerCase().split(/\s+/).filter(Boolean); const d = str(a.domain, 40);
    const rows = states.filter((s) => (!d || s.entity_id.startsWith(`${d}.`)) && q.every((w) => `${s.entity_id} ${s.attributes?.friendly_name ?? ''} ${s.attributes?.area ?? ''}`.toLowerCase().includes(w)));
    return rows.length ? data('Home Assistant devices', rows.slice(0, Math.min(Number(a.limit) || 30, 60)).map(label).join('\n') + (rows.length > 30 ? `\n…${rows.length} in total, narrow the search` : '')) : 'No matching devices in Home Assistant.';
  } },
  home_state: { group: 'Home', ready: homeReady, desc: 'Read one Home Assistant device or sensor in detail (state, attributes, last change).', args: '{"entity_id": "e.g. sensor.living_room_temperature"}', run: async (_c, a) => {
    const id = str(a.entity_id, 120); if (!ENTITY.test(id)) throw bad('entity_id looks like sensor.kitchen_temperature');
    const s = await ha(`/states/${id}`);
    const attrs = Object.entries(s.attributes ?? {}).filter(([k]) => !['entity_picture', 'icon', 'supported_features'].includes(k)).slice(0, 25).map(([k, v]) => `${k}: ${clip(typeof v === 'object' ? JSON.stringify(v) : v, 120)}`).join('\n');
    return data(`Home Assistant ${id}`, `${label(s)}\nlast changed: ${s.last_changed}\n${attrs}`);
  } },
  home_history: { group: 'Home', ready: homeReady, desc: 'How a Home Assistant device or sensor changed over the last hours (e.g. temperature through the night, when the door opened).', args: '{"entity_id": "id", "hours?": 24}', run: async (_c, a) => {
    const id = str(a.entity_id, 120); if (!ENTITY.test(id)) throw bad('entity_id looks like sensor.kitchen_temperature');
    const from = new Date(Date.now() - Math.min(Number(a.hours) || 24, 168) * 3_600_000).toISOString();
    const j = await ha(`/history/period/${from}?${new URLSearchParams({ filter_entity_id: id, minimal_response: '', no_attributes: '' })}`);
    const pts = (j?.[0] ?? []).map((p) => `${String(p.last_changed).slice(0, 16).replace('T', ' ')} ${p.state}`);
    const step = Math.max(1, Math.ceil(pts.length / 40));
    return pts.length ? `${id}, ${pts.length} change(s):\n${pts.filter((_, i) => i % step === 0 || i === pts.length - 1).join('\n')}` : `No history for ${id} in that time.`;
  } },
  home_control: { group: 'Home', ready: homeReady, write: true, desc: `Control an everyday device in Home Assistant: ${SAFE_DOMAINS.slice(0, 8).join(', ')}… Only when the owner asked. action is the service (turn_on, turn_off, toggle, set_temperature, media_pause…); data holds extra values like {"brightness_pct": 40}.`, args: '{"entity_id": "light.kitchen", "action": "turn_on", "data?": {"brightness_pct": 40}}', run: async (_c, a) => control(a, SAFE_DOMAINS) },
  home_control_secure: { group: 'Home', ready: homeReady, write: true, needsApproval: true, desc: `Control a device that affects safety or access in Home Assistant (${SECURE_DOMAINS.join(', ')}), e.g. lock the front door, close the garage. Needs the owner's approval.`, args: '{"entity_id": "lock.front_door", "action": "lock", "data?": {}}', run: async (_c, a) => control(a, [...SAFE_DOMAINS, ...SECURE_DOMAINS]) },
};

export const home = {
  key: 'home', name: 'Home Assistant', badge: 'HA', group: 'Home', bg: '#E3F2FD', fg: '#0B63B5',
  what: 'Your agents see your home: temperatures, doors, energy, who is home. They can switch lights, media and climate when you ask, keep watch for things like a door left open, and Zen can dim the lights for focus time. Locks, alarms and garage doors always ask you first.',
  fields: [{ key: 'HA_URL', label: 'Home Assistant address', placeholder: 'http://homeassistant.local:8123' }, { key: 'HA_TOKEN', label: 'Long-lived access token' }],
  steps: [
    { title: 'Make a token', text: 'In Home Assistant, open your profile (bottom left) → Security → Long-lived access tokens → Create token. Name it Loopmates and copy it (it is shown only once).' },
    { title: 'Paste the address and token', text: 'Use the address your Loopmates computer can reach, usually http://homeassistant.local:8123 or http://<its IP>:8123. Nothing needs to be exposed to the internet.' },
    { title: 'Test, then ask', text: 'Try "@mimo is the front door locked?" or "turn the living room lights to 30%". To be told when something happens, ask the leader to watch a device ("tell me if the garage is open after 11pm").' },
  ],
  ready: homeReady, note: () => (homeReady() ? `At ${base()}` : 'Not set up'),
  test: async () => { const c = await ha('/config'); const s = await ha('/states'); return `Working: ${c.location_name ?? 'Home'} (Home Assistant ${c.version}), ${s.length} entities.`; },
  tools: HOME_TOOLS,
};
export { ha as haFetch };
