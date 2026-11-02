import { Suspense } from "react";
import { AuthRedirect } from "@/components/auth/AuthRedirect";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="page-shell">Loading...</main>}>
      <AuthRedirect>
        <main className="page-shell auth-shell">
          <section className="content-panel auth-panel">
            <p className="eyebrow">Account access</p>
            <h1>Create account</h1>
            <p className="muted">
              New accounts are assigned the staff role. Administrators manage privileged access.
            </p>
            <RegisterForm />
          </section>
        </main>
      </AuthRedirect>
    </Suspense>
  );
}
