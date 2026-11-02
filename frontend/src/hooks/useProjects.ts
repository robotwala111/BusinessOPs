"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { projectService } from "@/services/projectService";
import type { Project, ProjectFormData, ProjectPriority, ProjectStatus } from "@/types/project";

type UseProjectsOptions = {
  autoLoad?: boolean;
};

export function useProjects(clientId?: string, options: UseProjectsOptions = {}) {
  const { autoLoad = true } = options;
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | "all">("all");

  const loadProjects = useCallback(async () => {
    if (clientId === "") {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    try {
      setProjects(clientId ? await projectService.getProjectsByClient(clientId) : await projectService.getProjects());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load projects.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (autoLoad) void loadProjects();
  }, [autoLoad, loadProjects]);

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const q = searchTerm.toLowerCase();
    return (statusFilter === "all" || project.status === statusFilter)
      && (priorityFilter === "all" || project.priority === priorityFilter)
      && (!q || [project.project_code, project.project_name, project.client?.company_name, project.project_type].some((value) => value?.toLowerCase().includes(q)));
  }), [priorityFilter, projects, searchTerm, statusFilter]);

  async function saveProject(data: ProjectFormData, id?: string) {
    const record = id
      ? await projectService.updateProject(id, data)
      : await projectService.createProject({ ...data, created_by: user?.id ?? null });
    await loadProjects();
    return record;
  }

  async function deleteProject(id: string) {
    if (profile?.role !== "admin") throw new Error("Only admin users can delete projects.");
    await projectService.deleteProject(id);
    setProjects((current) => current.filter((project) => project.id !== id));
  }

  return { projects, filteredProjects, isLoading, errorMessage, searchTerm, statusFilter, priorityFilter, setSearchTerm, setStatusFilter, setPriorityFilter, saveProject, deleteProject, loadProjects };
}
