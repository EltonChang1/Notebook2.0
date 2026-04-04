import { create } from "zustand";
import type {
  AppDataSnapshot,
  CalendarEvent,
  LeetCodeProblem,
  StudyGroup,
  UserSettings,
  Book,
  LeetCodeSyncMetadata,
} from "../models/domain";
import { loadSnapshot, saveSnapshot } from "../lib/db";
import {
  fetchLeetCodeScrapeSummary,
  importFromLeetCodeGraphQl,
} from "../lib/leetcode";

const defaultSettings: UserSettings = {
  aiEnabled: false,
  notificationsEnabled: false,
  themePreference: "dark",
  leetCodeUsername: "",
  aiApiKey: "",
  leetCodeGoal: 200,
};

const defaultLeetCodeSyncMetadata: LeetCodeSyncMetadata = {
  status: "disconnected",
  method: "none",
  consecutiveFailures: 0,
  lastAttemptMethods: [],
};

type SortBy =
  | "updatedAt"
  | "problemNumber"
  | "title"
  | "difficulty"
  | "status"
  | "confidence";

type UpsertProblemInput = Omit<
  LeetCodeProblem,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type ReviewResult = "good" | "shaky";

type AppState = {
  hydrated: boolean;
  problems: LeetCodeProblem[];
  books: Book[];
  events: CalendarEvent[];
  groups: StudyGroup[];
  settings: UserSettings;
  leetCodeSyncMetadata: LeetCodeSyncMetadata;
  searchQuery: string;
  topicFilter: string;
  difficultyFilter: "all" | "Easy" | "Medium" | "Hard";
  statusFilter: "all" | "Solved" | "Attempted" | "Review" | "Stuck";
  sortBy: SortBy;
  sortOrder: "asc" | "desc";
  hydrate: () => Promise<void>;
  setSearchQuery: (value: string) => void;
  setTopicFilter: (value: string) => void;
  setDifficultyFilter: (value: AppState["difficultyFilter"]) => void;
  setStatusFilter: (value: AppState["statusFilter"]) => void;
  setSortBy: (value: SortBy) => void;
  setSortOrder: (value: "asc" | "desc") => void;
  upsertProblem: (input: UpsertProblemInput) => void;
  deleteProblem: (id: string) => void;
  markReviewResult: (id: string, result: ReviewResult) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  runLeetCodeSync: () => Promise<void>;
};

const reviewSchedule = [1, 3, 7, 14, 30] as const;

