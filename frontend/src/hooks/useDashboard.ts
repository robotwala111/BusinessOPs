"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardMetrics } from "@/types/dashboard";

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await dashboardService.getDashboardMetrics();
      setMetrics(data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    // Auto-refresh when user switches back to the tab or storage updates
    function handleFocus() {
      void refresh();
    }
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleFocus);
    };
  }, [refresh]);

  return { metrics, isLoading, errorMessage, refresh };
}
