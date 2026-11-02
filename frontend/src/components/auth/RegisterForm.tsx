"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function RegisterForm() {
  const { register, isConfigured } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await register(email, password, fullName);
      setMessage("Admin account created. You can now continue to the dashboard.");
      router.replace("/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create account. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {!isConfigured ? (
        <div className="form-note">
          Demo mode: this creates a temporary local admin session.
        </div>
      ) : null}
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}

      <label>
        Full name
        <input
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </label>
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
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create admin account"}
      </button>
      <div className="auth-links">
        <Link href="/login">Back to login</Link>
      </div>
    </form>
  );
}
