// Spotify for Tune: search, what is playing, recent and top tracks, and real playlists. The owner makes their own
// Spotify app (developer mode is enough for one person) and signs in once; the refresh token stays on the server.
import { env } from '../lib/env.js';
import { bad, str, clip, list, http } from './util.js';

export const SPOTIFY_SCOPES = 'playlist-modify-private playlist-modify-public user-read-currently-playing user-read-recently-played user-top-read';
const clientOk = () => !!(env('SPOTIFY_CLIENT_ID') && env('SPOTIFY_CLIENT_SECRET'));
export const spotifyReady = () => clientOk() && !!env('SPOTIFY_REFRESH_TOKEN');
const basic = () => `Basic ${Buffer.from(`${env('SPOTIFY_CLIENT_ID')}:${env('SPOTIFY_CLIENT_SECRET')}`).toString('base64')}`;

let tok = { v: '', exp: 0, rt: '' };
async function token() {
  if (tok.v && tok.exp > Date.now() + 60_000 && tok.rt === env('SPOTIFY_REFRESH_TOKEN')) return tok.v;
  const j = await http('Spotify sign-in', 'https://accounts.spotify.com/api/token', { method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env('SPOTIFY_REFRESH_TOKEN') }).toString() });
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000, rt: env('SPOTIFY_REFRESH_TOKEN') };
  return tok.v;
}
const sp = async (path, init = {}) => http('Spotify', `https://api.spotify.com/v1${path}`, { ...init, headers: { authorization: `Bearer ${await token()}`, ...(init.headers ?? {}) } });

export const spotifyAuthUrl = (redirectUri, state) => `https://accounts.spotify.com/authorize?${new URLSearchParams({ client_id: env('SPOTIFY_CLIENT_ID'), response_type: 'code', redirect_uri: redirectUri, scope: SPOTIFY_SCOPES, state, show_dialog: 'true' })}`;
export async function spotifyExchange(code, redirectUri) {
  if (!clientOk()) throw bad('Save the Spotify client ID and secret first.');
  const j = await http('Spotify sign-in', 'https://accounts.spotify.com/api/token', { method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString() });
  if (!j.refresh_token) throw bad('Spotify did not return a refresh token.');
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000, rt: j.refresh_token };
  return j.refresh_token;
}

const track = (t) => `${t.name} — ${(t.artists ?? []).map((a) => a.name).join(', ')}${t.album?.name ? ` (${t.album.name})` : ''} | ${t.uri}`;
async function resolveTracks(items) {
  const uris = [], missing = [];
  for (const q of items.slice(0, 60)) {
    const s = String(q).trim(); if (!s) continue;
    if (/^spotify:track:[A-Za-z0-9]{22}$/.test(s)) { uris.push(s); continue; }
    const m = /open\.spotify\.com\/track\/([A-Za-z0-9]{22})/.exec(s); if (m) { uris.push(`spotify:track:${m[1]}`); continue; }
    const r = await sp(`/search?${new URLSearchParams({ q: s.slice(0, 200), type: 'track', limit: '1' })}`).catch(() => null);
    const t = r?.tracks?.items?.[0]; if (t) uris.push(t.uri); else missing.push(s);
  }
  return { uris: [...new Set(uris)], missing };
}

