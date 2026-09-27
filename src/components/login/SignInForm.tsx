"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";

/* Development-only test accounts (see supabase/profiles.sql for setup).
   Guarded by NODE_ENV so these never ship in a production build. */
const DEV_ACCOUNTS = [
  { label: "President", email: "president.test@atecshub.local", password: "Pres!Dev2026" },
  { label: "Member", email: "member.test@atecshub.local", password: "Mem!Dev2026" },
] as const;

export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = getBrowserSupabase();

  if (!supabase) {
    return (
      <div className="auth-form">
        <p className="auth-error" role="status">
          Supabase isn’t configured yet. Add <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the dev
          server.
        </p>
        <div className="auth-row">
          <span />
          <Link href="/" className="auth-back">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const nextTarget = () => new URLSearchParams(window.location.search).get("next") || "/hub";

  async function signIn(withEmail: string, withPassword: string) {
    setLoading(true);
    setError("");
    setNotice("");
    const { error: err } = await supabase!.auth.signInWithPassword({
      email: withEmail,
      password: withPassword,
    });
    if (err) {
      setError(
        err.message === "Invalid login credentials" ? "Invalid email or password." : err.message
      );
      setLoading(false);
      return;
    }
    // Client-side transition into the Hub (no full reload)
    router.push(nextTarget());
    router.refresh();
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void signIn(email, password);
  };

  const onRecovery = async () => {
    setError("");
    setNotice("");
    if (!email) {
      setError("Enter your email first, then request a recovery link.");
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (err) setError(err.message);
    else setNotice("Recovery email sent — check your inbox.");
  };

  const isDev = process.env.NODE_ENV === "development";

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="auth-notice" role="status">
          {notice}
        </p>
      )}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@atecshub.local"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <div className="auth-row">
        <button type="button" className="auth-link" onClick={onRecovery} disabled={loading}>
          Forgot password?
        </button>
        <Link href="/" className="auth-back">
          ← Back to home
        </Link>
      </div>

      {isDev && (
        <div className="dev-switch">
          <span>Dev test accounts (development only)</span>
          {DEV_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail(a.email);
                setPassword(a.password);
                void signIn(a.email, a.password);
              }}
            >
              Sign in as {a.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
