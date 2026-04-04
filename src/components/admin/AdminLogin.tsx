import { useState, useRef } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
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
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="Email"
              autoFocus
              autoComplete="email"
              className={error ? styles.inputError : styles.input}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Password"
              autoComplete="current-password"
              className={error ? styles.inputError : styles.input}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={error ? styles.submitButtonWithError : styles.submitButton}
          >
            {loading ? "..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
