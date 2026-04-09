import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAuth, type Auth } from "firebase/auth";

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

export function getFirebaseDb(): Firestore {
  if (!_db) _db = getFirestore(getApp());
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getApp());
  return _storage;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp());
  return _auth;
}
