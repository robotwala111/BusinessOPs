"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function LoginForm() {
  const { login, isConfigured } = useAuth();
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

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {!isConfigured ? (
        <div className="form-note">
          Demo mode: use demo-admin@example.local and password Admin@123.
        </div>
      ) : null}
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

      <label>
        Email
        <input
          type="email"
          autoComplete="email"
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      <div className="auth-links">
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/register">Initial admin setup</Link>
      </div>
    </form>
  );
}
