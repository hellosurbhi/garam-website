import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminDashboard from "@/components/admin/AdminDashboard";

function isAdminSession(user: User | null): user is User {
  return !!user && !user.isAnonymous;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let unsub: ReturnType<typeof onAuthStateChanged> | undefined;
    getFirebaseAuth()
      .then((auth) => {
        unsub = onAuthStateChanged(auth, (user) => {
          setAuthed(!!user);
          setChecking(false);
        });
      })
      .catch(() => setChecking(false));
    return () => {
      unsub?.();
    };
  }, []);

  function handleLogout() {
    getFirebaseAuth().then((auth) => signOut(auth));
  }

  if (checking) return null;

  return authed ? (
    <AdminDashboard onLogout={handleLogout} />
  ) : (
    <AdminLogin onSuccess={() => setAuthed(true)} />
  );
}
