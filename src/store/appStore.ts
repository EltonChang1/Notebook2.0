import { create } from "zustand";
import type {
  AppDataSnapshot,
  CalendarEvent,
  LeetCodeProblem,
  StudyGroup,
  UserSettings,
  Book,
  KnowledgePoint,
  Note,
  LeetCodeSyncMetadata,
  SyncHistoryEntry,
} from "../models/domain";
import { loadSnapshot, saveSnapshot } from "../lib/db";
import {
  fetchLeetCodeScrapeSummary,
  importFromLeetCodeGraphQl,
} from "../lib/leetcode";
import { previewCsvImport, type ParsedCsvProblem } from "../lib/csvImport";

const defaultSettings: UserSettings = {
  aiEnabled: false,
  notificationsEnabled: false,
  dailyDigestEnabled: true,
  dailyDigestTime: "08:00",
  eventRemindersEnabled: true,
  reviewRemindersEnabled: false,
  reviewReminderTime: "18:30",
  streakRemindersEnabled: false,
  streakReminderTime: "20:00",
  quietHoursEnabled: true,
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  themePreference: "dark",
  accentColor: "#58a6ff",
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
  knowledgePoints: KnowledgePoint[];
  notes: Note[];
  events: CalendarEvent[];
  groups: StudyGroup[];
  settings: UserSettings;
  leetCodeSyncMetadata: LeetCodeSyncMetadata;
  topicNotes: Record<string, string>;
  topicResources: Record<string, string[]>;
  syncHistory: SyncHistoryEntry[];
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
  upsertBook: (input: Omit<Book, "id" | "createdAt"> & { id?: string }) => void;
  deleteBook: (id: string) => void;
  upsertKnowledgePoint: (
    input: Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ) => void;
  deleteKnowledgePoint: (id: string) => void;
  upsertEvent: (input: Omit<CalendarEvent, "id" | "createdAt"> & { id?: string }) => void;
  deleteEvent: (id: string) => void;
  upsertNote: (input: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string }) => void;
  deleteNote: (id: string) => void;
  markKnowledgePointReviewResult: (id: string, result: ReviewResult) => void;
  markReviewResult: (id: string, result: ReviewResult) => void;
  setTopicNote: (topic: string, note: string) => void;
  setTopicResources: (topic: string, resources: string[]) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  runLeetCodeSync: () => Promise<void>;
  importParsedProblems: (
    rows: ParsedCsvProblem[],
    options?: {
      allowMergeProblemNumbers?: number[];
      invalidCount?: number;
      errorSummary?: string[];
    }
  ) => {
    importedCount: number;
    createdCount: number;
    mergedCount: number;
    invalidCount: number;
    skippedConflicts: number;
  };
  importProblemsFromCsv: (csvText: string) => {
    importedCount: number;
    createdCount: number;
    mergedCount: number;
    invalidCount: number;
    skippedConflicts: number;
    errors: string[];
  };
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
    knowledgePoints: state.knowledgePoints,
    notes: state.notes,
    events: state.events,
    groups: state.groups,
    settings: state.settings,
    leetCodeSyncMetadata: state.leetCodeSyncMetadata,
    topicNotes: state.topicNotes,
    topicResources: state.topicResources,
    syncHistory: state.syncHistory,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  problems: [],
  books: [],
  knowledgePoints: [],
  notes: [],
  events: [],
  groups: [],
  settings: defaultSettings,
  leetCodeSyncMetadata: defaultLeetCodeSyncMetadata,
  topicNotes: {},
  topicResources: {},
  syncHistory: [],
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
      knowledgePoints: snapshot.knowledgePoints ?? [],
      notes: snapshot.notes ?? [],
      events: snapshot.events,
      groups: snapshot.groups,
      settings: { ...defaultSettings, ...(snapshot.settings ?? {}) },
      leetCodeSyncMetadata:
        snapshot.leetCodeSyncMetadata ?? defaultLeetCodeSyncMetadata,
      topicNotes: snapshot.topicNotes ?? {},
      topicResources: snapshot.topicResources ?? {},
      syncHistory: snapshot.syncHistory ?? [],
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
  upsertBook(input) {
    const now = new Date().toISOString();
    const current = get().books;
    const nextBook: Book = {
      id: input.id ?? crypto.randomUUID(),
      title: input.title,
      author: input.author,
      isbn: input.isbn,
      totalChapters: input.totalChapters,
      status: input.status,
      createdAt: current.find((book) => book.id === input.id)?.createdAt ?? now,
    };
    const books = current.some((book) => book.id === nextBook.id)
      ? current.map((book) => (book.id === nextBook.id ? nextBook : book))
      : [nextBook, ...current];
    set({ books });
    void saveSnapshot(toSnapshot({ ...get(), books }));
  },
  deleteBook(id) {
    const books = get().books.filter((book) => book.id !== id);
    const knowledgePoints = get().knowledgePoints.filter((point) => point.bookId !== id);
    set({ books, knowledgePoints });
    void saveSnapshot(toSnapshot({ ...get(), books, knowledgePoints }));
  },
  upsertKnowledgePoint(input) {
    const now = new Date().toISOString();
    const current = get().knowledgePoints;
    const existing = current.find((point) => point.id === input.id);
    let reviewIntervalDays = existing?.reviewIntervalDays;
    let nextReviewDate = existing?.nextReviewDate;
    let lastReviewedAt = existing?.lastReviewedAt;

    if (input.confidence <= 3) {
      reviewIntervalDays = reviewIntervalDays ?? defaultIntervalFromConfidence(input.confidence);
      nextReviewDate = nextReviewDate ?? addDaysIso(now, reviewIntervalDays);
    } else {
      reviewIntervalDays = undefined;
      nextReviewDate = undefined;
      lastReviewedAt = undefined;
    }

    const nextPoint: KnowledgePoint = {
      id: input.id ?? crypto.randomUUID(),
      bookId: input.bookId,
      title: input.title,
      chapter: input.chapter,
      pageSection: input.pageSection,
      concept: input.concept,
      tags: input.tags,
      importance: input.importance,
      confidence: input.confidence,
      reviewIntervalDays,
      nextReviewDate,
      lastReviewedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const knowledgePoints = current.some((point) => point.id === nextPoint.id)
      ? current.map((point) => (point.id === nextPoint.id ? nextPoint : point))
      : [nextPoint, ...current];
    set({ knowledgePoints });
    void saveSnapshot(toSnapshot({ ...get(), knowledgePoints }));
  },
  deleteKnowledgePoint(id) {
    const knowledgePoints = get().knowledgePoints.filter((point) => point.id !== id);
    set({ knowledgePoints });
    void saveSnapshot(toSnapshot({ ...get(), knowledgePoints }));
  },
  upsertEvent(input) {
    const now = new Date().toISOString();
    const current = get().events;
    const existing = current.find((event) => event.id === input.id);
    const nextEvent: CalendarEvent = {
      id: input.id ?? crypto.randomUUID(),
      title: input.title,
      type: input.type,
      startTime: input.startTime,
      endTime: input.endTime,
      recurrence: input.recurrence ?? "none",
      recurrenceUntil: input.recurrenceUntil,
      reminderMinutesBefore: input.reminderMinutesBefore,
      description: input.description,
      linkedModule: input.linkedModule,
      linkedItemId: input.linkedItemId,
      groupId: input.groupId,
      createdAt: existing?.createdAt ?? now,
    };
    const events = current.some((event) => event.id === nextEvent.id)
      ? current.map((event) => (event.id === nextEvent.id ? nextEvent : event))
      : [nextEvent, ...current];
    set({ events });
    void saveSnapshot(toSnapshot({ ...get(), events }));
  },
  deleteEvent(id) {
    const events = get().events.filter((event) => event.id !== id);
    set({ events });
    void saveSnapshot(toSnapshot({ ...get(), events }));
  },
  upsertNote(input) {
    const now = new Date().toISOString();
    const current = get().notes;
    const existing = current.find((note) => note.id === input.id);
    const nextNote: Note = {
      id: input.id ?? crypto.randomUUID(),
      title: input.title,
      template: input.template,
      content: input.content,
      tags: input.tags,
      linkedModule: input.linkedModule,
      linkedItemId: input.linkedItemId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const notes = current.some((note) => note.id === nextNote.id)
      ? current.map((note) => (note.id === nextNote.id ? nextNote : note))
      : [nextNote, ...current];
    set({ notes });
    void saveSnapshot(toSnapshot({ ...get(), notes }));
  },
  deleteNote(id) {
    const notes = get().notes.filter((note) => note.id !== id);
    set({ notes });
    void saveSnapshot(toSnapshot({ ...get(), notes }));
  },
  markKnowledgePointReviewResult(id, result) {
    const now = new Date().toISOString();
    const knowledgePoints = get().knowledgePoints.map((point) => {
      if (point.id !== id) return point;
      const interval =
        result === "shaky"
          ? reviewSchedule[0]
          : nextIntervalFromCurrent(point.reviewIntervalDays);
      return {
        ...point,
        reviewIntervalDays: interval,
        nextReviewDate: addDaysIso(now, interval),
        lastReviewedAt: now,
        updatedAt: now,
      };
    });
    set({ knowledgePoints });
    void saveSnapshot(toSnapshot({ ...get(), knowledgePoints }));
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
  setTopicNote(topic, note) {
    const topicNotes = { ...get().topicNotes, [topic]: note };
    set({ topicNotes });
    void saveSnapshot(toSnapshot({ ...get(), topicNotes }));
  },
  setTopicResources(topic, resources) {
    const topicResources = { ...get().topicResources, [topic]: resources };
    set({ topicResources });
    void saveSnapshot(toSnapshot({ ...get(), topicResources }));
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
      let createdCount = 0;
      let mergedCount = 0;
      for (const item of imported) {
        const alreadyExists = nextProblems.some(
          (problem) => problem.problemNumber === item.problemNumber
        );
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
        if (alreadyExists) {
          mergedCount += 1;
        } else {
          createdCount += 1;
        }
      }
      const successState: LeetCodeSyncMetadata = {
        ...graphQlState,
        status: "success",
        method: "graphql",
        lastSyncAt: new Date().toISOString(),
        lastImportedCount: imported.length,
        lastCreatedCount: createdCount,
        lastMergedCount: mergedCount,
        consecutiveFailures: 0,
        lastError: undefined,
        activeStep: undefined,
      };
      const historyEntry: SyncHistoryEntry = {
        at: successState.lastSyncAt ?? new Date().toISOString(),
        method: "graphql",
        status: "success",
        importedCount: imported.length,
        createdCount,
        mergedCount,
      };
      const syncHistory = [historyEntry, ...get().syncHistory].slice(0, 20);
      set({ problems: nextProblems, leetCodeSyncMetadata: successState, syncHistory });
      void saveSnapshot(
        toSnapshot({
          ...get(),
          problems: nextProblems,
          leetCodeSyncMetadata: successState,
          syncHistory,
        })
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
          lastCreatedCount: 0,
          lastMergedCount: 0,
          scrapeSolvedCount: scrapeSummary.solvedCount ?? undefined,
          consecutiveFailures: 0,
          lastError: undefined,
          activeStep: undefined,
        };
        const historyEntry: SyncHistoryEntry = {
          at: successState.lastSyncAt ?? new Date().toISOString(),
          method: "scrape",
          status: "success",
          importedCount: 0,
          createdCount: 0,
          mergedCount: 0,
          message: "Scrape fallback summary only",
        };
        const syncHistory = [historyEntry, ...get().syncHistory].slice(0, 20);
        set({ leetCodeSyncMetadata: successState, syncHistory });
        void saveSnapshot(toSnapshot({ ...get(), leetCodeSyncMetadata: successState, syncHistory }));
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
        const historyEntry: SyncHistoryEntry = {
          at: new Date().toISOString(),
          method: "manual",
          status: "error",
          message: manualState.lastError,
        };
        const syncHistory = [historyEntry, ...get().syncHistory].slice(0, 20);
        set({ leetCodeSyncMetadata: manualState, syncHistory });
        void saveSnapshot(toSnapshot({ ...get(), leetCodeSyncMetadata: manualState, syncHistory }));
      }
    }
  },
  importParsedProblems(rows, options) {
    const allowMergeSet = new Set(options?.allowMergeProblemNumbers ?? []);
    const mergeAll = !options?.allowMergeProblemNumbers;
    let nextProblems = get().problems;
    let importedCount = 0;
    let createdCount = 0;
    let mergedCount = 0;
    let skippedConflicts = 0;

    for (const row of rows) {
      const alreadyExists = nextProblems.some(
        (problem) => problem.problemNumber === row.problemNumber
      );
      if (alreadyExists && !mergeAll && !allowMergeSet.has(row.problemNumber)) {
        skippedConflicts += 1;
        continue;
      }

      nextProblems = mergeAutoImportedProblem(nextProblems, {
        problemNumber: row.problemNumber,
        title: row.title,
        difficulty: row.difficulty,
        topics: row.topics,
        status: "Solved",
        confidence: 3,
        source: "manual",
        verified: false,
        dateSolved: row.dateSolved ?? new Date().toISOString(),
      });
      importedCount += 1;
      if (alreadyExists) {
        mergedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    const invalidCount = options?.invalidCount ?? 0;
    const nextSync: LeetCodeSyncMetadata = {
      ...get().leetCodeSyncMetadata,
      status: "success",
      method: "manual",
      activeStep: undefined,
      lastAttemptMethods: [...get().leetCodeSyncMetadata.lastAttemptMethods, "manual"],
      lastSyncAt: new Date().toISOString(),
      lastImportedCount: importedCount,
      lastCreatedCount: createdCount,
      lastMergedCount: mergedCount,
      lastError:
        invalidCount > 0 || skippedConflicts > 0
          ? `Imported with ${invalidCount} invalid row(s) and ${skippedConflicts} skipped conflict(s).`
          : undefined,
    };
    const messageParts: string[] = [];
    if (options?.errorSummary?.length) {
      messageParts.push(options.errorSummary.join("; "));
    }
    if (skippedConflicts > 0) {
      messageParts.push(`${skippedConflicts} conflict row(s) skipped by reviewer`);
    }
    const historyEntry: SyncHistoryEntry = {
      at: nextSync.lastSyncAt ?? new Date().toISOString(),
      method: "manual",
      status: "success",
      importedCount,
      createdCount,
      mergedCount,
      invalidCount,
      message: messageParts.length ? messageParts.join(" | ") : "Manual import successful",
    };
    const syncHistory = [historyEntry, ...get().syncHistory].slice(0, 20);

    set({ problems: nextProblems, leetCodeSyncMetadata: nextSync, syncHistory });
    void saveSnapshot(
      toSnapshot({
        ...get(),
        problems: nextProblems,
        leetCodeSyncMetadata: nextSync,
        syncHistory,
      })
    );
    return { importedCount, createdCount, mergedCount, invalidCount, skippedConflicts };
  },
  importProblemsFromCsv(csvText) {
    const preview = previewCsvImport(csvText, get().problems);
    const result = get().importParsedProblems(preview.validRows, {
      invalidCount: preview.invalidRows.length,
      errorSummary: preview.invalidRows.slice(0, 2).map((row) => `L${row.line}: ${row.reason}`),
    });
    return {
      importedCount: result.importedCount,
      createdCount: result.createdCount,
      mergedCount: result.mergedCount,
      invalidCount: result.invalidCount,
      skippedConflicts: result.skippedConflicts,
      errors: preview.invalidRows.slice(0, 5).map((row) => `L${row.line}: ${row.reason}`),
    };
  },
}));
