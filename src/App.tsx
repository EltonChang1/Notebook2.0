import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { List, type RowComponentProps } from "react-window";
import type {
  BookStatus,
  CalendarEvent,
  Difficulty,
  EventType,
  Importance,
  LeetCodeProblem,
  NoteTemplate,
  ProblemStatus,
  ThemePreference,
} from "./models/domain";
import { useAppStore } from "./store/appStore";
import { buildCsvTemplate, previewCsvImport } from "./lib/csvImport";

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

type TopicRadarDatum = {
  topic: string;
  score: number;
  solvedCount: number;
};

function TopicRadar({ data }: { data: TopicRadarDatum[] }) {
  if (data.length < 3) {
    return (
      <div className="topic-radar-empty">
        Add solved problems with topics to unlock radar analytics.
      </div>
    );
  }

  const cx = 120;
  const cy = 120;
  const radius = 88;
  const angleStep = (Math.PI * 2) / data.length;
  const levels = [0.25, 0.5, 0.75, 1];
  const points = data.map((item, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const scoreScale = Math.max(0.05, item.score / 100);
    return {
      x: cx + Math.cos(angle) * radius * scoreScale,
      y: cy + Math.sin(angle) * radius * scoreScale,
      labelX: cx + Math.cos(angle) * (radius + 20),
      labelY: cy + Math.sin(angle) * (radius + 20),
      topic: item.topic,
      score: item.score,
    };
  });
  const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="topic-radar">
      <svg viewBox="0 0 240 240" role="img" aria-label="Topic proficiency radar chart">
        {levels.map((level) => (
          <circle
            key={level}
            cx={cx}
            cy={cy}
            r={radius * level}
            fill="none"
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
        ))}
        {points.map((point) => (
          <line
            key={`axis-${point.topic}`}
            x1={cx}
            y1={cy}
            x2={point.labelX}
            y2={point.labelY}
            stroke="var(--border)"
          />
        ))}
        <polygon
          points={polygonPoints}
          fill="color-mix(in srgb, var(--accent) 20%, transparent)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        {points.map((point) => (
          <g key={`label-${point.topic}`}>
            <circle cx={point.x} cy={point.y} r="3" fill="var(--accent)" />
            <text
              x={point.labelX}
              y={point.labelY}
              textAnchor={point.labelX < cx ? "end" : "start"}
              dominantBaseline="middle"
              className="topic-radar-label"
            >
              {point.topic}
            </text>
          </g>
        ))}
      </svg>
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

type ConflictFieldKey = "title" | "difficulty" | "topics" | "dateSolved";
type ConflictFieldSelection = Record<
  number,
  Record<ConflictFieldKey, boolean>
