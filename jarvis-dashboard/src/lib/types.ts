export interface Project {
  id: string;
  title: string;
  category: "AI Business" | "Real Estate" | "Side Hustles" | "Personal";
  status: "Idea" | "Planning" | "Building" | "Launched" | "Revenue";
  description: string;
  revenue_goal: string;
  progress: number;
  grade: "A" | "B" | "C";
  drive_folder_id?: string | null;
  war_room_completed_at?: string | null;
  war_room_summary?: {
    completed_at: string;
    confidence_score: number;
    agents_ran: number;
    top_recommendation: string;
  } | null;
  updated_at?: string | null;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  content: string;
  created_at: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  progress: number;
  target: number | string;
  target_date?: string;
  milestones: Milestone[];
  weekly_breakdown?: string[];
  progress_snapshots?: ProgressSnapshot[];
  created_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
}

export interface ProgressSnapshot {
  week: number;
  progress: number;
  date: string;
}

export interface GoalJournal {
  id: string;
  goal_id: string;
  entry: string;
  created_at: string;
}

export type MemoryCategory =
  | "personal"
  | "business"
  | "health"
  | "goals"
  | "relationships"
  | "preferences"
  | "ideas";

export interface Memory {
  id: string;
  fact: string;
  category: MemoryCategory;
  source: string;
  confidence: number;
  created_at: string;
}

export interface LindyBriefing {
  id: string;
  content: string;
  created_at: string;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  summary: string;
  title: string;
  conversation_type: "global" | "project";
  created_at: string;
  updated_at: string;
}

export interface ConversationPreview {
  id: string;
  title: string;
  summary: string;
  conversation_type: "global" | "project";
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
  last_role: string;
}
