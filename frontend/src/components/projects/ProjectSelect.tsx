"use client";

import { useProjects } from "@/hooks/useProjects";

type ProjectSelectProps = {
  clientId?: string;
  value: string;
  onChange: (projectId: string) => void;
  required?: boolean;
};

export function ProjectSelect({ clientId, value, onChange, required = false }: ProjectSelectProps) {
  const { projects, isLoading } = useProjects(clientId ?? "", { autoLoad: Boolean(clientId) });
  const isDisabled = !clientId || isLoading;

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={isDisabled} required={required}>
      <option value="">
        {!clientId ? "Select client first" : isLoading ? "Loading projects..." : "No linked project"}
      </option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.project_code} - {project.project_name}
        </option>
      ))}
    </select>
  );
}
