import { Suspense } from "react";
import { AuthRedirect } from "@/components/auth/AuthRedirect";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="page-shell">Loading...</main>}>
      <AuthRedirect>
        <main className="page-shell auth-shell">
          <section className="content-panel auth-panel">
            <p className="eyebrow">Initial setup</p>
            <h1>Create admin account</h1>
            <p className="muted">
              Use this page for the first administrator account.
            </p>
            <RegisterForm />
          </section>
        </main>
      </AuthRedirect>
    </Suspense>
  );
}
