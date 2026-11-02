import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { env, need } from '../lib/env.js';
import * as mem from './memdb.js';

// MEMORY_DB=1 swaps in a fake Firestore/Auth for local tests. Hard-disabled in production.
const useMem = env('MEMORY_DB') === '1' && env('NODE_ENV') !== 'production';

function boot() {
  if (useMem || getApps().length) return;
  let sa;
  try { sa = JSON.parse(Buffer.from(need('FIREBASE_SERVICE_ACCOUNT_B64'), 'base64').toString('utf8')); }
  catch (e) { throw new Error(`FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64 JSON: ${e.message}`); }
  initializeApp({ credential: cert(sa) });
}
boot();
export const db = useMem ? mem.db : getFirestore();
db.settings({ ignoreUndefinedProperties: true });
export const auth = useMem ? mem.auth : getAuth();
export { FieldValue };

/** users/{uid}/{name} */
export const userCol = (uid, name) => db.collection('users').doc(uid).collection(name);
export const userDoc = (uid, name, id) => userCol(uid, name).doc(id);
export const strip = (d) => (d.exists ? { id: d.id, ...d.data() } : undefined);
