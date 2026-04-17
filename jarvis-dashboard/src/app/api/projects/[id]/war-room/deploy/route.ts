// ═══════════════════════════════════════════════════════════════════
// Jarvis War Room — Full 6-Phase Deploy Route with Debate System
//
// PHASES:
//  1. Setup — load project, constraints, create session
//  2. Wave 1 — 4 C-suite agents analyze sequentially (anchors reality)
//  3. Wave 2 — 17 agents analyze in batches, briefed by Wave 1
//  4. Conflict Detection — JARVIS identifies tactical + strategic conflicts
//  5. Round 1 Debate — role-filtered agent pairs resolve tactical conflicts
//  6. Round 2 Debate — remaining conflicts
//  7. Finalize — escalate strategic conflicts to approval queue, save synthesis
// ═══════════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import {
  WAVE_1,
  WAVE_2,
  ALL_AGENTS,
  getCompanyContext,
  type AgentDef,
  type ProjectConstraints,
} from "@/lib/warRoomAgents";

const MODEL = "claude-sonnet-4-20250514";
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface AgentResult {
  key: string;
  name: string;
  role: string;
  tier: string;
  result: string;
  positionId?: string;
}

interface Conflict {
  topic: string;
  description: string;
  agents: string[];
  type: "tactical" | "strategic";
  category: string;
}

async function callAgent(
  client: Anthropic,
  agent: AgentDef,
  companyContext: string,
  taskPrompt: string,
  briefing: string = ""
): Promise<string> {
  const system = [companyContext, "", "# YOUR ROLE", agent.role_prompt, briefing].filter(Boolean).join("\n\n");

  const doCall = async () => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: taskPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";
  };

  try {
    return await doCall();
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const isRateLimit = e?.status === 429 || (e?.message || "").toLowerCase().includes("rate");
    if (isRateLimit) {
      await delay(10000);
      try {
        return await doCall();
      } catch (err2: unknown) {
        const e2 = err2 as { message?: string };
        return `[Rate limited after retry] ${e2?.message || "Unknown error"}`;
      }
    }
    return `[Error] ${e?.message || "Unknown error"}`;
  }
}

async function buildProjectContext(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  projectId: string
): Promise<{ context: string; title: string }> {
  const { data: project } = await sb.from("projects").select("*").eq("id", projectId).single();
  if (!project) return { context: "No project data found.", title: "Unknown Project" };
  const description = (project.description || "").slice(0, 800);
  return {
    context: `## PROJECT UNDER ANALYSIS\nTitle: ${project.title}\nCategory: ${project.category || "N/A"}\nRevenue Goal: ${project.revenue_goal || "Not set"}\n\nDescription:\n${description || "No description provided."}`,
    title: project.title,
  };
}

async function loadConstraints(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  projectId: string
): Promise<ProjectConstraints | null> {
  const { data } = await sb
    .from("project_constraints")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  return data as ProjectConstraints | null;
}

async function detectConflicts(
  client: Anthropic,
  companyContext: string,
  projectContext: string,
  allPositions: AgentResult[]
): Promise<Conflict[]> {
  const positionsBlock = allPositions
    .map((p) => `## ${p.name} (${p.role})\n${p.result}`)
    .join("\n\n---\n\n");

  const system = `${companyContext}

# YOUR ROLE: JARVIS — Chief of Staff & Debate Moderator

You've just received initial analyses from all 21 team members. Identify REAL conflicts — places where agents disagree on specifics that matter. NOT superficial differences, NOT missing detail — actual conflicting recommendations.

Classify each conflict:
- "tactical" = team can resolve via debate
- "strategic" = requires Dylan's judgment (pricing, major budget, brand, legal risk, strategic direction)

Categorize: budget | pricing | timeline | legal | scope | strategy | tech | ops | marketing

Return a JSON array (no markdown fences):
{
  "topic": "Short name",
  "description": "1-3 sentences",
  "agents": ["cfo", "cmo"],
  "type": "tactical" | "strategic",
  "category": "budget"
}

If no real conflicts, return []. Max 10, ranked by importance.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [
      {
        role: "user",
        content: `${projectContext}\n\n## ALL TEAM POSITIONS:\n\n${positionsBlock}\n\nIdentify the conflicts. Return JSON array only.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "[]";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10).map((c: unknown) => {
      const conflict = c as Partial<Conflict>;
      return {
        topic: conflict.topic || "Unnamed conflict",
        description: conflict.description || "",
        agents: Array.isArray(conflict.agents) ? conflict.agents : [],
        type: conflict.type === "strategic" ? "strategic" : "tactical",
        category: conflict.category || "strategy",
      };
    });
  } catch {
    return [];
  }
}

