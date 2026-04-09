import { getSupabase } from "@/lib/supabase";

// Seed data adapted for the existing Supabase UUID schema.
// project_tasks.project_id is a UUID FK, so we insert projects first, capture their UUIDs,
// then insert tasks referencing those UUIDs.

const PROJECTS = [
  { title: "AI Real Estate Lead Nurture", category: "AI Business", status: "Planning", description: "Automated lead follow-up system for new construction builders. Integrates with CRM, sends personalized follow-ups based on buyer behavior and timeline. Target Utah builders first, then expand nationally.", revenue_goal: "$2-5k/mo per builder client", progress: 15, grade: "A" },
  { title: "Jarvis-as-a-Service", category: "AI Business", status: "Building", description: "Productize this dashboard as a SaaS for entrepreneurs. Personal AI chief of staff with customizable agents, goal tracking, and AI chat. $99-299/mo subscription model.", revenue_goal: "$5-30k/mo at scale", progress: 30, grade: "A" },
  { title: "AI Home Buyer Chatbot", category: "Real Estate", status: "Idea", description: "24/7 chatbot for builder websites that qualifies leads, answers FAQs about communities, and books showings. White-label for multiple builders.", revenue_goal: "$500-1k/mo per builder", progress: 0, grade: "B" },
  { title: "Narwhal Ops Automation", category: "Real Estate", status: "Planning", description: "Automate internal Narwhal Homes operations — lead routing, transaction coordination, reporting, and client communication. Reduce manual work by 50%.", revenue_goal: "Internal efficiency — saves 10+ hrs/week", progress: 20, grade: "B" },
  { title: "AI Listing Content Generator", category: "Real Estate", status: "Idea", description: "Generate MLS descriptions, social media posts, and virtual tour scripts from listing photos and details. Tool for agents.", revenue_goal: "$29-99/mo per agent", progress: 0, grade: "C" },
  { title: "Football Film Platform", category: "AI Business", status: "Planning", description: "AI-powered football film analysis platform. Automated game film breakdown, player tracking, and coaching insights. Target high school and college programs.", revenue_goal: "$3-10k/mo per program", progress: 10, grade: "A" },
  { title: "Narwhal Real Estate", category: "Real Estate", status: "Building", description: "Core real estate operations at Narwhal Homes / Red Rock Real Estate. New construction focus, builder relationships, lead management. Powered by Lindy AI for automation.", revenue_goal: "Primary income — commissions", progress: 75, grade: "A" },
];

const TASKS_BY_PROJECT: Record<string, { title: string; done: boolean }[]> = {
  "AI Real Estate Lead Nurture": [
    { title: "Define MVP feature set", done: true },
    { title: "Design email sequence templates", done: false },
    { title: "Build CRM webhook integration", done: false },
    { title: "Get 2 beta builder clients", done: false },
  ],
  "Jarvis-as-a-Service": [
    { title: "Build dashboard shell", done: true },
    { title: "Add Anthropic chat integration", done: true },
    { title: "Build project management system", done: false },
    { title: "Create waitlist landing page", done: false },
  ],
  "Narwhal Ops Automation": [
    { title: "Map current manual workflows", done: true },
    { title: "Set up Inbox Sentinel agent", done: false },
  ],
};

const GOALS = [
  { title: "Launch 1 AI product with real revenue", category: "Product", progress: 5, target: 100, milestones: [{ id: "m1", title: "Choose product to build first", done: true },{ id: "m2", title: "Define MVP scope and features", done: false },{ id: "m3", title: "Build working prototype", done: false },{ id: "m4", title: "Get 2 beta users", done: false },{ id: "m5", title: "Iterate based on feedback", done: false },{ id: "m6", title: "Launch publicly", done: false },{ id: "m7", title: "Get first paying customer", done: false }] },
  { title: "Master AI build tools", category: "Skills", progress: 15, target: 100, milestones: [{ id: "m8", title: "Complete Claude API tutorial projects", done: true },{ id: "m9", title: "Build a full Next.js app (Jarvis)", done: true },{ id: "m10", title: "Implement prompt engineering best practices", done: false },{ id: "m11", title: "Build multi-agent orchestration system", done: false },{ id: "m12", title: "Deploy production AI application", done: false }] },
  { title: "Generate $1k/mo from AI", category: "Revenue", progress: 0, target: 100, milestones: [{ id: "m13", title: "Launch first paid product", done: false },{ id: "m14", title: "Get first paying customer", done: false },{ id: "m15", title: "Reach $250/mo", done: false },{ id: "m16", title: "Reach $500/mo", done: false },{ id: "m17", title: "Reach $1,000/mo", done: false }] },
  { title: "Automate Narwhal ops with AI", category: "Operations", progress: 20, target: 100, milestones: [{ id: "m18", title: "Map all manual workflows", done: true },{ id: "m19", title: "Deploy Inbox Sentinel", done: true },{ id: "m20", title: "Automate lead follow-up sequences", done: false },{ id: "m21", title: "Automate transaction coordination", done: false },{ id: "m22", title: "Automate weekly reporting", done: false },{ id: "m23", title: "Measure time saved — hit 50% target", done: false }] },
];

export async function POST() {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const results: { step: string; status: string }[] = [];

  // Check if already seeded
  const { data: existing } = await sb.from("projects").select("id").limit(1);
  if (existing && existing.length > 0) {
    return Response.json({ message: "Already seeded", projects: existing.length });
  }

  // Seed projects
  const { data: insertedProjects, error: pe } = await sb
    .from("projects")
    .insert(PROJECTS)
    .select("id, title");

  if (pe) {
    results.push({ step: "Seed projects", status: `error: ${pe.message}` });
    return Response.json({ results });
  }
  results.push({ step: "Seed projects", status: `${insertedProjects.length} created` });

  // Build title → UUID map
  const projectIdMap = new Map<string, string>();
  for (const p of insertedProjects) {
    projectIdMap.set(p.title, p.id);
  }

  // Seed tasks
  const allTasks: { project_id: string; title: string; done: boolean }[] = [];
  for (const [projTitle, tasks] of Object.entries(TASKS_BY_PROJECT)) {
    const pid = projectIdMap.get(projTitle);
    if (!pid) continue;
    for (const t of tasks) {
      allTasks.push({ project_id: pid, title: t.title, done: t.done });
    }
  }

  const { error: te } = await sb.from("project_tasks").insert(allTasks);
  results.push({ step: "Seed tasks", status: te ? `error: ${te.message}` : `${allTasks.length} created` });

  // Seed goals
  const { error: ge } = await sb.from("goals").insert(GOALS);
  results.push({ step: "Seed goals", status: ge ? `error: ${ge.message}` : `${GOALS.length} created` });

  // Verify
  const { count: pc } = await sb.from("projects").select("*", { count: "exact", head: true });
  const { count: gc } = await sb.from("goals").select("*", { count: "exact", head: true });

  return Response.json({
    seeded: true,
    results,
    counts: { projects: pc, goals: gc },
  });
}
