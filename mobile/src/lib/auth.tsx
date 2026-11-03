import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// getReactNativePersistence is exported by firebase/auth's React Native build.
// @ts-ignore: not present in the default (web) type declarations
import { getReactNativePersistence, initializeAuth, getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as fbSignOut, GoogleAuthProvider, signInWithCredential, type Auth, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { firebaseConfig, GOOGLE_WEB_CLIENT_ID } from './firebaseConfig';

let auth: Auth | null = null;
export function firebaseAuth(): Auth {
  if (auth) return auth;
  if (getApps().length) { auth = getAuth(getApp()); return auth; }
  const app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  return auth;
}

type Ctx = { ready: boolean; user: User | null };
const AuthCtx = createContext<Ctx>({ ready: false, user: null });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Ctx>({ ready: false, user: null });
  useEffect(() => onAuthStateChanged(firebaseAuth(), (user) => setS({ ready: true, user })), []);
  return <AuthCtx.Provider value={s}>{children}</AuthCtx.Provider>;
}

export async function idToken(): Promise<string | null> {
  const u = firebaseAuth().currentUser;
  return u ? u.getIdToken() : null;
}

const nice = (e: unknown) => {
  const c = (e as { code?: string })?.code ?? '';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'Email or password is not right.';
  if (/email-already-in-use/.test(c)) return 'That email already has an account. Sign in instead.';
  if (/weak-password/.test(c)) return 'Use a password with at least 6 characters.';
  if (/invalid-email/.test(c)) return 'That email address does not look right.';
  if (/network/.test(c)) return 'No connection. Check your internet and try again.';
  if (/operation-not-allowed/.test(c)) return 'Email sign-in is switched off in Firebase. Turn on Email/Password under Authentication.';
  return 'Could not sign in. Try again.';
};
export const signIn = (email: string, pw: string) => signInWithEmailAndPassword(firebaseAuth(), email.trim(), pw).catch((e) => { throw new Error(nice(e)); });
export const signUp = (email: string, pw: string) => createUserWithEmailAndPassword(firebaseAuth(), email.trim(), pw).catch((e) => { throw new Error(nice(e)); });
export const resetPassword = (email: string) => sendPasswordResetEmail(firebaseAuth(), email.trim()).catch((e) => { throw new Error(nice(e)); });
/** Returns false when the person closes the Google sheet without choosing an account. */
export async function signInGoogle(): Promise<boolean> {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error('Google sign-in is not set up in this build yet. Use email for now.');
  try {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const r = await GoogleSignin.signIn();
    if (!isSuccessResponse(r)) return false;
    const idt = r.data.idToken; if (!idt) throw new Error('Google did not return a token. Try again.');
    await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(idt));
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) return false;
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services are missing or out of date on this phone.');
    if (code === '10' || /DEVELOPER_ERROR/i.test(String((e as Error).message))) throw new Error('Google sign-in is not fully configured: add this app\'s SHA-1 in Firebase.');
    throw new Error(e instanceof Error && e.message ? e.message : 'Could not sign in with Google.');
  }
}
export const signOut = async () => { try { await GoogleSignin.signOut(); } catch { /* not signed in with Google */ } await fbSignOut(firebaseAuth()); };
