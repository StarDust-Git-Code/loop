import { signOutUser } from '../auth';
import { firebaseAuth } from '../firebase';
import type { Api } from './contract';
import { createHttpApi } from './http';
import { createLocalApi } from './local';

const url = process.env.NEXT_PUBLIC_API_URL;
const base: Api = url ? createHttpApi(url) : createLocalApi();
/** Identity always comes from Firebase Auth when configured, whichever adapter serves the data. */
export const api: Api = {
  ...base,
  auth: {
    session: async () => {
      const a = firebaseAuth();
      if (!a) return { signedIn: false };
      await a.authStateReady();
      const u = a.currentUser;
      return u ? { signedIn: true, name: u.displayName ?? u.email ?? undefined, email: u.email ?? undefined } : { signedIn: false };
    },
    signOut: signOutUser,
  },
};
export type { Api } from './contract';
