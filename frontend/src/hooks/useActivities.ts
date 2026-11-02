"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { activityService } from "@/services/activityService";
import type {
  Activity,
  ActivityFormData,
  ActivityPriority,
  ActivityStatus
} from "@/types/activity";

export function useActivities(clientId?: string) {
  const { user, profile } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<ActivityPriority | "all">("all");

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setActivities(clientId ? await activityService.getActivitiesByClient(clientId) : await activityService.getActivities());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load activities.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activities.filter((activity) =>
      (statusFilter === "all" || activity.status === statusFilter) &&
      (priorityFilter === "all" || activity.priority === priorityFilter) &&
      (!q ||
        [activity.subject, activity.description, activity.client?.company_name, activity.contact?.full_name, activity.project?.project_name]
          .some((value) => value?.toLowerCase().includes(q)))
    );
  }, [activities, priorityFilter, searchTerm, statusFilter]);

  async function saveActivity(data: ActivityFormData, id?: string) {
    const completed_at =
      data.status === "completed" && !data.completed_at
        ? new Date().toISOString()
        : data.status === "completed"
          ? data.completed_at
          : "";
    const payload = { ...data, completed_at };
    const record = id
      ? await activityService.updateActivity(id, payload)
      : await activityService.createActivity({ ...payload, created_by: user?.id ?? null });
    await loadActivities();
    return record;
  }

  async function deleteActivity(id: string) {
    if (profile?.role !== "admin") throw new Error("Only admin users can delete activities.");
    await activityService.deleteActivity(id);
    setActivities((current) => current.filter((activity) => activity.id !== id));
  }

  return {
    activities,
    filteredActivities,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    priorityFilter,
    setSearchTerm,
    setStatusFilter,
    setPriorityFilter,
    saveActivity,
    deleteActivity,
    loadActivities
  };
}
