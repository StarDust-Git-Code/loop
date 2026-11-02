'use client';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/** Public web config; safe in the browser. Access is enforced by Auth + backend token checks + Firestore rules. */
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const authEnabled = !!cfg.apiKey;
let app: FirebaseApp | undefined;
export function firebaseAuth(): Auth | null {
  if (!authEnabled) return null;
  app ??= getApps().length ? getApp() : initializeApp(cfg);
  return getAuth(app);
}
