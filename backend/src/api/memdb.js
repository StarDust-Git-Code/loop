// Tiny in-memory stand-in for Firestore + Auth, for local development and tests only (MEMORY_DB=1, never in production).
const store = new Map(); // path -> data
const clone = (o) => JSON.parse(JSON.stringify(o));
const getField = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

class DocSnap { constructor(ref, data) { this.ref = ref; this.id = ref.id; this._d = data; this.exists = data !== undefined; } data() { return this._d === undefined ? undefined : clone(this._d); } }
class DocRef {
  constructor(path) { this.path = path; this.id = path.split('/').pop(); this.firestore = db; }
  get parent() { return new ColRef(this.path.split('/').slice(0, -1).join('/')); }
  collection(n) { return new ColRef(`${this.path}/${n}`); }
  async get() { return new DocSnap(this, store.get(this.path)); }
  async set(d, o) { store.set(this.path, o?.merge ? { ...(store.get(this.path) ?? {}), ...clone(d) } : clone(d)); }
  async update(d) { if (!store.has(this.path)) throw new Error('not found'); store.set(this.path, { ...store.get(this.path), ...clone(d) }); }
  async delete() { store.delete(this.path); }
}
class ColRef {
  constructor(path, filters = [], lim = Infinity) { this.path = path; this.filters = filters; this.lim = lim; this.firestore = db; }
  doc(id = Math.random().toString(36).slice(2, 12)) { return new DocRef(`${this.path}/${id}`); }
  where(f, op, v) { return new ColRef(this.path, [...this.filters, [f, op, v]], this.lim); }
  limit(n) { return new ColRef(this.path, this.filters, n); }
  async get() {
    const depth = this.path.split('/').length + 1;
    const docs = [];
    for (const [p, d] of store) {
      if (!p.startsWith(`${this.path}/`) || p.split('/').length !== depth) continue;
      if (this.filters.every(([f, op, v]) => { const x = getField(d, f); return op === '==' ? x === v : op === '<=' ? x <= v : false; })) docs.push(new DocSnap(new DocRef(p), d));
      if (docs.length >= this.lim) break;
    }
    return { docs, empty: !docs.length, size: docs.length };
  }
}
export const db = {
  settings() {}, collection: (n) => new ColRef(n),
  batch() { const ops = []; return { set: (r, d) => ops.push(() => r.set(d)), commit: async () => { for (const o of ops) await o(); } }; },
  async runTransaction(fn) { return fn({ get: (r) => r.get(), update: (r, d) => r.update(d), delete: (r) => r.delete(), set: (r, d) => r.set(d) }); },
};
export const auth = {
  async verifyIdToken(t) { const m = /^dev:([\w-]+):?(.*)$/.exec(t); if (!m) throw new Error('bad dev token'); return { uid: m[1], email: m[2] || `${m[1]}@dev.local`, name: m[1], email_verified: true }; },
};
export const dump = () => Object.fromEntries(store);