>;

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
  const navigate = useNavigate();
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
  const importParsedProblems = useAppStore((state) => state.importParsedProblems);
  const syncHistory = useAppStore((state) => state.syncHistory);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LeetCodeProblem | undefined>();
  const [csvImportText, setCsvImportText] = useState("");
  const [csvImportMessage, setCsvImportMessage] = useState("");
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [allowedConflictNumbers, setAllowedConflictNumbers] = useState<number[]>([]);
  const [conflictFieldSelection, setConflictFieldSelection] =
    useState<ConflictFieldSelection>({});

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

  const topicRadarData = useMemo(() => {
    const solvedOnly = problems.filter((item) => item.status === "Solved");
    const aggregate = new Map<
      string,
      { solvedCount: number; confidenceTotal: number; appearances: number }
    >();
    for (const problem of solvedOnly) {
      for (const topic of problem.topics) {
        const current = aggregate.get(topic) ?? {
          solvedCount: 0,
          confidenceTotal: 0,
          appearances: 0,
        };
        current.solvedCount += 1;
        current.confidenceTotal += problem.confidence;
        current.appearances += 1;
        aggregate.set(topic, current);
      }
    }
    return [...aggregate.entries()]
      .map(([topic, stats]) => {
        const confidenceAvg = stats.confidenceTotal / Math.max(1, stats.appearances);
        const score = Math.min(100, Math.round(stats.solvedCount * 8 * (confidenceAvg / 5)));
        return {
          topic,
          solvedCount: stats.solvedCount,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
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
  const csvPreview = useMemo(
    () => previewCsvImport(csvImportText, problems),
    [csvImportText, problems]
  );
  const csvConflicts = useMemo(() => {
    return csvPreview.validRows
      .map((row) => {
        const existing = problems.find((problem) => problem.problemNumber === row.problemNumber);
        if (!existing) return null;
        const changes: Array<{ field: ConflictFieldKey; oldValue: string; newValue: string }> =
          [];
        if (existing.title !== row.title) {
          changes.push({ field: "title", oldValue: existing.title, newValue: row.title });
        }
        if (existing.difficulty !== row.difficulty) {
          changes.push({
            field: "difficulty",
            oldValue: existing.difficulty,
            newValue: row.difficulty,
          });
        }
        if (existing.topics.join("|") !== row.topics.join("|")) {
          changes.push({
            field: "topics",
            oldValue: existing.topics.join(", ") || "-",
            newValue: row.topics.join(", ") || "-",
          });
        }
        if ((existing.dateSolved ?? "").slice(0, 10) !== (row.dateSolved ?? "").slice(0, 10)) {
          changes.push({
            field: "dateSolved",
            oldValue: (existing.dateSolved ?? "").slice(0, 10) || "-",
            newValue: (row.dateSolved ?? "").slice(0, 10) || "-",
          });
        }
        return {
          row,
          existing,
          changes,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
  }, [csvPreview.validRows, problems]);
  const selectedConflictCount = allowedConflictNumbers.length;
  const rejectedConflictCount = Math.max(0, csvConflicts.length - selectedConflictCount);

  useEffect(() => {
    setAllowedConflictNumbers(csvConflicts.map((entry) => entry.row.problemNumber));
    setConflictFieldSelection((prev) => {
      const next: ConflictFieldSelection = { ...prev };
      for (const entry of csvConflicts) {
        if (!next[entry.row.problemNumber]) {
          next[entry.row.problemNumber] = {
            title: true,
            difficulty: true,
            topics: true,
            dateSolved: true,
          };
        }
      }
      return next;
    });
  }, [csvImportText, csvConflicts]);

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
          {typeof syncMetadata.lastCreatedCount === "number" && (
            <p>Created: {syncMetadata.lastCreatedCount}</p>
          )}
          {typeof syncMetadata.lastMergedCount === "number" && (
            <p>Merged: {syncMetadata.lastMergedCount}</p>
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
          <div className="csv-import-box">
            <small>Manual CSV fallback (problemNumber,title,difficulty,topics|pipe,optionalDate)</small>
            <textarea
              rows={3}
              value={csvImportText}
              placeholder={"1,Two Sum,Easy,Array|Hash Table,2026-04-01"}
              onChange={(event) => setCsvImportText(event.target.value)}
            />
            <div className="inline-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowCsvPreview((prev) => !prev)}
              >
                {showCsvPreview ? "Hide Preview" : "Preview CSV"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  const rowsForImport = csvPreview.validRows.map((row) => {
                    const conflict = csvConflicts.find(
                      (entry) => entry.row.problemNumber === row.problemNumber
                    );
                    if (!conflict) return row;
                    const fields = conflictFieldSelection[row.problemNumber] ?? {
                      title: true,
                      difficulty: true,
                      topics: true,
                      dateSolved: true,
                    };
                    return {
                      ...row,
                      title: fields.title ? row.title : conflict.existing.title,
                      difficulty: fields.difficulty
                        ? row.difficulty
                        : conflict.existing.difficulty,
                      topics: fields.topics ? row.topics : conflict.existing.topics,
                      dateSolved: fields.dateSolved
                        ? row.dateSolved
                        : conflict.existing.dateSolved,
                    };
                  });

                  const result = importParsedProblems(rowsForImport, {
                    allowMergeProblemNumbers: allowedConflictNumbers,
                    invalidCount: csvPreview.invalidRows.length,
                    errorSummary: csvPreview.invalidRows
                      .slice(0, 3)
                      .map((row) => `L${row.line}: ${row.reason}`),
                  });
                  setCsvImportMessage(
                    `Imported ${result.importedCount} row(s): ${result.createdCount} created, ${result.mergedCount} merged, ${result.invalidCount} invalid, ${result.skippedConflicts} skipped conflicts.`
                  );
                }}
              >
                Import CSV Text
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  const template = buildCsvTemplate();
                  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "leetcode-import-template.csv";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download Template
              </button>
              {csvConflicts.length > 0 && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    const report = {
                      generatedAt: new Date().toISOString(),
                      totalConflicts: csvConflicts.length,
                      selectedConflicts: allowedConflictNumbers.length,
                      conflicts: csvConflicts.map((entry) => ({
                        problemNumber: entry.row.problemNumber,
                        selected: allowedConflictNumbers.includes(entry.row.problemNumber),
                        fieldSelection: conflictFieldSelection[entry.row.problemNumber],
                        changes: entry.changes,
                      })),
                    };
                    const blob = new Blob([JSON.stringify(report, null, 2)], {
                      type: "application/json;charset=utf-8;",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "leetcode-conflict-report.json";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download Conflict Report
                </button>
              )}
              {csvConflicts.length > 0 && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    const lines = [
                      "problemNumber,selected,field,oldValue,newValue,useIncoming",
                    ];
                    for (const entry of csvConflicts) {
                      const selected = allowedConflictNumbers.includes(entry.row.problemNumber);
                      const fieldConfig = conflictFieldSelection[entry.row.problemNumber] ?? {
                        title: true,
                        difficulty: true,
                        topics: true,
                        dateSolved: true,
                      };
                      for (const change of entry.changes) {
                        const escapedOld = `"${change.oldValue.replaceAll("\"", "\"\"")}"`;
                        const escapedNew = `"${change.newValue.replaceAll("\"", "\"\"")}"`;
                        lines.push(
                          [
                            entry.row.problemNumber,
                            selected ? "yes" : "no",
                            change.field,
                            escapedOld,
                            escapedNew,
                            fieldConfig[change.field] ? "yes" : "no",
                          ].join(",")
                        );
                      }
                    }
                    const blob = new Blob([lines.join("\n")], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "leetcode-conflict-report.csv";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download Conflict CSV
                </button>
              )}
            </div>
            {csvImportMessage && <small>{csvImportMessage}</small>}
            {showCsvPreview && (
              <div className="csv-preview">
                <small>
                  Preview: {csvPreview.validRows.length} valid, {csvPreview.invalidRows.length} invalid,{" "}
                  {csvPreview.createdCount} new, {csvPreview.mergedCount} merge.
                </small>
                {csvPreview.invalidRows.slice(0, 5).map((row) => (
                  <small key={`${row.line}-${row.reason}`}>{`L${row.line}: ${row.reason}`}</small>
                ))}
                {csvConflicts.length > 0 && (
                  <div className="conflict-review-panel">
                    <div className="conflict-review-header">
                      <strong>Conflict Review ({csvConflicts.length})</strong>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() =>
                            setAllowedConflictNumbers(
                              csvConflicts.map((entry) => entry.row.problemNumber)
                            )
                          }
                        >
                          Apply All
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => setAllowedConflictNumbers([])}
                        >
                          Reject All
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() =>
                            setConflictFieldSelection(
                              Object.fromEntries(
                                csvConflicts.map((entry) => [
                                  entry.row.problemNumber,
                                  {
                                    title: true,
                                    difficulty: true,
                                    topics: true,
                                    dateSolved: true,
                                  },
                                ])
                              )
                            )
                          }
                        >
                          Reset Field Selections
                        </button>
                      </div>
                    </div>
                    <div className="conflict-summary-chips">
                      <span className="summary-chip">Selected: {selectedConflictCount}</span>
                      <span className="summary-chip">Rejected: {rejectedConflictCount}</span>
                    </div>
                    <small>
                      Selected merges: {allowedConflictNumbers.length}/{csvConflicts.length}
                    </small>
                    {csvConflicts.map((entry) => {
                      const checked = allowedConflictNumbers.includes(entry.row.problemNumber);
                      const fieldConfig = conflictFieldSelection[entry.row.problemNumber] ?? {
                        title: true,
                        difficulty: true,
                        topics: true,
                        dateSolved: true,
                      };
                      return (
                        <div key={`conflict-${entry.row.problemNumber}`} className="conflict-row-detailed">
                          <label className="conflict-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setAllowedConflictNumbers((prev) =>
                                  event.target.checked
                                    ? [...new Set([...prev, entry.row.problemNumber])]
                                    : prev.filter((id) => id !== entry.row.problemNumber)
                                )
                              }
                            />
                            <span>
                              #{entry.row.problemNumber} {entry.existing.title}
                            </span>
                          </label>
                          <div className="conflict-diff-table">
                            <div className="conflict-diff-head">Field</div>
                            <div className="conflict-diff-head">Use Incoming</div>
                            <div className="conflict-diff-head">Current</div>
                            <div className="conflict-diff-head">Incoming</div>
                            {entry.changes.map((change) => (
                              <div
                                key={`${entry.row.problemNumber}-${change.field}`}
                                className="conflict-diff-row"
                              >
                                <div>{change.field}</div>
                                <div>
                                  <input
                                    type="checkbox"
                                    checked={fieldConfig[change.field]}
                                    onChange={(event) =>
                                      setConflictFieldSelection((prev) => ({
                                        ...prev,
                                        [entry.row.problemNumber]: {
                                          ...fieldConfig,
                                          [change.field]: event.target.checked,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div>{change.oldValue}</div>
                                <div>{change.newValue}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </article>
        <article className="tile">
          <h2>Total Logged</h2>
          <p>{problems.length} problems</p>
        </article>
      </div>

      <article className="tile topic-radar-section">
        <h2>Topic Proficiency Radar</h2>
        <p>Top topics based on solved volume and confidence.</p>
        <div className="topic-radar-layout">
          <TopicRadar data={topicRadarData} />
          <div className="topic-radar-list">
            {topicRadarData.map((item) => (
              <div key={item.topic} className="topic-radar-row">
                <strong>{item.topic}</strong>
                <span>{item.solvedCount} solved</span>
                <span>score {item.score}</span>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => navigate(`/leetcode/topic/${encodeURIComponent(item.topic)}`)}
                >
                  Deep Dive
                </button>
              </div>
            ))}
            {topicRadarData.length === 0 && (
              <p>No solved topic data yet. Solve some tagged problems first.</p>
            )}
          </div>
        </div>
      </article>

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
          <div className="inline-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => navigate(`/leetcode/topic/${encodeURIComponent(topicFilter)}`)}
            >
              Open Topic Page
            </button>
            <button type="button" className="button-secondary" onClick={() => setTopicFilter("")}>
              Clear Topic Filter
            </button>
          </div>
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
      <article className="tile import-history-panel">
        <h2>Import & Sync History</h2>
        {syncHistory.length === 0 ? (
          <p>No import history yet.</p>
        ) : (
          <ul>
            {syncHistory.slice(0, 8).map((entry, index) => (
              <li key={`${entry.at}-${entry.method}-${index}`}>
                <strong>
                  {entry.method.toUpperCase()} {entry.status.toUpperCase()}
                </strong>
                <span>{new Date(entry.at).toLocaleString()}</span>
                <span>
                  imported {entry.importedCount ?? 0}, created {entry.createdCount ?? 0}, merged{" "}
                  {entry.mergedCount ?? 0}
                  {typeof entry.invalidCount === "number" ? `, invalid ${entry.invalidCount}` : ""}
                </span>
                {entry.message && <small>{entry.message}</small>}
              </li>
            ))}
          </ul>
        )}
      </article>
    </PageCard>
  );
}

function TopicDeepDivePage() {
  const params = useParams();
  const navigate = useNavigate();
  const topicName = decodeURIComponent(params.topicName ?? "");
  const problems = useAppStore((state) => state.problems);
  const topicNotes = useAppStore((state) => state.topicNotes);
  const topicResources = useAppStore((state) => state.topicResources);
  const setTopicNote = useAppStore((state) => state.setTopicNote);
  const setTopicResources = useAppStore((state) => state.setTopicResources);
  const [resourcesDraft, setResourcesDraft] = useState(
    (topicResources[topicName] ?? []).join("\n")
  );

  useEffect(() => {
    setResourcesDraft((topicResources[topicName] ?? []).join("\n"));
  }, [topicName, topicResources]);

  const topicProblems = useMemo(
    () => problems.filter((problem) => problem.topics.includes(topicName)),
    [problems, topicName]
  );

  const solvedCount = topicProblems.filter((problem) => problem.status === "Solved").length;
  const completion = topicProblems.length
    ? Math.round((solvedCount / topicProblems.length) * 100)
    : 0;

  const byDifficulty = useMemo(
    () => ({
      easy: topicProblems.filter((problem) => problem.difficulty === "Easy").length,
      medium: topicProblems.filter((problem) => problem.difficulty === "Medium").length,
      hard: topicProblems.filter((problem) => problem.difficulty === "Hard").length,
    }),
    [topicProblems]
  );

  const byStatus = useMemo(
    () => ({
      solved: topicProblems.filter((problem) => problem.status === "Solved").length,
      attempted: topicProblems.filter((problem) => problem.status === "Attempted").length,
      review: topicProblems.filter((problem) => problem.status === "Review").length,
      stuck: topicProblems.filter((problem) => problem.status === "Stuck").length,
    }),
    [topicProblems]
  );

  return (
    <PageCard
      title={`Topic Deep Dive: ${topicName}`}
      subtitle="Topic-specific progress, problem patterns, notes, and resources."
    >
      <div className="inline-actions">
        <button type="button" className="button-secondary" onClick={() => navigate("/leetcode")}>
          Back to LeetCode
        </button>
      </div>
      <div className="grid">
        <article className="tile">
          <h2>Completion</h2>
          <p>
            {solvedCount}/{topicProblems.length} solved ({completion}%)
          </p>
        </article>
        <article className="tile">
          <h2>Difficulty Mix</h2>
          <p>
            Easy {byDifficulty.easy} | Medium {byDifficulty.medium} | Hard {byDifficulty.hard}
          </p>
        </article>
        <article className="tile">
          <h2>Status Breakdown</h2>
          <p>
            Solved {byStatus.solved} | Attempted {byStatus.attempted} | Review {byStatus.review} |
            Stuck {byStatus.stuck}
          </p>
        </article>
      </div>

      <article className="tile topic-notes-panel">
        <h2>Personal Notes</h2>
        <textarea
          rows={5}
          placeholder={`Write your ${topicName} pattern notes...`}
          value={topicNotes[topicName] ?? ""}
          onChange={(event) => setTopicNote(topicName, event.target.value)}
        />
      </article>

      <article className="tile topic-notes-panel">
        <h2>Curated Resource Links</h2>
        <textarea
          rows={4}
          placeholder={"One URL per line"}
          value={resourcesDraft}
          onChange={(event) => setResourcesDraft(event.target.value)}
        />
        <div className="inline-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              setTopicResources(
                topicName,
                resourcesDraft
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
              )
            }
          >
            Save Resources
          </button>
        </div>
      </article>

      <div className="table-wrap">
        <div className="problem-grid-header problem-grid">
          <div className="problem-cell">#</div>
          <div className="problem-cell">Title</div>
          <div className="problem-cell">Difficulty</div>
          <div className="problem-cell">Status</div>
          <div className="problem-cell">Topics</div>
          <div className="problem-cell">Confidence</div>
          <div className="problem-cell">Updated</div>
          <div className="problem-cell">Source</div>
        </div>
        {topicProblems.length === 0 && (
          <div className="empty-cell standalone-empty">No problems logged for this topic yet.</div>
        )}
        {topicProblems.map((problem) => (
          <div key={problem.id} className="problem-row problem-grid">
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
                {problem.topics.map((topic) => (
                  <span key={`${problem.id}-${topic}`} className="topic-chip">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div className="problem-cell">{problem.confidence}</div>
            <div className="problem-cell">{new Date(problem.updatedAt).toLocaleDateString()}</div>
            <div className="problem-cell">{problem.source}</div>
          </div>
        ))}
      </div>
    </PageCard>
  );
}

function ReadingPage() {
  const books = useAppStore((state) => state.books);
  const knowledgePoints = useAppStore((state) => state.knowledgePoints);
  const upsertBook = useAppStore((state) => state.upsertBook);
  const deleteBook = useAppStore((state) => state.deleteBook);
  const upsertKnowledgePoint = useAppStore((state) => state.upsertKnowledgePoint);
  const deleteKnowledgePoint = useAppStore((state) => state.deleteKnowledgePoint);
  const markKnowledgePointReviewResult = useAppStore(
    (state) => state.markKnowledgePointReviewResult
  );

  const [activeBookId, setActiveBookId] = useState<string>("");
  const [showBookForm, setShowBookForm] = useState(false);
  const [showPointForm, setShowPointForm] = useState(false);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [reviewSessionIds, setReviewSessionIds] = useState<string[]>([]);
  const [reviewCursor, setReviewCursor] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [reviewNeedsWorkCount, setReviewNeedsWorkCount] = useState(0);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookStatus, setBookStatus] = useState<BookStatus>("reading");
  const [bookChapters, setBookChapters] = useState("");
  const [pointSearch, setPointSearch] = useState("");
  const [pointImportanceFilter, setPointImportanceFilter] = useState<"all" | Importance>("all");
  const [pointSortBy, setPointSortBy] = useState<"updatedAt" | "nextReviewDate" | "confidence">(
    "updatedAt"
  );
  const [dueOnly, setDueOnly] = useState(false);
  const [pointTitle, setPointTitle] = useState("");
  const [pointChapter, setPointChapter] = useState("");
  const [pointConcept, setPointConcept] = useState("");
  const [pointTags, setPointTags] = useState("");
  const [pointImportance, setPointImportance] = useState<Importance>("Core");
  const [pointConfidence, setPointConfidence] = useState<"1" | "2" | "3" | "4" | "5">("3");

  useEffect(() => {
    if (!activeBookId && books.length > 0) {
      setActiveBookId(books[0].id);
    }
    if (activeBookId && !books.some((book) => book.id === activeBookId)) {
      setActiveBookId(books[0]?.id ?? "");
    }
  }, [books, activeBookId]);

  useEffect(() => {
    setReviewSessionIds([]);
    setReviewCursor(0);
    setReviewRevealed(false);
    setReviewedCount(0);
    setReviewNeedsWorkCount(0);
  }, [activeBookId]);

  const activeBook = books.find((book) => book.id === activeBookId);
  const activePoints = useMemo(
    () => knowledgePoints.filter((point) => point.bookId === activeBookId),
    [knowledgePoints, activeBookId]
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const reviewDuePoints = useMemo(
    () =>
      activePoints
        .filter((point) => point.nextReviewDate && point.nextReviewDate.slice(0, 10) <= todayKey)
        .sort((a, b) => (a.nextReviewDate ?? "").localeCompare(b.nextReviewDate ?? "")),
    [activePoints, todayKey]
  );
  const filteredPoints = useMemo(() => {
    const query = pointSearch.trim().toLowerCase();
    return activePoints
      .filter((point) => {
        if (pointImportanceFilter !== "all" && point.importance !== pointImportanceFilter) {
          return false;
        }
        if (dueOnly && (!point.nextReviewDate || point.nextReviewDate.slice(0, 10) > todayKey)) {
          return false;
        }
        if (!query) return true;
        return (
          point.title.toLowerCase().includes(query) ||
          point.concept.toLowerCase().includes(query) ||
          (point.chapter ?? "").toLowerCase().includes(query) ||
          point.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (pointSortBy === "confidence") return b.confidence - a.confidence;
        if (pointSortBy === "nextReviewDate") {
          return (a.nextReviewDate ?? "9999").localeCompare(b.nextReviewDate ?? "9999");
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [activePoints, pointSearch, pointImportanceFilter, dueOnly, pointSortBy, todayKey]);
  const reviewCurrentPoint = useMemo(
    () => knowledgePoints.find((point) => point.id === reviewSessionIds[reviewCursor]),
    [knowledgePoints, reviewSessionIds, reviewCursor]
  );
  const reviewSessionTotal = reviewSessionIds.length;
  const reviewSessionCompleted =
    reviewSessionTotal > 0 &&
    (reviewCursor >= reviewSessionTotal || !reviewCurrentPoint);

  function startReviewSession() {
    if (reviewDuePoints.length === 0) return;
    setReviewSessionIds(reviewDuePoints.map((point) => point.id));
    setReviewCursor(0);
    setReviewRevealed(false);
    setReviewedCount(0);
    setReviewNeedsWorkCount(0);
  }

  function stopReviewSession() {
    setReviewSessionIds([]);
    setReviewCursor(0);
    setReviewRevealed(false);
  }

  function gradeCurrentFlashcard(result: "good" | "shaky") {
    const currentId = reviewSessionIds[reviewCursor];
    if (!currentId) return;
    markKnowledgePointReviewResult(currentId, result);
    setReviewedCount((count) => count + 1);
    if (result === "shaky") {
      setReviewNeedsWorkCount((count) => count + 1);
    }
    setReviewCursor((cursor) => cursor + 1);
    setReviewRevealed(false);
  }

  function isPointDue(nextReviewDate?: string): boolean {
    return Boolean(nextReviewDate && nextReviewDate.slice(0, 10) <= todayKey);
  }

  function downloadTextFile(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function escapeCsvCell(value: string): string {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function exportBookMarkdown() {
    if (!activeBook) return;
    const lines: string[] = [
      `# ${activeBook.title}`,
      "",
      `- Author: ${activeBook.author}`,
      `- Status: ${activeBook.status}`,
      `- Total knowledge points: ${activePoints.length}`,
      "",
      "## Knowledge Points",
      "",
    ];
    for (const point of activePoints) {
      lines.push(`### ${point.title}`);
      lines.push(`- Chapter: ${point.chapter ?? "N/A"}`);
      lines.push(`- Importance: ${point.importance}`);
      lines.push(`- Confidence: ${point.confidence}/5`);
      lines.push(`- Tags: ${point.tags.join(", ") || "N/A"}`);
      if (point.nextReviewDate) {
        lines.push(`- Next Review: ${new Date(point.nextReviewDate).toLocaleDateString()}`);
      }
      lines.push("");
      lines.push(point.concept);
      lines.push("");
    }
    downloadTextFile(
      `${activeBook.title.replaceAll(/\s+/g, "-").toLowerCase()}-knowledge.md`,
      lines.join("\n"),
      "text/markdown;charset=utf-8;"
    );
  }

  function exportBookAnkiCsv() {
    if (!activeBook) return;
    const rows = [
      ["Front", "Back", "Tags"].map(escapeCsvCell).join(","),
      ...activePoints.map((point) =>
        [
          `${point.title}${point.chapter ? ` (Chapter ${point.chapter})` : ""}`,
          point.concept,
          point.tags.join(" "),
        ]
          .map(escapeCsvCell)
          .join(",")
      ),
    ];
    downloadTextFile(
      `${activeBook.title.replaceAll(/\s+/g, "-").toLowerCase()}-anki.csv`,
      rows.join("\n"),
      "text/csv;charset=utf-8;"
    );
  }

  function exportBookPdf() {
    if (!activeBook) return;
    const rows = activePoints
      .map((point) => {
        const tags = point.tags.length > 0 ? point.tags.join(", ") : "N/A";
        const review = point.nextReviewDate
          ? new Date(point.nextReviewDate).toLocaleDateString()
          : "N/A";
        return `
          <article class="kp">
            <h3>${escapeHtml(point.title)}</h3>
            <p><strong>Chapter:</strong> ${escapeHtml(point.chapter ?? "N/A")}</p>
            <p><strong>Importance:</strong> ${escapeHtml(point.importance)} | <strong>Confidence:</strong> ${point.confidence}/5</p>
            <p><strong>Tags:</strong> ${escapeHtml(tags)}</p>
            <p><strong>Next Review:</strong> ${escapeHtml(review)}</p>
            <p>${escapeHtml(point.concept)}</p>
          </article>
        `;
      })
      .join("");
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(activeBook.title)} Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px; }
            .meta { color: #444; margin-bottom: 16px; }
            .kp { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
            .kp h3 { margin: 0 0 8px; }
            .kp p { margin: 6px 0; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(activeBook.title)}</h1>
          <p class="meta">Author: ${escapeHtml(activeBook.author)} | Points: ${activePoints.length}</p>
          ${rows || "<p>No knowledge points yet.</p>"}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function onCreateBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookTitle.trim() || !bookAuthor.trim()) return;
    upsertBook({
      title: bookTitle.trim(),
      author: bookAuthor.trim(),
      totalChapters: bookChapters ? Number(bookChapters) : undefined,
      status: bookStatus,
    });
    setBookTitle("");
    setBookAuthor("");
    setBookChapters("");
    setBookStatus("reading");
    setShowBookForm(false);
  }

  function onCreateKnowledgePoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBookId || !pointTitle.trim() || !pointConcept.trim()) return;
    upsertKnowledgePoint({
      id: editingPointId ?? undefined,
      bookId: activeBookId,
      title: pointTitle.trim(),
      chapter: pointChapter || undefined,
      concept: pointConcept.trim(),
      tags: pointTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      importance: pointImportance,
      confidence: Number(pointConfidence) as 1 | 2 | 3 | 4 | 5,
    });
    resetPointForm();
    setShowPointForm(false);
  }

  function startEditPoint(pointId: string) {
    const point = activePoints.find((item) => item.id === pointId);
    if (!point) return;
    setEditingPointId(point.id);
    setPointTitle(point.title);
    setPointChapter(point.chapter ?? "");
    setPointConcept(point.concept);
    setPointTags(point.tags.join(", "));
    setPointImportance(point.importance);
    setPointConfidence(String(point.confidence) as "1" | "2" | "3" | "4" | "5");
    setShowPointForm(true);
  }

  function resetPointForm() {
    setPointTitle("");
    setPointChapter("");
    setPointConcept("");
    setPointTags("");
    setPointImportance("Core");
    setPointConfidence("3");
    setEditingPointId(null);
  }

  return (
    <PageCard
      title="Reading Tracker"
      subtitle="Track textbooks and capture chapter-level knowledge points."
    >
      <div className="actions-row">
        <button type="button" onClick={() => setShowBookForm((prev) => !prev)}>
          {showBookForm ? "Hide New Book Form" : "Add Book"}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={!activeBookId}
          onClick={() => setShowPointForm((prev) => !prev)}
        >
          {showPointForm ? "Hide Knowledge Point Form" : "Add Knowledge Point"}
        </button>
        {showPointForm && (
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setShowPointForm(false);
              resetPointForm();
            }}
          >
            Cancel Edit
          </button>
        )}
      </div>

      {showBookForm && (
        <form className="problem-form" onSubmit={onCreateBook}>
          <div className="problem-form-grid">
            <label>
              <span>Book Title</span>
              <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} required />
            </label>
            <label>
              <span>Author</span>
              <input
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={bookStatus}
                onChange={(e) => setBookStatus(e.target.value as BookStatus)}
              >
                <option value="reading">Reading</option>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              <span>Total Chapters</span>
              <input
                type="number"
                min={1}
                value={bookChapters}
                onChange={(e) => setBookChapters(e.target.value)}
              />
            </label>
          </div>
          <div className="actions-row">
            <button type="submit">Save Book</button>
          </div>
        </form>
      )}

      {showPointForm && activeBookId && (
        <form className="problem-form" onSubmit={onCreateKnowledgePoint}>
          <div className="problem-form-grid">
            <label>
              <span>Knowledge Point Title</span>
              <input
                value={pointTitle}
                onChange={(e) => setPointTitle(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Chapter</span>
              <input value={pointChapter} onChange={(e) => setPointChapter(e.target.value)} />
            </label>
            <label>
              <span>Importance</span>
              <select
                value={pointImportance}
                onChange={(e) => setPointImportance(e.target.value as Importance)}
              >
                <option value="Core">Core</option>
                <option value="Supporting">Supporting</option>
                <option value="NiceToKnow">NiceToKnow</option>
              </select>
            </label>
            <label>
              <span>Confidence (1-5)</span>
              <select
                value={pointConfidence}
                onChange={(e) => setPointConfidence(e.target.value as "1" | "2" | "3" | "4" | "5")}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label>
            <label className="full-width">
              <span>Tags (comma-separated)</span>
              <input
                value={pointTags}
                onChange={(e) => setPointTags(e.target.value)}
                placeholder="Algorithms, DP, Graph"
              />
            </label>
            <label className="full-width">
              <span>Concept</span>
              <textarea
                rows={4}
                value={pointConcept}
                onChange={(e) => setPointConcept(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="actions-row">
            <button type="submit">
              {editingPointId ? "Update Knowledge Point" : "Save Knowledge Point"}
            </button>
          </div>
        </form>
      )}

      {activeBook && (
        <div className="filters-row reading-filters">
          <input
            placeholder="Search title, concept, chapter, tag"
            value={pointSearch}
            onChange={(e) => setPointSearch(e.target.value)}
          />
          <select
            value={pointImportanceFilter}
            onChange={(e) => setPointImportanceFilter(e.target.value as "all" | Importance)}
          >
            <option value="all">All Importance</option>
            <option value="Core">Core</option>
            <option value="Supporting">Supporting</option>
            <option value="NiceToKnow">NiceToKnow</option>
          </select>
          <select
            value={pointSortBy}
            onChange={(e) =>
              setPointSortBy(e.target.value as "updatedAt" | "nextReviewDate" | "confidence")
            }
          >
            <option value="updatedAt">Sort: Last Updated</option>
            <option value="nextReviewDate">Sort: Next Review</option>
            <option value="confidence">Sort: Confidence</option>
          </select>
          <label className="due-only-toggle">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => setDueOnly(e.target.checked)}
            />
            Due only
          </label>
        </div>
      )}

      {activeBook && (
        <article className="tile flashcard-session">
          <h2>Flashcard Review</h2>
          <small>
            {reviewDuePoints.length} due right now for {activeBook.title}
          </small>
          {reviewSessionTotal === 0 && (
            <div className="actions-row">
              <button type="button" onClick={startReviewSession} disabled={reviewDuePoints.length === 0}>
                Start Review Session
              </button>
            </div>
          )}

          {reviewSessionTotal > 0 && !reviewSessionCompleted && reviewCurrentPoint && (
            <div className="flashcard-body">
              <small>
                Card {reviewCursor + 1} / {reviewSessionTotal}
              </small>
              <h3>{reviewCurrentPoint.title}</h3>
              <small>
                {reviewCurrentPoint.chapter
                  ? `Chapter ${reviewCurrentPoint.chapter}`
                  : "No chapter"}{" "}
                • {reviewCurrentPoint.importance}
              </small>
              {reviewCurrentPoint.tags.length > 0 && (
                <div className="chip-list">
                  {reviewCurrentPoint.tags.map((tag) => (
                    <span key={`${reviewCurrentPoint.id}-${tag}`} className="topic-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {!reviewRevealed ? (
                <div className="actions-row">
                  <button type="button" onClick={() => setReviewRevealed(true)}>
                    Reveal Concept
                  </button>
                  <button type="button" className="button-secondary" onClick={stopReviewSession}>
                    End Session
                  </button>
                </div>
              ) : (
                <>
                  <p>{reviewCurrentPoint.concept}</p>
                  <div className="actions-row">
                    <button type="button" onClick={() => gradeCurrentFlashcard("good")}>
                      I Recalled It
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => gradeCurrentFlashcard("shaky")}
                    >
                      Need More Work
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {reviewSessionCompleted && (
            <div className="flashcard-body">
              <p>
                You reviewed {reviewedCount} cards. {reviewNeedsWorkCount} need more work.
              </p>
              <div className="actions-row">
                <button type="button" onClick={startReviewSession} disabled={reviewDuePoints.length === 0}>
                  Review Due Cards Again
                </button>
                <button type="button" className="button-secondary" onClick={stopReviewSession}>
                  Close Session
                </button>
              </div>
            </div>
          )}
        </article>
      )}

      <div className="reading-layout">
        <article className="tile">
          <h2>Bookshelf</h2>
          {books.length === 0 && <p>No books added yet.</p>}
          <ul className="books-list">
            {books.map((book) => (
              <li
                key={book.id}
                className={`book-row${activeBookId === book.id ? " book-row-active" : ""}`}
              >
                <button
                  type="button"
                  className="book-select"
                  onClick={() => setActiveBookId(book.id)}
                >
                  <strong>{book.title}</strong>
                  <small>
                    {book.author} • {book.status}
                  </small>
                </button>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => deleteBook(book.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="tile">
          <h2>Knowledge Points {activeBook ? `for ${activeBook.title}` : ""}</h2>
          {activeBook && (
            <small>
              {activePoints.length} total • {reviewDuePoints.length} due review
            </small>
          )}
          {activeBook && (
            <div className="actions-row export-actions">
              <button type="button" onClick={exportBookMarkdown}>
                Export Markdown
              </button>
              <button type="button" className="button-secondary" onClick={exportBookPdf}>
                Export PDF
              </button>
              <button type="button" className="button-secondary" onClick={exportBookAnkiCsv}>
                Export Anki CSV
              </button>
            </div>
          )}
          {!activeBook && <p>Select a book to view knowledge points.</p>}
          {activeBook && filteredPoints.length === 0 && (
            <p>No matching knowledge points yet.</p>
          )}
          {activeBook && filteredPoints.length > 0 && (
            <ul className="knowledge-list">
              {filteredPoints.map((point) => (
                <li key={point.id} className="knowledge-row">
                  <details className="knowledge-accordion" open={dueOnly || isPointDue(point.nextReviewDate)}>
                    <summary>
                      <div className="knowledge-summary-title">
                        <strong>{point.title}</strong>
                        <small>
                          {point.chapter ? `Chapter ${point.chapter}` : "No chapter"} •{" "}
                          {point.importance} • confidence {point.confidence}
                        </small>
                      </div>
                      {point.nextReviewDate && (
                        <span
                          className={`badge ${
                            isPointDue(point.nextReviewDate)
                              ? "badge-status-review"
                              : "badge-status-attempted"
                          }`}
                        >
                          {isPointDue(point.nextReviewDate) ? "Due" : "Upcoming"}
                        </span>
                      )}
                    </summary>
                    <div className="knowledge-content">
                      {point.nextReviewDate && (
                        <small>
                          Review date: {new Date(point.nextReviewDate).toLocaleDateString()}
                        </small>
                      )}
                      <p>{point.concept}</p>
                      {point.tags.length > 0 && (
                        <div className="chip-list">
                          {point.tags.map((tag) => (
                            <span key={`${point.id}-${tag}`} className="topic-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="inline-actions">
                        <button type="button" onClick={() => startEditPoint(point.id)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={!point.nextReviewDate}
                          onClick={() => markKnowledgePointReviewResult(point.id, "good")}
                        >
                          Reviewed (Good)
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={!point.nextReviewDate}
                          onClick={() => markKnowledgePointReviewResult(point.id, "shaky")}
                        >
                          Reviewed (Shaky)
                        </button>
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => deleteKnowledgePoint(point.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </PageCard>
  );
}

function CalendarPage() {
  type CalendarViewEvent = CalendarEvent & {
    occurrenceId: string;
    sourceEventId: string;
    isRecurringInstance: boolean;
  };

  const events = useAppStore((state) => state.events);
  const settings = useAppStore((state) => state.settings);
  const upsertEvent = useAppStore((state) => state.upsertEvent);
  const deleteEvent = useAppStore((state) => state.deleteEvent);
  const problems = useAppStore((state) => state.problems);
  const books = useAppStore((state) => state.books);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "agenda">("week");
  const [isMobileCalendar, setIsMobileCalendar] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth <= 880
  );
  const [showMobileDayGrid, setShowMobileDayGrid] = useState(false);
  const [focusDate, setFocusDate] = useState(new Date().toISOString().slice(0, 10));
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("study");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventRecurrence, setEventRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">(
    "none"
  );
  const [eventRecurrenceUntil, setEventRecurrenceUntil] = useState("");
  const [eventReminderMinutesBefore, setEventReminderMinutesBefore] = useState<"0" | "5" | "10" | "15" | "30" | "60">("15");
  const [eventLinkedModule, setEventLinkedModule] = useState<
    "none" | "leetcode" | "reading" | "notes" | "groups"
  >("none");
  const [eventLinkedItemId, setEventLinkedItemId] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [timerMode, setTimerMode] = useState<"focus" | "shortBreak" | "longBreak">("focus");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSecondsRemaining, setTimerSecondsRemaining] = useState(25 * 60);
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0);
  const [lastCompletedFocusSeconds, setLastCompletedFocusSeconds] = useState<number | null>(null);
  const [lastCompletedFocusAt, setLastCompletedFocusAt] = useState<string | null>(null);
  const [timerLogType, setTimerLogType] = useState<"study" | "leetcode">("study");
  const [timerLogTitle, setTimerLogTitle] = useState("Pomodoro Session");
  const [dragCreateStartSlot, setDragCreateStartSlot] = useState<number | null>(null);
  const [dragCreateEndSlot, setDragCreateEndSlot] = useState<number | null>(null);
  const [resizingEventId, setResizingEventId] = useState<string | null>(null);
  const resizeStateRef = useRef<{ startY: number; baseEndIso: string } | null>(null);
  const slotsPerDay = 48;
  const slotMinutes = 30;
  const timerDurations = {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
  } as const;

  function toLocalDateTimeInput(iso: string): string {
    const dt = new Date(iso);
    const offsetMs = dt.getTimezoneOffset() * 60000;
    return new Date(dt.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function toIsoFromLocalInput(localValue: string): string {
    return new Date(localValue).toISOString();
  }

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events]
  );

  function expandEventsInRange(rangeStart: Date, rangeEnd: Date): CalendarViewEvent[] {
    const result: CalendarViewEvent[] = [];
    for (const event of sortedEvents) {
      const recurrence = event.recurrence ?? "none";
      if (recurrence === "none") {
        const eventDate = new Date(event.startTime);
        if (eventDate >= rangeStart && eventDate < rangeEnd) {
          result.push({
            ...event,
            occurrenceId: event.id,
            sourceEventId: event.id,
            isRecurringInstance: false,
          });
        }
        continue;
      }
      const baseStart = new Date(event.startTime);
      const baseEnd = new Date(event.endTime);
      const durationMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 30 * 60000);
      const until = event.recurrenceUntil
        ? new Date(`${event.recurrenceUntil}T23:59:59`)
        : new Date(rangeEnd);
      let cursor = new Date(baseStart);
      let guard = 0;
      while (cursor < rangeEnd && cursor <= until && guard < 500) {
        if (cursor >= rangeStart) {
          const occurrenceStart = new Date(cursor);
          const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
          result.push({
            ...event,
            startTime: occurrenceStart.toISOString(),
            endTime: occurrenceEnd.toISOString(),
            occurrenceId: `${event.id}::${occurrenceStart.toISOString()}`,
            sourceEventId: event.id,
            isRecurringInstance: true,
          });
        }
        if (recurrence === "daily") {
          cursor.setDate(cursor.getDate() + 1);
        } else if (recurrence === "weekly") {
          cursor.setDate(cursor.getDate() + 7);
        } else {
          cursor.setMonth(cursor.getMonth() + 1);
        }
        guard += 1;
      }
    }
    return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function isWithinQuietHours(date: Date): boolean {
    if (!settings.quietHoursEnabled) return false;
    const [startHour, startMinute] = settings.quietHoursStart.split(":").map(Number);
    const [endHour, endMinute] = settings.quietHoursEnd.split(":").map(Number);
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    const currentTotal = date.getHours() * 60 + date.getMinutes();
    if (startTotal === endTotal) return false;
    if (startTotal < endTotal) {
      return currentTotal >= startTotal && currentTotal < endTotal;
    }
    return currentTotal >= startTotal || currentTotal < endTotal;
  }

  function toRangeBoundary() {
    const focus = new Date(`${focusDate}T00:00:00`);
    if (viewMode === "agenda") {
      const start = new Date(`${focusDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 90);
      return { start, end };
    }
    if (viewMode === "day") {
      const start = new Date(`${focusDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    if (viewMode === "week") {
      const day = focus.getDay();
      const mondayDelta = day === 0 ? -6 : 1 - day;
      const start = new Date(focus);
      start.setDate(focus.getDate() + mondayDelta);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end };
    }
    const start = new Date(`${focusDate.slice(0, 7)}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);
    return { start, end };
  }

  const visibleEvents = useMemo(() => {
    const { start, end } = toRangeBoundary();
    return expandEventsInRange(start, end);
  }, [sortedEvents, viewMode, focusDate]);

  const reminderPreview = useMemo(() => {
    if (!settings.notificationsEnabled || !settings.eventRemindersEnabled) {
      return [];
    }
    const now = new Date();
    const horizon = new Date(now);
    horizon.setHours(horizon.getHours() + 24);
    const expansionEnd = new Date(horizon);
    expansionEnd.setHours(expansionEnd.getHours() + 4);
    return expandEventsInRange(now, expansionEnd)
      .filter((event) => typeof event.reminderMinutesBefore === "number")
      .map((event) => {
        const reminderAt = new Date(
          new Date(event.startTime).getTime() - (event.reminderMinutesBefore ?? 0) * 60000
        );
        return {
          event,
          reminderAt,
          suppressedByQuietHours: isWithinQuietHours(reminderAt),
        };
      })
      .filter(({ reminderAt }) => reminderAt >= now && reminderAt <= horizon)
      .sort((a, b) => a.reminderAt.getTime() - b.reminderAt.getTime());
  }, [
    settings.notificationsEnabled,
    settings.eventRemindersEnabled,
    settings.quietHoursEnabled,
    settings.quietHoursStart,
    settings.quietHoursEnd,
    sortedEvents,
  ]);

  const groupedEvents = useMemo(() => {
    return visibleEvents.reduce<Record<string, CalendarViewEvent[]>>((acc, event) => {
      const key = event.startTime.slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    }, {});
  }, [visibleEvents]);

  const groupedDates = Object.keys(groupedEvents).sort();
  const dayEvents = useMemo(
    () =>
      visibleEvents.filter((event) => event.startTime.slice(0, 10) === focusDate),
    [visibleEvents, focusDate]
  );

  const draggedSlotRange = useMemo(() => {
    if (dragCreateStartSlot === null || dragCreateEndSlot === null) return null;
    return {
      start: Math.min(dragCreateStartSlot, dragCreateEndSlot),
      end: Math.max(dragCreateStartSlot, dragCreateEndSlot),
    };
  }, [dragCreateStartSlot, dragCreateEndSlot]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onResize() {
      setIsMobileCalendar(window.innerWidth <= 880);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobileCalendar) return;
    if (viewMode === "week" || viewMode === "month") {
      setViewMode("agenda");
    }
  }, [isMobileCalendar, viewMode]);

  useEffect(() => {
    if (!isMobileCalendar) {
      setShowMobileDayGrid(false);
    }
  }, [isMobileCalendar]);

  useEffect(() => {
    if (!resizingEventId) return;
    function onMouseMove(event: MouseEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      const current = events.find((item) => item.id === resizingEventId);
      if (!current) return;
      const deltaSlots = Math.round((event.clientY - resizeState.startY) / 16);
      if (deltaSlots === 0) return;
      const nextEnd = new Date(resizeState.baseEndIso);
      nextEnd.setMinutes(nextEnd.getMinutes() + deltaSlots * slotMinutes);
      const minEnd = new Date(current.startTime);
      minEnd.setMinutes(minEnd.getMinutes() + slotMinutes);
      if (nextEnd <= minEnd) {
        nextEnd.setTime(minEnd.getTime());
      }
      upsertEvent({
        id: current.id,
        title: current.title,
        type: current.type,
        startTime: current.startTime,
        endTime: nextEnd.toISOString(),
        recurrence: current.recurrence,
        recurrenceUntil: current.recurrenceUntil,
        reminderMinutesBefore: current.reminderMinutesBefore,
        description: current.description,
        linkedModule: current.linkedModule,
        linkedItemId: current.linkedItemId,
        groupId: current.groupId,
      });
    }

    function onMouseUp() {
      setResizingEventId(null);
      resizeStateRef.current = null;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [events, resizingEventId, upsertEvent]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSecondsRemaining((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(id);
          setTimerRunning(false);
          if (timerMode === "focus") {
            setCompletedFocusSessions((value) => value + 1);
            setLastCompletedFocusSeconds(timerDurations.focus);
            setLastCompletedFocusAt(new Date().toISOString());
          }
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, timerMode]);

  function shiftFocus(delta: number) {
    const date = new Date(`${focusDate}T00:00:00`);
    if (viewMode === "month") {
      date.setMonth(date.getMonth() + delta);
    } else if (viewMode === "week") {
      date.setDate(date.getDate() + delta * 7);
    } else {
      date.setDate(date.getDate() + delta);
    }
    setFocusDate(date.toISOString().slice(0, 10));
  }

  function resetEventForm() {
    setEditingEventId(null);
    setEventTitle("");
    setEventType("study");
    setEventStart("");
    setEventEnd("");
    setEventRecurrence("none");
    setEventRecurrenceUntil("");
    setEventReminderMinutesBefore("15");
    setEventLinkedModule("none");
    setEventLinkedItemId("");
    setEventDescription("");
  }

  function onSaveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventTitle.trim() || !eventStart || !eventEnd) return;
    const startIso = toIsoFromLocalInput(eventStart);
    const endIso = toIsoFromLocalInput(eventEnd);
    if (endIso <= startIso) return;
    upsertEvent({
      id: editingEventId ?? undefined,
      title: eventTitle.trim(),
      type: eventType,
      startTime: startIso,
      endTime: endIso,
      recurrence: eventRecurrence,
      recurrenceUntil: eventRecurrence === "none" ? undefined : eventRecurrenceUntil || undefined,
      reminderMinutesBefore:
        eventReminderMinutesBefore === "0" ? undefined : Number(eventReminderMinutesBefore),
      linkedModule: eventLinkedModule === "none" ? undefined : eventLinkedModule,
      linkedItemId: eventLinkedModule === "none" ? undefined : eventLinkedItemId || undefined,
      description: eventDescription.trim() || undefined,
    });
    setShowEventForm(false);
    resetEventForm();
  }

  function onEditEvent(event: CalendarEvent) {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventType(event.type);
    setEventStart(toLocalDateTimeInput(event.startTime));
    setEventEnd(toLocalDateTimeInput(event.endTime));
    setEventRecurrence(event.recurrence ?? "none");
    setEventRecurrenceUntil(event.recurrenceUntil ?? "");
    setEventReminderMinutesBefore(
      String(event.reminderMinutesBefore ?? 15) as "0" | "5" | "10" | "15" | "30" | "60"
    );
    setEventLinkedModule(event.linkedModule ?? "none");
    setEventLinkedItemId(event.linkedItemId ?? "");
    setEventDescription(event.description ?? "");
    setShowEventForm(true);
  }

  function goToLinkedTarget(event: CalendarEvent) {
    if (event.linkedModule === "leetcode") {
      navigate("/leetcode");
      return;
    }
    if (event.linkedModule === "reading") {
      navigate("/reading");
      return;
    }
    if (event.linkedModule === "notes") {
      navigate("/notes");
      return;
    }
    if (event.linkedModule === "groups") {
      navigate("/groups");
    }
  }

  function resetTimerForMode(mode: "focus" | "shortBreak" | "longBreak") {
    setTimerMode(mode);
    setTimerRunning(false);
    setTimerSecondsRemaining(timerDurations[mode]);
  }

  function formatTimer(seconds: number): string {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function logCompletedPomodoro() {
    if (!lastCompletedFocusSeconds || !lastCompletedFocusAt) return;
    const end = new Date(lastCompletedFocusAt);
    const start = new Date(end);
    start.setSeconds(start.getSeconds() - lastCompletedFocusSeconds);
    upsertEvent({
      title: timerLogTitle.trim() || "Pomodoro Session",
      type: timerLogType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      recurrence: "none",
      description: "Logged from Focus Mode timer",
    });
    setLastCompletedFocusSeconds(null);
    setLastCompletedFocusAt(null);
  }

  function applyAcademicTemplate(template: "cs-starter" | "exam-week") {
    const baseDate = new Date(`${focusDate}T00:00:00`);
    if (template === "cs-starter") {
      const starterItems: Array<{
        title: string;
        type: EventType;
        weekdayOffset: number;
        startHour: number;
        durationHours: number;
      }> = [
        { title: "Algorithms Class", type: "class", weekdayOffset: 1, startHour: 10, durationHours: 1.5 },
        { title: "Systems Class", type: "class", weekdayOffset: 3, startHour: 10, durationHours: 1.5 },
        { title: "LeetCode Practice", type: "leetcode", weekdayOffset: 2, startHour: 19, durationHours: 1 },
        { title: "Deep Study Block", type: "study", weekdayOffset: 5, startHour: 14, durationHours: 2 },
      ];
      starterItems.forEach((item) => {
        const start = new Date(baseDate);
        start.setDate(start.getDate() + ((item.weekdayOffset - start.getDay() + 7) % 7));
        start.setHours(item.startHour, 0, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + item.durationHours * 60);
        const until = new Date(start);
        until.setDate(until.getDate() + 7 * 12);
        upsertEvent({
          title: item.title,
          type: item.type,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          recurrence: "weekly",
          recurrenceUntil: until.toISOString().slice(0, 10),
          description: "Academic term template",
        });
      });
      return;
    }
    const examPrep: Array<{ title: string; dayOffset: number; hour: number; durationHours: number }> = [
      { title: "Exam Review Session", dayOffset: 0, hour: 18, durationHours: 2 },
      { title: "Past Paper Practice", dayOffset: 2, hour: 17, durationHours: 2 },
      { title: "Formula + Notes Consolidation", dayOffset: 4, hour: 19, durationHours: 1.5 },
    ];
    examPrep.forEach((item) => {
      const start = new Date(baseDate);
      start.setDate(start.getDate() + item.dayOffset);
      start.setHours(item.hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + item.durationHours * 60);
      upsertEvent({
        title: item.title,
        type: "study",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        recurrence: "none",
        description: "Exam week template",
      });
    });
  }

  function slotIndexToIso(slotIndex: number): string {
    const dt = new Date(`${focusDate}T00:00:00`);
    dt.setMinutes(dt.getMinutes() + slotIndex * slotMinutes);
    return dt.toISOString();
  }

  function isEventCoveringSlot(event: CalendarEvent, slotIndex: number): boolean {
    const slotStart = new Date(slotIndexToIso(slotIndex)).getTime();
    const slotEnd = new Date(slotIndexToIso(slotIndex + 1)).getTime();
    const eventStartMs = new Date(event.startTime).getTime();
    const eventEndMs = new Date(event.endTime).getTime();
    return eventStartMs < slotEnd && eventEndMs > slotStart;
  }

  function onDaySlotMouseDown(slotIndex: number) {
    if (viewMode !== "day") return;
    setDragCreateStartSlot(slotIndex);
    setDragCreateEndSlot(slotIndex);
  }

  function onDaySlotMouseEnter(slotIndex: number) {
    if (dragCreateStartSlot === null) return;
    setDragCreateEndSlot(slotIndex);
  }

  function onDaySlotMouseUp() {
    if (draggedSlotRange === null) return;
    const startIso = slotIndexToIso(draggedSlotRange.start);
    const endIso = slotIndexToIso(Math.min(draggedSlotRange.end + 1, slotsPerDay));
    setEventStart(toLocalDateTimeInput(startIso));
    setEventEnd(toLocalDateTimeInput(endIso));
    setEventTitle("");
    setEventDescription("");
    setEventType("study");
    setEditingEventId(null);
    setShowEventForm(true);
    setDragCreateStartSlot(null);
    setDragCreateEndSlot(null);
  }

  function startResizeDrag(mouseEvent: ReactMouseEvent<HTMLButtonElement>, event: CalendarEvent) {
    mouseEvent.preventDefault();
    setResizingEventId(event.id);
    resizeStateRef.current = {
      startY: mouseEvent.clientY,
      baseEndIso: event.endTime,
    };
  }

  return (
    <PageCard
      title="Calendar"
      subtitle="Plan classes, study blocks, LeetCode sessions, and deadlines."
    >
      <div className="actions-row">
        <button type="button" onClick={() => setShowEventForm((prev) => !prev)}>
          {showEventForm ? "Hide Event Form" : "Add Event"}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => applyAcademicTemplate("cs-starter")}
        >
          Apply CS Term Template
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => applyAcademicTemplate("exam-week")}
        >
          Apply Exam Week Template
        </button>
        <div className="view-switch">
          {(["day", "week", "month", "agenda"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={mode === viewMode ? "button-secondary view-active" : "button-secondary"}
              onClick={() => setViewMode(mode)}
            >
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-nav">
        <button type="button" onClick={() => shiftFocus(-1)}>
          Prev
        </button>
        <strong>{new Date(`${focusDate}T00:00:00`).toLocaleDateString()}</strong>
        <button type="button" onClick={() => shiftFocus(1)}>
          Next
        </button>
        <button type="button" className="button-secondary" onClick={() => setFocusDate(new Date().toISOString().slice(0, 10))}>
          Today
        </button>
      </div>

      {isMobileCalendar && (
        <div className="calendar-mobile-switch">
          <small>Mobile quick views</small>
          <div className="actions-row">
            <button
              type="button"
              className={viewMode === "day" ? "button-secondary view-active" : "button-secondary"}
              onClick={() => setViewMode("day")}
            >
              Day
            </button>
            <button
              type="button"
              className={viewMode === "agenda" ? "button-secondary view-active" : "button-secondary"}
              onClick={() => setViewMode("agenda")}
            >
              Agenda
            </button>
          </div>
        </div>
      )}

      <article className="tile focus-mode-tile">
        <h2>Focus Mode</h2>
        <small>{completedFocusSessions} focus session(s) completed today</small>
        <div className="timer-presets">
          <button
            type="button"
            className={timerMode === "focus" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => resetTimerForMode("focus")}
          >
            Focus 25m
          </button>
          <button
            type="button"
            className={timerMode === "shortBreak" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => resetTimerForMode("shortBreak")}
          >
            Short Break
          </button>
          <button
            type="button"
            className={timerMode === "longBreak" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => resetTimerForMode("longBreak")}
          >
            Long Break
          </button>
        </div>
        <div className="timer-display">{formatTimer(timerSecondsRemaining)}</div>
        <div className="actions-row">
          <button type="button" onClick={() => setTimerRunning((v) => !v)}>
            {timerRunning ? "Pause" : "Start"}
          </button>
          <button type="button" className="button-secondary" onClick={() => resetTimerForMode(timerMode)}>
            Reset
          </button>
        </div>
        {lastCompletedFocusSeconds && lastCompletedFocusAt && (
          <div className="timer-log-box">
            <small>
              Last completed focus: {Math.round(lastCompletedFocusSeconds / 60)} minutes at{" "}
              {new Date(lastCompletedFocusAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
            <div className="filters-row timer-log-row">
              <select
                value={timerLogType}
                onChange={(e) => setTimerLogType(e.target.value as "study" | "leetcode")}
              >
                <option value="study">Study</option>
                <option value="leetcode">LeetCode</option>
              </select>
              <input
                value={timerLogTitle}
                onChange={(e) => setTimerLogTitle(e.target.value)}
                placeholder="Session title"
              />
            </div>
            <div className="actions-row">
              <button type="button" onClick={logCompletedPomodoro}>
                Save Session To Calendar
              </button>
            </div>
          </div>
        )}
      </article>

      <article className="tile reminder-preview-tile">
        <h2>Upcoming Reminder Preview</h2>
        <small>Next 24 hours based on your current settings.</small>
        {!settings.notificationsEnabled && (
          <p>Notifications are disabled in Settings.</p>
        )}
        {settings.notificationsEnabled && !settings.eventRemindersEnabled && (
          <p>Event reminders are disabled in Settings.</p>
        )}
        {settings.notificationsEnabled && settings.eventRemindersEnabled && reminderPreview.length === 0 && (
          <p>No upcoming reminders in the next 24 hours.</p>
        )}
        {settings.notificationsEnabled && settings.eventRemindersEnabled && reminderPreview.length > 0 && (
          <ul className="reminder-preview-list">
            {reminderPreview.map((item) => (
              <li key={`${item.event.occurrenceId}-${item.reminderAt.toISOString()}`}>
                <strong>{item.event.title}</strong>
                <small>
                  Notify at {item.reminderAt.toLocaleString()} • Event starts{" "}
                  {new Date(item.event.startTime).toLocaleString()}
                </small>
                {item.suppressedByQuietHours && (
                  <small>Suppressed by quiet hours</small>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>

      {showEventForm && (
        <form className="problem-form" onSubmit={onSaveEvent}>
          <div className="problem-form-grid">
            <label>
              <span>Title</span>
              <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
            </label>
            <label>
              <span>Type</span>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                <option value="class">Class</option>
                <option value="study">Study</option>
                <option value="leetcode">LeetCode</option>
                <option value="deadline">Deadline</option>
                <option value="meeting">Meeting</option>
                <option value="personal">Personal</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              <span>Start</span>
              <input
                type="datetime-local"
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                required
              />
            </label>
            <label>
              <span>End</span>
              <input
                type="datetime-local"
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Recurrence</span>
              <select
                value={eventRecurrence}
                onChange={(e) =>
                  setEventRecurrence(e.target.value as "none" | "daily" | "weekly" | "monthly")
                }
              >
                <option value="none">No recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label>
              <span>Repeat Until</span>
              <input
                type="date"
                value={eventRecurrenceUntil}
                disabled={eventRecurrence === "none"}
                onChange={(e) => setEventRecurrenceUntil(e.target.value)}
              />
            </label>
            <label>
              <span>Reminder</span>
              <select
                value={eventReminderMinutesBefore}
                onChange={(e) =>
                  setEventReminderMinutesBefore(
                    e.target.value as "0" | "5" | "10" | "15" | "30" | "60"
                  )
                }
              >
                <option value="0">No reminder</option>
                <option value="5">5 min before</option>
                <option value="10">10 min before</option>
                <option value="15">15 min before</option>
                <option value="30">30 min before</option>
                <option value="60">1 hour before</option>
              </select>
            </label>
            <label>
              <span>Linked Module</span>
              <select
                value={eventLinkedModule}
                onChange={(e) => {
                  const value = e.target.value as
                    | "none"
                    | "leetcode"
                    | "reading"
                    | "notes"
                    | "groups";
                  setEventLinkedModule(value);
                  setEventLinkedItemId("");
                }}
              >
                <option value="none">None</option>
                <option value="leetcode">LeetCode</option>
                <option value="reading">Reading</option>
                <option value="notes">Notes</option>
                <option value="groups">Groups</option>
              </select>
            </label>
            {eventLinkedModule === "leetcode" && (
              <label>
                <span>Linked Problem</span>
                <select
                  value={eventLinkedItemId}
                  onChange={(e) => setEventLinkedItemId(e.target.value)}
                >
                  <option value="">None</option>
                  {problems.slice(0, 200).map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      #{problem.problemNumber} {problem.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {eventLinkedModule === "reading" && (
              <label>
                <span>Linked Book</span>
                <select
                  value={eventLinkedItemId}
                  onChange={(e) => setEventLinkedItemId(e.target.value)}
                >
                  <option value="">None</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="full-width">
              <span>Description</span>
              <textarea
                rows={3}
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </label>
          </div>
          <div className="actions-row">
            <button type="submit">{editingEventId ? "Update Event" : "Save Event"}</button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setShowEventForm(false);
                resetEventForm();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <article className="tile calendar-events">
        <h2>{viewMode[0].toUpperCase() + viewMode.slice(1)} View</h2>
        {viewMode === "day" && (
          <div className="calendar-day-planner">
            <small>Drag across time slots to create an event quickly.</small>
            {isMobileCalendar && (
              <div className="mobile-day-list">
                {dayEvents.length === 0 && <small>No events for this day.</small>}
                {dayEvents.map((event) => (
                  <article key={`mobile-day-${event.occurrenceId}`} className="mobile-event-card">
                    <strong>{event.title}</strong>
                    <small>
                      {new Date(event.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(event.endTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                    <span className={`event-type event-type-${event.type}`}>{event.type}</span>
                  </article>
                ))}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowMobileDayGrid((prev) => !prev)}
                >
                  {showMobileDayGrid ? "Hide Time Grid" : "Show Time Grid"}
                </button>
              </div>
            )}
            {(!isMobileCalendar || showMobileDayGrid) && (
              <div className="calendar-day-grid" onMouseLeave={onDaySlotMouseUp}>
                {Array.from({ length: slotsPerDay }).map((_, slotIndex) => {
                  const inDraggedRange =
                    draggedSlotRange !== null &&
                    slotIndex >= draggedSlotRange.start &&
                    slotIndex <= draggedSlotRange.end;
                  const hasEvent = dayEvents.some((event) => isEventCoveringSlot(event, slotIndex));
                  const hour = String(Math.floor(slotIndex / 2)).padStart(2, "0");
                  const minute = slotIndex % 2 === 0 ? "00" : "30";
                  return (
                    <button
                      key={`slot-${slotIndex}`}
                      type="button"
                      className={`calendar-slot${inDraggedRange ? " calendar-slot-selected" : ""}${
                        hasEvent ? " calendar-slot-has-event" : ""
                      }`}
                      onMouseDown={() => onDaySlotMouseDown(slotIndex)}
                      onMouseEnter={() => onDaySlotMouseEnter(slotIndex)}
                      onMouseUp={onDaySlotMouseUp}
                    >
                      <span>{`${hour}:${minute}`}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {visibleEvents.length === 0 && <p>No events in this range.</p>}
        {groupedDates.map((dateKey) => (
          <div
            key={dateKey}
            className={`event-group${isMobileCalendar && viewMode === "agenda" ? " event-group-mobile" : ""}`}
          >
            <h3>{new Date(`${dateKey}T00:00:00`).toLocaleDateString()}</h3>
            <ul>
              {groupedEvents[dateKey].map((event) => (
                <li key={event.id}>
                  <div className="event-main">
                    <span className={`event-type event-type-${event.type}`}>{event.type}</span>
                    <strong>{event.title}</strong>
                    <small>
                      {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                      {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </small>
                    {(event.recurrence ?? "none") !== "none" && (
                      <small>
                        Repeats {event.recurrence}
                        {event.recurrenceUntil ? ` until ${event.recurrenceUntil}` : ""}
                      </small>
                    )}
                    {typeof event.reminderMinutesBefore === "number" && (
                      <small>Reminder: {event.reminderMinutesBefore} min before</small>
                    )}
                    {event.linkedModule && (
                      <small>
                        Linked: {event.linkedModule}
                        {event.linkedItemId ? ` (${event.linkedItemId.slice(0, 8)})` : ""}
                      </small>
                    )}
                    {event.description && <small>{event.description}</small>}
                  </div>
                  <div className="inline-actions">
                    <button type="button" onClick={() => onEditEvent(events.find((item) => item.id === event.sourceEventId) ?? event)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button-secondary event-resize-handle"
                      title="Drag vertically to resize event end time"
                      disabled={event.isRecurringInstance}
                      onMouseDown={(mouseEvent) => startResizeDrag(mouseEvent, events.find((item) => item.id === event.sourceEventId) ?? event)}
                    >
                      Resize
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => deleteEvent(event.sourceEventId)}
                    >
                      Delete
                    </button>
                    {event.linkedModule && (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => goToLinkedTarget(event)}
                      >
                        Open Linked
                      </button>
                    )}
                    {event.type === "leetcode" && (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => navigate("/leetcode")}
                      >
                        Log Problem
                      </button>
                    )}
                    {event.type === "study" && (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => navigate("/reading")}
                      >
                        Capture Knowledge
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </article>
    </PageCard>
  );
}

function NotesPage() {
  const notes = useAppStore((state) => state.notes);
  const problems = useAppStore((state) => state.problems);
  const books = useAppStore((state) => state.books);
  const events = useAppStore((state) => state.events);
  const groups = useAppStore((state) => state.groups);
  const upsertNote = useAppStore((state) => state.upsertNote);
  const deleteNote = useAppStore((state) => state.deleteNote);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<NoteTemplate>("custom");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [linkedModule, setLinkedModule] = useState<"none" | "leetcode" | "reading" | "calendar" | "groups">(
    "none"
  );
  const [linkedItemId, setLinkedItemId] = useState("");

  const templateBodies: Record<NoteTemplate, { title: string; content: string }> = {
    custom: { title: "", content: "" },
    lecture: {
      title: "Lecture Notes",
      content:
        "# Lecture\n\n## Key Ideas\n- \n\n## Examples\n- \n\n## Questions\n- \n\n## Next Actions\n- [[calendar]] Review and summarize",
    },
    algorithm: {
      title: "Algorithm Note",
      content:
        "# Problem Context\n\n## Approach\n- \n\n## Complexity\n- Time: \n- Space: \n\n## Edge Cases\n- \n\n## Related\n- [[leetcode]]",
    },
    meeting: {
      title: "Meeting Notes",
      content:
        "# Agenda\n- \n\n## Discussion\n- \n\n## Decisions\n- \n\n## Action Items\n- [ ] \n\n## Follow-up\n- [[groups]]",
    },
    weekly_reflection: {
      title: "Weekly Reflection",
      content:
        "# Wins\n- \n\n# Challenges\n- \n\n# Learnings\n- \n\n# Focus Next Week\n- [[reading]]\n- [[leetcode]]",
    },
  };

  useEffect(() => {
    if (!activeNoteId && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
    if (activeNoteId && !notes.some((note) => note.id === activeNoteId)) {
      setActiveNoteId(notes[0]?.id ?? "");
    }
  }, [notes, activeNoteId]);

  useEffect(() => {
    const active = notes.find((note) => note.id === activeNoteId);
    if (!active) return;
    setTitle(active.title);
    setTemplate(active.template);
    setContent(active.content);
    setTagsInput(active.tags.join(", "));
    setLinkedModule(active.linkedModule ?? "none");
    setLinkedItemId(active.linkedItemId ?? "");
  }, [activeNoteId, notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [notes, search]);

  const wikilinks = useMemo(() => {
    const matches = content.matchAll(/\[\[([^[\]]+)\]\]/g);
    return [...new Set(Array.from(matches, (m) => m[1].trim()))];
  }, [content]);

  const resolvedWikilinks = useMemo(() => {
    return wikilinks.map((raw) => {
      const [prefix, ...rest] = raw.split(":");
      const maybeQuery = rest.join(":").trim();
      const normalizedPrefix = prefix.trim().toLowerCase();
      const hasPrefix = raw.includes(":");
      const lookupQuery = (hasPrefix ? maybeQuery : raw).toLowerCase();

      if (!lookupQuery && hasPrefix) {
        return { raw, status: "unresolved" as const };
      }

      if (normalizedPrefix === "leetcode" || (!hasPrefix && normalizedPrefix === "leetcode")) {
        return { raw, status: "route" as const, route: "/leetcode" };
      }
      if (normalizedPrefix === "reading" || (!hasPrefix && normalizedPrefix === "reading")) {
        return { raw, status: "route" as const, route: "/reading" };
      }
      if (normalizedPrefix === "calendar" || (!hasPrefix && normalizedPrefix === "calendar")) {
        return { raw, status: "route" as const, route: "/calendar" };
      }
      if (normalizedPrefix === "groups" || (!hasPrefix && normalizedPrefix === "groups")) {
        return { raw, status: "route" as const, route: "/groups" };
      }
      if (normalizedPrefix === "notes" || (!hasPrefix && normalizedPrefix === "notes")) {
        return { raw, status: "route" as const, route: "/notes" };
      }

      if (normalizedPrefix === "book" || normalizedPrefix === "reading") {
        const matchBook = books.find((book) =>
          book.title.toLowerCase().includes(lookupQuery)
        );
        if (matchBook) {
          return { raw, status: "route" as const, route: "/reading" };
        }
      }

      if (normalizedPrefix === "event" || normalizedPrefix === "calendar") {
        const matchEvent = events.find((event) =>
          event.title.toLowerCase().includes(lookupQuery)
        );
        if (matchEvent) {
          return { raw, status: "route" as const, route: "/calendar" };
        }
      }

      const noteQuery = hasPrefix ? (normalizedPrefix === "note" || normalizedPrefix === "notes" ? lookupQuery : "") : lookupQuery;
      if (noteQuery || !hasPrefix) {
        const target = notes.find((note) => note.title.toLowerCase().includes(noteQuery || lookupQuery));
        if (target) {
          return { raw, status: "note" as const, noteId: target.id };
        }
      }

      return { raw, status: "unresolved" as const };
    });
  }, [wikilinks, books, events, notes]);
  const resolvedLinkMap = useMemo(
    () => new Map(resolvedWikilinks.map((item) => [item.raw.toLowerCase(), item])),
    [resolvedWikilinks]
  );

  function resetDraft() {
    setActiveNoteId("");
    setTitle("");
    setTemplate("custom");
    setContent("");
    setTagsInput("");
    setLinkedModule("none");
    setLinkedItemId("");
  }

  function applyTemplate(nextTemplate: NoteTemplate) {
    const preset = templateBodies[nextTemplate];
    setTemplate(nextTemplate);
    if (!title.trim()) setTitle(preset.title);
    if (!content.trim()) setContent(preset.content);
  }

  function saveNote() {
    if (!title.trim()) return;
    upsertNote({
      id: activeNoteId || undefined,
      title: title.trim(),
      template,
      content,
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      linkedModule: linkedModule === "none" ? undefined : linkedModule,
      linkedItemId: linkedModule === "none" ? undefined : linkedItemId || undefined,
    });
  }

  function openResolvedWikilink(link: (typeof resolvedWikilinks)[number]) {
    if (link.status === "route") {
      navigate(link.route);
      return;
    }
    if (link.status === "note") {
      setActiveNoteId(link.noteId);
      return;
    }
  }

  function renderInline(text: string): ReactNode[] {
    const tokenRegex = /(\[\[[^[\]]+\]\]|\*\*[^*\n]+\*\*|`[^`\n]+`|\$[^$\n]+\$)/g;
    const parts = text.split(tokenRegex).filter(Boolean);
    return parts.map((part, idx) => {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const raw = part.slice(2, -2).trim();
        const resolved = resolvedLinkMap.get(raw.toLowerCase());
        if (!resolved || resolved.status === "unresolved") {
          return (
            <span key={`inline-${idx}`} className="inline-wikilink unresolved-wikilink">
              [[{raw}]]
            </span>
          );
        }
        return (
          <button
            key={`inline-${idx}`}
            type="button"
            className="inline-wikilink"
            onClick={() => openResolvedWikilink(resolved)}
          >
            [[{raw}]]
          </button>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`inline-${idx}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={`inline-${idx}`}>{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("$") && part.endsWith("$")) {
        return (
          <span key={`inline-${idx}`} className="inline-math">
            {part.slice(1, -1)}
          </span>
        );
      }
      return <span key={`inline-${idx}`}>{part}</span>;
    });
  }

  function renderMarkdownPreview(markdown: string): ReactNode {
    if (!markdown.trim()) {
      return <p>Start writing to preview markdown-like content.</p>;
    }
    const lines = markdown.replaceAll("\r\n", "\n").split("\n");
    const output: ReactNode[] = [];
    let paragraph: string[] = [];
    let listItems: string[] = [];
    let inCode = false;
    let codeLang = "";
    let codeLines: string[] = [];
    let inMathBlock = false;
    let mathLines: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length === 0) return;
      output.push(
        <p key={`p-${output.length}`}>{renderInline(paragraph.join(" "))}</p>
      );
      paragraph = [];
    };
    const flushList = () => {
      if (listItems.length === 0) return;
      output.push(
        <ul key={`ul-${output.length}`}>
          {listItems.map((item, idx) => (
            <li key={`li-${idx}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    };

    for (const line of lines) {
      if (line.startsWith("```")) {
        flushParagraph();
        flushList();
        if (!inCode) {
          inCode = true;
          codeLang = line.slice(3).trim();
          codeLines = [];
        } else {
          output.push(
            <pre key={`code-${output.length}`} className="markdown-code-block">
              <small>{codeLang || "code"}</small>
              <code>{codeLines.join("\n")}</code>
            </pre>
          );
          inCode = false;
          codeLang = "";
          codeLines = [];
        }
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }
      if (line.trim() === "$$") {
        flushParagraph();
        flushList();
        if (!inMathBlock) {
          inMathBlock = true;
          mathLines = [];
        } else {
          output.push(
            <div key={`math-${output.length}`} className="math-block">
              {mathLines.join("\n")}
            </div>
          );
          inMathBlock = false;
          mathLines = [];
        }
        continue;
      }
      if (inMathBlock) {
        mathLines.push(line);
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }
      if (line.startsWith("### ")) {
        flushParagraph();
        flushList();
        output.push(
          <h3 key={`h3-${output.length}`}>{renderInline(line.slice(4).trim())}</h3>
        );
        continue;
      }
      if (line.startsWith("## ")) {
        flushParagraph();
        flushList();
        output.push(
          <h2 key={`h2-${output.length}`}>{renderInline(line.slice(3).trim())}</h2>
        );
        continue;
      }
      if (line.startsWith("# ")) {
        flushParagraph();
        flushList();
        output.push(
          <h1 key={`h1-${output.length}`}>{renderInline(line.slice(2).trim())}</h1>
        );
        continue;
      }
      if (line.startsWith("- ")) {
        flushParagraph();
        listItems.push(line.slice(2).trim());
        continue;
      }
      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    if (inCode) {
      output.push(
        <pre key={`code-tail-${output.length}`} className="markdown-code-block">
          <small>{codeLang || "code"}</small>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
    }
    if (inMathBlock) {
      output.push(
        <div key={`math-tail-${output.length}`} className="math-block">
          {mathLines.join("\n")}
        </div>
      );
    }
    return <>{output}</>;
  }

  return (
    <PageCard
      title="Notes"
      subtitle="Quick capture and structured notes for lectures and algorithms."
    >
      <div className="actions-row">
        <button type="button" onClick={resetDraft}>
          New Note
        </button>
        <button type="button" className="button-secondary" onClick={saveNote}>
          Save Note
        </button>
      </div>

      <div className="notes-layout">
        <article className="tile notes-sidebar">
          <h2>Notes</h2>
          <input
            type="search"
            placeholder="Search notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="notes-list">
            {filteredNotes.map((note) => (
              <li key={note.id} className={note.id === activeNoteId ? "note-active" : ""}>
                <button type="button" onClick={() => setActiveNoteId(note.id)}>
                  <strong>{note.title}</strong>
                  <small>{new Date(note.updatedAt).toLocaleDateString()}</small>
                </button>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => {
                    deleteNote(note.id);
                    if (note.id === activeNoteId) resetDraft();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="tile">
          <h2>Editor</h2>
          <div className="problem-form-grid">
            <label>
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              <span>Template</span>
              <select
                value={template}
                onChange={(e) => applyTemplate(e.target.value as NoteTemplate)}
              >
                <option value="custom">Custom</option>
                <option value="lecture">Lecture Notes</option>
                <option value="algorithm">Algorithm Notes</option>
                <option value="meeting">Meeting Notes</option>
                <option value="weekly_reflection">Weekly Reflection</option>
              </select>
            </label>
            <label>
              <span>Linked Module</span>
              <select
                value={linkedModule}
                onChange={(e) =>
                  setLinkedModule(
                    e.target.value as "none" | "leetcode" | "reading" | "calendar" | "groups"
                  )
                }
              >
                <option value="none">None</option>
                <option value="leetcode">LeetCode</option>
                <option value="reading">Reading</option>
                <option value="calendar">Calendar</option>
                <option value="groups">Groups</option>
              </select>
            </label>
            {linkedModule === "leetcode" && (
              <label>
                <span>Linked Problem</span>
                <select
                  value={linkedItemId}
                  onChange={(e) => setLinkedItemId(e.target.value)}
                >
                  <option value="">None</option>
                  {problems.slice(0, 200).map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      #{problem.problemNumber} {problem.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {linkedModule === "reading" && (
              <label>
                <span>Linked Book</span>
                <select value={linkedItemId} onChange={(e) => setLinkedItemId(e.target.value)}>
                  <option value="">None</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {linkedModule === "calendar" && (
              <label>
                <span>Linked Event</span>
                <select value={linkedItemId} onChange={(e) => setLinkedItemId(e.target.value)}>
                  <option value="">None</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {linkedModule === "groups" && (
              <label>
                <span>Linked Group</span>
                <select value={linkedItemId} onChange={(e) => setLinkedItemId(e.target.value)}>
                  <option value="">None</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="full-width">
              <span>Tags (comma-separated)</span>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </label>
            <label className="full-width">
              <span>Content (Markdown + [[wikilink]])</span>
              <textarea
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="tile notes-preview">
          <h2>Preview</h2>
          <div className="markdown-preview">{renderMarkdownPreview(content)}</div>
          {resolvedWikilinks.length > 0 && (
            <div className="notes-wikilinks">
              <strong>Detected Wikilinks</strong>
              <div className="chip-list">
                {resolvedWikilinks.map((link) => (
                  <button
                    key={link.raw}
                    type="button"
                    className={link.status === "unresolved" ? "button-danger" : "button-secondary"}
                    disabled={link.status === "unresolved"}
                    onClick={() => openResolvedWikilink(link)}
                  >
                    [[{link.raw}]]
                  </button>
                ))}
              </div>
              <small>
                Syntax: `[[leetcode]]`, `[[reading]]`, `[[note:Lecture Notes]]`, `[[calendar:Midterm]]`.
              </small>
            </div>
          )}
        </article>
      </div>
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
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  function onThemeChange(value: ThemePreference) {
    updateSettings({ themePreference: value });
  }

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  async function requestNotificationPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
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
          <div className="sync-box">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(event) =>
                updateSettings({ notificationsEnabled: event.target.checked })
              }
            />
            <small>
              Browser permission: {notificationPermission}
            </small>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void requestNotificationPermission()}
              disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}
            >
              Request Browser Permission
            </button>
          </div>
        </label>
        <label className="setting-row">
          <span>Daily digest</span>
          <input
            type="checkbox"
            checked={settings.dailyDigestEnabled}
            disabled={!settings.notificationsEnabled}
            onChange={(event) =>
              updateSettings({ dailyDigestEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>Daily digest time</span>
          <input
            type="time"
            value={settings.dailyDigestTime}
            disabled={!settings.notificationsEnabled || !settings.dailyDigestEnabled}
            onChange={(event) =>
              updateSettings({ dailyDigestTime: event.target.value || "08:00" })
            }
          />
        </label>
        <label className="setting-row">
          <span>Event reminders</span>
          <input
            type="checkbox"
            checked={settings.eventRemindersEnabled}
            disabled={!settings.notificationsEnabled}
            onChange={(event) =>
              updateSettings({ eventRemindersEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>Review reminders</span>
          <input
            type="checkbox"
            checked={settings.reviewRemindersEnabled}
            disabled={!settings.notificationsEnabled}
            onChange={(event) =>
              updateSettings({ reviewRemindersEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>Review reminder time</span>
          <input
            type="time"
            value={settings.reviewReminderTime}
            disabled={!settings.notificationsEnabled || !settings.reviewRemindersEnabled}
            onChange={(event) =>
              updateSettings({ reviewReminderTime: event.target.value || "18:30" })
            }
          />
        </label>
        <label className="setting-row">
          <span>Streak reminders</span>
          <input
            type="checkbox"
            checked={settings.streakRemindersEnabled}
            disabled={!settings.notificationsEnabled}
            onChange={(event) =>
              updateSettings({ streakRemindersEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>Streak reminder time</span>
          <input
            type="time"
            value={settings.streakReminderTime}
            disabled={!settings.notificationsEnabled || !settings.streakRemindersEnabled}
            onChange={(event) =>
              updateSettings({ streakReminderTime: event.target.value || "20:00" })
            }
          />
        </label>
        <label className="setting-row">
          <span>Quiet hours</span>
          <input
            type="checkbox"
            checked={settings.quietHoursEnabled}
            disabled={!settings.notificationsEnabled}
            onChange={(event) =>
              updateSettings({ quietHoursEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>Quiet hours start</span>
          <input
            type="time"
            value={settings.quietHoursStart}
            disabled={!settings.notificationsEnabled || !settings.quietHoursEnabled}
            onChange={(event) =>
              updateSettings({ quietHoursStart: event.target.value || "23:00" })
            }
          />
        </label>
        <label className="setting-row">
          <span>Quiet hours end</span>
          <input
            type="time"
            value={settings.quietHoursEnd}
            disabled={!settings.notificationsEnabled || !settings.quietHoursEnabled}
            onChange={(event) =>
              updateSettings({ quietHoursEnd: event.target.value || "07:00" })
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
          <span>Accent color</span>
          <div className="accent-picker-row">
            <input
              type="color"
              value={settings.accentColor}
              onChange={(event) => updateSettings({ accentColor: event.target.value })}
            />
            <div className="chip-list chip-list-inline">
              {["#58a6ff", "#7ee787", "#d2a8ff", "#ffb86b", "#f47067"].map((color) => (
                <button
                  key={color}
                  type="button"
                  className="accent-swatch"
                  style={{ background: color }}
                  onClick={() => updateSettings({ accentColor: color })}
                  aria-label={`Set accent ${color}`}
                />
              ))}
            </div>
          </div>
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
            {typeof syncMetadata.lastCreatedCount === "number" && (
              <small>Created: {syncMetadata.lastCreatedCount}</small>
            )}
            {typeof syncMetadata.lastMergedCount === "number" && (
              <small>Merged: {syncMetadata.lastMergedCount}</small>
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
  const navigate = useNavigate();
  const hydrated = useAppStore((state) => state.hydrated);
  const hydrate = useAppStore((state) => state.hydrate);
  const settings = useAppStore((state) => state.settings);
  const events = useAppStore((state) => state.events);
  const notes = useAppStore((state) => state.notes);
  const books = useAppStore((state) => state.books);
  const groups = useAppStore((state) => state.groups);
  const problems = useAppStore((state) => state.problems);
  const knowledgePoints = useAppStore((state) => state.knowledgePoints);
  const themePreference = useAppStore((state) => state.settings.themePreference);
  const accentColor = useAppStore((state) => state.settings.accentColor);
  const notifiedReminderIdsRef = useRef<Set<string>>(new Set());
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [topbarSearchOpen, setTopbarSearchOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.body.dataset.theme = themePreference;
  }, [themePreference]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentColor || "#58a6ff");
  }, [accentColor]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        setTopbarSearchOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        navigate("/settings");
      }
      if ((event.metaKey || event.ctrlKey) && ["1", "2", "3", "4", "5", "6"].includes(event.key)) {
        event.preventDefault();
        const routeMap: Record<string, string> = {
          "1": "/",
          "2": "/leetcode",
          "3": "/reading",
          "4": "/calendar",
          "5": "/notes",
          "6": "/groups",
        };
        navigate(routeMap[event.key] ?? "/");
      }
      if (event.key === "?" || ((event.metaKey || event.ctrlKey) && event.key === "/")) {
        event.preventDefault();
        setShortcutHelpOpen(true);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
        setTopbarSearchOpen(false);
        setShortcutHelpOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const commandResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    const base = [
      { id: "go-home", label: "Go to Dashboard", description: "Open dashboard", route: "/" },
      { id: "go-leetcode", label: "Go to LeetCode", description: "Problem tracking", route: "/leetcode" },
      { id: "go-reading", label: "Go to Reading", description: "Books and knowledge points", route: "/reading" },
      { id: "go-calendar", label: "Go to Calendar", description: "Schedule and reminders", route: "/calendar" },
      { id: "go-notes", label: "Go to Notes", description: "Quick notes and templates", route: "/notes" },
      { id: "go-groups", label: "Go to Groups", description: "Study groups", route: "/groups" },
      { id: "go-settings", label: "Go to Settings", description: "Preferences", route: "/settings" },
    ];
    const dynamic = [
      ...notes.map((note) => ({
        id: `note-${note.id}`,
        label: `Note: ${note.title}`,
        description: "Open Notes module",
        route: "/notes",
      })),
      ...books.map((book) => ({
        id: `book-${book.id}`,
        label: `Book: ${book.title}`,
        description: "Open Reading module",
        route: "/reading",
      })),
      ...events.map((event) => ({
        id: `event-${event.id}`,
        label: `Event: ${event.title}`,
        description: "Open Calendar module",
        route: "/calendar",
      })),
      ...groups.map((group) => ({
        id: `group-${group.id}`,
        label: `Group: ${group.name}`,
        description: "Open Groups module",
        route: "/groups",
      })),
      ...problems.map((problem) => ({
        id: `problem-${problem.id}`,
        label: `Problem #${problem.problemNumber}: ${problem.title}`,
        description: "Open LeetCode module",
        route: "/leetcode",
      })),
      ...knowledgePoints.map((point) => ({
        id: `kp-${point.id}`,
        label: `Knowledge: ${point.title}`,
        description: "Open Reading module",
        route: "/reading",
      })),
    ];
    const all = [...base, ...dynamic];
    if (!q) return all.slice(0, 12);
    return all
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [globalSearchQuery, notes, books, events, groups, problems, knowledgePoints]);

  function runCommand(route: string) {
    navigate(route);
    setCommandPaletteOpen(false);
    setTopbarSearchOpen(false);
    setGlobalSearchQuery("");
  }

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (!settings.notificationsEnabled) return;
    if (Notification.permission !== "granted") return;

    function isWithinQuietHours(date: Date): boolean {
      if (!settings.quietHoursEnabled) return false;
      const [startHour, startMinute] = settings.quietHoursStart.split(":").map(Number);
      const [endHour, endMinute] = settings.quietHoursEnd.split(":").map(Number);
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      const currentTotal = date.getHours() * 60 + date.getMinutes();
      if (startTotal === endTotal) return false;
      if (startTotal < endTotal) {
        return currentTotal >= startTotal && currentTotal < endTotal;
      }
      return currentTotal >= startTotal || currentTotal < endTotal;
    }

    function expandEventsInRange(rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
      const result: CalendarEvent[] = [];
      for (const event of events) {
        const recurrence = event.recurrence ?? "none";
        if (recurrence === "none") {
          const eventDate = new Date(event.startTime);
          if (eventDate >= rangeStart && eventDate < rangeEnd) {
            result.push(event);
          }
          continue;
        }
        const baseStart = new Date(event.startTime);
        const baseEnd = new Date(event.endTime);
        const durationMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 30 * 60000);
        const until = event.recurrenceUntil
          ? new Date(`${event.recurrenceUntil}T23:59:59`)
          : new Date(rangeEnd);
        let cursor = new Date(baseStart);
        let guard = 0;
        while (cursor < rangeEnd && cursor <= until && guard < 500) {
          if (cursor >= rangeStart) {
            const occurrenceStart = new Date(cursor);
            const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
            result.push({
              ...event,
              startTime: occurrenceStart.toISOString(),
              endTime: occurrenceEnd.toISOString(),
            });
          }
          if (recurrence === "daily") {
            cursor.setDate(cursor.getDate() + 1);
          } else if (recurrence === "weekly") {
            cursor.setDate(cursor.getDate() + 7);
          } else {
            cursor.setMonth(cursor.getMonth() + 1);
          }
          guard += 1;
        }
      }
      return result;
    }

    function tick() {
      const now = new Date();
      const horizon = new Date(now);
      horizon.setHours(horizon.getHours() + 24);
      const triggerWindowMs = 45_000;
      const todayKey = now.toISOString().slice(0, 10);
      const todayAtConfigured = new Date(`${todayKey}T${settings.dailyDigestTime}:00`);
      const todayAtReviewReminder = new Date(`${todayKey}T${settings.reviewReminderTime}:00`);
      const todayAtStreakReminder = new Date(`${todayKey}T${settings.streakReminderTime}:00`);

      if (settings.eventRemindersEnabled) {
        const occurrences = expandEventsInRange(now, horizon)
          .filter((event) => typeof event.reminderMinutesBefore === "number")
          .map((event) => {
            const reminderAt = new Date(
              new Date(event.startTime).getTime() - (event.reminderMinutesBefore ?? 0) * 60000
            );
            const reminderKey = `${event.id}::${event.startTime}::${event.reminderMinutesBefore ?? 0}`;
            return { event, reminderAt, reminderKey };
          });

        occurrences.forEach(({ event, reminderAt, reminderKey }) => {
          const delta = now.getTime() - reminderAt.getTime();
          if (delta < 0 || delta > triggerWindowMs) return;
          if (notifiedReminderIdsRef.current.has(reminderKey)) return;
          notifiedReminderIdsRef.current.add(reminderKey);
          if (isWithinQuietHours(reminderAt)) return;

          const title = `Upcoming: ${event.title}`;
          const body = `${new Date(event.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })} • ${event.type}`;
          new Notification(title, { body, tag: reminderKey });
        });
      }

      if (settings.dailyDigestEnabled) {
        const digestKey = `digest::${todayKey}`;
        const delta = now.getTime() - todayAtConfigured.getTime();
        if (
          delta >= 0 &&
          delta <= triggerWindowMs &&
          !notifiedReminderIdsRef.current.has(digestKey)
        ) {
          notifiedReminderIdsRef.current.add(digestKey);
          if (!isWithinQuietHours(now)) {
            const todayEventCount = events.filter(
              (event) => event.startTime.slice(0, 10) === todayKey
            ).length;
            const reviewDueProblems = problems.filter(
              (item) =>
                item.nextReviewDate &&
                item.nextReviewDate.slice(0, 10) <= todayKey &&
                (item.status === "Solved" || item.status === "Review")
            ).length;
            const reviewDueKnowledge = knowledgePoints.filter(
              (point) =>
                point.nextReviewDate && point.nextReviewDate.slice(0, 10) <= todayKey
            ).length;
            new Notification("Daily Study Digest", {
              body: `Today: ${todayEventCount} events, ${reviewDueProblems} LeetCode reviews, ${reviewDueKnowledge} reading reviews.`,
              tag: digestKey,
            });
          }
        }
      }

      if (settings.streakRemindersEnabled) {
        const streakKey = `streak::${todayKey}`;
        const delta = now.getTime() - todayAtStreakReminder.getTime();
        if (
          delta >= 0 &&
          delta <= triggerWindowMs &&
          !notifiedReminderIdsRef.current.has(streakKey)
        ) {
          notifiedReminderIdsRef.current.add(streakKey);
          if (!isWithinQuietHours(now)) {
            const solvedToday = problems.some(
              (item) =>
                item.status === "Solved" &&
                (item.dateSolved ?? item.updatedAt).slice(0, 10) === todayKey
            );
            if (!solvedToday) {
              new Notification("Keep your streak alive", {
                body: "Solve at least one problem today to maintain your LeetCode streak.",
                tag: streakKey,
              });
            }
          }
        }
      }

      if (settings.reviewRemindersEnabled) {
        const reviewKey = `review::${todayKey}`;
        const delta = now.getTime() - todayAtReviewReminder.getTime();
        if (
          delta >= 0 &&
          delta <= triggerWindowMs &&
          !notifiedReminderIdsRef.current.has(reviewKey)
        ) {
          notifiedReminderIdsRef.current.add(reviewKey);
          if (!isWithinQuietHours(now)) {
            const reviewDueProblems = problems.filter(
              (item) =>
                item.nextReviewDate &&
                item.nextReviewDate.slice(0, 10) <= todayKey &&
                (item.status === "Solved" || item.status === "Review")
            ).length;
            const reviewDueKnowledge = knowledgePoints.filter(
              (point) =>
                point.nextReviewDate && point.nextReviewDate.slice(0, 10) <= todayKey
            ).length;
            if (reviewDueProblems + reviewDueKnowledge > 0) {
              new Notification("Review queue due", {
                body: `${reviewDueProblems} problems and ${reviewDueKnowledge} knowledge cards are due.`,
                tag: reviewKey,
              });
            }
          }
        }
      }
    }

    tick();
    const intervalId = window.setInterval(tick, 15_000);
    return () => window.clearInterval(intervalId);
  }, [
    settings.notificationsEnabled,
    settings.dailyDigestEnabled,
    settings.dailyDigestTime,
    settings.eventRemindersEnabled,
    settings.reviewRemindersEnabled,
    settings.reviewReminderTime,
    settings.streakRemindersEnabled,
    settings.streakReminderTime,
    settings.quietHoursEnabled,
    settings.quietHoursStart,
    settings.quietHoursEnd,
    events,
    problems,
    knowledgePoints,
  ]);

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
          <div className="global-search-wrap">
            <input
              type="search"
              placeholder={`${t("searchPlaceholder")} (⌘/Ctrl+K)`}
              value={globalSearchQuery}
              onChange={(event) => setGlobalSearchQuery(event.target.value)}
              onFocus={() => setTopbarSearchOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setTopbarSearchOpen(false), 120);
              }}
            />
            {topbarSearchOpen && (
              <div className="global-search-results">
                {commandResults.length === 0 && <small>No results</small>}
                {commandResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => runCommand(item.route)}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button">AI Panel</button>
          <button
            type="button"
            onClick={() => {
              setCommandPaletteOpen(true);
              setTopbarSearchOpen(false);
            }}
          >
            Command Palette
          </button>
          <button type="button" onClick={() => setShortcutHelpOpen(true)}>
            Shortcuts
          </button>
        </header>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leetcode" element={<LeetCodePage />} />
          <Route path="/leetcode/topic/:topicName" element={<TopicDeepDivePage />} />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {commandPaletteOpen && (
        <div className="command-palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()}>
            <input
              autoFocus
              type="search"
              placeholder="Type a command or search..."
              value={globalSearchQuery}
              onChange={(event) => setGlobalSearchQuery(event.target.value)}
            />
            <div className="command-list">
              {commandResults.length === 0 && <small>No matching command</small>}
              {commandResults.map((item) => (
                <button key={`cp-${item.id}`} type="button" onClick={() => runCommand(item.route)}>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {shortcutHelpOpen && (
        <div className="command-palette-overlay" onClick={() => setShortcutHelpOpen(false)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()}>
            <h2>Keyboard Shortcuts</h2>
            <div className="shortcut-list">
              <div><kbd>⌘/Ctrl</kbd> + <kbd>K</kbd> <span>Open command palette</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>1</kbd> <span>Go to Dashboard</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>2</kbd> <span>Go to LeetCode</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>3</kbd> <span>Go to Reading</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>4</kbd> <span>Go to Calendar</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>5</kbd> <span>Go to Notes</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>6</kbd> <span>Go to Groups</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>,</kbd> <span>Open Settings</span></div>
              <div><kbd>?</kbd> <span>Open this shortcut help</span></div>
              <div><kbd>Esc</kbd> <span>Close overlays</span></div>
            </div>
            <div className="actions-row">
              <button type="button" onClick={() => setShortcutHelpOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
