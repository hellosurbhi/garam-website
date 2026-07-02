import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import type { Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId:
    import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID?.trim(),
};

let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;
let _configError: Error | null = null;

function getValidatedConfig(): FirebaseOptions {
  if (_configError) throw _configError;

  const entries = Object.entries(firebaseConfig);
  const missing = entries
    .filter(([, value]) => !value)
    .map(
      ([key]) =>
        `PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (match) => `_${match}`).toUpperCase()}`,
    );

  if (missing.length > 0) {
    _configError = new Error(
      `Missing Firebase client config: ${missing.join(", ")}`,
    );
    throw _configError;
  }

  return firebaseConfig as FirebaseOptions;
}

function getApp() {
  return getApps().length ? getApps()[0] : initializeApp(getValidatedConfig());
}

/** Return the singleton Firestore instance, initialising the Firebase app on first call. */
export function getFirebaseDb(): Firestore {
  if (!_db) _db = getFirestore(getApp());
  return _db;
}

/** Return the singleton Firebase Storage instance, lazily loading the SDK on first call. */
export async function getFirebaseStorage(): Promise<FirebaseStorage> {
  if (!_storage) {
    const { getStorage } = await import("firebase/storage");
    if (!_storage) _storage = getStorage(getApp());
  }
  return _storage as FirebaseStorage;
}

/** Return the singleton Firebase Auth instance, lazily loading the SDK on first call. */
export async function getFirebaseAuth(): Promise<Auth> {
  if (!_auth) {
    const { getAuth } = await import("firebase/auth");
    if (!_auth) _auth = getAuth(getApp());
  }
  return _auth as Auth;
}
