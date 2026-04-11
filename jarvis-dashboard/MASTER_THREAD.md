# MASTER THREAD — JARVIS DASHBOARD

## OVERVIEW
Jarvis Dashboard is a comprehensive system for managing AI agents, projects, and automated workflows. Built with Next.js 16, TypeScript, Tailwind CSS, and Supabase.

## CURRENT ARCHITECTURE

### Database Schema (Supabase)
- **profiles**: User profiles with role-based access
- **projects**: Core project entity with metadata
- **ideas**: Idea Lab conversations and iterations
- **agents**: AI agent definitions and configurations
- **agent_reports**: War Room agent analysis and reports
- **conversations**: Chat histories and context
- **files**: Project file storage and management
- **notifications**: System alerts and updates

### Core Features
1. **Idea Lab**: Interactive brainstorming with AI
2. **War Room**: Multi-agent analysis and strategy
3. **Build**: Project execution and management
4. **Files**: Document storage and organization
5. **Agents**: AI assistant management

### Technology Stack
- **Frontend**: Next.js 16, React, TypeScript
- **Styling**: Tailwind CSS, Shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **AI Integration**: OpenAI API, custom agent orchestration
- **Deployment**: Vercel

## CURRENT STATUS
- [x] Project structure established
- [x] Database schema implemented
- [x] Authentication system active
- [x] Basic UI components in place
- [ ] Idea Lab implementation
- [ ] War Room multi-agent system
- [ ] Build stage automation
- [ ] File management system

## KEY DECISIONS

### UI/UX Principles
- Dark theme primary (Jarvis aesthetic)
- Clean, minimal interface
- Real-time updates and feedback
- Mobile-responsive design
- Consistent component patterns

### Data Flow
1. Ideas → War Room → Build → Execution
2. All stages preserve full context
3. Agent outputs feed into next stage
4. Files and reports auto-organize by project

### Agent System
- 21 specialized business agents
- Context-aware analysis
- Cross-agent information sharing
- Iterative refinement capability

---

## WAR ROOM — FULL AGREED SPEC (April 11 2026)

### Vision
The War Room is a living think tank. Not a static report. Dylan brings a fully formed idea from the Idea Lab and deploys his entire executive team simultaneously. They brief each other, analyze from their specialty, and deliver a comprehensive picture. Dylan interrogates, refines, and approves. Then moves to Build.

### Deployment — Two Wave System
Wave 1 (Foundation): CFO, CTO, CLO, COO fire first. They establish:
- CFO: financial reality, budget, revenue model, runway
- CTO: technical scope, what is and isn't buildable
- CLO: legal constraints, compliance requirements
- COO: operational requirements, resource needs

Wave 2 (Full Team): All 17 remaining agents fire simultaneously. Each receives a briefing package from Wave 1 so they understand the full picture — budget, technical constraints, legal limits, operational reality. CMO knows the budget. VP Sales knows the legal constraints. Head of Design knows the tech scope.

### Layout
- Jarvis Summary at top — cover page synthesizing everything, flagging conflicts, top 3 things team agreed on
- C-Suite row below summary
- VP row below C-Suite
- Specialists row at bottom
- Each agent has expandable card with full analysis + role-specific visuals

### Context Fed to Every Agent
Complete Idea Lab conversation — every message Dylan and Jarvis exchanged about the idea, plus project title and description. Agents use full context to make analysis specific, not generic.

### Cross-Agent Briefing
Agents know what relevant teammates said. CTO sees CFO budget before writing tech roadmap. CMO sees CSO target customer before writing content strategy. CLO constraints visible to all agents who need them.

### Live War Room Chat
After reports populate, Dylan chats with Jarvis inside the War Room. Jarvis knows every agent's full report. Dylan can:
- Ask about specific agent reports
- Request individual agent re-runs with new instructions
- Ask Jarvis to cross-reference agents for conflicts or alignment
- Get Jarvis to surface top 3 agreements across all 21 agents

### Refresh System
After interrogating and adding context through chat, Dylan hits Refresh. Every agent re-runs with updated context — original Idea Lab + War Room chat history. Reports update. Jarvis Summary refreshes. Can repeat until fully satisfied.

### PDF Reports with Visuals
After final refresh and approval, all agents generate professional PDF reports:
- Each PDF: agent name, role, project name, date as header
- Structured sections: Executive Summary, Key Findings, Recommendations, Risks, Next Steps
- Role-specific visuals: CFO gets revenue charts, CMO gets market matrix, CTO gets architecture diagram
- Jarvis Summary becomes the cover PDF
- All 22 PDFs save automatically to project Files tab, tagged with project_id
- Never mixed with other project files

### Move to Build
Single button closes War Room and formally kicks off Build Stage execution.

### Business Context
- Lindy agent business: being built separately by Dylan, not ready yet, Jarvis will run it when ready
- First revenue: Dylan closing Narwhal PM leads personally, SDR agent fills calendar automatically
- Longer term: virtual closer on commission, then AI-assisted closing with real-time coaching
- Two tracks: Dylan doing personal outreach NOW while SDR automation builds pipeline in background