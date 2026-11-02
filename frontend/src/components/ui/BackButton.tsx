"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
};

export function BackButton({ fallbackHref = "/dashboard", label = "Back" }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button type="button" variant="secondary" className="back-button" onClick={handleBack}>
      <span aria-hidden="true">‹</span>
      {label}
    </Button>
  );
}
