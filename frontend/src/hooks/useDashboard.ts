"use client";

import { useEffect, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardMetrics } from "@/types/dashboard";

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        setMetrics(await dashboardService.getDashboardMetrics());
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load dashboard.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return { metrics, isLoading, errorMessage };
}
