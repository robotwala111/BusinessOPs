import { Suspense } from "react";
import { ActivitiesPage } from "@/components/business/ActivitiesPage";

export default function ActivitiesRoute() {
  return (
    <Suspense fallback={<div className="module-loading-placeholder">Loading activities...</div>}>
      <ActivitiesPage />
    </Suspense>
  );
}
