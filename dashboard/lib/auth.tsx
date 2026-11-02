'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, updateProfile, type User,
} from 'firebase/auth';
import { authEnabled, firebaseAuth } from './firebase';

type Ctx = { ready: boolean; user: User | null };
const AuthCtx = createContext<Ctx>({ ready: true, user: null });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Ctx>({ ready: !authEnabled, user: null });
  useEffect(() => {
    const a = firebaseAuth();
    if (!a) return;
    return onAuthStateChanged(a, (user) => setState({ ready: true, user }));
  }, []);
  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export async function idToken(): Promise<string | null> {
  const a = firebaseAuth();
  if (!a) return null;
  await a.authStateReady();
  return a.currentUser ? a.currentUser.getIdToken() : null;
}

export const signInGoogle = () => signInWithPopup(firebaseAuth()!, new GoogleAuthProvider());
export const signInEmail = (email: string, pw: string) => signInWithEmailAndPassword(firebaseAuth()!, email, pw);
export async function signUpEmail(name: string, email: string, pw: string) {
  const c = await createUserWithEmailAndPassword(firebaseAuth()!, email, pw);
  if (name) await updateProfile(c.user, { displayName: name });
  return c;
}
export const resetPassword = (email: string) => sendPasswordResetEmail(firebaseAuth()!, email);
export const signOutUser = () => (firebaseAuth() ? fbSignOut(firebaseAuth()!) : Promise.resolve());

export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Wrong email or password.', 'auth/email-already-in-use': 'That email already has an account. Try signing in.',
    'auth/weak-password': 'Use at least 6 characters.', 'auth/invalid-email': 'That email looks off.',
    'auth/popup-closed-by-user': 'Sign-in window closed.', 'auth/too-many-requests': 'Too many tries. Wait a bit and retry.',
    'auth/unauthorized-domain': 'This domain is not authorised in Firebase yet.', 'auth/network-request-failed': 'Network problem. Check your connection.',
  };
  return map[code] ?? 'Something went wrong. Try again.';
}
