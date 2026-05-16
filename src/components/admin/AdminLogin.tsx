import { useState, useRef, type SyntheticEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import styles from "./AdminLogin.module.css";

interface AdminLoginProps {
  onSuccess: () => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(
        await getFirebaseAuth(),
        email,
        password,
      );
      onSuccess();
    } catch {
      setError("Invalid email or password.");
      setShaking(true);
      setPassword("");
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.emoji}>🌶️</p>
        <h1 className={styles.title}>Team Access</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div
            className={shaking ? styles.shake : undefined}
            onAnimationEnd={() => setShaking(false)}
          >
            <label htmlFor="admin-email" className={styles.label}>
              Email
            </label>
            <input
              ref={emailRef}
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
              required
              aria-invalid={!!error}
              className={error ? styles.inputError : styles.input}
            />
            <label htmlFor="admin-password" className={styles.label}>
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoComplete="current-password"
              required
              aria-invalid={!!error}
              className={error ? styles.inputError : styles.input}
            />
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={
              error ? styles.submitButtonWithError : styles.submitButton
            }
          >
            {loading ? "..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
