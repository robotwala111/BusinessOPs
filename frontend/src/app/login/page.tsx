import { Suspense } from "react";
import { AuthRedirect } from "@/components/auth/AuthRedirect";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page-shell">Loading...</main>}>
      <AuthRedirect>
        <main className="page-shell auth-shell">
          <section className="content-panel auth-panel">
            <p className="eyebrow">Business Operations Platform</p>
            <h1>Sign in</h1>
            <p className="muted">
              Access the internal business operations workspace.
            </p>
            <LoginForm />
          </section>
        </main>
      </AuthRedirect>
    </Suspense>
  );
}
