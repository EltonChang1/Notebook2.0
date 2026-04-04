import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { List, type RowComponentProps } from "react-window";
import type {
  Difficulty,
  LeetCodeProblem,
  ProblemStatus,
  ThemePreference,
} from "./models/domain";
import { useAppStore } from "./store/appStore";

type NavItem = {
  to: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "🏠" },
  { to: "/leetcode", label: "LeetCode", icon: "📊" },
  { to: "/reading", label: "Reading", icon: "📚" },
  { to: "/calendar", label: "Calendar", icon: "📅" },
  { to: "/notes", label: "Notes", icon: "📝" },
  { to: "/groups", label: "Groups", icon: "👥" },
];

function PageCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <section className="card">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </section>
  );
}

function DashboardPage() {
  const problems = useAppStore((state) => state.problems);
  const settings = useAppStore((state) => state.settings);
  const syncMetadata = useAppStore((state) => state.leetCodeSyncMetadata);
  const markReviewResult = useAppStore((state) => state.markReviewResult);
  const todayKey = new Date().toISOString().slice(0, 10);
  const solvedByDay = new Set(
    problems
      .filter((item) => item.status === "Solved")
      .map((item) => (item.dateSolved ?? item.updatedAt).slice(0, 10))
  );
  let streak = 0;
  if (solvedByDay.has(todayKey)) {
    const cursor = new Date();
    while (solvedByDay.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const solvedCount = problems.filter((item) => item.status === "Solved").length;
  const reviewDue = problems
    .filter(
      (item) =>
        item.nextReviewDate &&
        item.nextReviewDate.slice(0, 10) <= todayKey &&
        (item.status === "Solved" || item.status === "Review")
    )
    .sort((a, b) => (a.nextReviewDate ?? "").localeCompare(b.nextReviewDate ?? ""));

  const solvedDates = problems
    .filter((item) => item.status === "Solved")
    .map((item) => item.dateSolved ?? item.updatedAt);

  const difficultyCounts = {
    easy: problems.filter((item) => item.status === "Solved" && item.difficulty === "Easy")
      .length,
    medium: problems.filter((item) => item.status === "Solved" && item.difficulty === "Medium")
      .length,
    hard: problems.filter((item) => item.status === "Solved" && item.difficulty === "Hard")
      .length,
  };

  return (
    <PageCard
      title="Dashboard"
      subtitle="Your daily briefing: schedule, streaks, reading progress, and quick actions."
    >
      <div className="grid">
        <article className="tile">
          <h2>LeetCode Streak</h2>
          <p>{streak} day(s)</p>
        </article>
        <article className="tile">
          <h2>Problems Due Review</h2>
          <p>{reviewDue.length} today</p>
        </article>
        <article className="tile">
          <h2>Solved Total</h2>
          <p>{solvedCount} solved</p>
        </article>
        <article className="tile">
          <h2>LeetCode Sync</h2>
          <p>
            {syncMetadata.status === "success" && syncMetadata.lastSyncAt
              ? `Last synced ${new Date(syncMetadata.lastSyncAt).toLocaleString()}`
              : `Status: ${syncMetadata.status}`}
          </p>
        </article>
        <article className="tile">
          <h2>Reading Progress</h2>
          <p>No active books yet.</p>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="tile">
          <h2>LeetCode Goal Progress</h2>
          <ProgressRing solved={solvedCount} goal={settings.leetCodeGoal} />
          <div className="difficulty-legend">
            <span className="badge badge-difficulty-easy">Easy {difficultyCounts.easy}</span>
            <span className="badge badge-difficulty-medium">Medium {difficultyCounts.medium}</span>
            <span className="badge badge-difficulty-hard">Hard {difficultyCounts.hard}</span>
          </div>
        </article>
        <article className="tile">
          <h2>12-Month Solve Heatmap</h2>
          <SolveHeatmap solvedDates={solvedDates} />
        </article>
      </div>

      <article className="tile review-queue">
        <h2>Review Queue</h2>
        {reviewDue.length === 0 ? (
          <p>No problems due today.</p>
        ) : (
          <ul>
            {reviewDue.slice(0, 8).map((problem) => (
              <li key={problem.id}>
                <div>
                  <strong>
                    #{problem.problemNumber} {problem.title}
                  </strong>
                  <small>
                    Due {problem.nextReviewDate?.slice(0, 10)} | interval{" "}
                    {problem.reviewIntervalDays ?? 1} day(s)
                  </small>
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => markReviewResult(problem.id, "good")}
                  >
                    Reviewed Good
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => markReviewResult(problem.id, "shaky")}
                  >
                    Still Shaky
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </PageCard>
  );
}

type ProblemFormState = {
  id?: string;
  problemNumber: string;
  title: string;
  difficulty: Difficulty;
  topics: string;
  status: ProblemStatus;
  dateSolved: string;
  timeMinutes: string;
  approach: string;
  confidence: "1" | "2" | "3" | "4" | "5";
  solutionLink: string;
};

const initialProblemForm: ProblemFormState = {
  problemNumber: "",
  title: "",
  difficulty: "Easy",
  topics: "",
  status: "Attempted",
  dateSolved: "",
  timeMinutes: "",
  approach: "",
  confidence: "3",
  solutionLink: "",
};

function toStatusClass(status: ProblemStatus): string {
  return status.toLowerCase();
}

function toDifficultyClass(difficulty: Difficulty): string {
  return difficulty.toLowerCase();
}

function ProgressRing({ solved, goal }: { solved: number; goal: number }) {
  const safeGoal = Math.max(goal, 1);
  const percent = Math.min(100, Math.round((solved / safeGoal) * 100));

  return (
    <div className="progress-ring-wrap">
      <div
        className="progress-ring"
        style={{
          background: `conic-gradient(var(--accent) ${percent}%, var(--bg-primary) ${percent}% 100%)`,
        }}
      >
        <div className="progress-ring-inner">
          <strong>{percent}%</strong>
          <small>
            {solved}/{safeGoal}
          </small>
        </div>
      </div>
    </div>
  );
}

function SolveHeatmap({ solvedDates }: { solvedDates: string[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const value of solvedDates) {
      const key = value.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [solvedDates]);

  const tiles = useMemo(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 364);
    const result: { key: string; level: number; label: string }[] = [];
    for (let i = 0; i < 365; i += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const key = current.toISOString().slice(0, 10);
      const count = counts.get(key) ?? 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
      result.push({ key, level, label: `${key}: ${count} solved` });
    }
    return result;
  }, [counts]);

  return (
    <div className="heatmap">
      {tiles.map((tile) => (
        <span
          key={tile.key}
          className={`heatmap-cell heatmap-level-${tile.level}`}
          title={tile.label}
        />
      ))}
    </div>
  );
}

type VirtualRowData = {
  problems: LeetCodeProblem[];
  topicFilter: string;
  onSelectTopic: (topic: string) => void;
  onEdit: (problem: LeetCodeProblem) => void;
  onDelete: (id: string) => void;
};

function VirtualProblemRow({
  index,
  style,
  problems,
  topicFilter,
  onSelectTopic,
  onEdit,
  onDelete,
}: RowComponentProps<VirtualRowData>) {
  const problem = problems[index];
  const rowStyle: CSSProperties = {
    ...style,
    width: "100%",
  };

  return (
    <div className="problem-row problem-grid" style={rowStyle}>
      <div className="problem-cell">{problem.problemNumber}</div>
      <div className="problem-cell">{problem.title}</div>
      <div className="problem-cell">
        <span className={`badge badge-difficulty-${toDifficultyClass(problem.difficulty)}`}>
          {problem.difficulty}
        </span>
      </div>
      <div className="problem-cell">
        <span className={`badge badge-status-${toStatusClass(problem.status)}`}>
          {problem.status}
        </span>
      </div>
      <div className="problem-cell">
        <div className="chip-list chip-list-inline">
          {problem.topics.length === 0 && <span>-</span>}
          {problem.topics.slice(0, 3).map((topic) => (
            <button
              key={`${problem.id}-${topic}`}
              type="button"
              className={`topic-chip${topicFilter === topic ? " topic-chip-active" : ""}`}
              onClick={() => onSelectTopic(topic)}
            >
              {topic}
            </button>
          ))}
          {problem.topics.length > 3 && (
            <span className="more-topics">+{problem.topics.length - 3}</span>
          )}
        </div>
      </div>
      <div className="problem-cell">{problem.confidence}</div>
      <div className="problem-cell">{new Date(problem.updatedAt).toLocaleDateString()}</div>
      <div className="problem-cell">
        <div className="inline-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => onEdit(problem)}
          >
            Edit
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={() => onDelete(problem.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ProblemEditor({
  activeProblem,
  onCancel,
}: {
  activeProblem?: LeetCodeProblem;
  onCancel: () => void;
}) {
  const upsertProblem = useAppStore((state) => state.upsertProblem);
  const [form, setForm] = useState<ProblemFormState>(() =>
    activeProblem
      ? {
          id: activeProblem.id,
          problemNumber: String(activeProblem.problemNumber),
          title: activeProblem.title,
          difficulty: activeProblem.difficulty,
          topics: activeProblem.topics.join(", "),
          status: activeProblem.status,
          dateSolved: activeProblem.dateSolved ?? "",
          timeMinutes: activeProblem.timeMinutes
            ? String(activeProblem.timeMinutes)
            : "",
          approach: activeProblem.approach ?? "",
          confidence: String(activeProblem.confidence) as ProblemFormState["confidence"],
          solutionLink: activeProblem.solutionLink ?? "",
        }
      : initialProblemForm
  );

  useEffect(() => {
    if (!activeProblem) {
      setForm(initialProblemForm);
      return;
    }
    setForm({
      id: activeProblem.id,
      problemNumber: String(activeProblem.problemNumber),
      title: activeProblem.title,
      difficulty: activeProblem.difficulty,
      topics: activeProblem.topics.join(", "),
      status: activeProblem.status,
      dateSolved: activeProblem.dateSolved ?? "",
      timeMinutes: activeProblem.timeMinutes ? String(activeProblem.timeMinutes) : "",
      approach: activeProblem.approach ?? "",
      confidence: String(activeProblem.confidence) as ProblemFormState["confidence"],
      solutionLink: activeProblem.solutionLink ?? "",
    });
  }, [activeProblem]);

  function onChange<K extends keyof ProblemFormState>(
    key: K,
    value: ProblemFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedNumber = Number(form.problemNumber);
    if (!form.title.trim() || Number.isNaN(parsedNumber)) {
      return;
    }
    upsertProblem({
      id: form.id,
      problemNumber: parsedNumber,
      title: form.title.trim(),
      difficulty: form.difficulty,
      topics: form.topics
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: form.status,
      dateSolved: form.dateSolved || undefined,
      timeMinutes: form.timeMinutes ? Number(form.timeMinutes) : undefined,
      approach: form.approach || undefined,
      confidence: Number(form.confidence) as 1 | 2 | 3 | 4 | 5,
      solutionLink: form.solutionLink || undefined,
      source: "manual",
      verified: false,
    });
    onCancel();
    setForm(initialProblemForm);
  }

  return (
    <form className="problem-form" onSubmit={onSubmit}>
      <div className="problem-form-grid">
        <label>
          <span>Problem #</span>
          <input
            value={form.problemNumber}
            onChange={(event) => onChange("problemNumber", event.target.value)}
            required
          />
        </label>
        <label>
          <span>Title</span>
          <input
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            required
          />
        </label>
        <label>
          <span>Difficulty</span>
          <select
            value={form.difficulty}
            onChange={(event) =>
              onChange("difficulty", event.target.value as Difficulty)
            }
          >
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              onChange("status", event.target.value as ProblemStatus)
            }
          >
            <option>Solved</option>
            <option>Attempted</option>
            <option>Review</option>
            <option>Stuck</option>
          </select>
        </label>
        <label>
          <span>Confidence (1-5)</span>
          <select
            value={form.confidence}
            onChange={(event) =>
              onChange(
                "confidence",
                event.target.value as ProblemFormState["confidence"]
              )
            }
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>
        <label>
          <span>Date Solved</span>
          <input
            type="date"
            value={form.dateSolved}
            onChange={(event) => onChange("dateSolved", event.target.value)}
          />
        </label>
        <label>
          <span>Time (min)</span>
          <input
            type="number"
            min={1}
            value={form.timeMinutes}
            onChange={(event) => onChange("timeMinutes", event.target.value)}
          />
        </label>
        <label>
          <span>Solution Link</span>
          <input
            type="url"
            placeholder="https://..."
            value={form.solutionLink}
            onChange={(event) => onChange("solutionLink", event.target.value)}
          />
        </label>
        <label className="full-width">
          <span>Topics (comma-separated)</span>
          <input
            value={form.topics}
            placeholder="Array, Hash Table, Sliding Window"
            onChange={(event) => onChange("topics", event.target.value)}
          />
        </label>
        <label className="full-width">
          <span>Approach</span>
          <textarea
            rows={3}
            value={form.approach}
            onChange={(event) => onChange("approach", event.target.value)}
          />
        </label>
      </div>
      <div className="actions-row">
        <button type="submit">{form.id ? "Update Problem" : "Add Problem"}</button>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LeetCodePage() {
  const settings = useAppStore((state) => state.settings);
  const syncMetadata = useAppStore((state) => state.leetCodeSyncMetadata);
  const problems = useAppStore((state) => state.problems);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const topicFilter = useAppStore((state) => state.topicFilter);
  const difficultyFilter = useAppStore((state) => state.difficultyFilter);
  const statusFilter = useAppStore((state) => state.statusFilter);
  const sortBy = useAppStore((state) => state.sortBy);
  const sortOrder = useAppStore((state) => state.sortOrder);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const setTopicFilter = useAppStore((state) => state.setTopicFilter);
  const setDifficultyFilter = useAppStore((state) => state.setDifficultyFilter);
  const setStatusFilter = useAppStore((state) => state.setStatusFilter);
  const setSortBy = useAppStore((state) => state.setSortBy);
  const setSortOrder = useAppStore((state) => state.setSortOrder);
  const deleteProblem = useAppStore((state) => state.deleteProblem);
  const runLeetCodeSync = useAppStore((state) => state.runLeetCodeSync);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LeetCodeProblem | undefined>();

  const filtered = useMemo(() => {
    return problems.filter((problem) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        problem.title.toLowerCase().includes(query) ||
        String(problem.problemNumber).includes(query) ||
        problem.topics.some((topic) => topic.toLowerCase().includes(query));

      const matchesDifficulty =
        difficultyFilter === "all" || problem.difficulty === difficultyFilter;
      const matchesStatus = statusFilter === "all" || problem.status === statusFilter;
      const matchesTopic =
        topicFilter.length === 0 || problem.topics.includes(topicFilter);

      return matchesQuery && matchesDifficulty && matchesStatus && matchesTopic;
    });
  }, [problems, searchQuery, difficultyFilter, statusFilter, topicFilter]);

  const sortedFiltered = useMemo(() => {
    const rankedDifficulty: Record<Difficulty, number> = {
      Easy: 1,
      Medium: 2,
      Hard: 3,
    };
    const rankedStatus: Record<ProblemStatus, number> = {
      Attempted: 1,
      Review: 2,
      Solved: 3,
      Stuck: 4,
    };
    const sorted = [...filtered].sort((a, b) => {
      let left: number | string = 0;
      let right: number | string = 0;
      switch (sortBy) {
        case "problemNumber":
          left = a.problemNumber;
          right = b.problemNumber;
          break;
        case "title":
          left = a.title.toLowerCase();
          right = b.title.toLowerCase();
          break;
        case "difficulty":
          left = rankedDifficulty[a.difficulty];
          right = rankedDifficulty[b.difficulty];
          break;
        case "status":
          left = rankedStatus[a.status];
          right = rankedStatus[b.status];
          break;
        case "confidence":
          left = a.confidence;
          right = b.confidence;
          break;
        case "updatedAt":
        default:
          left = new Date(a.updatedAt).getTime();
          right = new Date(b.updatedAt).getTime();
          break;
      }
      if (left < right) return sortOrder === "asc" ? -1 : 1;
      if (left > right) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filtered, sortBy, sortOrder]);

  const uniqueTopics = useMemo(() => {
    const map = new Map<string, number>();
    for (const problem of problems) {
      for (const topic of problem.topics) {
        map.set(topic, (map.get(topic) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [problems]);

  const rowData = useMemo<VirtualRowData>(
    () => ({
      problems: sortedFiltered,
      topicFilter,
      onSelectTopic: setTopicFilter,
      onEdit: (problem) => {
        setEditing(problem);
        setShowForm(true);
      },
      onDelete: deleteProblem,
    }),
    [sortedFiltered, topicFilter, setTopicFilter, deleteProblem]
  );

  const listHeight = Math.min(560, Math.max(76, sortedFiltered.length * 76));

  function onHeaderSort(
    key:
      | "updatedAt"
      | "problemNumber"
      | "title"
      | "difficulty"
      | "status"
      | "confidence"
  ) {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      return;
    }
    setSortBy(key);
    setSortOrder(key === "title" ? "asc" : "desc");
  }

  return (
    <PageCard
      title="LeetCode Tracker"
      subtitle="Track solved problems, confidence, and review queue. Manual entry first, auto-sync optional."
    >
      <div className="grid">
        <article className="tile">
          <h2>Quick Add</h2>
          <p>Use the button below to create problem entries.</p>
        </article>
        <article className="tile">
          <h2>Sync Status</h2>
          <p>
            {settings.leetCodeUsername
              ? `Connected as ${settings.leetCodeUsername}`
              : "Disconnected. Add your username in Settings."}
          </p>
          <p>
            Method: {syncMetadata.method} | Status: {syncMetadata.status}
          </p>
          {typeof syncMetadata.lastImportedCount === "number" && (
            <p>Imported this run: {syncMetadata.lastImportedCount}</p>
          )}
          {typeof syncMetadata.scrapeSolvedCount === "number" && (
            <p>Scrape solved count: {syncMetadata.scrapeSolvedCount}</p>
          )}
          {syncMetadata.activeStep && <p>Active step: {syncMetadata.activeStep}</p>}
          {syncMetadata.lastAttemptMethods.length > 0 && (
            <p>Attempt chain: {syncMetadata.lastAttemptMethods.join(" -> ")}</p>
          )}
          <p>
            Last sync:{" "}
            {syncMetadata.lastSyncAt
              ? new Date(syncMetadata.lastSyncAt).toLocaleString()
              : "Never"}
          </p>
          <p>Failures: {syncMetadata.consecutiveFailures}</p>
          {syncMetadata.lastError && <p>Error: {syncMetadata.lastError}</p>}
          <div className="actions-row">
            <button
              type="button"
              disabled={syncMetadata.status === "syncing"}
              onClick={() => void runLeetCodeSync()}
            >
              Sync Now
            </button>
          </div>
        </article>
        <article className="tile">
          <h2>Total Logged</h2>
          <p>{problems.length} problems</p>
        </article>
      </div>

      <div className="actions-row">
        <button
          type="button"
          onClick={() => {
            setEditing(undefined);
            setShowForm((prev) => !prev);
          }}
        >
          {showForm ? "Hide Form" : "Add Problem"}
        </button>
      </div>

      {(showForm || editing) && (
        <ProblemEditor
          activeProblem={editing}
          onCancel={() => {
            setEditing(undefined);
            setShowForm(false);
          }}
        />
      )}

      <div className="filters-row">
        <input
          type="search"
          value={searchQuery}
          placeholder="Search by #, title, or topic"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <select
          value={difficultyFilter}
          onChange={(event) =>
            setDifficultyFilter(
              event.target.value as "all" | "Easy" | "Medium" | "Hard"
            )
          }
        >
          <option value="all">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as
                | "all"
                | "Solved"
                | "Attempted"
                | "Review"
                | "Stuck"
            )
          }
        >
          <option value="all">All Statuses</option>
          <option value="Solved">Solved</option>
          <option value="Attempted">Attempted</option>
          <option value="Review">Review</option>
          <option value="Stuck">Stuck</option>
        </select>
      </div>
      {uniqueTopics.length > 0 && (
        <div className="topic-filter-row">
          <span className="row-title">Topics:</span>
          <div className="chip-list">
            {uniqueTopics.map(([topic, count]) => (
              <button
                key={topic}
                type="button"
                className={`topic-chip${topicFilter === topic ? " topic-chip-active" : ""}`}
                onClick={() => setTopicFilter(topicFilter === topic ? "" : topic)}
              >
                {topic} ({count})
              </button>
            ))}
          </div>
        </div>
      )}
      {topicFilter && (
        <div className="active-topic-row">
          <span>
            Active topic filter: <strong>{topicFilter}</strong>
          </span>
          <button type="button" className="button-secondary" onClick={() => setTopicFilter("")}>
            Clear Topic Filter
          </button>
        </div>
      )}

      <div className="table-wrap">
        <div className="problem-grid-header problem-grid">
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("problemNumber")}
                >
                  # {sortBy === "problemNumber" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("title")}
                >
                  Title {sortBy === "title" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("difficulty")}
                >
                  Difficulty{" "}
                  {sortBy === "difficulty" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("status")}
                >
                  Status {sortBy === "status" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">Topics</div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("confidence")}
                >
                  Confidence{" "}
                  {sortBy === "confidence" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("updatedAt")}
                >
                  Updated{" "}
                  {sortBy === "updatedAt" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">Actions</div>
        </div>
        {sortedFiltered.length === 0 && (
          <div className="empty-cell standalone-empty">
            No problems found for current filters.
          </div>
        )}
        {sortedFiltered.length > 0 && (
          <List
            className="virtual-list"
            style={{ height: listHeight, width: "100%" }}
            rowCount={sortedFiltered.length}
            rowHeight={76}
            rowProps={rowData}
            rowComponent={VirtualProblemRow}
            overscanCount={8}
          />
        )}
      </div>
      <div className="pagination-row">
        <span>
          Showing {sortedFiltered.length === 0 ? 0 : 1}-{sortedFiltered.length} of{" "}
          {sortedFiltered.length}
        </span>
        <span>Virtualized rendering enabled (react-window)</span>
      </div>
    </PageCard>
  );
}

function ReadingPage() {
  return (
    <PageCard
      title="Reading Tracker"
      subtitle="Track textbooks and capture chapter-level knowledge points."
    >
      <article className="tile">
        <h2>Bookshelf</h2>
        <p>No books added yet.</p>
      </article>
    </PageCard>
  );
}

function CalendarPage() {
  return (
    <PageCard
      title="Calendar"
      subtitle="Plan classes, study blocks, LeetCode sessions, and deadlines."
    >
      <article className="tile">
        <h2>Today</h2>
        <p>No events scheduled.</p>
      </article>
    </PageCard>
  );
}

function NotesPage() {
  return (
    <PageCard
      title="Notes"
      subtitle="Quick capture and structured notes for lectures and algorithms."
    >
      <article className="tile">
        <h2>Quick Capture</h2>
        <p>Use Cmd/Ctrl + Shift + N from anywhere.</p>
      </article>
    </PageCard>
  );
}

function GroupsPage() {
  return (
    <PageCard
      title="Study Groups"
      subtitle="Create optional shared spaces for classmates and project teammates."
    >
      <article className="tile">
        <h2>Group Setup</h2>
        <p>Create your first group and invite members.</p>
      </article>
    </PageCard>
  );
}

function SettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const syncMetadata = useAppStore((state) => state.leetCodeSyncMetadata);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const runLeetCodeSync = useAppStore((state) => state.runLeetCodeSync);

  function onThemeChange(value: ThemePreference) {
    updateSettings({ themePreference: value });
  }

  return (
    <PageCard
      title="Settings"
      subtitle="Theme, notifications, AI controls, and LeetCode account linking."
    >
      <div className="settings-list">
        <label className="setting-row">
          <span>Enable AI features</span>
          <input
            type="checkbox"
            checked={settings.aiEnabled}
            onChange={(event) =>
              updateSettings({ aiEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>Enable notifications</span>
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(event) =>
              updateSettings({ notificationsEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>Theme</span>
          <select
            value={settings.themePreference}
            onChange={(event) => onThemeChange(event.target.value as ThemePreference)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="setting-row">
          <span>LeetCode Username</span>
          <input
            type="text"
            placeholder="e.g. your_handle"
            value={settings.leetCodeUsername}
            onChange={(event) =>
              updateSettings({ leetCodeUsername: event.target.value })
            }
          />
        </label>
        <label className="setting-row">
          <span>LeetCode Goal</span>
          <input
            type="number"
            min={1}
            value={settings.leetCodeGoal}
            onChange={(event) =>
              updateSettings({ leetCodeGoal: Math.max(1, Number(event.target.value || 1)) })
            }
          />
        </label>
        <div className="setting-row">
          <span>LeetCode Sync</span>
          <div className="sync-box">
            <small>
              {syncMetadata.status} via {syncMetadata.method}
            </small>
            <small>
              Last sync:{" "}
              {syncMetadata.lastSyncAt
                ? new Date(syncMetadata.lastSyncAt).toLocaleString()
                : "Never"}
            </small>
            {typeof syncMetadata.lastImportedCount === "number" && (
              <small>Imported this run: {syncMetadata.lastImportedCount}</small>
            )}
            {typeof syncMetadata.scrapeSolvedCount === "number" && (
              <small>Scrape solved count: {syncMetadata.scrapeSolvedCount}</small>
            )}
            {syncMetadata.lastAttemptMethods.length > 0 && (
              <small>Attempt chain: {syncMetadata.lastAttemptMethods.join(" -> ")}</small>
            )}
            <button
              type="button"
              disabled={syncMetadata.status === "syncing"}
              onClick={() => void runLeetCodeSync()}
            >
              Sync Now
            </button>
          </div>
        </div>
        <label className="setting-row">
          <span>AI API Key (optional)</span>
          <input
            type="password"
            placeholder="sk-..."
            value={settings.aiApiKey}
            onChange={(event) => updateSettings({ aiApiKey: event.target.value })}
          />
        </label>
      </div>
    </PageCard>
  );
}

function NotFoundPage() {
  return (
    <PageCard
      title="Page Not Found"
      subtitle="This route does not exist yet."
    />
  );
}

export default function App() {
  const { t } = useTranslation();
  const hydrated = useAppStore((state) => state.hydrated);
  const hydrate = useAppStore((state) => state.hydrate);
  const themePreference = useAppStore((state) => state.settings.themePreference);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.body.dataset.theme = themePreference;
  }, [themePreference]);

  if (!hydrated) {
    return <div className="loading-screen">Loading your workspace...</div>;
  }

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="brand">{t("appName")}</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-item${isActive ? " nav-item-active" : ""}`
              }
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-item${isActive ? " nav-item-active" : ""}`
            }
          >
            <span aria-hidden>⚙️</span>
            <span>{t("settings")}</span>
          </NavLink>
        </nav>
      </aside>

      <main className="main-layout">
        <header className="topbar">
          <input type="search" placeholder={t("searchPlaceholder")} />
          <button type="button">AI Panel</button>
        </header>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leetcode" element={<LeetCodePage />} />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
