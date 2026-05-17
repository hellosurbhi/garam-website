import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;

function getApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }
  const clientEmail = import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const projectId =
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ??
    import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (!clientEmail || !privateKeyRaw || !projectId) {
    throw new Error(
      "Firebase Admin env vars missing: FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, PUBLIC_FIREBASE_PROJECT_ID",
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return app;
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getApp());
}
