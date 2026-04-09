import {
  Project,
  ProjectTask,
  ProjectNote,
  Goal,
  GoalJournal,
  Memory,
  LindyBriefing,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────
function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function get<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Seed Data ────────────────────────────────────────────
const SEED_PROJECTS: Project[] = [
  {
    id: "proj-1",
    title: "AI Real Estate Lead Nurture",
    category: "AI Business",
    status: "Planning",
    grade: "A",
    description:
      "Automated lead follow-up system for new construction builders. Integrates with CRM, sends personalized follow-ups based on buyer behavior and timeline. Target Utah builders first, then expand nationally.",
    revenue_goal: "$2-5k/mo per builder client",
    progress: 15,
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "proj-2",
    title: "Jarvis-as-a-Service",
    category: "AI Business",
    status: "Building",
    grade: "A",
    description:
      "Productize this dashboard as a SaaS for entrepreneurs. Personal AI chief of staff with customizable agents, goal tracking, and AI chat. $99-299/mo subscription model.",
    revenue_goal: "$5-30k/mo at scale",
    progress: 30,
    created_at: "2026-03-20T00:00:00Z",
  },
  {
    id: "proj-3",
    title: "AI Home Buyer Chatbot",
    category: "Real Estate",
    status: "Idea",
    grade: "B",
    description:
      "24/7 chatbot for builder websites that qualifies leads, answers FAQs about communities, and books showings. White-label for multiple builders.",
    revenue_goal: "$500-1k/mo per builder",
    progress: 0,
    created_at: "2026-03-25T00:00:00Z",
  },
  {
    id: "proj-4",
    title: "Narwhal Ops Automation",
    category: "Real Estate",
    status: "Planning",
    grade: "B",
    description:
      "Automate internal Narwhal Homes operations — lead routing, transaction coordination, reporting, and client communication. Reduce manual work by 50%.",
    revenue_goal: "Internal efficiency — saves 10+ hrs/week",
    progress: 20,
    created_at: "2026-03-28T00:00:00Z",
  },
  {
    id: "proj-5",
    title: "AI Listing Content Generator",
    category: "Real Estate",
    status: "Idea",
    grade: "C",
    description:
      "Generate MLS descriptions, social media posts, and virtual tour scripts from listing photos and details. Tool for agents.",
    revenue_goal: "$29-99/mo per agent",
    progress: 0,
    created_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "proj-6",
    title: "Football Film Platform",
    category: "AI Business",
    status: "Planning",
    grade: "A",
    description:
      "AI-powered football film analysis platform. Automated game film breakdown, player tracking, and coaching insights. Target high school and college programs.",
    revenue_goal: "$3-10k/mo per program",
    progress: 10,
    created_at: "2026-04-05T00:00:00Z",
  },
  {
    id: "proj-7",
    title: "Narwhal Real Estate",
    category: "Real Estate",
    status: "Building",
    grade: "A",
    description:
      "Core real estate operations at Narwhal Homes / Red Rock Real Estate. New construction focus, builder relationships, lead management. Powered by Lindy AI for automation.",
    revenue_goal: "Primary income — commissions",
    progress: 75,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const SEED_PROJECT_TASKS: ProjectTask[] = [
  { id: "pt-1", project_id: "proj-1", title: "Define MVP feature set", done: true, created_at: "2026-03-15T00:00:00Z" },
  { id: "pt-2", project_id: "proj-1", title: "Design email sequence templates", done: false, created_at: "2026-03-16T00:00:00Z" },
  { id: "pt-3", project_id: "proj-1", title: "Build CRM webhook integration", done: false, created_at: "2026-03-17T00:00:00Z" },
  { id: "pt-4", project_id: "proj-1", title: "Get 2 beta builder clients", done: false, created_at: "2026-03-18T00:00:00Z" },
  { id: "pt-5", project_id: "proj-2", title: "Build dashboard shell", done: true, created_at: "2026-03-20T00:00:00Z" },
  { id: "pt-6", project_id: "proj-2", title: "Add Anthropic chat integration", done: true, created_at: "2026-03-21T00:00:00Z" },
  { id: "pt-7", project_id: "proj-2", title: "Build project management system", done: false, created_at: "2026-03-22T00:00:00Z" },
  { id: "pt-8", project_id: "proj-2", title: "Create waitlist landing page", done: false, created_at: "2026-03-23T00:00:00Z" },
  { id: "pt-9", project_id: "proj-4", title: "Map current manual workflows", done: true, created_at: "2026-03-28T00:00:00Z" },
  { id: "pt-10", project_id: "proj-4", title: "Set up Inbox Sentinel agent", done: false, created_at: "2026-03-29T00:00:00Z" },
];

const SEED_GOALS: Goal[] = [
  {
    id: "goal-1",
    title: "Launch 1 AI product with real revenue",
    category: "Product",
    progress: 5,
    target: "Ship MVP and get first paying customer",
    target_date: "2026-07-08",
    milestones: [
      { id: "m1", title: "Choose product to build first", done: true },
      { id: "m2", title: "Define MVP scope and features", done: false },
      { id: "m3", title: "Build working prototype", done: false },
      { id: "m4", title: "Get 2 beta users", done: false },
      { id: "m5", title: "Iterate based on feedback", done: false },
      { id: "m6", title: "Launch publicly", done: false },
      { id: "m7", title: "Get first paying customer", done: false },
    ],
    weekly_breakdown: [
      "Weeks 1-2: Finalize scope, design system architecture",
      "Weeks 3-4: Build core MVP — email sequences + CRM hooks",
      "Weeks 5-6: Beta test with 2 builder contacts",
      "Weeks 7-8: Iterate, fix bugs, add polish",
      "Weeks 9-10: Launch, onboard first paid clients",
      "Weeks 11-12: Optimize, collect testimonials, plan growth",
    ],
    progress_snapshots: [
      { week: 1, progress: 3, date: "2026-04-01" },
      { week: 2, progress: 5, date: "2026-04-08" },
    ],
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "goal-2",
    title: "Master AI build tools",
    category: "Skills",
    progress: 15,
    target: "Proficiency in Claude API, Next.js, and agent architecture",
    target_date: "2026-07-08",
    milestones: [
      { id: "m8", title: "Complete Claude API tutorial projects", done: true },
      { id: "m9", title: "Build a full Next.js app (Jarvis)", done: true },
      { id: "m10", title: "Implement prompt engineering best practices", done: false },
      { id: "m11", title: "Build multi-agent orchestration system", done: false },
      { id: "m12", title: "Deploy production AI application", done: false },
    ],
    weekly_breakdown: [
      "Weeks 1-2: Deep dive Claude API — streaming, tools, system prompts",
      "Weeks 3-4: Master Next.js App Router, API routes, server components",
      "Weeks 5-6: Build agent architecture — multi-agent coordination",
      "Weeks 7-8: Prompt engineering — testing, iteration, evaluation",
      "Weeks 9-10: Production deployment — monitoring, error handling",
      "Weeks 11-12: Advanced patterns — RAG, function calling, chains",
    ],
    progress_snapshots: [
      { week: 1, progress: 8, date: "2026-04-01" },
      { week: 2, progress: 15, date: "2026-04-08" },
    ],
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "goal-3",
    title: "Generate $1k/mo from AI",
    category: "Revenue",
    progress: 0,
    target: "Recurring monthly revenue from AI products/services",
    target_date: "2026-07-08",
    milestones: [
      { id: "m13", title: "Launch first paid product", done: false },
      { id: "m14", title: "Get first paying customer", done: false },
      { id: "m15", title: "Reach $250/mo", done: false },
      { id: "m16", title: "Reach $500/mo", done: false },
      { id: "m17", title: "Reach $1,000/mo", done: false },
    ],
    weekly_breakdown: [
      "Weeks 1-4: Focus on building — revenue comes from shipped products",
      "Weeks 5-6: Beta launch, initial outreach to builder network",
      "Weeks 7-8: Convert beta users to paid ($500/mo each)",
      "Weeks 9-10: Add 2nd client, refine pricing",
      "Weeks 11-12: Hit $1k/mo target, systemize sales process",
    ],
    progress_snapshots: [
      { week: 1, progress: 0, date: "2026-04-01" },
      { week: 2, progress: 0, date: "2026-04-08" },
    ],
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "goal-4",
    title: "Automate Narwhal ops with AI",
    category: "Operations",
    progress: 20,
    target: "Reduce manual work by 50% using AI agents",
    target_date: "2026-07-08",
    milestones: [
      { id: "m18", title: "Map all manual workflows", done: true },
      { id: "m19", title: "Deploy Inbox Sentinel", done: true },
      { id: "m20", title: "Automate lead follow-up sequences", done: false },
      { id: "m21", title: "Automate transaction coordination", done: false },
      { id: "m22", title: "Automate weekly reporting", done: false },
      { id: "m23", title: "Measure time saved — hit 50% target", done: false },
    ],
    weekly_breakdown: [
      "Weeks 1-2: Deploy and tune Inbox Sentinel",
      "Weeks 3-4: Build automated lead follow-up sequences",
      "Weeks 5-6: Automate transaction coordination workflows",
      "Weeks 7-8: Build automated reporting dashboard",
      "Weeks 9-10: Test and iterate on all automations",
      "Weeks 11-12: Measure results, optimize, document SOPs",
    ],
    progress_snapshots: [
      { week: 1, progress: 12, date: "2026-04-01" },
      { week: 2, progress: 20, date: "2026-04-08" },
    ],
    created_at: "2026-03-15T00:00:00Z",
  },
];

// ─── Initialize ───────────────────────────────────────────
function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("jarvis_seeded")) {
    set("jarvis_projects", SEED_PROJECTS);
    set("jarvis_project_tasks", SEED_PROJECT_TASKS);
    set("jarvis_project_notes", []);
    set("jarvis_goals", SEED_GOALS);
    set("jarvis_goal_journal", []);
    set("jarvis_memories", []);
    localStorage.setItem("jarvis_seeded", "true");
  }
  // Migrate: add any new seed projects that don't exist yet
  const existing = get<Project>("jarvis_projects");
  const existingIds = new Set(existing.map((p) => p.id));
  const missing = SEED_PROJECTS.filter((p) => !existingIds.has(p.id));
  if (missing.length > 0) {
    set("jarvis_projects", [...existing, ...missing]);
  }
}

// ─── Projects ─────────────────────────────────────────────
export const db = {
  init: ensureSeeded,

  projects: {
    list(): Project[] {
      ensureSeeded();
      return get<Project>("jarvis_projects");
    },
    get(id: string): Project | undefined {
      return this.list().find((p) => p.id === id);
    },
    create(data: Omit<Project, "id" | "created_at">): Project {
      const items = this.list();
      const item: Project = { ...data, id: uid(), created_at: now() };
      set("jarvis_projects", [...items, item]);
      return item;
    },
    update(id: string, data: Partial<Project>): void {
      const items = this.list().map((p) =>
        p.id === id ? { ...p, ...data } : p
      );
      set("jarvis_projects", items);
    },
    delete(id: string): void {
      set(
        "jarvis_projects",
        this.list().filter((p) => p.id !== id)
      );
    },
  },

  projectTasks: {
    list(projectId: string): ProjectTask[] {
      ensureSeeded();
      return get<ProjectTask>("jarvis_project_tasks").filter(
        (t) => t.project_id === projectId
      );
    },
    create(data: Omit<ProjectTask, "id" | "created_at">): ProjectTask {
      const all = get<ProjectTask>("jarvis_project_tasks");
      const item: ProjectTask = { ...data, id: uid(), created_at: now() };
      set("jarvis_project_tasks", [...all, item]);
      return item;
    },
    update(id: string, data: Partial<ProjectTask>): void {
      const all = get<ProjectTask>("jarvis_project_tasks").map((t) =>
        t.id === id ? { ...t, ...data } : t
      );
      set("jarvis_project_tasks", all);
    },
    delete(id: string): void {
      set(
        "jarvis_project_tasks",
        get<ProjectTask>("jarvis_project_tasks").filter((t) => t.id !== id)
      );
    },
  },

  projectNotes: {
    list(projectId: string): ProjectNote[] {
      ensureSeeded();
      return get<ProjectNote>("jarvis_project_notes").filter(
        (n) => n.project_id === projectId
      );
    },
    create(data: Omit<ProjectNote, "id" | "created_at">): ProjectNote {
      const all = get<ProjectNote>("jarvis_project_notes");
      const item: ProjectNote = { ...data, id: uid(), created_at: now() };
      set("jarvis_project_notes", [...all, item]);
      return item;
    },
  },

  goals: {
    list(): Goal[] {
      ensureSeeded();
      return get<Goal>("jarvis_goals");
    },
    get(id: string): Goal | undefined {
      return this.list().find((g) => g.id === id);
    },
    update(id: string, data: Partial<Goal>): void {
      const items = this.list().map((g) =>
        g.id === id ? { ...g, ...data } : g
      );
      set("jarvis_goals", items);
    },
  },

  goalJournal: {
    list(goalId: string): GoalJournal[] {
      ensureSeeded();
      return get<GoalJournal>("jarvis_goal_journal").filter(
        (j) => j.goal_id === goalId
      );
    },
    create(data: Omit<GoalJournal, "id" | "created_at">): GoalJournal {
      const all = get<GoalJournal>("jarvis_goal_journal");
      const item: GoalJournal = { ...data, id: uid(), created_at: now() };
      set("jarvis_goal_journal", [...all, item]);
      return item;
    },
  },

  memories: {
    list(): Memory[] {
      ensureSeeded();
      return get<Memory>("jarvis_memories");
    },
    create(data: Omit<Memory, "id" | "created_at">): Memory {
      const all = this.list();
      const item: Memory = { ...data, id: uid(), created_at: now() };
      set("jarvis_memories", [...all, item]);
      return item;
    },
    delete(id: string): void {
      set(
        "jarvis_memories",
        this.list().filter((m) => m.id !== id)
      );
    },
  },

  lindyBriefings: {
    list(): LindyBriefing[] {
      return get<LindyBriefing>("jarvis_lindy_briefings");
    },
    latest(): LindyBriefing | undefined {
      const all = this.list();
      return all.length > 0 ? all[all.length - 1] : undefined;
    },
    create(content: string): LindyBriefing {
      const all = this.list();
      const item: LindyBriefing = { id: uid(), content, created_at: now() };
      set("jarvis_lindy_briefings", [...all, item]);
      return item;
    },
  },
};
