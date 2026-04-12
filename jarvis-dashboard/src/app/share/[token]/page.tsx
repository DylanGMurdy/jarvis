import { getSupabaseAdmin } from "@/lib/supabase";
import Link from "next/link";

interface ProjectData {
  id: string;
  title: string;
  category: string;
  status: string;
  description: string;
  revenue_goal: string;
  progress: number;
  grade: string;
  created_at: string;
}

interface NoteData {
  id: string;
  content: string;
  created_at: string;
}

interface TaskData {
  id: string;
  title: string;
  done: boolean;
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = getSupabaseAdmin();

  if (!sb) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] flex items-center justify-center">
        <p>Supabase not configured</p>
      </div>
    );
  }

  // Resolve token → project_id
  const { data: shareData } = await sb
    .from("project_shares")
    .select("project_id")
    .eq("token", token)
    .single();

  if (!shareData) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="text-[#64748b]">This share link is invalid or has been revoked.</p>
        <Link href="/landing" className="text-[#6366f1] hover:underline">Visit JARVIS</Link>
      </div>
    );
  }

  // Fetch project data
  const [projectRes, notesRes, tasksRes] = await Promise.all([
    sb.from("projects").select("*").eq("id", shareData.project_id).single(),
    sb.from("project_notes").select("*").eq("project_id", shareData.project_id).order("created_at", { ascending: false }).limit(50),
    sb.from("project_tasks").select("*").eq("project_id", shareData.project_id),
  ]);

  const project = projectRes.data as ProjectData | null;
  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] flex items-center justify-center">
        <p>Project not found</p>
      </div>
    );
  }

  const notes = (notesRes.data || []) as NoteData[];
  const tasks = (tasksRes.data || []) as TaskData[];
  const doneTasks = tasks.filter((t) => t.done).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      {/* Read-only banner */}
      <div className="bg-[#6366f1]/10 border-b border-[#6366f1]/20 px-6 py-3 text-center text-sm">
        <span className="text-[#a5b4fc]">📖 Read-only view shared from </span>
        <Link href="/landing" className="text-[#6366f1] font-semibold hover:underline">JARVIS</Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-bold">{project.title}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1e1e2e] text-[#94a3b8] border border-[#1e1e2e]">{project.category}</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Grade {project.grade}</span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/30">{project.status}</span>
          </div>
          <p className="text-sm text-[#64748b]">Created {new Date(project.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>

        {/* Description */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Description</h2>
          <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
            <p className="text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{project.description || "No description provided."}</p>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#6366f1]">{project.progress}%</p>
              <p className="text-xs text-[#64748b] mt-1">Progress</p>
            </div>
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{doneTasks}/{tasks.length}</p>
              <p className="text-xs text-[#64748b] mt-1">Tasks Done</p>
            </div>
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{notes.length}</p>
              <p className="text-xs text-[#64748b] mt-1">Notes</p>
            </div>
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{project.revenue_goal || "—"}</p>
              <p className="text-xs text-[#64748b] mt-1">Revenue Goal</p>
            </div>
          </div>
        </section>

        {/* Tasks */}
        {tasks.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Tasks</h2>
            <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] divide-y divide-[#1e1e2e]">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${t.done ? "bg-[#6366f1] border-[#6366f1]" : "border-[#64748b]"}`}>
                    {t.done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className={`text-sm ${t.done ? "line-through text-[#64748b]" : "text-[#e2e8f0]"}`}>{t.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Notes & Analysis</h2>
            <div className="space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-5">
                  <p className="text-sm text-[#e2e8f0] whitespace-pre-wrap leading-relaxed">{n.content}</p>
                  <p className="text-[10px] text-[#64748b] mt-3">{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer CTA */}
        <div className="mt-12 pt-8 border-t border-[#1e1e2e] text-center">
          <p className="text-sm text-[#64748b] mb-3">Built with JARVIS — your personal AI private equity firm</p>
          <Link href="/landing" className="inline-block px-5 py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-semibold hover:bg-[#5558e6] transition-colors">
            Get Early Access
          </Link>
        </div>
      </div>
    </div>
  );
}
