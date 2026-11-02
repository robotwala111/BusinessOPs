import { isSupabaseConfigured } from "@/lib/supabase/client";
import { generateNumber, normalizeText, readDemoRecords, requireSupabase, toNumber, writeDemoRecords } from "@/services/moduleHelpers";
import { settingsService } from "@/services/settingsService";
import type { Project, ProjectCreateInput, ProjectFormData, ProjectUpdateInput } from "@/types/project";

const KEY = "business-ops-demo-projects";
let projectsCache: Project[] | null = null;
const projectsByClientCache = new Map<string, Project[]>();

function clearProjectCache() {
  projectsCache = null;
  projectsByClientCache.clear();
}

function normalize(data: ProjectFormData) {
  return {
    client_id: data.client_id,
    project_code: data.project_code.trim(),
    project_name: data.project_name.trim(),
    project_type: normalizeText(data.project_type),
    description: normalizeText(data.description),
    status: data.status,
    start_date: data.start_date || null,
    target_end_date: data.target_end_date || null,
    actual_end_date: data.actual_end_date || null,
    project_value: toNumber(data.project_value),
    assigned_manager: data.assigned_manager || null,
    priority: data.priority,
    tags: data.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    notes: normalizeText(data.notes)
  };
}

export const projectService = {
  invalidateCache() {
    clearProjectCache();
  },
  generateProjectCode() {
    return settingsService
      .getNumberingPrefix("project", "PRJ")
      .then((prefix) => generateNumber("projects", "project_code", KEY, prefix));
  },
  async getProjects() {
    if (projectsCache) return projectsCache;
    if (!isSupabaseConfigured) {
      projectsCache = readDemoRecords<Project>(KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return projectsCache;
    }
    const { data, error } = await requireSupabase().from("projects").select("*, clients(*)").order("created_at", { ascending: false });
    if (error) throw error;
    projectsCache = (data ?? []).map((project) => ({ ...project, client: project.clients })) as Project[];
    return projectsCache;
  },
  async getProjectById(id: string) {
    if (!isSupabaseConfigured) return readDemoRecords<Project>(KEY).find((item) => item.id === id) ?? null;
    const { data, error } = await requireSupabase().from("projects").select("*, clients(*)").eq("id", id).single();
    if (error) throw error;
    return { ...data, client: data.clients } as Project;
  },
  async getProjectsByClient(clientId: string) {
    if (!clientId) return [];
    const cached = projectsByClientCache.get(clientId);
    if (cached) return cached;
    if (!isSupabaseConfigured) {
      const projects = await this.getProjects();
      const filtered = projects.filter((project) => project.client_id === clientId);
      projectsByClientCache.set(clientId, filtered);
      return filtered;
    }
    const { data, error } = await requireSupabase()
      .from("projects")
      .select("*, clients(*)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const projects = (data ?? []).map((project) => ({ ...project, client: project.clients })) as Project[];
    projectsByClientCache.set(clientId, projects);
    return projects;
  },
  async createProject(data: ProjectCreateInput) {
    const payload = { ...normalize(data), created_by: data.created_by };
    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const record = { id: crypto.randomUUID(), ...payload, created_at: now, updated_at: now } as Project;
      writeDemoRecords(KEY, [record, ...readDemoRecords<Project>(KEY)]);
      clearProjectCache();
      return record;
    }
    const { data: record, error } = await requireSupabase().from("projects").insert(payload).select().single();
    if (error) throw error;
    clearProjectCache();
    return record as Project;
  },
  async updateProject(id: string, data: ProjectUpdateInput) {
    if (!isSupabaseConfigured) {
      const records = readDemoRecords<Project>(KEY);
      const updated = records.map((record) => record.id === id ? { ...record, ...data, updated_at: new Date().toISOString() } as Project : record);
      writeDemoRecords(KEY, updated);
      clearProjectCache();
      return updated.find((record) => record.id === id) ?? null;
    }
    const { data: record, error } = await requireSupabase().from("projects").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    clearProjectCache();
    return record as Project;
  },
  async deleteProject(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Project>(KEY).filter((record) => record.id !== id));
      clearProjectCache();
      return;
    }
    const { error } = await requireSupabase().from("projects").delete().eq("id", id);
    if (error) throw error;
    clearProjectCache();
  }
};