async function runDebateRoundForConflict(
  client: Anthropic,
  companyContext: string,
  projectContext: string,
  conflict: Conflict,
  allPositions: AgentResult[],
  round: number
): Promise<{ question: string; responses: { agent: string; response: string }[] }> {
  const agentsOfInterest = new Set<string>(conflict.agents);
  conflict.agents.forEach((k) => {
    const def = ALL_AGENTS.find((a) => a.key === k);
    def?.cross_references.forEach((r) => agentsOfInterest.add(r));
  });
  const relevantPositions = allPositions.filter((p) => agentsOfInterest.has(p.key));
  const positionsBlock = relevantPositions.map((p) => `## ${p.name}\n${p.result}`).join("\n\n---\n\n");

  const jarvisSystem = `${companyContext}

# YOUR ROLE: JARVIS — Debate Moderator
You're facilitating round ${round} of debate on a specific conflict. Write a FOCUSED question to the agents involved that forces them to address the disagreement head-on. Under 80 words. Direct. Name the tradeoff.`;

  const jarvisResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: jarvisSystem,
    messages: [
      {
        role: "user",
        content: `Conflict: ${conflict.topic}\nDescription: ${conflict.description}\nAgents involved: ${conflict.agents.join(", ")}\n\nRelevant positions:\n\n${positionsBlock}\n\nWrite the moderator question for round ${round}.`,
      },
    ],
  });
  const jarvisBlock = jarvisResponse.content.find((b) => b.type === "text");
  const question = jarvisBlock && jarvisBlock.type === "text" ? jarvisBlock.text : `Resolve: ${conflict.topic}`;

  const agentResponses: { agent: string; response: string }[] = [];
  for (const agentKey of conflict.agents) {
    const agentDef = ALL_AGENTS.find((a) => a.key === agentKey);
    if (!agentDef) continue;

    const otherPositions = allPositions
      .filter((p) => p.key !== agentKey && agentsOfInterest.has(p.key))
      .map((p) => `## ${p.name}'s position\n${p.result}`)
      .join("\n\n---\n\n");

    const system = `${companyContext}

# YOUR ROLE
${agentDef.role_prompt}

# DEBATE CONTEXT
You're in round ${round} of a team debate about: ${conflict.topic}
JARVIS moderator question: ${question}

Your teammates' positions (these are people on YOUR team):
${otherPositions}

Respond in under 200 words:
1. Acknowledge valid points from teammates
2. State your revised position clearly (with specific numbers/details)
3. If conceding, say so explicitly
4. If still disagreeing, explain WHY in terms of Dylan's constraints`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: projectContext }],
    });
    const block = response.content.find((b) => b.type === "text");
    agentResponses.push({
      agent: agentKey,
      response: block && block.type === "text" ? block.text : "[No response]",
    });
    await delay(1500);
  }

  return { question, responses: agentResponses };
}

