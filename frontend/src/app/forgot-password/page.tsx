import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="page-shell auth-shell">
      <section className="content-panel auth-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset password</h1>
        <p className="muted">
          Password reset email delivery will use Supabase Auth configuration.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
