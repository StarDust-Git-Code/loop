// Public Firebase web config (not secret; access is enforced by Auth and backend token checks).
// Web OAuth client ID of the Firebase project (Authentication > Sign-in method > Google > Web SDK configuration). Public value.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '552234711906-6qu2moqgh8nb72egsqu2leur4l86bhmd.apps.googleusercontent.com';

export const firebaseConfig = {
  apiKey: 'AIzaSyCR1c-Sqjg1B8Oto3KDSKz3tEXphe84ypg',
  authDomain: 'loop-mates.firebaseapp.com',
  projectId: 'loop-mates',
  appId: '1:552234711906:web:5f5b6c7995190cebb2ca3b',
  messagingSenderId: '552234711906',
};
