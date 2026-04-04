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
export type NoteTemplate =
  | "custom"
  | "lecture"
  | "algorithm"
  | "meeting"
  | "weekly_reflection";

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
  reviewIntervalDays?: number;
  nextReviewDate?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  recurrenceUntil?: string;
  reminderMinutesBefore?: number;
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

export interface Note {
  id: string;
  title: string;
  template: NoteTemplate;
  content: string;
  pinned?: boolean;
  tags: string[];
  linkedModule?: "leetcode" | "reading" | "calendar" | "groups";
  linkedItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  aiEnabled: boolean;
  aiBackend: "mock" | "claw_agent_devtools";
  aiProvider: "free_default" | "byok";
  aiModel: "gemma-3" | "llama-4-scout" | "gpt-4.1-mini";
  aiPrivacyAcknowledged: boolean;
  aiFeatureChat: boolean;
  aiFeatureLeetCodeHints: boolean;
  aiFeatureReadingExplainer: boolean;
  aiFeatureCalendarPlanner: boolean;
  aiFeatureFlashcardGenerator: boolean;
  notificationsEnabled: boolean;
  dailyDigestEnabled: boolean;
  dailyDigestTime: string;
  eventRemindersEnabled: boolean;
  reviewRemindersEnabled: boolean;
  reviewReminderTime: string;
  streakRemindersEnabled: boolean;
  streakReminderTime: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  themePreference: ThemePreference;
  accentColor: string;
  leetCodeUsername: string;
  aiApiKey: string;
  aiApiKeyEncrypted?: string;
  aiByokRequirePassphrase?: boolean;
  aiByokPassphraseHash?: string;
  leetCodeGoal: number;
}

export interface LeetCodeSyncMetadata {
  status: "disconnected" | "idle" | "syncing" | "success" | "error";
  method: "none" | "graphql" | "scrape" | "manual";
  lastSyncAt?: string;
  lastImportedCount?: number;
  lastMergedCount?: number;
  lastCreatedCount?: number;
  scrapeSolvedCount?: number;
  consecutiveFailures: number;
  lastError?: string;
  lastAttemptMethods: ("graphql" | "scrape" | "manual")[];
  activeStep?: "graphql" | "scrape" | "manual";
}

export interface SyncHistoryEntry {
  at: string;
  method: "graphql" | "scrape" | "manual";
  status: "success" | "error";
  importedCount?: number;
  createdCount?: number;
  mergedCount?: number;
  invalidCount?: number;
  message?: string;
}

export interface AppDataSnapshot {
  problems: LeetCodeProblem[];
  books: Book[];
  knowledgePoints?: KnowledgePoint[];
  notes?: Note[];
  events: CalendarEvent[];
  groups: StudyGroup[];
  settings: UserSettings;
  leetCodeSyncMetadata: LeetCodeSyncMetadata;
  topicNotes?: Record<string, string>;
  topicResources?: Record<string, string[]>;
  syncHistory?: SyncHistoryEntry[];
}
