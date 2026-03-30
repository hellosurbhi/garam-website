import { useState } from "react";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminDashboard from "@/components/admin/AdminDashboard";

const SESSION_KEY = "gm-admin-auth";
const TOKEN_KEY = "gm-admin-token";

export default function AdminPage() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "true",
  );

  function handleLogin(sessionToken: string) {
    sessionStorage.setItem(SESSION_KEY, "true");
    sessionStorage.setItem(TOKEN_KEY, sessionToken);
    setAuthed(true);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setAuthed(false);
  }

  const sessionToken = sessionStorage.getItem(TOKEN_KEY) ?? "";

  return authed ? (
    <AdminDashboard onLogout={handleLogout} sessionToken={sessionToken} />
  ) : (
    <AdminLogin onSuccess={handleLogin} />
  );
}
