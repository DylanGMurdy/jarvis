export interface Project {
  id: string;
  title: string;
  category: "AI Business" | "Real Estate" | "Side Hustles" | "Personal";
  status: "Idea" | "Planning" | "Building" | "Launched" | "Revenue";
  description: string;
  revenue_goal: string;
  progress: number;
  grade: "A" | "B" | "C";
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
  target: string;
  target_date: string;
  milestones: Milestone[];
  weekly_breakdown: string[];
  progress_snapshots: ProgressSnapshot[];
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

export interface Memory {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
}

export interface LindyBriefing {
  id: string;
  content: string;
  created_at: string;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
