"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function LoginForm() {
  const { login, isConfigured, isDemoMode } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.replace(searchParams.get("next") ?? "/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to login. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFillDemo() {
    setEmail("demo-admin@example.local");
    setPassword("Admin@123");
    setErrorMessage("");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isDemoMode ? (
        <div className="form-note demo-helper-box">
          <div className="demo-helper-text">
            <strong>Demo Sandbox Mode</strong>
            <small>Default credentials: demo-admin@example.local / Admin@123</small>
          </div>
          <button
            type="button"
            className="btn-demo-autofill"
            onClick={handleFillDemo}
          >
            ⚡ Autofill Demo
          </button>
        </div>
      ) : null}

      {!isConfigured && !isDemoMode ? (
        <div className="form-error">
          Supabase is not configured. Authentication is unavailable until it is configured.
        </div>
      ) : null}
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

      <label>
        Email Address
        <input
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button type="submit" className="btn-primary auth-submit-btn" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in to Workspace"}
      </button>
      <div className="auth-links">
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/register">Create new account</Link>
      </div>
    </form>
  );
}
