import { getFirebaseAuth } from "@/lib/firebase";

/** The signed-in admin's Firebase ID token for Bearer calls, or null when signed out. */
export async function adminIdToken(): Promise<string | null> {
  return (await (await getFirebaseAuth()).currentUser?.getIdToken()) ?? null;
}