const SPOTIFY_TOOLS = {
  spotify_search: { group: 'Music', ready: spotifyReady, desc: 'Search Spotify for tracks, artists, albums or playlists.', args: '{"query": "text", "type?": "track|artist|album|playlist", "limit?": 8}', run: async (_c, a) => {
    const type = ['track', 'artist', 'album', 'playlist'].includes(a.type) ? a.type : 'track';
    const j = await sp(`/search?${new URLSearchParams({ q: str(a.query, 200), type, limit: String(Math.min(Number(a.limit) || 8, 20)) })}`);
    const items = j[`${type}s`]?.items?.filter(Boolean) ?? [];
    const rows = items.map((x) => (type === 'track' ? `- ${track(x)}` : type === 'artist' ? `- ${x.name} | ${(x.genres ?? []).slice(0, 3).join(', ')} | ${x.uri}` : `- ${x.name}${x.artists ? ` — ${x.artists.map((y) => y.name).join(', ')}` : ''} | ${x.uri}`));
    return rows.length ? rows.join('\n') : 'Nothing found on Spotify.';
  } },
  spotify_now: { group: 'Music', ready: spotifyReady, desc: 'What the owner is playing on Spotify right now.', args: '{}', run: async () => {
    const j = await sp('/me/player/currently-playing').catch((e) => { if (/204/.test(e.message)) return null; throw e; });
    return j?.item ? `${j.is_playing ? 'Playing' : 'Paused'}: ${track(j.item)}` : 'Nothing is playing on Spotify right now.';
  } },
  spotify_history: { group: 'Music', ready: spotifyReady, desc: 'The owner\'s recently played tracks, or their top tracks or artists (taste).', args: '{"which?": "recent|top_tracks|top_artists", "range?": "short|medium|long"}', run: async (_c, a) => {
    const range = { short: 'short_term', medium: 'medium_term', long: 'long_term' }[a.range] ?? 'medium_term';
    if (a.which === 'top_artists') { const j = await sp(`/me/top/artists?limit=15&time_range=${range}`); return j.items.map((x, i) => `${i + 1}. ${x.name} (${(x.genres ?? []).slice(0, 2).join(', ')})`).join('\n') || 'No top artists yet.'; }
    if (a.which === 'top_tracks') { const j = await sp(`/me/top/tracks?limit=15&time_range=${range}`); return j.items.map((x, i) => `${i + 1}. ${track(x)}`).join('\n') || 'No top tracks yet.'; }
    const j = await sp('/me/player/recently-played?limit=20'); return j.items.map((x) => `- ${x.played_at.slice(0, 16).replace('T', ' ')} ${track(x.track)}`).join('\n') || 'Nothing played recently.';
  } },
  spotify_playlist: { group: 'Music', ready: spotifyReady, write: true, desc: 'Create a Spotify playlist in the owner\'s account and fill it. tracks are "Song — Artist" searches, track URIs or links, in order.', args: '{"name": "playlist name", "tracks": ["Song — Artist", "spotify:track:…"], "description?": "text", "public?": "false (default)"}', run: async (_c, a) => {
    const name = str(a.name, 100).trim(); if (!name) throw bad('name is required');
    const { uris, missing } = await resolveTracks(list(a.tracks)); if (!uris.length) throw bad('None of the tracks were found on Spotify');
    const me = await sp('/me');
    const pl = await sp(`/users/${encodeURIComponent(me.id)}/playlists`, { method: 'POST', body: { name, description: clip(str(a.description, 300), 300), public: a.public === true || a.public === 'true' } });
    for (let i = 0; i < uris.length; i += 100) await sp(`/playlists/${pl.id}/tracks`, { method: 'POST', body: { uris: uris.slice(i, i + 100) } });
    return `Created "${name}" with ${uris.length} track(s): ${pl.external_urls?.spotify ?? pl.uri}${missing.length ? `\nNot found: ${missing.slice(0, 10).join('; ')}` : ''}`;
  } },
};

export const spotify = {
  key: 'spotify', name: 'Spotify', badge: 'SP', group: 'Music', bg: '#E3F7EA', fg: '#137A3A',
  what: 'Tune builds real playlists in your Spotify, knows what you are playing, and suggests music from your actual taste.',
  fields: [{ key: 'SPOTIFY_CLIENT_ID', label: 'Client ID' }, { key: 'SPOTIFY_CLIENT_SECRET', label: 'Client secret' }],
  steps: [
    { title: 'Create a Spotify app', text: 'On developer.spotify.com/dashboard → Create app. Choose Web API. Add the redirect URI shown below (on the setup page it is a 127.0.0.1 address that never changes, which Spotify allows). Under User Management, add your own Spotify email.' },
    { title: 'Paste the client ID and secret, then sign in', text: 'Save both values, then press Sign in with Spotify and allow access.' },
  ],
  oauth: { start: 'spotify', label: 'Sign in with Spotify', callback: '/spotify/oauth/callback' },
  ready: spotifyReady, note: () => (spotifyReady() ? 'Signed in' : clientOk() ? 'Sign in next' : 'Not set up'),
  test: async () => { const me = await sp('/me'); return `Working as ${me.display_name ?? me.id} (${me.product ?? 'account'}).`; },
  tools: SPOTIFY_TOOLS,
};