function addDaysIso(baseIso: string, days: number): string {
  const date = new Date(baseIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function defaultIntervalFromConfidence(confidence: 1 | 2 | 3 | 4 | 5): number {
  if (confidence <= 1) return reviewSchedule[0];
  if (confidence === 2) return reviewSchedule[1];
  if (confidence === 3) return reviewSchedule[2];
  if (confidence === 4) return reviewSchedule[3];
  return reviewSchedule[4];
}

function nextIntervalFromCurrent(current?: number): number {
  if (!current) return reviewSchedule[0];
  const idx = reviewSchedule.findIndex((item) => item === current);
  if (idx < 0) return reviewSchedule[0];
  return reviewSchedule[Math.min(idx + 1, reviewSchedule.length - 1)];
}

function mergeAutoImportedProblem(
  current: LeetCodeProblem[],
  imported: UpsertProblemInput
): LeetCodeProblem[] {
  const now = new Date().toISOString();
  const existingByNumber = current.find(
    (item) => item.problemNumber === imported.problemNumber
  );
  if (!existingByNumber) {
    return [
      {
        id: crypto.randomUUID(),
        problemNumber: imported.problemNumber,
        title: imported.title,
        difficulty: imported.difficulty,
        topics: imported.topics,
        status: imported.status,
        dateSolved: imported.dateSolved,
        timeMinutes: imported.timeMinutes,
        approach: imported.approach,
        confidence: imported.confidence,
        solutionLink: imported.solutionLink,
        source: imported.source,
        verified: imported.verified,
        reviewIntervalDays: imported.reviewIntervalDays,
        nextReviewDate: imported.nextReviewDate,
        lastReviewedAt: imported.lastReviewedAt,
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ];
  }

  const merged: LeetCodeProblem = {
    ...existingByNumber,
    title: imported.title,
    difficulty: imported.difficulty,
    topics: imported.topics.length > 0 ? imported.topics : existingByNumber.topics,
    source: existingByNumber.source === "manual" ? "manual" : imported.source,
    verified: true,
    updatedAt: now,
    dateSolved: imported.dateSolved ?? existingByNumber.dateSolved,
  };

  return current.map((item) => (item.id === existingByNumber.id ? merged : item));
}

function toSnapshot(state: AppState): AppDataSnapshot {
  return {
    problems: state.problems,
    books: state.books,
    events: state.events,
    groups: state.groups,
    settings: state.settings,
    leetCodeSyncMetadata: state.leetCodeSyncMetadata,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  problems: [],
  books: [],
  events: [],
  groups: [],
  settings: defaultSettings,
  leetCodeSyncMetadata: defaultLeetCodeSyncMetadata,
  searchQuery: "",
  topicFilter: "",
  difficultyFilter: "all",
  statusFilter: "all",
  sortBy: "updatedAt",
  sortOrder: "desc",
  async hydrate() {
    const snapshot = await loadSnapshot();
    if (!snapshot) {
      set({ hydrated: true });
      return;
    }
    set({
      hydrated: true,
      problems: snapshot.problems,
      books: snapshot.books,
      events: snapshot.events,
      groups: snapshot.groups,
      settings: { ...defaultSettings, ...(snapshot.settings ?? {}) },
      leetCodeSyncMetadata:
        snapshot.leetCodeSyncMetadata ?? defaultLeetCodeSyncMetadata,
    });
  },
  setSearchQuery(value) {
    set({ searchQuery: value });
  },
  setTopicFilter(value) {
    set({ topicFilter: value });
  },
  setDifficultyFilter(value) {
    set({ difficultyFilter: value });
  },
  setStatusFilter(value) {
    set({ statusFilter: value });
  },
  setSortBy(value) {
    set({ sortBy: value });
  },
  setSortOrder(value) {
    set({ sortOrder: value });
  },
  upsertProblem(input) {
    const current = get();
    const now = new Date().toISOString();
    const existing = current.problems.find((item) => item.id === input.id);
    let reviewIntervalDays = existing?.reviewIntervalDays;
    let nextReviewDate = existing?.nextReviewDate;
    let lastReviewedAt = existing?.lastReviewedAt;

    if (input.status === "Solved") {
      if (input.confidence <= 3) {
        reviewIntervalDays = reviewIntervalDays ?? defaultIntervalFromConfidence(input.confidence);
        nextReviewDate = nextReviewDate ?? addDaysIso(now, reviewIntervalDays);
      } else {
        reviewIntervalDays = undefined;
        nextReviewDate = undefined;
      }
    }

    if (input.status === "Review" && !nextReviewDate) {
      reviewIntervalDays = reviewIntervalDays ?? reviewSchedule[0];
      nextReviewDate = now;
    }

    if (input.status === "Attempted" || input.status === "Stuck") {
      reviewIntervalDays = undefined;
      nextReviewDate = undefined;
      lastReviewedAt = undefined;
    }

    const nextProblem: LeetCodeProblem = {
      id: input.id ?? crypto.randomUUID(),
      problemNumber: input.problemNumber,
      title: input.title,
      difficulty: input.difficulty,
      topics: input.topics,
      status: input.status,
      dateSolved: input.dateSolved,
      timeMinutes: input.timeMinutes,
      approach: input.approach,
      confidence: input.confidence,
      solutionLink: input.solutionLink,
      source: input.source,
      verified: input.verified,
      reviewIntervalDays,
      nextReviewDate,
      lastReviewedAt,
      createdAt:
        existing?.createdAt ?? now,
      updatedAt: now,
    };

    const exists = current.problems.some((item) => item.id === nextProblem.id);
    const problems = exists
      ? current.problems.map((item) =>
          item.id === nextProblem.id ? nextProblem : item
        )
      : [nextProblem, ...current.problems];

    set({ problems });
    void saveSnapshot(toSnapshot({ ...get(), problems }));
  },
  deleteProblem(id) {
    const problems = get().problems.filter((item) => item.id !== id);
    set({ problems });
    void saveSnapshot(toSnapshot({ ...get(), problems }));
  },
  markReviewResult(id, result) {
    const now = new Date().toISOString();
    const problems = get().problems.map((problem) => {
      if (problem.id !== id) return problem;
      const interval =
        result === "shaky"
          ? reviewSchedule[0]
          : nextIntervalFromCurrent(problem.reviewIntervalDays);
      const nextProblem: LeetCodeProblem = {
        ...problem,
        status: "Solved",
        reviewIntervalDays: interval,
        nextReviewDate: addDaysIso(now, interval),
        lastReviewedAt: now,
        updatedAt: now,
      };
      return nextProblem;
    });
    set({ problems });
    void saveSnapshot(toSnapshot({ ...get(), problems }));
  },
  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    const currentSync = get().leetCodeSyncMetadata;
    let nextSync = currentSync;
    if (Object.hasOwn(patch, "leetCodeUsername")) {
      nextSync = settings.leetCodeUsername.trim()
        ? {
            ...currentSync,
            status:
              currentSync.status === "success" || currentSync.status === "error"
                ? currentSync.status
                : "idle",
            method: currentSync.method === "none" ? "graphql" : currentSync.method,
            lastError: undefined,
            lastAttemptMethods: [],
            activeStep: undefined,
          }
        : defaultLeetCodeSyncMetadata;
    }
    set({ settings, leetCodeSyncMetadata: nextSync });
    void saveSnapshot(
      toSnapshot({ ...get(), settings, leetCodeSyncMetadata: nextSync })
    );
  },
  async runLeetCodeSync() {
    const { settings, leetCodeSyncMetadata } = get();

    if (!settings.leetCodeUsername.trim()) {
      const nextSync: LeetCodeSyncMetadata = {
        ...leetCodeSyncMetadata,
        status: "error",
        method: "none",
        lastError: "Missing LeetCode username",
        consecutiveFailures: leetCodeSyncMetadata.consecutiveFailures + 1,
        lastAttemptMethods: [],
        activeStep: undefined,
      };
      set({ leetCodeSyncMetadata: nextSync });
      void saveSnapshot(toSnapshot({ ...get(), leetCodeSyncMetadata: nextSync }));
      return;
    }

    const normalizedUsername = settings.leetCodeUsername.trim().toLowerCase();
    const graphQlState: LeetCodeSyncMetadata = {
      ...leetCodeSyncMetadata,
      status: "syncing",
      method: "graphql",
      lastError: undefined,
      activeStep: "graphql",
      lastAttemptMethods: ["graphql"],
      scrapeSolvedCount: undefined,
    };
    set({ leetCodeSyncMetadata: graphQlState });
    void saveSnapshot(toSnapshot({ ...get(), leetCodeSyncMetadata: graphQlState }));
    try {
      const imported = await importFromLeetCodeGraphQl(normalizedUsername);
      let nextProblems = get().problems;
      for (const item of imported) {
        nextProblems = mergeAutoImportedProblem(nextProblems, {
          problemNumber: item.problemNumber,
          title: item.title,
          difficulty: item.difficulty,
          topics: item.topics,
          status: "Solved",
          dateSolved: item.dateSolved,
          confidence: 3,
          source: "auto_import",
          verified: true,
        });
      }
      const successState: LeetCodeSyncMetadata = {
        ...graphQlState,
        status: "success",
        method: "graphql",
        lastSyncAt: new Date().toISOString(),
        lastImportedCount: imported.length,
        consecutiveFailures: 0,
        lastError: undefined,
        activeStep: undefined,
      };
      set({ problems: nextProblems, leetCodeSyncMetadata: successState });
      void saveSnapshot(
        toSnapshot({ ...get(), problems: nextProblems, leetCodeSyncMetadata: successState })
      );
      return;
    } catch {
      const scrapeState: LeetCodeSyncMetadata = {
        ...graphQlState,
        status: "syncing",
        method: "scrape",
        activeStep: "scrape",
        lastAttemptMethods: ["graphql", "scrape"],
      };
      set({ leetCodeSyncMetadata: scrapeState });
      void saveSnapshot(toSnapshot({ ...get(), leetCodeSyncMetadata: scrapeState }));

      try {
        const scrapeSummary = await fetchLeetCodeScrapeSummary(normalizedUsername);
        const successState: LeetCodeSyncMetadata = {
          ...scrapeState,
          status: "success",
          method: "scrape",
          lastSyncAt: new Date().toISOString(),
          lastImportedCount: 0,
          scrapeSolvedCount: scrapeSummary.solvedCount ?? undefined,
          consecutiveFailures: 0,
          lastError: undefined,
          activeStep: undefined,
        };
        set({ leetCodeSyncMetadata: successState });
        void saveSnapshot(toSnapshot({ ...get(), leetCodeSyncMetadata: successState }));
        return;
      } catch {
        const manualState: LeetCodeSyncMetadata = {
          ...scrapeState,
          status: "error",
          method: "manual",
          activeStep: undefined,
          lastAttemptMethods: ["graphql", "scrape", "manual"],
          lastError:
            "GraphQL and scrape failed. Use CSV/JSON manual import flow (next step).",
          consecutiveFailures: leetCodeSyncMetadata.consecutiveFailures + 1,
        };
        set({ leetCodeSyncMetadata: manualState });
        void saveSnapshot(toSnapshot({ ...get(), leetCodeSyncMetadata: manualState }));
      }
    }
  },
}));
