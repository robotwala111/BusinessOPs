import { Suspense } from "react";
import { ClientOnboardingWizard } from "@/components/clients/ClientOnboardingWizard";

export default function ClientOnboardingPage() {
  return (
    <Suspense fallback={<div className="module-page"><p className="muted">Loading Onboarding Wizard...</p></div>}>
      <ClientOnboardingWizard />
    </Suspense>
  );
}