async function finalSynthesis(
  client: Anthropic,
  companyContext: string,
  projectContext: string,
  allPositions: AgentResult[],
  conflicts: Conflict[],
  resolutions: { conflict: Conflict; resolved: boolean; resolutionText: string }[]
): Promise<string> {
  const tacticalResolutions = resolutions
    .filter((r) => r.conflict.type === "tactical" && r.resolved)
    .map((r) => `- **${r.conflict.topic}** — ${r.resolutionText}`)
    .join("\n");
  const strategicConflicts = conflicts
    .filter((c) => c.type === "strategic")
    .map((c) => `- **${c.topic}** — ${c.description}`)
    .join("\n");
  const unresolved = resolutions
    .filter((r) => !r.resolved)
    .map((r) => `- **${r.conflict.topic}** — ${r.resolutionText || "still being discussed"}`)
    .join("\n");

  const positionsSummary = allPositions
    .map((p) => `### ${p.name}\n${p.result.split("\n").slice(0, 8).join("\n")}`)
    .join("\n\n");

  const system = `${companyContext}

# YOUR ROLE: JARVIS — Final Synthesis

After 2 debate rounds, produce the team's final recommendation for Dylan. Structure:

## Team Verdict (2-3 sentences)
Overall recommendation. Direct. No hedging.

## What the team aligned on
5-7 bullets of the core plan we agreed on (post-debate).

## Resolved tactical conflicts
How we resolved each (show the work).

## ⚠️ Decisions needed from Dylan (STRATEGIC)
List the strategic conflicts we couldn't resolve ourselves. Frame each as a specific question with 2-3 options.

## Recommended next actions (priority order)
5 specific things to do this week.

## Confidence: X/10
Team's confidence (realistic, not inflated).

Direct. Meeting minutes from a real exec team, not a consulting deck.`;

  const userContent = `${projectContext}

## FINAL POSITIONS (post-debate):
${positionsSummary}

## RESOLVED DURING DEBATE:
${tacticalResolutions || "(none)"}

## STRATEGIC DECISIONS ESCALATING TO DYLAN:
${strategicConflicts || "(none)"}

## STILL DISPUTED:
${unresolved || "(none)"}

Produce the final synthesis.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "Synthesis generation failed.";
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  // PHASE 1: Setup
  const { context: projectContext, title: projectTitle } = await buildProjectContext(sb, projectId);
  const constraints = await loadConstraints(sb, projectId);
  const companyContext = getCompanyContext(constraints);

  const { data: session, error: sessionErr } = await sb
    .from("war_room_sessions")
    .insert({
      project_id: projectId,
      status: "running",
      debate_status: "wave_1_running",
      constraints_snapshot: constraints || null,
      agents_run: 0,
    })
    .select()
    .single();

  if (sessionErr || !session) {
    return Response.json({ error: `Session creation failed: ${sessionErr?.message}` }, { status: 500 });
  }
  const sessionId = session.id;

  try {
    // PHASE 2: Wave 1
    const wave1Results: AgentResult[] = [];
    const wave1TaskPrompt = `Analyze this project for our team.\n\n${projectContext}\n\nRespond in your role, following the structure in your role definition. Be specific, use Dylan's actual constraints.`;

    for (let i = 0; i < WAVE_1.length; i++) {
      const agent = WAVE_1[i];
      const result = await callAgent(client, agent, companyContext, wave1TaskPrompt);
      wave1Results.push({ key: agent.key, name: agent.name, role: agent.role, tier: agent.tier, result });
      const { data: posRow } = await sb
        .from("war_room_agent_positions")
        .insert({
          session_id: sessionId,
          project_id: projectId,
          agent_key: agent.key,
          agent_name: agent.name,
          agent_tier: agent.tier,
          round: 0,
          position_text: result,
        })
        .select()
        .single();
      if (posRow) wave1Results[wave1Results.length - 1].positionId = posRow.id;
      await sb.from("project_notes").insert({
        project_id: projectId,
        content: `[War Room — ${agent.name}]\n\n${result}`,
        source: `war_room_${agent.key}`,
        session_id: sessionId,
      });
      if (i < WAVE_1.length - 1) await delay(2000);
    }

    await sb.from("war_room_sessions").update({ debate_status: "wave_2_running" }).eq("id", sessionId);

    // PHASE 3: Wave 2
    const wave1Briefing = `\n\n# WAVE 1 BRIEFING — Financial, Technical, Legal, Operational reality\n\nYour teammates in the foundational roles have already analyzed this. Their positions define the reality you're building within:\n\n${wave1Results.map((r) => `## ${r.name}\n${r.result}`).join("\n\n---\n\n")}`;

    const wave2Results: AgentResult[] = [];
    for (let i = 0; i < WAVE_2.length; i += 2) {
      const batch = WAVE_2.slice(i, i + 2);
      const batchResults: AgentResult[] = await Promise.all(
        batch.map(async (agent): Promise<AgentResult> => {
          const result = await callAgent(client, agent, companyContext, wave1TaskPrompt, wave1Briefing);
          return { key: agent.key, name: agent.name, role: agent.role, tier: agent.tier, result };
        })
      );
      wave2Results.push(...batchResults);
      for (const r of batchResults) {
        const { data: posRow } = await sb
          .from("war_room_agent_positions")
          .insert({
            session_id: sessionId,
            project_id: projectId,
            agent_key: r.key,
            agent_name: r.name,
            agent_tier: r.tier,
            round: 0,
            position_text: r.result,
          })
          .select()
          .single();
        if (posRow) r.positionId = posRow.id;
        await sb.from("project_notes").insert({
          project_id: projectId,
          content: `[War Room — ${r.name}]\n\n${r.result}`,
          source: `war_room_${r.key}`,
          session_id: sessionId,
        });
      }
      if (i + 2 < WAVE_2.length) await delay(3000);
    }

    const allInitialPositions: AgentResult[] = [...wave1Results, ...wave2Results];

    // PHASE 4: Conflict Detection
    await sb.from("war_room_sessions").update({ debate_status: "detecting_conflicts" }).eq("id", sessionId);
    await delay(2000);

    const conflicts = await detectConflicts(client, companyContext, projectContext, allInitialPositions);

    const savedConflicts: { id: string; conflict: Conflict }[] = [];
    for (const c of conflicts) {
      const { data: row } = await sb
        .from("war_room_conflicts")
        .insert({
          session_id: sessionId,
          project_id: projectId,
          conflict_topic: c.topic,
          conflict_description: c.description,
          agents_involved: c.agents,
          conflict_type: c.type,
          conflict_category: c.category,
          resolution_status: "open",
        })
        .select()
        .single();
      if (row) savedConflicts.push({ id: row.id, conflict: c });
    }

    // PHASES 5 & 6: Debate rounds
    const tacticalConflicts = savedConflicts.filter((c) => c.conflict.type === "tactical");
    const currentPositions: AgentResult[] = [...allInitialPositions];
    const resolutions: { conflict: Conflict; resolved: boolean; resolutionText: string }[] = [];

    for (let round = 1; round <= 2; round++) {
      await sb.from("war_room_sessions").update({
        debate_status: round === 1 ? "round_1_debating" : "round_2_debating",
      }).eq("id", sessionId);

      const stillOpen = tacticalConflicts.filter(
        (c) => !resolutions.find((r) => r.conflict.topic === c.conflict.topic && r.resolved)
      );
      if (stillOpen.length === 0) break;

      for (const sc of stillOpen) {
        const { question, responses } = await runDebateRoundForConflict(
          client,
          companyContext,
          projectContext,
          sc.conflict,
          currentPositions,
          round
        );

        await sb.from("war_room_debate_messages").insert({
          session_id: sessionId,
          conflict_id: sc.id,
          round,
          from_agent: "jarvis",
          to_agents: sc.conflict.agents,
          message_type: "question",
          message: question,
          referenced_conflict_topic: sc.conflict.topic,
        });
        for (const r of responses) {
          await sb.from("war_room_debate_messages").insert({
            session_id: sessionId,
            conflict_id: sc.id,
            round,
            from_agent: r.agent,
            to_agents: sc.conflict.agents.filter((a) => a !== r.agent),
            message_type: "response",
            message: r.response,
            referenced_conflict_topic: sc.conflict.topic,
          });
          const idx = currentPositions.findIndex((p) => p.key === r.agent);
          if (idx >= 0) currentPositions[idx] = { ...currentPositions[idx], result: r.response };
          const agentDef = ALL_AGENTS.find((a) => a.key === r.agent);
          if (agentDef) {
            await sb.from("war_room_agent_positions").insert({
              session_id: sessionId,
              project_id: projectId,
              agent_key: r.agent,
              agent_name: agentDef.name,
              agent_tier: agentDef.tier,
              round,
              position_text: r.response,
            });
          }
        }

        const jointText = responses.map((r) => r.response).join(" ").toLowerCase();
        const consensusSignals = ["agreed", "aligned", "concede", "accept", "you're right", "i'll defer"];
        const hasConsensus = consensusSignals.some((s) => jointText.includes(s));

        if (hasConsensus || round === 2) {
          const resolutionText = responses
            .map((r) => `${r.agent.toUpperCase()}: ${r.response.slice(0, 150)}...`)
            .join(" | ");
          resolutions.push({ conflict: sc.conflict, resolved: true, resolutionText });
          await sb
            .from("war_room_conflicts")
            .update({
              resolution_status: "resolved",
              resolution_text: resolutionText,
              resolved_in_round: round,
              resolved_at: new Date().toISOString(),
            })
            .eq("id", sc.id);
        }
      }

      await delay(2000);
    }

    // PHASE 7: Escalate strategic conflicts
    await sb.from("war_room_sessions").update({ debate_status: "reconciling" }).eq("id", sessionId);

    const strategicConflicts = savedConflicts.filter((c) => c.conflict.type === "strategic");
    let escalationCount = 0;
    for (const sc of strategicConflicts) {
      try {
        const { data: appRow } = await sb
          .from("approval_queue")
          .insert({
            source: "war_room_conflict",
            source_id: sc.id,
            project_id: projectId,
            priority: "high",
            context: {
              topic: sc.conflict.topic,
              description: sc.conflict.description,
              agents_involved: sc.conflict.agents,
              category: sc.conflict.category,
              session_id: sessionId,
              project_title: projectTitle,
            },
            status: "pending",
          })
          .select()
          .single();
        if (appRow) {
          await sb
            .from("war_room_conflicts")
            .update({
              resolution_status: "escalated",
              escalated_to_dylan: true,
              approval_queue_id: appRow.id,
            })
            .eq("id", sc.id);
          escalationCount++;
        }
      } catch {
        // approval_queue schema might not perfectly match — continue gracefully
      }
    }

    // Final synthesis
    const summary = await finalSynthesis(
      client,
      companyContext,
      projectContext,
      currentPositions,
      conflicts,
      resolutions
    );

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[War Room — JARVIS Final Synthesis]\n\n${summary}`,
      source: "war_room_summary",
      session_id: sessionId,
    });

    const confMatch = summary.match(/confidence[:\s]+(\d+)\s*\/\s*10/i);
    const confidenceScore = confMatch ? parseInt(confMatch[1], 10) : 7;

    const finalStatus = escalationCount > 0 ? "awaiting_dylan_decision" : "complete";
    await sb
      .from("war_room_sessions")
      .update({
        status: "complete",
        debate_status: finalStatus,
        confidence_score: confidenceScore,
        agents_run: allInitialPositions.length,
        summary_text: summary,
        total_rounds_completed: 2,
        conflict_count: conflicts.length,
        escalation_count: escalationCount,
      })
      .eq("id", sessionId);

    try {
      await sb.from("notifications").insert({
        title: escalationCount > 0 ? "War Room Complete — Your decision needed" : "War Room Complete",
        body: `${projectTitle} — ${allInitialPositions.length} agents, ${conflicts.length} conflicts${escalationCount > 0 ? `, ${escalationCount} needing your call` : ", all resolved by the team"}. Confidence: ${confidenceScore}/10.`,
        type: escalationCount > 0 ? "warning" : "success",
        link: `/ideas/${projectId}`,
        read: false,
      });
    } catch { /* ignore */ }

    return Response.json({
      ok: true,
      session_id: sessionId,
      summary,
      agents: allInitialPositions.map((r) => ({
        key: r.key,
        name: r.name,
        role: r.role,
        tier: r.tier,
        initial_position: r.result,
        final_position: currentPositions.find((p) => p.key === r.key)?.result || r.result,
      })),
      conflicts: savedConflicts.map((c) => c.conflict),
      escalations_to_dylan: escalationCount,
      rounds_completed: 2,
      confidence: confidenceScore,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    try {
      await sb.from("war_room_sessions").update({ status: "errored", debate_status: "errored" }).eq("id", sessionId);
    } catch { /* ignore */ }
    return Response.json({ error: msg, session_id: sessionId }, { status: 500 });
  }
}
