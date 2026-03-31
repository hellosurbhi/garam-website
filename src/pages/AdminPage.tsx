import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function AdminPage() {
  usePageMeta("Admin | Garam Masala Dating", "", undefined, true);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(!!user);
      setChecking(false);
    });
    return unsub;
  }, []);

  function handleLogout() {
    signOut(auth);
  }

  if (checking) return null;

  return authed ? (
    <AdminDashboard onLogout={handleLogout} />
  ) : (
    <AdminLogin onSuccess={() => setAuthed(true)} />
  );
}
