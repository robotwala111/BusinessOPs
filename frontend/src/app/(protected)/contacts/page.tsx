import { Suspense } from "react";
import { ContactsPage } from "@/components/clients/ContactsPage";

export default function ContactsRoute() {
  return (
    <Suspense fallback={<div className="module-loading-placeholder">Loading contacts...</div>}>
      <ContactsPage />
    </Suspense>
  );
}
