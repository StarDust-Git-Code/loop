// Generic per-user CRUD: users/{uid}/{collection}/{id}. Secrets are sealed (AES-256-GCM) and never returned.
import { now } from '../lib/env.js';
import { seal, hint } from '../lib/crypto.js';
import { userCol, strip } from './db.js';
import { MATE_DEFS, defaultConfig } from './mates.js';

const isMask = (v) => typeof v === 'string' && v.startsWith('•');
const SECRET_KEY = /token|secret|password|passwd|api[_-]?key|private/i;
const bad = (msg) => Object.assign(new Error(msg), { statusCode: 400 });
const str = (v, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : v);

/** Collections. `path` is the REST path, `col` the Firestore collection. */
export const COLLECTIONS = {
  tasks: { col: 'tasks' }, workflows: { col: 'workflows' }, automations: { col: 'automations' }, knowledge: { col: 'knowledge' },
  memories: { col: 'memories' }, skills: { col: 'skills' }, 'mcp-servers': { col: 'mcp' }, connections: { col: 'connections', secrets: 'config' },
  conversations: { col: 'conversations' }, events: { col: 'events' }, files: { col: 'files', noCreate: true }, runs: { col: 'runs', readonly: true },
  mates: { col: 'mates', seed: true }, providers: { col: 'providers', secrets: 'apiKey' },
};

/** Strip server-managed fields and cap strings so a client cannot write arbitrary shapes. */
function clean(body) {
  const o = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (['id', 'createdAt', 'updatedAt', 'keyEnc', 'keyHint', 'secretsEnc', 'uid', 'inline', 'vec', 'vm', 'chunks'].includes(k)) continue;
    o[k] = typeof v === 'string' ? str(v) : v;
  }
  return o;
}

/** Move secret input into sealed storage. Returns the doc fields to write. */
function sealIn(def, uid, id, input, existing) {
  if (!def.secrets) return input;
  const out = { ...input };
  if (def.secrets === 'apiKey') {
    const k = out.apiKey; delete out.apiKey;
    if (typeof k === 'string' && k && !isMask(k)) { out.keyEnc = seal(k.trim(), `${uid}|provider|${id}`); out.keyHint = hint(k.trim()); }
    else if (existing) { out.keyEnc = existing.keyEnc; out.keyHint = existing.keyHint; }
    if (typeof out.baseUrl === 'string' && !/^https?:\/\//i.test(out.baseUrl)) throw bad('baseUrl must start with http:// or https://');
  } else if (def.secrets === 'config') {
    if (!out.config) return out; // patch without config: leave stored config and secrets untouched
    const cfg = { ...(out.config ?? {}) }; const enc = { ...(existing?.secretsEnc ?? {}) };
    for (const [k, v] of Object.entries(cfg)) {
      if (!SECRET_KEY.test(k)) continue;
      if (typeof v === 'string' && v && !isMask(v)) enc[k] = { ...seal(v, `${uid}|connection|${id}|${k}`), hint: hint(v) };
      delete cfg[k];
    }
    for (const k of Object.keys(enc)) if (out.config && !(k in out.config)) delete enc[k]; // user cleared the field
    out.config = cfg; out.secretsEnc = enc;
  }
  return out;
}

export function sealOut(def, d) {
  if (!d) return d;
  const { keyEnc, keyHint, secretsEnc, inline, vec, vm, chunks, ...rest } = d; // internal blobs never leave the server
  if (def.secrets === 'apiKey') return { ...rest, apiKey: keyHint || '' };
  if (def.secrets === 'config') {
    const masks = Object.fromEntries(Object.entries(secretsEnc ?? {}).map(([k, v]) => [k, v.hint || '••••']));
    return { ...rest, config: { ...(rest.config ?? {}), ...masks } };
  }
  return rest;
}

export function registerCrud(app, { hooks = {} } = {}) {
  for (const [path, def] of Object.entries(COLLECTIONS)) {
    const col = (uid) => userCol(uid, def.col);

    app.get(`/v1/${path}`, async (req) => {
      const uid = req.user.uid;
      let snap = await col(uid).limit(500).get();
      if (def.seed) { // seed the roster, and top it up when new Mates are added later
        const have = new Set(snap.docs.map((d) => d.id)); const missing = MATE_DEFS.filter((m) => !have.has(m.key));
        if (missing.length) {
          const ts = now(); const b = userCol(uid, def.col).firestore.batch();
          for (const m of missing) b.set(col(uid).doc(m.key), defaultConfig(m, ts));
          await b.commit();
          snap = await col(uid).limit(500).get();
        }
      }
      return snap.docs.map((d) => sealOut(def, { id: d.id, ...d.data() }));
    });

    app.get(`/v1/${path}/:id`, async (req, reply) => {
      const d = strip(await col(req.user.uid).doc(req.params.id).get());
      return d ? sealOut(def, d) : reply.code(404).send({ error: 'Not found' });
    });

    if (def.readonly) { // runs are created by the engine; users may only delete them
      app.delete(`/v1/${path}/:id`, async (req, reply) => { await col(req.user.uid).doc(req.params.id).delete(); return reply.code(204).send(); });
      continue;
    }

    if (!def.noCreate) app.post(`/v1/${path}`, async (req, reply) => {
      const uid = req.user.uid; const ref = col(uid).doc();
      const ts = now();
      const doc = { ...sealIn(def, uid, ref.id, clean(req.body)), createdAt: ts, updatedAt: ts };
      await ref.set(doc);
      await hooks[def.col]?.(uid, ref.id, doc, 'set');
      return reply.code(201).send(sealOut(def, { id: ref.id, ...doc }));
    });

    app.patch(`/v1/${path}/:id`, async (req, reply) => {
      const uid = req.user.uid; const ref = col(uid).doc(req.params.id);
      const cur = strip(await ref.get());
      if (!cur) return reply.code(404).send({ error: 'Not found' });
      const patch = sealIn(def, uid, ref.id, clean(req.body), cur);
      const doc = { ...cur, ...patch, updatedAt: now() }; delete doc.id;
      await ref.set(doc);
      await hooks[def.col]?.(uid, ref.id, doc, 'set');
      return sealOut(def, { id: ref.id, ...doc });
    });

    app.delete(`/v1/${path}/:id`, async (req, reply) => {
      const uid = req.user.uid;
      const prev = strip(await col(uid).doc(req.params.id).get());
      await col(uid).doc(req.params.id).delete();
      await hooks[def.col]?.(uid, req.params.id, null, 'delete', prev);
      return reply.code(204).send();
    });
  }
}
