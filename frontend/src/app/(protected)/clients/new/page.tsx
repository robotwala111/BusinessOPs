import { Suspense } from "react";
import { NewClientPage } from "@/components/clients/NewClientPage";

export default function NewClientRoute() {
  return (
    <Suspense fallback={<div className="module-page"><p className="muted">Loading Client Form...</p></div>}>
      <NewClientPage />
    </Suspense>
  );
}
