"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function ForgotPasswordForm() {
  const { sendPasswordReset, isConfigured, isDemoMode } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await sendPasswordReset(email);
      setMessage("If the email exists, Supabase will send reset instructions.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start password reset. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isDemoMode ? (
        <div className="form-note">
          Demo mode: password reset will be enabled when Supabase is connected.
        </div>
      ) : null}
      {!isConfigured && !isDemoMode ? (
        <div className="form-error">
          Supabase is not configured. Password reset is unavailable until it is configured.
        </div>
      ) : null}
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}

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
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset instructions"}
      </button>
      <div className="auth-links">
        <Link href="/login">Back to login</Link>
      </div>
    </form>
  );
}
