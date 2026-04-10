// Client-side API module — all data flows through Supabase-backed API routes
import type { Project, ProjectTask, ProjectNote, Goal, GoalJournal, ChatMessage, ConversationPreview } from "./types";

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  return res.json();
}

function post(url: string, body: Record<string, unknown>) {
  return fetchJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patch(url: string, body: Record<string, unknown>) {
  return fetchJSON(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  projects: {
    async list(): Promise<Project[]> {
      const res = await fetchJSON<{ data: Project[] }>("/api/projects");
      return res.data || [];
    },
    async get(id: string): Promise<Project | null> {
      const res = await fetchJSON<{ data: Project | null }>(`/api/projects/${id}`);
      return res.data;
    },
    async create(data: Partial<Project>): Promise<Project | null> {
      const res = await post("/api/projects", data as Record<string, unknown>);
      return (res as { data?: Project }).data || null;
    },
    async update(id: string, data: Partial<Project>): Promise<void> {
      await patch(`/api/projects/${id}`, data as Record<string, unknown>);
    },
    async delete(id: string): Promise<void> {
      await fetchJSON(`/api/projects/${id}`, { method: "DELETE" });
    },
  },

  projectTasks: {
    async list(projectId: string): Promise<ProjectTask[]> {
      const res = await fetchJSON<{ data: ProjectTask[] }>(`/api/projects/${projectId}/tasks`);
      return res.data || [];
    },
    async create(projectId: string, title: string): Promise<ProjectTask | null> {
      const res = await post(`/api/projects/${projectId}/tasks`, { title, done: false });
      return (res as { data?: ProjectTask }).data || null;
    },
    async update(projectId: string, taskId: string, updates: Partial<ProjectTask>): Promise<void> {
      await patch(`/api/projects/${projectId}/tasks`, { taskId, ...updates });
    },
  },

  projectNotes: {
    async list(projectId: string): Promise<ProjectNote[]> {
      const res = await fetchJSON<{ data: ProjectNote[] }>(`/api/projects/${projectId}/notes`);
      return res.data || [];
    },
    async create(projectId: string, content: string): Promise<ProjectNote | null> {
      const res = await post(`/api/projects/${projectId}/notes`, { content });
      return (res as { data?: ProjectNote }).data || null;
    },
  },

  goals: {
    async list(): Promise<Goal[]> {
      const res = await fetchJSON<{ data: Goal[] }>("/api/db/goals");
      return res.data || [];
    },
    async get(id: string): Promise<Goal | null> {
      const res = await fetchJSON<{ data: Goal | null }>(`/api/db/goals/${id}`);
      return res.data;
    },
    async update(id: string, data: Partial<Goal>): Promise<void> {
      await patch(`/api/db/goals/${id}`, data as Record<string, unknown>);
    },
  },

  goalJournal: {
    async list(goalId: string): Promise<GoalJournal[]> {
      const res = await fetchJSON<{ data: GoalJournal[] }>(`/api/db/goals/${goalId}/journal`);
      return res.data || [];
    },
    async create(goalId: string, entry: string): Promise<GoalJournal | null> {
      const res = await post(`/api/db/goals/${goalId}/journal`, { entry });
      return (res as { data?: GoalJournal }).data || null;
    },
  },

  conversations: {
    async list(): Promise<ConversationPreview[]> {
      const res = await fetchJSON<{ conversations: ConversationPreview[] }>("/api/chat?list=true");
      return res.conversations || [];
    },
    async get(id: string): Promise<{ messages: ChatMessage[]; conversation: { id: string; title: string } | null }> {
      return fetchJSON(`/api/chat?id=${id}`);
    },
    async getLatestGlobal(): Promise<{ messages: ChatMessage[]; conversation: { id: string; title: string } | null }> {
      return fetchJSON("/api/chat?type=global");
    },
    async send(messages: ChatMessage[], conversationId?: string): Promise<{ response: string; conversationId: string }> {
      return fetchJSON("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, conversationId }),
      });
    },
    async updateTitle(id: string, title: string): Promise<void> {
      await patch("/api/conversations", { id, title } as Record<string, unknown>);
    },
    async delete(id: string): Promise<void> {
      await fetchJSON("/api/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
  },
};
