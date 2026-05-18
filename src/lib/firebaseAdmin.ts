import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import {
  getFirebaseProjectId,
  readPrivateKeyEnv,
  readTrimmedEnv,
} from "@/lib/env";

let app: App | undefined;

function getApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }
  const clientEmail = readTrimmedEnv(
    import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  );
  const privateKey = readPrivateKeyEnv(
    import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
  const projectId = getFirebaseProjectId();

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error(
      "Firebase Admin env vars missing: FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, PUBLIC_FIREBASE_PROJECT_ID",
    );
  }

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return app;
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getApp());
}
