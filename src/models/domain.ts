export type Difficulty = "Easy" | "Medium" | "Hard";
export type ProblemStatus = "Solved" | "Attempted" | "Review" | "Stuck";
export type ThemePreference = "dark" | "light";
export type Importance = "Core" | "Supporting" | "NiceToKnow";
export type BookStatus = "reading" | "completed" | "planned";
export type EventType =
  | "class"
  | "study"
  | "leetcode"
  | "deadline"
  | "meeting"
  | "personal"
  | "custom";
export type GroupRole = "owner" | "member";

export interface LeetCodeProblem {
  id: string;
  problemNumber: number;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  status: ProblemStatus;
  dateSolved?: string;
  timeMinutes?: number;
  approach?: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  solutionLink?: string;
  source: "manual" | "auto_import";
  verified: boolean;
  reviewIntervalDays?: number;
  nextReviewDate?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  totalChapters?: number;
  status: BookStatus;
  createdAt: string;
}

export interface KnowledgePoint {
  id: string;
  bookId: string;
  title: string;
  chapter?: string;
  pageSection?: string;
  concept: string;
  tags: string[];
  importance: Importance;
  confidence: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  description?: string;
  linkedModule?: "leetcode" | "reading" | "notes" | "groups";
  linkedItemId?: string;
  groupId?: string;
  createdAt: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  iconColor?: string;
  role: GroupRole;
  memberCount: number;
  createdAt: string;
}

export interface UserSettings {
  aiEnabled: boolean;
  notificationsEnabled: boolean;
  themePreference: ThemePreference;
  leetCodeUsername: string;
  aiApiKey: string;
  leetCodeGoal: number;
}

export interface LeetCodeSyncMetadata {
  status: "disconnected" | "idle" | "syncing" | "success" | "error";
  method: "none" | "graphql" | "scrape" | "manual";
  lastSyncAt?: string;
  lastImportedCount?: number;
  scrapeSolvedCount?: number;
  consecutiveFailures: number;
  lastError?: string;
  lastAttemptMethods: ("graphql" | "scrape" | "manual")[];
  activeStep?: "graphql" | "scrape" | "manual";
}

export interface AppDataSnapshot {
  problems: LeetCodeProblem[];
  books: Book[];
  events: CalendarEvent[];
  groups: StudyGroup[];
  settings: UserSettings;
  leetCodeSyncMetadata: LeetCodeSyncMetadata;
}
