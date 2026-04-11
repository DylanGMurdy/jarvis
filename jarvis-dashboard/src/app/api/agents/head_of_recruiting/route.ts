import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "job_descriptions" | "hiring_process" | "culture_fit_questions" | "employer_brand";

const SYSTEM_PROMPT = `You are the Head of Recruiting agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan is a real estate agent in Eagle Mountain, Utah building multiple AI and real estate businesses. He's a solo founder who will eventually need to hire — but only when automation can't handle the job. When he does hire, he values culture fit over credentials, hustle over pedigree, and remote-friendly setups.

Your role: Help Dylan hire the right people at the right time. Write job descriptions that attract builders and self-starters, not corporate types. Design hiring processes that are fast and founder-friendly — Dylan doesn't have weeks to interview candidates. Every hire should 10x some part of the business.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  job_descriptions: (title, desc) => `Write compelling job descriptions for the top 3 roles to hire for "${title}".

Project description: ${desc}

For each role provide:
1. **Job Title** — clear, searchable title (avoid trendy titles)
2. **One-Liner** — exciting one-sentence hook about the role
3. **About the Company** — 3-sentence company description that attracts builders
4. **What You'll Do** — 5 specific responsibilities (not vague bullet points)
5. **What You Bring** — must-haves (3-4) and nice-to-haves (2-3)
6. **What We Offer** — compensation range, remote policy, unique perks
7. **Red Flags** — what kind of person should NOT apply
8. **Application Question** — one question that filters for quality (not "tell me about yourself")

Order the 3 roles by hire priority. Assume contractor/part-time first, full-time later. Include realistic salary ranges for Utah/remote.`,

  hiring_process: (title, desc) => `Design the end-to-end hiring process for "${title}".

Project description: ${desc}

Provide:
1. **Sourcing Strategy** — where to find candidates (job boards, communities, referrals, LinkedIn)
2. **Application Screening** — how to filter 100 applicants to 10 in under 1 hour
3. **Stage 1: Async Assessment** — take-home task or Loom video (what to ask, rubric)
4. **Stage 2: Interview** — 30-minute interview guide with 5 key questions and what good answers look like
5. **Stage 3: Paid Trial** — 1-week paid trial project (scope, pay rate, evaluation criteria)
6. **Decision Framework** — scoring rubric for hire/no-hire (weight: skills 30%, culture 30%, initiative 40%)
7. **Offer & Onboarding** — how to make the offer, first-week onboarding checklist
8. **Timeline** — total days from posting to hired (target: under 14 days)
9. **Tools** — specific tools for each stage (ATS, scheduling, assessment)

Design for a solo founder who has 2-3 hours/week for hiring.`,

  culture_fit_questions: (title, desc) => `Create culture fit interview questions for "${title}".

Project description: ${desc}

Provide 12 questions across 4 categories:

**Ownership & Initiative (3 questions)**
- Testing: do they take action without being told?

**Scrappiness & Speed (3 questions)**
- Testing: can they ship with limited resources?

**Communication & Honesty (3 questions)**
- Testing: do they communicate clearly and raise problems early?

**Values Alignment (3 questions)**
- Testing: do they align with family-first, automation-first, customer-obsessed values?

For each question:
- The exact question to ask
- What a GREAT answer sounds like (with example)
- What a RED FLAG answer sounds like (with example)
- Follow-up probe question

Also provide:
- **Reverse Culture Questions** — 3 questions candidates should ask Dylan (and what his answers should be)
- **Reference Check Questions** — 5 questions to ask references that actually reveal something useful`,

  employer_brand: (title, desc) => `Build an employer brand strategy for "${title}".

Project description: ${desc}

Provide:
1. **Employer Value Proposition** — why someone talented would choose this over a big company
2. **Culture Pillars** — 4-5 defining traits of the culture (with specific examples of each)
3. **Employer Brand Story** — the narrative about working here (2 paragraphs)
4. **Careers Page Copy** — ready-to-use copy for a careers section
5. **Social Proof Strategy** — how to build credibility as an employer (content, testimonials, awards)
6. **Content Plan** — 5 LinkedIn/Twitter posts Dylan can write about building the team
7. **Talent Community** — how to build a pipeline of interested candidates before you need them
8. **Competitive Positioning** — how to compete for talent against well-funded startups
9. **Compensation Philosophy** — how to think about pay when bootstrapping (equity, flexibility, growth)`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: job_descriptions, hiring_process, culture_fit_questions, or employer_brand" }, { status: 400 });
    }
    if (!projectId || !projectTitle) {
      return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });

    const claude = new Anthropic({ apiKey });
    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: ACTION_PROMPTS[action as Action](projectTitle, projectDescription || "No description") }],
    });

    const output = msg.content[0].type === "text" ? msg.content[0].text : "";

    const sb = getSupabaseAdmin();
    if (sb) {
      const labels: Record<Action, string> = { job_descriptions: "Job Descriptions", hiring_process: "Hiring Process", culture_fit_questions: "Culture Fit Questions", employer_brand: "Employer Brand" };
      await sb.from("project_notes").insert({
        id: `recruiting-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[Head of Recruiting — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
