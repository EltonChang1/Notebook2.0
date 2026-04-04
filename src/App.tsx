import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { RowComponentProps } from "react-window";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import type { Session } from "@supabase/supabase-js";
import type {
  BookStatus,
  CalendarEvent,
  Difficulty,
  EventType,
  Importance,
  KnowledgePoint,
  LeetCodeProblem,
  NoteTemplate,
  ProblemStatus,
  ThemePreference,
} from "./models/domain";
import { useAppStore } from "./store/appStore";
import { buildCsvTemplate, previewCsvImport } from "./lib/csvImport";
import type { AiStreamRequest } from "./lib/ai";
import { consumeAiQuota, sanitizeAiPrompt } from "./lib/aiSafety";
import {
  clearAiAuditEntries,
  exportAiAuditReport,
  getAiAuditEntries,
  recordAiAuditEntry,
  type AiAuditEntry,
  verifyAiAuditChain,
} from "./lib/aiAudit";
import {
  clearSessionUnlockedByokKey,
  createPassphraseHash,
  decryptAtRestSecret,
  getSessionUnlockedByokKey,
  setSessionUnlockedByokKey,
  verifyPassphrase,
} from "./lib/cryptoVault";
import {
  getCurrentSession,
  isAuthConfigured,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signInWithOAuth,
  signOutCurrentUser,
  signUpWithEmailPassword,
  subscribeAuthState,
} from "./lib/auth";

type NavItem = {
  to: string;
  labelKey: string;
  icon: string;
};

type AiChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  at: string;
};

let aiModulePromise: Promise<typeof import("./lib/ai")> | null = null;
async function* streamAiResponseLazy(request: AiStreamRequest): AsyncGenerator<string> {
  aiModulePromise ??= import("./lib/ai");
  const { streamAiResponse } = await aiModulePromise;
  for await (const chunk of streamAiResponse(request)) {
    yield chunk;
  }
}

const navItems: NavItem[] = [
  { to: "/", labelKey: "nav.dashboard", icon: "🏠" },
  { to: "/leetcode", labelKey: "nav.leetcode", icon: "📊" },
  { to: "/reading", labelKey: "nav.reading", icon: "📚" },
  { to: "/calendar", labelKey: "nav.calendar", icon: "📅" },
  { to: "/notes", labelKey: "nav.notes", icon: "📝" },
  { to: "/groups", labelKey: "nav.groups", icon: "👥" },
];

const LazyDashboardPage = lazy(() => import("./routes/DashboardPageRoute"));
const LazyLeetCodePage = lazy(() => import("./routes/LeetCodePageRoute"));
const LazyTopicDeepDivePage = lazy(() => import("./routes/TopicDeepDivePageRoute"));
const LazyReadingPage = lazy(() => import("./routes/ReadingPageRoute"));
const LazyCalendarPage = lazy(() => import("./routes/CalendarPageRoute"));
const LazyNotesPage = lazy(() => import("./routes/NotesPageRoute"));
const LazyGroupsPage = lazy(() => import("./routes/GroupsPageRoute"));
const LazySettingsPage = lazy(() => import("./routes/SettingsPageRoute"));
const LazyNotFoundPage = lazy(() => import("./routes/NotFoundPageRoute"));

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

function AuthPage({
  loading,
  onAuthenticated,
}: {
  loading: boolean;
  onAuthenticated: (session: Session | null) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (mode === "signin") {
        const { data, error } = await signInWithEmailPassword(email.trim(), password);
        if (error) {
          setAuthMessage(error.message);
          return;
        }
        onAuthenticated(data.session ?? null);
        return;
      }
      if (mode === "signup") {
        const { error } = await signUpWithEmailPassword(email.trim(), password);
        if (error) {
          setAuthMessage(error.message);
          return;
        }
        setAuthMessage("Sign-up successful. Check your inbox to confirm your account.");
        return;
      }
      const { error } = await sendPasswordResetEmail(email.trim());
      if (error) {
        setAuthMessage(error.message);
        return;
      }
      setAuthMessage("Password reset email sent.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function startOAuth(provider: "github" | "google" | "apple") {
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const { error } = await signInWithOAuth(provider);
      if (error) {
        setAuthMessage(error.message);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <h1>Notebook 2.0</h1>
        <p>{t("auth.subtitle")}</p>
        {!isAuthConfigured && (
          <div className="auth-warning">
            <strong>Auth not configured</strong>
            <small>
              {t("auth.notConfigured")}
            </small>
          </div>
        )}
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={mode === "signin" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => setMode("signin")}
            disabled={authBusy || loading}
          >
            {t("auth.signIn")}
          </button>
          <button
            type="button"
            className={mode === "signup" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => setMode("signup")}
            disabled={authBusy || loading}
          >
            {t("auth.signUp")}
          </button>
          <button
            type="button"
            className={mode === "forgot" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => setMode("forgot")}
            disabled={authBusy || loading}
          >
            {t("auth.forgot")}
          </button>
        </div>
        <form className="auth-form" onSubmit={submitAuth}>
          <label>
              <span>{t("auth.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {mode !== "forgot" && (
            <label>
              <span>{t("auth.password")}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
          )}
          <button type="submit" disabled={authBusy || loading || !isAuthConfigured}>
            {mode === "signin"
              ? t("auth.signIn")
              : mode === "signup"
                ? t("auth.createAccount")
                : t("auth.sendReset")}
          </button>
        </form>
        <div className="auth-oauth">
          <small>{t("auth.continueWith")}</small>
          <div className="actions-row">
            <button
              type="button"
              className="button-secondary"
              disabled={authBusy || loading || !isAuthConfigured}
              onClick={() => void startOAuth("github")}
            >
              {t("auth.github")}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={authBusy || loading || !isAuthConfigured}
              onClick={() => void startOAuth("google")}
            >
              {t("auth.google")}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={authBusy || loading || !isAuthConfigured}
              onClick={() => void startOAuth("apple")}
            >
              {t("auth.apple")}
            </button>
          </div>
        </div>
        {(authMessage || loading) && (
          <small>{loading ? "Checking session..." : authMessage}</small>
        )}
      </section>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
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
      title={t("pages.dashboard.title")}
      subtitle={t("pages.dashboard.subtitle")}
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
  const { t } = useTranslation();
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
        <span className={`badge ${problem.verified ? "badge-verified" : "badge-unverified"}`}>
          {problem.verified ? t("leetcode.verified") : t("leetcode.unverified")}
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
            {t("common.edit")}
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={() => onDelete(problem.id)}
          >
            {t("common.delete")}
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
  const { t } = useTranslation();
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
          <span>{t("leetcode.problemNumberLabel")}</span>
          <input
            value={form.problemNumber}
            onChange={(event) => onChange("problemNumber", event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t("leetcode.title")}</span>
          <input
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t("leetcode.difficulty")}</span>
          <select
            value={form.difficulty}
            onChange={(event) =>
              onChange("difficulty", event.target.value as Difficulty)
            }
          >
            <option>{t("leetcode.easy")}</option>
            <option>{t("leetcode.medium")}</option>
            <option>{t("leetcode.hard")}</option>
          </select>
        </label>
        <label>
          <span>{t("leetcode.status")}</span>
          <select
            value={form.status}
            onChange={(event) =>
              onChange("status", event.target.value as ProblemStatus)
            }
          >
            <option>{t("leetcode.solved")}</option>
            <option>{t("leetcode.attempted")}</option>
            <option>{t("leetcode.review")}</option>
            <option>{t("leetcode.stuck")}</option>
          </select>
        </label>
        <label>
          <span>{t("leetcode.confidenceOneToFive")}</span>
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
          <span>{t("leetcode.dateSolved")}</span>
          <input
            type="date"
            value={form.dateSolved}
            onChange={(event) => onChange("dateSolved", event.target.value)}
          />
        </label>
        <label>
          <span>{t("leetcode.timeMin")}</span>
          <input
            type="number"
            min={1}
            value={form.timeMinutes}
            onChange={(event) => onChange("timeMinutes", event.target.value)}
          />
        </label>
        <label>
          <span>{t("leetcode.solutionLink")}</span>
          <input
            type="url"
            placeholder={t("leetcode.solutionLinkPlaceholder")}
            value={form.solutionLink}
            onChange={(event) => onChange("solutionLink", event.target.value)}
          />
        </label>
        <label className="full-width">
          <span>{t("leetcode.topicsCommaSeparated")}</span>
          <input
            value={form.topics}
            placeholder={t("leetcode.topicsPlaceholder")}
            onChange={(event) => onChange("topics", event.target.value)}
          />
        </label>
        <label className="full-width">
          <span>{t("leetcode.approach")}</span>
          <textarea
            rows={3}
            value={form.approach}
            onChange={(event) => onChange("approach", event.target.value)}
          />
        </label>
      </div>
      <div className="actions-row">
        <button type="submit">{form.id ? t("leetcode.updateProblem") : t("leetcode.addProblem")}</button>
        <button type="button" className="button-secondary" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function LeetCodePage() {
  const { t } = useTranslation();
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
  const [aiProblemId, setAiProblemId] = useState<string>("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isMobileLeetCode, setIsMobileLeetCode] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth <= 880
  );
  const [VirtualListComponent, setVirtualListComponent] = useState<
    ((props: Record<string, unknown>) => ReactNode) | null
  >(null);

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

  useEffect(() => {
    if (!aiProblemId && sortedFiltered.length > 0) {
      setAiProblemId(sortedFiltered[0].id);
    }
    if (aiProblemId && !sortedFiltered.some((problem) => problem.id === aiProblemId)) {
      setAiProblemId(sortedFiltered[0]?.id ?? "");
    }
  }, [aiProblemId, sortedFiltered]);

  useEffect(() => {
    function onResize() {
      setIsMobileLeetCode(window.innerWidth <= 880);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let active = true;
    void import("react-window").then((module) => {
      if (!active) return;
      setVirtualListComponent(() => module.List as unknown as (props: Record<string, unknown>) => ReactNode);
    });
    return () => {
      active = false;
    };
  }, []);

  const syncHealthState = useMemo<"healthy" | "warning" | "critical">(() => {
    if (!settings.leetCodeUsername.trim()) return "critical";
    if (syncMetadata.status === "error" || syncMetadata.consecutiveFailures >= 3) return "critical";
    if (!syncMetadata.lastSyncAt) return "warning";
    const since = Date.now() - new Date(syncMetadata.lastSyncAt).getTime();
    if (since > 36 * 60 * 60 * 1000) return "critical";
    if (since > 24 * 60 * 60 * 1000) return "warning";
    return "healthy";
  }, [settings.leetCodeUsername, syncMetadata.status, syncMetadata.consecutiveFailures, syncMetadata.lastSyncAt]);

  const nextAutoSyncAt = useMemo(() => {
    if (!syncMetadata.lastSyncAt) return null;
    return new Date(new Date(syncMetadata.lastSyncAt).getTime() + 24 * 60 * 60 * 1000);
  }, [syncMetadata.lastSyncAt]);

  async function runLeetCodeAi(mode: "hints" | "explain" | "pattern") {
    if (!settings.aiEnabled) {
      setAiOutput(t("ai.messages.enableFirst"));
      return;
    }
    if (!settings.aiFeatureLeetCodeHints) {
      setAiOutput(t("ai.messages.leetcodeHintsDisabled"));
      return;
    }
    if (!settings.aiPrivacyAcknowledged) {
      setAiOutput(t("ai.messages.acknowledgePrivacy"));
      return;
    }
    if (settings.aiProvider === "byok" && !settings.aiApiKey.trim()) {
      setAiOutput(t("ai.messages.byokMissing"));
      return;
    }
    const quota = consumeAiQuota(settings.aiProvider);
    if (!quota.ok) {
      recordAiAuditEntry({
        module: "LeetCode",
        action: `leetcode_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: 0,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_quota",
      });
      setAiOutput(t("ai.messages.freeTierReached"));
      return;
    }
    const target = problems.find((problem) => problem.id === aiProblemId);
    if (!target) {
      setAiOutput(t("leetcode.selectProblemFirst"));
      return;
    }
    const promptMap = {
      hints: `Give progressive hints (level 1 to 3) for problem #${target.problemNumber} ${target.title}. Avoid full solution until last hint.`,
      explain: `Explain an ideal solution for #${target.problemNumber} ${target.title} with intuition, complexity, and edge cases.`,
      pattern: `Identify likely patterns for #${target.problemNumber} ${target.title}. Mention what signals in prompt indicate each pattern.`,
    } as const;
    const rawPrompt = promptMap[mode];
    const safePrompt = sanitizeAiPrompt(rawPrompt);
    if (!safePrompt) {
      recordAiAuditEntry({
        module: "LeetCode",
        action: `leetcode_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_validation",
      });
      setAiOutput(t("ai.messages.invalidPrompt"));
      return;
    }
    recordAiAuditEntry({
      module: "LeetCode",
      action: `leetcode_${mode}`,
      provider: settings.aiProvider,
      model: settings.aiModel,
      promptChars: rawPrompt.length,
      sanitizedChars: safePrompt.length,
      quotaLimit: quota.limit,
      quotaUsed: quota.used,
      quotaRemaining: quota.remaining,
      outcome: "allowed",
    });
    setAiLoading(true);
    setAiOutput("");
    try {
      for await (const chunk of streamAiResponseLazy({
        prompt: safePrompt,
        moduleName: "LeetCode",
        backend: settings.aiBackend,
        provider: settings.aiProvider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        context: {
          problemsCount: problems.length,
        },
      })) {
        setAiOutput((prev) => prev + chunk);
      }
      recordAiAuditEntry({
        module: "LeetCode",
        action: `leetcode_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "success",
      });
    } catch {
      recordAiAuditEntry({
        module: "LeetCode",
        action: `leetcode_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "error",
      });
      setAiOutput(t("ai.messages.providerError"));
    } finally {
      setAiLoading(false);
    }
  }

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
      title={t("pages.leetcode.title")}
      subtitle={t("pages.leetcode.subtitle")}
    >
      <div className="grid">
        <article className="tile">
          <h2>{t("leetcode.quickAddTitle")}</h2>
          <p>{t("leetcode.quickAddDesc")}</p>
        </article>
        <article className="tile">
          <h2>{t("leetcode.syncStatusTitle")}</h2>
          <p>
            {settings.leetCodeUsername
              ? t("leetcode.connectedAs", { username: settings.leetCodeUsername })
              : t("leetcode.disconnected")}
          </p>
          <p>{t("leetcode.syncMethodStatus", { method: syncMetadata.method, status: syncMetadata.status })}</p>
          {typeof syncMetadata.lastImportedCount === "number" && (
            <p>{t("leetcode.importedThisRun", { count: syncMetadata.lastImportedCount })}</p>
          )}
          {typeof syncMetadata.lastCreatedCount === "number" && (
            <p>{t("leetcode.createdCount", { count: syncMetadata.lastCreatedCount })}</p>
          )}
          {typeof syncMetadata.lastMergedCount === "number" && (
            <p>{t("leetcode.mergedCount", { count: syncMetadata.lastMergedCount })}</p>
          )}
          {typeof syncMetadata.scrapeSolvedCount === "number" && (
            <p>{t("leetcode.scrapeSolvedCount", { count: syncMetadata.scrapeSolvedCount })}</p>
          )}
          {syncMetadata.activeStep && <p>{t("leetcode.activeStep", { step: syncMetadata.activeStep })}</p>}
          {syncMetadata.lastAttemptMethods.length > 0 && (
            <p>{t("leetcode.attemptChain", { chain: syncMetadata.lastAttemptMethods.join(" -> ") })}</p>
          )}
          <p>
            {t("leetcode.lastSync")}{" "}
            {syncMetadata.lastSyncAt
              ? new Date(syncMetadata.lastSyncAt).toLocaleString()
              : t("leetcode.never")}
          </p>
          <p>{t("leetcode.failures", { count: syncMetadata.consecutiveFailures })}</p>
          {syncMetadata.lastError && <p>{t("leetcode.error", { message: syncMetadata.lastError })}</p>}
          <p>
            {t("leetcode.syncHealth")}:{" "}
            <span className={`sync-health sync-health-${syncHealthState}`}>
              {t(`leetcode.health.${syncHealthState}`)}
            </span>
          </p>
          <p>
            {t("leetcode.nextAutoSync")}{" "}
            {nextAutoSyncAt ? nextAutoSyncAt.toLocaleString() : t("leetcode.afterFirstSync")}
          </p>
          <div className="actions-row">
            <button
              type="button"
              disabled={syncMetadata.status === "syncing"}
              onClick={() => void runLeetCodeSync()}
            >
              {t("leetcode.syncNow")}
            </button>
          </div>
          <div className="csv-import-box">
            <small>{t("leetcode.csvFallbackHint")}</small>
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
                {showCsvPreview ? t("leetcode.hidePreview") : t("leetcode.previewCsv")}
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
                    t("leetcode.csvImportSummary", {
                      imported: result.importedCount,
                      created: result.createdCount,
                      merged: result.mergedCount,
                      invalid: result.invalidCount,
                      skipped: result.skippedConflicts,
                    })
                  );
                }}
              >
                {t("leetcode.importCsvText")}
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
                {t("leetcode.downloadTemplate")}
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
                  {t("leetcode.downloadConflictReport")}
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
                  {t("leetcode.downloadConflictCsv")}
                </button>
              )}
            </div>
            {csvImportMessage && <small>{csvImportMessage}</small>}
            {showCsvPreview && (
              <div className="csv-preview">
                <small>
                  {t("leetcode.previewSummary", {
                    valid: csvPreview.validRows.length,
                    invalid: csvPreview.invalidRows.length,
                    created: csvPreview.createdCount,
                    merged: csvPreview.mergedCount,
                  })}
                </small>
                {csvPreview.invalidRows.slice(0, 5).map((row) => (
                  <small key={`${row.line}-${row.reason}`}>{`L${row.line}: ${row.reason}`}</small>
                ))}
                {csvConflicts.length > 0 && (
                  <div className="conflict-review-panel">
                    <div className="conflict-review-header">
                      <strong>{t("leetcode.conflictReview", { count: csvConflicts.length })}</strong>
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
                          {t("leetcode.applyAll")}
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => setAllowedConflictNumbers([])}
                        >
                          {t("leetcode.rejectAll")}
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
                          {t("leetcode.resetFieldSelections")}
                        </button>
                      </div>
                    </div>
                    <div className="conflict-summary-chips">
                      <span className="summary-chip">{t("leetcode.selectedCount", { count: selectedConflictCount })}</span>
                      <span className="summary-chip">{t("leetcode.rejectedCount", { count: rejectedConflictCount })}</span>
                    </div>
                    <small>
                      {t("leetcode.selectedMerges", {
                        selected: allowedConflictNumbers.length,
                        total: csvConflicts.length,
                      })}
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
                            <div className="conflict-diff-head">{t("leetcode.field")}</div>
                            <div className="conflict-diff-head">{t("leetcode.useIncoming")}</div>
                            <div className="conflict-diff-head">{t("leetcode.current")}</div>
                            <div className="conflict-diff-head">{t("leetcode.incoming")}</div>
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
          <h2>{t("leetcode.totalLoggedTitle")}</h2>
          <p>{t("leetcode.totalLoggedCount", { count: problems.length })}</p>
        </article>
      </div>

      <article className="tile topic-radar-section">
        <h2>{t("leetcode.topicRadarTitle")}</h2>
        <p>{t("leetcode.topicRadarDesc")}</p>
        <div className="topic-radar-layout">
          <TopicRadar data={topicRadarData} />
          <div className="topic-radar-list">
            {topicRadarData.map((item) => (
              <div key={item.topic} className="topic-radar-row">
                <strong>{item.topic}</strong>
                <span>{t("leetcode.solvedCount", { count: item.solvedCount })}</span>
                <span>{t("leetcode.score", { score: item.score })}</span>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => navigate(`/leetcode/topic/${encodeURIComponent(item.topic)}`)}
                >
                  {t("leetcode.deepDive")}
                </button>
              </div>
            ))}
            {topicRadarData.length === 0 && (
              <p>{t("leetcode.noSolvedTopicData")}</p>
            )}
          </div>
        </div>
      </article>

      <article className="tile leetcode-ai-panel">
        <h2>{t("leetcode.aiTitle")}</h2>
        <p>{t("leetcode.aiDesc")}</p>
        <div className="filters-row">
          <select value={aiProblemId} onChange={(event) => setAiProblemId(event.target.value)}>
            <option value="">{t("leetcode.selectProblem")}</option>
            {sortedFiltered.slice(0, 250).map((problem) => (
              <option key={problem.id} value={problem.id}>
                #{problem.problemNumber} {problem.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button-secondary"
            disabled={aiLoading}
            onClick={() => void runLeetCodeAi("hints")}
          >
            {t("leetcode.progressiveHints")}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={aiLoading}
            onClick={() => void runLeetCodeAi("explain")}
          >
            {t("leetcode.explainSolution")}
          </button>
        </div>
        <div className="actions-row">
          <button
            type="button"
            className="button-secondary"
            disabled={aiLoading}
            onClick={() => void runLeetCodeAi("pattern")}
          >
            {t("leetcode.patternRecognition")}
          </button>
        </div>
        <div className="ai-inline-output">
          {aiLoading && <small>{t("leetcode.generatingResponse")}</small>}
          {!aiLoading && !aiOutput && <small>{t("ai.messages.runActionPrompt")}</small>}
          {aiOutput && <pre>{aiOutput}</pre>}
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
          {showForm ? t("leetcode.hideForm") : t("leetcode.addProblem")}
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
          placeholder={t("leetcode.searchPlaceholder")}
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
          <option value="all">{t("leetcode.allDifficulties")}</option>
          <option value="Easy">{t("leetcode.easy")}</option>
          <option value="Medium">{t("leetcode.medium")}</option>
          <option value="Hard">{t("leetcode.hard")}</option>
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
          <option value="all">{t("leetcode.allStatuses")}</option>
          <option value="Solved">{t("leetcode.solved")}</option>
          <option value="Attempted">{t("leetcode.attempted")}</option>
          <option value="Review">{t("leetcode.review")}</option>
          <option value="Stuck">{t("leetcode.stuck")}</option>
        </select>
      </div>
      {uniqueTopics.length > 0 && (
        <div className="topic-filter-row">
          <span className="row-title">{t("leetcode.topicsLabel")}</span>
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
            {t("leetcode.activeTopicFilter")} <strong>{topicFilter}</strong>
          </span>
          <div className="inline-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => navigate(`/leetcode/topic/${encodeURIComponent(topicFilter)}`)}
            >
              {t("leetcode.openTopicPage")}
            </button>
            <button type="button" className="button-secondary" onClick={() => setTopicFilter("")}>
              {t("leetcode.clearTopicFilter")}
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        {!isMobileLeetCode && <div className="problem-grid-header problem-grid">
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
                  {t("leetcode.title")} {sortBy === "title" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("difficulty")}
                >
                  {t("leetcode.difficulty")}{" "}
                  {sortBy === "difficulty" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("status")}
                >
                  {t("leetcode.status")} {sortBy === "status" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">{t("leetcode.verifiedStatus")}</div>
          <div className="problem-cell">{t("leetcode.topics")}</div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("confidence")}
                >
                  {t("leetcode.confidence")}{" "}
                  {sortBy === "confidence" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">
                <button
                  type="button"
                  className="sort-header"
                  onClick={() => onHeaderSort("updatedAt")}
                >
                  {t("leetcode.updated")}{" "}
                  {sortBy === "updatedAt" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </button>
          </div>
          <div className="problem-cell">{t("leetcode.actions")}</div>
        </div>}
        {sortedFiltered.length === 0 && (
          <div className="empty-cell standalone-empty">
            {t("leetcode.noProblemsForFilters")}
          </div>
        )}
        {sortedFiltered.length > 0 && !isMobileLeetCode && VirtualListComponent && (
          <VirtualListComponent
            className="virtual-list"
            style={{ height: listHeight, width: "100%" }}
            rowCount={sortedFiltered.length}
            rowHeight={76}
            rowProps={rowData}
            rowComponent={VirtualProblemRow}
            overscanCount={8}
          />
        )}
        {sortedFiltered.length > 0 && !isMobileLeetCode && !VirtualListComponent && (
          <div className="virtual-list-fallback">
            {sortedFiltered.slice(0, 60).map((problem) => (
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
                  <span className={`badge ${problem.verified ? "badge-verified" : "badge-unverified"}`}>
                    {problem.verified ? t("leetcode.verified") : t("leetcode.unverified")}
                  </span>
                </div>
                <div className="problem-cell">
                  <div className="chip-list chip-list-inline">
                    {problem.topics.length === 0 && <span>-</span>}
                    {problem.topics.slice(0, 3).map((topic) => (
                      <button
                        key={`${problem.id}-fallback-${topic}`}
                        type="button"
                        className={`topic-chip${topicFilter === topic ? " topic-chip-active" : ""}`}
                        onClick={() => setTopicFilter(topic)}
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
                      onClick={() => {
                        setEditing(problem);
                        setShowForm(true);
                      }}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => deleteProblem(problem.id)}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {sortedFiltered.length > 0 && isMobileLeetCode && (
          <div className="leetcode-mobile-cards">
            {sortedFiltered.map((problem) => (
              <article
                key={problem.id}
                className="leetcode-mobile-card"
                aria-label={`Problem ${problem.problemNumber} ${problem.title} ${problem.status}`}
              >
                <div className="leetcode-mobile-card-head">
                  <strong>
                    #{problem.problemNumber} {problem.title}
                  </strong>
                  <span className={`badge ${problem.verified ? "badge-verified" : "badge-unverified"}`}>
                    {problem.verified ? t("leetcode.verified") : t("leetcode.unverified")}
                  </span>
                </div>
                <div className="chip-list">
                  <span className={`badge badge-difficulty-${toDifficultyClass(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                  <span className={`badge badge-status-${toStatusClass(problem.status)}`}>
                    {problem.status}
                  </span>
                  <span className="badge badge-confidence">
                    {t("leetcode.confidence")}: {problem.confidence}
                  </span>
                </div>
                <small>{new Date(problem.updatedAt).toLocaleDateString()}</small>
                <div className="chip-list chip-list-inline">
                  {problem.topics.length === 0 && <span>-</span>}
                  {problem.topics.map((topic) => (
                    <button
                      key={`${problem.id}-mobile-${topic}`}
                      type="button"
                      className={`topic-chip${topicFilter === topic ? " topic-chip-active" : ""}`}
                      onClick={() => setTopicFilter(topicFilter === topic ? "" : topic)}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setEditing(problem);
                      setShowForm(true);
                    }}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => deleteProblem(problem.id)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="pagination-row">
        <span>
          {t("leetcode.showingRange", {
            start: sortedFiltered.length === 0 ? 0 : 1,
            end: sortedFiltered.length,
            total: sortedFiltered.length,
          })}
        </span>
        <span>{t("leetcode.virtualizedRenderingEnabled")}</span>
      </div>
      <article className="tile import-history-panel">
        <h2>{t("leetcode.importSyncHistory")}</h2>
        {syncHistory.length === 0 ? (
          <p>{t("leetcode.noImportHistory")}</p>
        ) : (
          <ul>
            {syncHistory.slice(0, 8).map((entry, index) => (
              <li key={`${entry.at}-${entry.method}-${index}`}>
                <strong>
                  {entry.method.toUpperCase()} {entry.status.toUpperCase()}
                </strong>
                <span>{new Date(entry.at).toLocaleString()}</span>
                <span>
                  {t("leetcode.historyCounts", {
                    imported: entry.importedCount ?? 0,
                    created: entry.createdCount ?? 0,
                    merged: entry.mergedCount ?? 0,
                    invalid:
                      typeof entry.invalidCount === "number"
                        ? `, ${t("leetcode.invalidCountLabel", { count: entry.invalidCount })}`
                        : "",
                  })}
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

export function TopicDeepDivePage() {
  const { t } = useTranslation();
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
      title={t("leetcode.topicDeepDiveTitle", { topic: topicName })}
      subtitle={t("leetcode.topicDeepDiveSubtitle")}
    >
      <div className="inline-actions">
        <button type="button" className="button-secondary" onClick={() => navigate("/leetcode")}>
          {t("leetcode.backToLeetCode")}
        </button>
      </div>
      <div className="grid">
        <article className="tile">
          <h2>{t("leetcode.completion")}</h2>
          <p>
            {t("leetcode.completionSummary", {
              solved: solvedCount,
              total: topicProblems.length,
              completion,
            })}
          </p>
        </article>
        <article className="tile">
          <h2>{t("leetcode.difficultyMix")}</h2>
          <p>
            {t("leetcode.difficultyMixSummary", {
              easy: byDifficulty.easy,
              medium: byDifficulty.medium,
              hard: byDifficulty.hard,
            })}
          </p>
        </article>
        <article className="tile">
          <h2>{t("leetcode.statusBreakdown")}</h2>
          <p>
            {t("leetcode.statusBreakdownSummary", {
              solved: byStatus.solved,
              attempted: byStatus.attempted,
              review: byStatus.review,
              stuck: byStatus.stuck,
            })}
          </p>
        </article>
      </div>

      <article className="tile topic-notes-panel">
        <h2>{t("leetcode.personalNotes")}</h2>
        <textarea
          rows={5}
          placeholder={t("leetcode.patternNotesPlaceholder", { topic: topicName })}
          value={topicNotes[topicName] ?? ""}
          onChange={(event) => setTopicNote(topicName, event.target.value)}
        />
      </article>

      <article className="tile topic-notes-panel">
        <h2>{t("leetcode.curatedResourceLinks")}</h2>
        <textarea
          rows={4}
          placeholder={t("leetcode.oneUrlPerLine")}
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
            {t("leetcode.saveResources")}
          </button>
        </div>
      </article>

      <div className="table-wrap">
        <div className="problem-grid-header problem-grid">
          <div className="problem-cell">#</div>
          <div className="problem-cell">{t("leetcode.title")}</div>
          <div className="problem-cell">{t("leetcode.difficulty")}</div>
          <div className="problem-cell">{t("leetcode.status")}</div>
          <div className="problem-cell">{t("leetcode.verifiedStatus")}</div>
          <div className="problem-cell">{t("leetcode.topics")}</div>
          <div className="problem-cell">{t("leetcode.confidence")}</div>
          <div className="problem-cell">{t("leetcode.updated")}</div>
          <div className="problem-cell">{t("leetcode.source")}</div>
        </div>
        {topicProblems.length === 0 && (
          <div className="empty-cell standalone-empty">{t("leetcode.noTopicProblemsYet")}</div>
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
              <span className={`badge ${problem.verified ? "badge-verified" : "badge-unverified"}`}>
                {problem.verified ? t("leetcode.verified") : t("leetcode.unverified")}
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

export function ReadingPage() {
  const { t } = useTranslation();
  type GeneratedFlashcardDraft = {
    id: string;
    sourcePointId: string;
    question: string;
    answer: string;
    selected: boolean;
  };

  const settings = useAppStore((state) => state.settings);
  const books = useAppStore((state) => state.books);
  const knowledgePoints = useAppStore((state) => state.knowledgePoints);
  const upsertBook = useAppStore((state) => state.upsertBook);
  const deleteBook = useAppStore((state) => state.deleteBook);
  const upsertKnowledgePoint = useAppStore((state) => state.upsertKnowledgePoint);
  const deleteKnowledgePoint = useAppStore((state) => state.deleteKnowledgePoint);
  const markKnowledgePointReviewResult = useAppStore(
    (state) => state.markKnowledgePointReviewResult
  );
  const enqueueKnowledgePointsForReview = useAppStore(
    (state) => state.enqueueKnowledgePointsForReview
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
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [crossBookTagFilter, setCrossBookTagFilter] = useState<string>("all");
  const [crossBookChapterFilter, setCrossBookChapterFilter] = useState<string>("all");
  const [crossBookBookFilter, setCrossBookBookFilter] = useState<string>("all");
  const [crossBookQuery, setCrossBookQuery] = useState("");
  const [aiPointId, setAiPointId] = useState<string>("");
  const [aiReadingOutput, setAiReadingOutput] = useState("");
  const [aiReadingLoading, setAiReadingLoading] = useState(false);
  const [aiFlashcardScope, setAiFlashcardScope] = useState<"selected" | "chapter" | "book">(
    "selected"
  );
  const [aiFlashcardsLoading, setAiFlashcardsLoading] = useState(false);
  const [aiFlashcardsOutput, setAiFlashcardsOutput] = useState("");
  const pointNodeRefs = useRef<Record<string, HTMLLIElement | null>>({});

  function getBookStatusLabel(status: BookStatus): string {
    if (status === "reading") return t("reading.statusReading");
    if (status === "planned") return t("reading.statusPlanned");
    return t("reading.statusCompleted");
  }

  function getImportanceLabel(importance: Importance): string {
    if (importance === "Core") return t("reading.importanceCore");
    if (importance === "Supporting") return t("reading.importanceSupporting");
    return t("reading.importanceNiceToKnow");
  }

  function stripHtml(html: string): string {
    if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function hasMeaningfulRichText(html: string): boolean {
    return stripHtml(html).length > 0;
  }

  const pointConceptEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: t("reading.conceptPlaceholder"),
      }),
    ],
    content: pointConcept || "<p></p>",
    onUpdate: ({ editor }) => {
      setPointConcept(editor.getHTML());
    },
  });
  const [flashcardDrafts, setFlashcardDrafts] = useState<GeneratedFlashcardDraft[]>([]);

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
    setChapterFilter("all");
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
        if (chapterFilter !== "all" && (point.chapter ?? "").trim() !== chapterFilter) {
          return false;
        }
        if (pointImportanceFilter !== "all" && point.importance !== pointImportanceFilter) {
          return false;
        }
        if (dueOnly && (!point.nextReviewDate || point.nextReviewDate.slice(0, 10) > todayKey)) {
          return false;
        }
        if (!query) return true;
        return (
          point.title.toLowerCase().includes(query) ||
          stripHtml(point.concept).toLowerCase().includes(query) ||
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
  }, [activePoints, pointSearch, pointImportanceFilter, dueOnly, pointSortBy, todayKey, chapterFilter]);

  useEffect(() => {
    if (!aiPointId && activePoints.length > 0) {
      setAiPointId(activePoints[0].id);
    }
    if (aiPointId && !activePoints.some((point) => point.id === aiPointId)) {
      setAiPointId(activePoints[0]?.id ?? "");
    }
  }, [aiPointId, activePoints]);

  useEffect(() => {
    if (!pointConceptEditor) return;
    const currentHtml = pointConceptEditor.getHTML();
    if ((pointConcept || "<p></p>") === currentHtml) return;
    pointConceptEditor.commands.setContent(pointConcept || "<p></p>", {
      emitUpdate: false,
    });
  }, [pointConceptEditor, pointConcept]);
  const reviewCurrentPoint = useMemo(
    () => knowledgePoints.find((point) => point.id === reviewSessionIds[reviewCursor]),
    [knowledgePoints, reviewSessionIds, reviewCursor]
  );
  const reviewSessionTotal = reviewSessionIds.length;
  const reviewSessionCompleted =
    reviewSessionTotal > 0 &&
    (reviewCursor >= reviewSessionTotal || !reviewCurrentPoint);

  const chapterBuckets = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const point of activePoints) {
      const chapterKey = (point.chapter ?? "").trim() || "__no_chapter__";
      const current = map.get(chapterKey);
      map.set(chapterKey, {
        label:
          chapterKey === "__no_chapter__"
            ? t("reading.noChapter")
            : t("reading.chapterLabel", { chapter: chapterKey }),
        count: (current?.count ?? 0) + 1,
      });
    }
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activePoints, t]);

  const allTagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const point of knowledgePoints) {
      for (const tag of point.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [knowledgePoints]);

  const allChapterCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const point of knowledgePoints) {
      const chapter = (point.chapter ?? "").trim() || "__no_chapter__";
      map.set(chapter, (map.get(chapter) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([chapter, count]) => ({ chapter, count }))
      .sort((a, b) => b.count - a.count || a.chapter.localeCompare(b.chapter));
  }, [knowledgePoints]);

  const crossBookRows = useMemo(() => {
    const q = crossBookQuery.trim().toLowerCase();
    return knowledgePoints.filter((point) => {
      const chapter = (point.chapter ?? "").trim() || "__no_chapter__";
      if (crossBookBookFilter !== "all" && point.bookId !== crossBookBookFilter) return false;
      if (crossBookTagFilter !== "all" && !point.tags.includes(crossBookTagFilter)) return false;
      if (crossBookChapterFilter !== "all" && chapter !== crossBookChapterFilter) return false;
      if (!q) return true;
      return (
        point.title.toLowerCase().includes(q) ||
        stripHtml(point.concept).toLowerCase().includes(q) ||
        point.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        chapter.toLowerCase().includes(q)
      );
    });
  }, [knowledgePoints, crossBookBookFilter, crossBookTagFilter, crossBookChapterFilter, crossBookQuery]);

  const crossBookByTag = useMemo(() => {
    const map = new Map<string, KnowledgePoint[]>();
    for (const point of crossBookRows) {
      const tags = point.tags.length > 0 ? point.tags : ["__untagged__"];
      for (const tag of tags) {
        const bucket = map.get(tag) ?? [];
        bucket.push(point);
        map.set(tag, bucket);
      }
    }
    return Array.from(map.entries())
      .map(([tag, points]) => ({ tag, points }))
      .sort((a, b) => b.points.length - a.points.length || a.tag.localeCompare(b.tag));
  }, [crossBookRows]);

  const crossBookByChapter = useMemo(() => {
    const map = new Map<string, KnowledgePoint[]>();
    for (const point of crossBookRows) {
      const chapterKey = (point.chapter ?? "").trim() || "__no_chapter__";
      const bucket = map.get(chapterKey) ?? [];
      bucket.push(point);
      map.set(chapterKey, bucket);
    }
    return Array.from(map.entries())
      .map(([chapter, points]) => ({ chapter, points }))
      .sort((a, b) => b.points.length - a.points.length || a.chapter.localeCompare(b.chapter));
  }, [crossBookRows]);
  const crossBookPreviewLimit = 8;
  const quickTagChips = useMemo(() => {
    const selectedTag =
      crossBookTagFilter !== "all"
        ? allTagCounts.find((entry) => entry.tag === crossBookTagFilter)
        : undefined;
    const pool = selectedTag
      ? [selectedTag, ...allTagCounts.filter((entry) => entry.tag !== selectedTag.tag)]
      : allTagCounts;
    return pool.slice(0, 12);
  }, [allTagCounts, crossBookTagFilter]);

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

  function jumpToChapter(chapterKey: string) {
    setChapterFilter(chapterKey);
    const chapterValue = chapterKey === "__no_chapter__" ? "" : chapterKey;
    const firstPoint = activePoints.find(
      (point) => ((point.chapter ?? "").trim() || "") === chapterValue
    );
    if (!firstPoint) return;
    window.requestAnimationFrame(() => {
      pointNodeRefs.current[firstPoint.id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function focusKnowledgePointFromMap(point: KnowledgePoint) {
    setActiveBookId(point.bookId);
    setPointSearch(point.title);
    setDueOnly(false);
    setChapterFilter((point.chapter ?? "").trim() || "all");
    window.setTimeout(() => {
      pointNodeRefs.current[point.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
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
      lines.push(stripHtml(point.concept));
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
          stripHtml(point.concept),
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
            <p>${escapeHtml(stripHtml(point.concept))}</p>
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
    if (!activeBookId || !pointTitle.trim() || !hasMeaningfulRichText(pointConcept)) return;
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

  async function runReadingAi(mode: "explain" | "gap" | "summary") {
    if (!settings.aiEnabled) {
      setAiReadingOutput(t("ai.messages.enableFirst"));
      return;
    }
    if (!settings.aiFeatureReadingExplainer) {
      setAiReadingOutput(t("ai.messages.readingExplainerDisabled"));
      return;
    }
    if (!settings.aiPrivacyAcknowledged) {
      setAiReadingOutput(t("ai.messages.acknowledgePrivacy"));
      return;
    }
    if (settings.aiProvider === "byok" && !settings.aiApiKey.trim()) {
      setAiReadingOutput(t("ai.messages.byokMissing"));
      return;
    }
    const quota = consumeAiQuota(settings.aiProvider);
    if (!quota.ok) {
      recordAiAuditEntry({
        module: "Reading",
        action: `reading_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: 0,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_quota",
      });
      setAiReadingOutput(t("ai.messages.freeTierReached"));
      return;
    }

    const selectedPoint = activePoints.find((point) => point.id === aiPointId);
    const chapterPoints = activePoints.filter(
      (point) => selectedPoint?.chapter && point.chapter === selectedPoint.chapter
    );
    const promptMap = {
      explain: selectedPoint
        ? `Explain this concept for study retention: "${selectedPoint.title}" — ${stripHtml(
            selectedPoint.concept
          )}`
        : "Explain a core concept from my current reading notes in simple terms.",
      gap: `Identify likely missing knowledge areas from this book's current notes: ${activePoints
        .slice(0, 20)
        .map((point) => point.title)
        .join(", ")}`,
      summary: selectedPoint?.chapter
        ? `Summarize chapter ${selectedPoint.chapter} from these notes: ${chapterPoints
            .slice(0, 20)
            .map((point) => `${point.title}: ${stripHtml(point.concept)}`)
            .join(" | ")}`
        : `Summarize key learnings from these notes: ${activePoints
            .slice(0, 20)
            .map((point) => `${point.title}: ${stripHtml(point.concept)}`)
            .join(" | ")}`,
    } as const;
    const rawPrompt = promptMap[mode];
    const safePrompt = sanitizeAiPrompt(rawPrompt);
    if (!safePrompt) {
      recordAiAuditEntry({
        module: "Reading",
        action: `reading_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_validation",
      });
      setAiReadingOutput(t("ai.messages.invalidPrompt"));
      return;
    }
    recordAiAuditEntry({
      module: "Reading",
      action: `reading_${mode}`,
      provider: settings.aiProvider,
      model: settings.aiModel,
      promptChars: rawPrompt.length,
      sanitizedChars: safePrompt.length,
      quotaLimit: quota.limit,
      quotaUsed: quota.used,
      quotaRemaining: quota.remaining,
      outcome: "allowed",
    });

    setAiReadingLoading(true);
    setAiReadingOutput("");
    try {
      for await (const chunk of streamAiResponseLazy({
        prompt: safePrompt,
        moduleName: "Reading",
        backend: settings.aiBackend,
        provider: settings.aiProvider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        context: {
          knowledgePointsCount: knowledgePoints.length,
          notesCount: chapterPoints.length,
        },
      })) {
        setAiReadingOutput((prev) => prev + chunk);
      }
      recordAiAuditEntry({
        module: "Reading",
        action: `reading_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "success",
      });
    } catch {
      recordAiAuditEntry({
        module: "Reading",
        action: `reading_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "error",
      });
      setAiReadingOutput(t("ai.messages.providerError"));
    } finally {
      setAiReadingLoading(false);
    }
  }

  function parseFlashcardDraftsFromOutput(output: string): GeneratedFlashcardDraft[] {
    const lines = output.split(/\r?\n/);
    const cards: GeneratedFlashcardDraft[] = [];
    let currentSourceId = "";
    let currentQuestion = "";
    let currentAnswer = "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("SOURCE_ID:")) {
        if (currentSourceId && currentQuestion && currentAnswer) {
          cards.push({
            id: crypto.randomUUID(),
            sourcePointId: currentSourceId,
            question: currentQuestion,
            answer: currentAnswer,
            selected: true,
          });
          currentQuestion = "";
          currentAnswer = "";
        }
        currentSourceId = line.replace("SOURCE_ID:", "").trim();
        continue;
      }
      if (line.startsWith("Q:")) {
        currentQuestion = line.replace("Q:", "").trim();
        continue;
      }
      if (line.startsWith("A:")) {
        currentAnswer = line.replace("A:", "").trim();
      }
    }
    if (currentSourceId && currentQuestion && currentAnswer) {
      cards.push({
        id: crypto.randomUUID(),
        sourcePointId: currentSourceId,
        question: currentQuestion,
        answer: currentAnswer,
        selected: true,
      });
    }
    return cards;
  }

  async function generateReadingFlashcards() {
    if (!settings.aiEnabled) {
      setAiFlashcardsOutput(t("ai.messages.enableFirst"));
      return;
    }
    if (!settings.aiFeatureFlashcardGenerator) {
      setAiFlashcardsOutput(t("ai.messages.flashcardDisabled"));
      return;
    }
    if (!settings.aiPrivacyAcknowledged) {
      setAiFlashcardsOutput(t("ai.messages.acknowledgePrivacy"));
      return;
    }
    if (settings.aiProvider === "byok" && !settings.aiApiKey.trim()) {
      setAiFlashcardsOutput(t("ai.messages.byokMissing"));
      return;
    }
    const quota = consumeAiQuota(settings.aiProvider);
    if (!quota.ok) {
      recordAiAuditEntry({
        module: "Reading",
        action: "reading_flashcards",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: 0,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_quota",
      });
      setAiFlashcardsOutput(t("ai.messages.freeTierReached"));
      return;
    }

    const selectedPoint = activePoints.find((point) => point.id === aiPointId);
    const scopePoints =
      aiFlashcardScope === "selected"
        ? selectedPoint
          ? [selectedPoint]
          : []
        : aiFlashcardScope === "chapter" && selectedPoint?.chapter
          ? activePoints.filter((point) => point.chapter === selectedPoint.chapter).slice(0, 12)
          : activePoints.slice(0, 12);
    if (scopePoints.length === 0) {
      setAiFlashcardsOutput(t("reading.selectKnowledgePointFirst"));
      return;
    }

    const seedPayload = scopePoints
      .map((point) => {
        const compactConcept = stripHtml(point.concept).replace(/\s+/g, " ").trim().slice(0, 240);
        return `${point.id}::${point.title}::${compactConcept}`;
      })
      .join(" || ");
    const prompt = `[FLASHCARDS] ${seedPayload}`;
    const safePrompt = sanitizeAiPrompt(prompt);
    if (!safePrompt) {
      recordAiAuditEntry({
        module: "Reading",
        action: "reading_flashcards",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: prompt.length,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_validation",
      });
      setAiFlashcardsOutput(t("ai.messages.invalidPrompt"));
      return;
    }
    recordAiAuditEntry({
      module: "Reading",
      action: "reading_flashcards",
      provider: settings.aiProvider,
      model: settings.aiModel,
      promptChars: prompt.length,
      sanitizedChars: safePrompt.length,
      quotaLimit: quota.limit,
      quotaUsed: quota.used,
      quotaRemaining: quota.remaining,
      outcome: "allowed",
    });

    setAiFlashcardsLoading(true);
    setAiFlashcardsOutput("");
    setFlashcardDrafts([]);
    try {
      let fullOutput = "";
      for await (const chunk of streamAiResponseLazy({
        prompt: safePrompt,
        moduleName: "Reading",
        backend: settings.aiBackend,
        provider: settings.aiProvider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        context: {
          knowledgePointsCount: knowledgePoints.length,
          notesCount: scopePoints.length,
        },
      })) {
        fullOutput += chunk;
        setAiFlashcardsOutput(fullOutput);
      }
      const parsed = parseFlashcardDraftsFromOutput(fullOutput);
      setFlashcardDrafts(parsed);
      if (parsed.length === 0) {
        setAiFlashcardsOutput(t("reading.flashcardsParseError"));
      }
      recordAiAuditEntry({
        module: "Reading",
        action: "reading_flashcards",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: prompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "success",
      });
    } catch {
      recordAiAuditEntry({
        module: "Reading",
        action: "reading_flashcards",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: prompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "error",
      });
      setAiFlashcardsOutput(t("ai.messages.providerError"));
    } finally {
      setAiFlashcardsLoading(false);
    }
  }

  function pushGeneratedFlashcardsToReviewQueue() {
    const selectedIds = flashcardDrafts
      .filter((card) => card.selected)
      .map((card) => card.sourcePointId);
    const uniqueIds = [...new Set(selectedIds)];
    if (uniqueIds.length === 0) {
      setAiFlashcardsOutput(t("reading.selectGeneratedFlashcardFirst"));
      return;
    }
    enqueueKnowledgePointsForReview(uniqueIds);
    setAiFlashcardsOutput(t("reading.queuedForReview", { count: uniqueIds.length }));
  }

  return (
    <PageCard
      title={t("pages.reading.title")}
      subtitle={t("pages.reading.subtitle")}
    >
      <div className="actions-row">
        <button type="button" onClick={() => setShowBookForm((prev) => !prev)}>
          {showBookForm ? t("reading.hideNewBookForm") : t("reading.addBook")}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={!activeBookId}
          onClick={() => setShowPointForm((prev) => !prev)}
        >
          {showPointForm ? t("reading.hideKnowledgePointForm") : t("reading.addKnowledgePoint")}
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
            {t("reading.cancelEdit")}
          </button>
        )}
      </div>

      {showBookForm && (
        <form className="problem-form" onSubmit={onCreateBook}>
          <div className="problem-form-grid">
            <label>
              <span>{t("reading.bookTitle")}</span>
              <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} required />
            </label>
            <label>
              <span>{t("reading.author")}</span>
              <input
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                required
              />
            </label>
            <label>
              <span>{t("reading.status")}</span>
              <select
                value={bookStatus}
                onChange={(e) => setBookStatus(e.target.value as BookStatus)}
              >
                <option value="reading">{t("reading.statusReading")}</option>
                <option value="planned">{t("reading.statusPlanned")}</option>
                <option value="completed">{t("reading.statusCompleted")}</option>
              </select>
            </label>
            <label>
              <span>{t("reading.totalChapters")}</span>
              <input
                type="number"
                min={1}
                value={bookChapters}
                onChange={(e) => setBookChapters(e.target.value)}
              />
            </label>
          </div>
          <div className="actions-row">
            <button type="submit">{t("reading.saveBook")}</button>
          </div>
        </form>
      )}

      {showPointForm && activeBookId && (
        <form className="problem-form" onSubmit={onCreateKnowledgePoint}>
          <div className="problem-form-grid">
            <label>
              <span>{t("reading.knowledgePointTitle")}</span>
              <input
                value={pointTitle}
                onChange={(e) => setPointTitle(e.target.value)}
                required
              />
            </label>
            <label>
              <span>{t("reading.chapter")}</span>
              <input value={pointChapter} onChange={(e) => setPointChapter(e.target.value)} />
            </label>
            <label>
              <span>{t("reading.importance")}</span>
              <select
                value={pointImportance}
                onChange={(e) => setPointImportance(e.target.value as Importance)}
              >
                <option value="Core">{t("reading.importanceCore")}</option>
                <option value="Supporting">{t("reading.importanceSupporting")}</option>
                <option value="NiceToKnow">{t("reading.importanceNiceToKnow")}</option>
              </select>
            </label>
            <label>
              <span>{t("reading.confidenceOneToFive")}</span>
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
              <span>{t("reading.tagsCommaSeparated")}</span>
              <input
                value={pointTags}
                onChange={(e) => setPointTags(e.target.value)}
                placeholder={t("reading.tagsPlaceholder")}
              />
            </label>
            <label className="full-width">
              <span>{t("reading.concept")}</span>
              <div className="notes-toolbar compact-toolbar">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => pointConceptEditor?.chain().focus().toggleBold().run()}
                  disabled={!pointConceptEditor}
                >
                  {t("notes.bold")}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => pointConceptEditor?.chain().focus().toggleItalic().run()}
                  disabled={!pointConceptEditor}
                >
                  {t("notes.italic")}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => pointConceptEditor?.chain().focus().toggleCode().run()}
                  disabled={!pointConceptEditor}
                >
                  {t("reading.inlineCode")}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => pointConceptEditor?.chain().focus().toggleCodeBlock().run()}
                  disabled={!pointConceptEditor}
                >
                  {t("reading.codeBlock")}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => pointConceptEditor?.chain().focus().insertContent("$x^2$").run()}
                  disabled={!pointConceptEditor}
                >
                  {t("reading.inlineMath")}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    pointConceptEditor?.chain().focus().insertContent("$$\n\\int_a^b f(x)\\,dx\n$$").run()
                  }
                  disabled={!pointConceptEditor}
                >
                  {t("reading.blockMath")}
                </button>
              </div>
              <div className="reading-concept-editor">
                <EditorContent editor={pointConceptEditor} />
              </div>
            </label>
          </div>
          <div className="actions-row">
            <button type="submit">
              {editingPointId
                ? t("reading.updateKnowledgePoint")
                : t("reading.saveKnowledgePoint")}
            </button>
          </div>
        </form>
      )}

      {activeBook && (
        <div className="filters-row reading-filters">
          <input
            placeholder={t("reading.searchPlaceholder")}
            value={pointSearch}
            onChange={(e) => setPointSearch(e.target.value)}
          />
          <select
            value={pointImportanceFilter}
            onChange={(e) => setPointImportanceFilter(e.target.value as "all" | Importance)}
          >
            <option value="all">{t("reading.allImportance")}</option>
            <option value="Core">{t("reading.importanceCore")}</option>
            <option value="Supporting">{t("reading.importanceSupporting")}</option>
            <option value="NiceToKnow">{t("reading.importanceNiceToKnow")}</option>
          </select>
          <select
            value={pointSortBy}
            onChange={(e) =>
              setPointSortBy(e.target.value as "updatedAt" | "nextReviewDate" | "confidence")
            }
          >
            <option value="updatedAt">{t("reading.sortLastUpdated")}</option>
            <option value="nextReviewDate">{t("reading.sortNextReview")}</option>
            <option value="confidence">{t("reading.sortConfidence")}</option>
          </select>
          <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}>
            <option value="all">{t("reading.allChapters")}</option>
            {chapterBuckets.map((chapter) => (
              <option key={chapter.key} value={chapter.key}>
                {chapter.label} ({chapter.count})
              </option>
            ))}
          </select>
          <label className="due-only-toggle">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => setDueOnly(e.target.checked)}
            />
            {t("reading.dueOnly")}
          </label>
        </div>
      )}

      {activeBook && (
        <article className="tile flashcard-session">
          <h2>{t("reading.flashcardReviewTitle")}</h2>
          <small>
            {t("reading.dueRightNowForBook", {
              count: reviewDuePoints.length,
              title: activeBook.title,
            })}
          </small>
          {reviewSessionTotal === 0 && (
            <div className="actions-row">
              <button type="button" onClick={startReviewSession} disabled={reviewDuePoints.length === 0}>
                {t("reading.startReviewSession")}
              </button>
            </div>
          )}

          {reviewSessionTotal > 0 && !reviewSessionCompleted && reviewCurrentPoint && (
            <div className="flashcard-body">
              <small>
                {t("reading.cardProgress", { current: reviewCursor + 1, total: reviewSessionTotal })}
              </small>
              <h3>{reviewCurrentPoint.title}</h3>
              <small>
                {reviewCurrentPoint.chapter
                  ? t("reading.chapterLabel", { chapter: reviewCurrentPoint.chapter })
                  : t("reading.noChapter")}{" "}
                • {getImportanceLabel(reviewCurrentPoint.importance)}
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
                    {t("reading.revealConcept")}
                  </button>
                  <button type="button" className="button-secondary" onClick={stopReviewSession}>
                    {t("reading.endSession")}
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="knowledge-rich-content"
                    dangerouslySetInnerHTML={{ __html: reviewCurrentPoint.concept }}
                  />
                  <div className="actions-row">
                    <button type="button" onClick={() => gradeCurrentFlashcard("good")}>
                      {t("reading.iRecalledIt")}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => gradeCurrentFlashcard("shaky")}
                    >
                      {t("reading.needMoreWork")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {reviewSessionCompleted && (
            <div className="flashcard-body">
              <p>
                {t("reading.reviewSessionSummary", {
                  reviewed: reviewedCount,
                  needsWork: reviewNeedsWorkCount,
                })}
              </p>
              <div className="actions-row">
                <button type="button" onClick={startReviewSession} disabled={reviewDuePoints.length === 0}>
                  {t("reading.reviewDueCardsAgain")}
                </button>
                <button type="button" className="button-secondary" onClick={stopReviewSession}>
                  {t("reading.closeSession")}
                </button>
              </div>
            </div>
          )}
        </article>
      )}

      {activeBook && (
        <article className="tile leetcode-ai-panel">
          <h2>{t("reading.aiTitle")}</h2>
          <p>{t("reading.aiDesc")}</p>
          <div className="filters-row">
            <select value={aiPointId} onChange={(event) => setAiPointId(event.target.value)}>
              <option value="">{t("reading.selectKnowledgePoint")}</option>
              {activePoints.slice(0, 250).map((point) => (
                <option key={point.id} value={point.id}>
                  {point.chapter ? t("reading.chapterShort", { chapter: point.chapter }) : ""}
                  {point.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button-secondary"
              disabled={aiReadingLoading}
              onClick={() => void runReadingAi("explain")}
            >
              {t("reading.explainConcept")}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={aiReadingLoading}
              onClick={() => void runReadingAi("gap")}
            >
              {t("reading.detectGaps")}
            </button>
          </div>
          <div className="actions-row">
            <button
              type="button"
              className="button-secondary"
              disabled={aiReadingLoading}
              onClick={() => void runReadingAi("summary")}
            >
              {t("reading.summarizeChapter")}
            </button>
            <select
              value={aiFlashcardScope}
              onChange={(event) =>
                setAiFlashcardScope(event.target.value as "selected" | "chapter" | "book")
              }
            >
              <option value="selected">{t("reading.flashcardsSelectedPoint")}</option>
              <option value="chapter">{t("reading.flashcardsCurrentChapter")}</option>
              <option value="book">{t("reading.flashcardsCurrentBook")}</option>
            </select>
            <button
              type="button"
              className="button-secondary"
              disabled={aiFlashcardsLoading}
              onClick={() => void generateReadingFlashcards()}
            >
              {t("reading.generateFlashcards")}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={aiFlashcardsLoading || flashcardDrafts.length === 0}
              onClick={pushGeneratedFlashcardsToReviewQueue}
            >
              {t("reading.addSelectedToReviewQueue")}
            </button>
          </div>
          <div className="ai-inline-output">
            {aiReadingLoading && <small>{t("reading.generatingResponse")}</small>}
            {!aiReadingLoading && !aiReadingOutput && (
              <small>{t("reading.aiRunPrompt")}</small>
            )}
            {aiReadingOutput && <pre>{aiReadingOutput}</pre>}
          </div>
          <div className="ai-inline-output">
            {aiFlashcardsLoading && <small>{t("reading.generatingFlashcards")}</small>}
            {!aiFlashcardsLoading && flashcardDrafts.length === 0 && (
              <small>{t("reading.flashcardsEmptyPrompt")}</small>
            )}
            {flashcardDrafts.length > 0 && (
              <div className="knowledge-content">
                {flashcardDrafts.map((card) => (
                  <div key={card.id} className="problem-form">
                    <label>
                      <input
                        type="checkbox"
                        checked={card.selected}
                        onChange={(event) =>
                          setFlashcardDrafts((current) =>
                            current.map((item) =>
                              item.id === card.id ? { ...item, selected: event.target.checked } : item
                            )
                          )
                        }
                      />
                      {t("reading.includeInQueue")}
                    </label>
                    <label>
                      <span>{t("reading.question")}</span>
                      <input
                        value={card.question}
                        onChange={(event) =>
                          setFlashcardDrafts((current) =>
                            current.map((item) =>
                              item.id === card.id ? { ...item, question: event.target.value } : item
                            )
                          )
                        }
                      />
                    </label>
                    <label>
                      <span>{t("reading.answer")}</span>
                      <textarea
                        rows={3}
                        value={card.answer}
                        onChange={(event) =>
                          setFlashcardDrafts((current) =>
                            current.map((item) =>
                              item.id === card.id ? { ...item, answer: event.target.value } : item
                            )
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
            {aiFlashcardsOutput && <pre>{aiFlashcardsOutput}</pre>}
          </div>
        </article>
      )}

      <article className="tile cross-book-map">
        <h2>{t("reading.crossBookMapTitle")}</h2>
        <p>{t("reading.crossBookMapDesc")}</p>
        <div className="filters-row cross-book-filters">
          <input
            value={crossBookQuery}
            onChange={(event) => setCrossBookQuery(event.target.value)}
            placeholder={t("reading.crossBookSearchPlaceholder")}
          />
          <select
            value={crossBookBookFilter}
            onChange={(event) => setCrossBookBookFilter(event.target.value)}
          >
            <option value="all">{t("reading.allBooks")}</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
          <select
            value={crossBookTagFilter}
            onChange={(event) => setCrossBookTagFilter(event.target.value)}
          >
            <option value="all">{t("reading.allTags")}</option>
            {allTagCounts.map((tag) => (
              <option key={tag.tag} value={tag.tag}>
                {tag.tag} ({tag.count})
              </option>
            ))}
          </select>
          <select
            value={crossBookChapterFilter}
            onChange={(event) => setCrossBookChapterFilter(event.target.value)}
          >
            <option value="all">{t("reading.allChapters")}</option>
            {allChapterCounts.map((chapter) => (
              <option key={chapter.chapter} value={chapter.chapter}>
                {(chapter.chapter === "__no_chapter__"
                  ? t("reading.noChapter")
                  : t("reading.chapterLabel", { chapter: chapter.chapter })) +
                  ` (${chapter.count})`}
              </option>
            ))}
          </select>
        </div>
        <div className="quick-chip-row">
          <span>{t("reading.quickTagFilters")}</span>
          <button
            type="button"
            className={`topic-chip${crossBookTagFilter === "all" ? " topic-chip-active" : ""}`}
            onClick={() => setCrossBookTagFilter("all")}
          >
            {t("reading.allTags")}
          </button>
          {quickTagChips.map((tag) => (
            <button
              type="button"
              key={tag.tag}
              className={`topic-chip${crossBookTagFilter === tag.tag ? " topic-chip-active" : ""}`}
              onClick={() => setCrossBookTagFilter(tag.tag)}
            >
              {tag.tag} ({tag.count})
            </button>
          ))}
        </div>
        <div className="cross-book-meta-row">
          <small>{t("reading.matchedPointsSummary", { count: crossBookRows.length })}</small>
          <small>{t("reading.tagGroupsSummary", { count: crossBookByTag.length })}</small>
          <small>{t("reading.chapterGroupsSummary", { count: crossBookByChapter.length })}</small>
        </div>
        <div className="cross-book-group-layout">
          <section>
            <h3>{t("reading.groupedByTag")}</h3>
            {crossBookByTag.length === 0 && <p>{t("reading.noCrossBookMatches")}</p>}
            {crossBookByTag.map((group) => (
              <details key={group.tag} className="cross-book-group">
                <summary>
                  <strong>
                    {group.tag === "__untagged__" ? t("reading.untagged") : group.tag}
                  </strong>
                  <small>{t("reading.pointsCount", { count: group.points.length })}</small>
                </summary>
                <ul className="cross-book-point-list">
                  {group.points.slice(0, crossBookPreviewLimit).map((point) => {
                    const pointBook = books.find((book) => book.id === point.bookId);
                    return (
                      <li key={`${group.tag}-${point.id}`}>
                        <button type="button" onClick={() => focusKnowledgePointFromMap(point)}>
                          <strong>{point.title}</strong>
                          <small>
                            {(pointBook?.title ?? t("reading.unknownBook"))} •{" "}
                            {point.chapter
                              ? t("reading.chapterLabel", { chapter: point.chapter })
                              : t("reading.noChapter")}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {group.points.length > crossBookPreviewLimit && (
                  <small className="cross-book-preview-note">
                    {t("reading.showingPreviewCount", {
                      shown: crossBookPreviewLimit,
                      total: group.points.length,
                    })}
                  </small>
                )}
              </details>
            ))}
          </section>
          <section>
            <h3>{t("reading.groupedByChapter")}</h3>
            {crossBookByChapter.length === 0 && <p>{t("reading.noCrossBookMatches")}</p>}
            {crossBookByChapter.map((group) => (
              <details key={group.chapter} className="cross-book-group">
                <summary>
                  <strong>
                    {group.chapter === "__no_chapter__"
                      ? t("reading.noChapter")
                      : t("reading.chapterLabel", { chapter: group.chapter })}
                  </strong>
                  <small>{t("reading.pointsCount", { count: group.points.length })}</small>
                </summary>
                <ul className="cross-book-point-list">
                  {group.points.slice(0, crossBookPreviewLimit).map((point) => {
                    const pointBook = books.find((book) => book.id === point.bookId);
                    return (
                      <li key={`${group.chapter}-${point.id}`}>
                        <button type="button" onClick={() => focusKnowledgePointFromMap(point)}>
                          <strong>{point.title}</strong>
                          <small>
                            {(pointBook?.title ?? t("reading.unknownBook"))} •{" "}
                            {point.tags.slice(0, 3).join(", ") || t("reading.untagged")}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {group.points.length > crossBookPreviewLimit && (
                  <small className="cross-book-preview-note">
                    {t("reading.showingPreviewCount", {
                      shown: crossBookPreviewLimit,
                      total: group.points.length,
                    })}
                  </small>
                )}
              </details>
            ))}
          </section>
        </div>
      </article>

      <div className="reading-layout">
        <div className="reading-side-column">
          <article className="tile">
            <h2>{t("reading.bookshelf")}</h2>
            {books.length === 0 && <p>{t("reading.noBooksYet")}</p>}
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
                      {book.author} • {getBookStatusLabel(book.status)}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => deleteBook(book.id)}
                  >
                    {t("common.delete")}
                  </button>
                </li>
              ))}
            </ul>
          </article>
          {activeBook && (
            <article className="tile chapter-index-tile">
              <h2>{t("reading.chapterOutline")}</h2>
              <div className="chapter-index-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setChapterFilter("all")}
                >
                  {t("reading.showAllChapters")}
                </button>
              </div>
              {chapterBuckets.length === 0 && <p>{t("reading.noChapterOutlineYet")}</p>}
              {chapterBuckets.length > 0 && (
                <ul className="chapter-index-list">
                  {chapterBuckets.map((chapter) => (
                    <li key={chapter.key}>
                      <button
                        type="button"
                        className={chapterFilter === chapter.key ? "chapter-jump-active" : undefined}
                        onClick={() => jumpToChapter(chapter.key)}
                      >
                        <span>{chapter.label}</span>
                        <small>{chapter.count}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )}
        </div>

        <article className="tile">
          <h2>
            {activeBook
              ? t("reading.knowledgePointsForBook", { title: activeBook.title })
              : t("reading.knowledgePoints")}
          </h2>
          {activeBook && (
            <small>
              {t("reading.totalAndDueReview", {
                total: activePoints.length,
                due: reviewDuePoints.length,
              })}
            </small>
          )}
          {activeBook && (
            <div className="actions-row export-actions">
              <button type="button" onClick={exportBookMarkdown}>
                {t("reading.exportMarkdown")}
              </button>
              <button type="button" className="button-secondary" onClick={exportBookPdf}>
                {t("reading.exportPdf")}
              </button>
              <button type="button" className="button-secondary" onClick={exportBookAnkiCsv}>
                {t("reading.exportAnkiCsv")}
              </button>
            </div>
          )}
          {!activeBook && <p>{t("reading.selectBookPrompt")}</p>}
          {activeBook && filteredPoints.length === 0 && (
            <p>{t("reading.noMatchingKnowledgePoints")}</p>
          )}
          {activeBook && filteredPoints.length > 0 && (
            <ul className="knowledge-list">
              {filteredPoints.map((point) => (
                <li
                  key={point.id}
                  className="knowledge-row"
                  ref={(node) => {
                    pointNodeRefs.current[point.id] = node;
                  }}
                >
                  <details className="knowledge-accordion" open={dueOnly || isPointDue(point.nextReviewDate)}>
                    <summary>
                      <div className="knowledge-summary-title">
                        <strong>{point.title}</strong>
                        <small>
                          {point.chapter
                            ? t("reading.chapterLabel", { chapter: point.chapter })
                            : t("reading.noChapter")}{" "}
                          • {getImportanceLabel(point.importance)} •{" "}
                          {t("reading.confidenceLabel", { confidence: point.confidence })}
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
                          {isPointDue(point.nextReviewDate) ? t("reading.due") : t("reading.upcoming")}
                        </span>
                      )}
                    </summary>
                    <div className="knowledge-content">
                      {point.nextReviewDate && (
                        <small>
                          {t("reading.reviewDate", {
                            date: new Date(point.nextReviewDate).toLocaleDateString(),
                          })}
                        </small>
                      )}
                      <div
                        className="knowledge-rich-content"
                        dangerouslySetInnerHTML={{ __html: point.concept }}
                      />
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
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={!point.nextReviewDate}
                          onClick={() => markKnowledgePointReviewResult(point.id, "good")}
                        >
                          {t("reading.reviewedGood")}
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={!point.nextReviewDate}
                          onClick={() => markKnowledgePointReviewResult(point.id, "shaky")}
                        >
                          {t("reading.reviewedShaky")}
                        </button>
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => deleteKnowledgePoint(point.id)}
                        >
                          {t("common.delete")}
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

export function CalendarPage() {
  const { t } = useTranslation();
  type CalendarViewEvent = CalendarEvent & {
    occurrenceId: string;
    sourceEventId: string;
    isRecurringInstance: boolean;
  };
  type CalendarPlanDraft = {
    id: string;
    selected: boolean;
    title: string;
    date: string;
    time: string;
    durationMinutes: number;
    type: EventType;
  };

  const events = useAppStore((state) => state.events);
  const settings = useAppStore((state) => state.settings);
  const upsertEvent = useAppStore((state) => state.upsertEvent);
  const deleteEvent = useAppStore((state) => state.deleteEvent);
  const problems = useAppStore((state) => state.problems);
  const knowledgePoints = useAppStore((state) => state.knowledgePoints);
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
  const [timerLogTitle, setTimerLogTitle] = useState(t("calendar.pomodoroSession"));
  const [aiCalendarOutput, setAiCalendarOutput] = useState("");
  const [aiCalendarLoading, setAiCalendarLoading] = useState(false);
  const [calendarPlanDrafts, setCalendarPlanDrafts] = useState<CalendarPlanDraft[]>([]);
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

  function getViewModeLabel(mode: "day" | "week" | "month" | "agenda"): string {
    if (mode === "day") return t("calendar.day");
    if (mode === "week") return t("calendar.week");
    if (mode === "month") return t("calendar.month");
    return t("calendar.agenda");
  }

  function getEventTypeLabel(type: EventType): string {
    if (type === "class") return t("calendar.eventTypeClass");
    if (type === "study") return t("calendar.eventTypeStudy");
    if (type === "leetcode") return t("calendar.eventTypeLeetCode");
    if (type === "deadline") return t("calendar.eventTypeDeadline");
    if (type === "meeting") return t("calendar.eventTypeMeeting");
    if (type === "personal") return t("calendar.eventTypePersonal");
    return t("calendar.eventTypeCustom");
  }

  function getLinkedModuleLabel(moduleName: "leetcode" | "reading" | "notes" | "groups"): string {
    if (moduleName === "leetcode") return t("modules.leetcode");
    if (moduleName === "reading") return t("modules.reading");
    if (moduleName === "notes") return t("modules.notes");
    return t("modules.groups");
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
  const todayKey = new Date().toISOString().slice(0, 10);
  const reviewDueProblemsCount = useMemo(
    () =>
      problems.filter(
        (item) =>
          item.nextReviewDate &&
          item.nextReviewDate.slice(0, 10) <= todayKey &&
          (item.status === "Solved" || item.status === "Review")
      ).length,
    [problems, todayKey]
  );
  const reviewDueKnowledgeCount = useMemo(
    () =>
      knowledgePoints.filter(
        (item) => item.nextReviewDate && item.nextReviewDate.slice(0, 10) <= todayKey
      ).length,
    [knowledgePoints, todayKey]
  );

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
      title: timerLogTitle.trim() || t("calendar.pomodoroSession"),
      type: timerLogType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      recurrence: "none",
      description: t("calendar.loggedFromFocusModeTimer"),
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
        { title: t("calendar.templateAlgorithmsClass"), type: "class", weekdayOffset: 1, startHour: 10, durationHours: 1.5 },
        { title: t("calendar.templateSystemsClass"), type: "class", weekdayOffset: 3, startHour: 10, durationHours: 1.5 },
        { title: t("calendar.templateLeetCodePractice"), type: "leetcode", weekdayOffset: 2, startHour: 19, durationHours: 1 },
        { title: t("calendar.templateDeepStudyBlock"), type: "study", weekdayOffset: 5, startHour: 14, durationHours: 2 },
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
          description: t("calendar.academicTermTemplate"),
        });
      });
      return;
    }
    const examPrep: Array<{ title: string; dayOffset: number; hour: number; durationHours: number }> = [
      { title: t("calendar.templateExamReviewSession"), dayOffset: 0, hour: 18, durationHours: 2 },
      { title: t("calendar.templatePastPaperPractice"), dayOffset: 2, hour: 17, durationHours: 2 },
      { title: t("calendar.templateFormulaNotesConsolidation"), dayOffset: 4, hour: 19, durationHours: 1.5 },
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
        description: t("calendar.examWeekTemplate"),
      });
    });
  }

  async function runCalendarAi(mode: "briefing" | "schedule" | "plan") {
    if (!settings.aiEnabled) {
      setAiCalendarOutput(t("ai.messages.enableFirst"));
      return;
    }
    if (!settings.aiFeatureCalendarPlanner) {
      setAiCalendarOutput(t("ai.messages.calendarPlannerDisabled"));
      return;
    }
    if (!settings.aiPrivacyAcknowledged) {
      setAiCalendarOutput(t("ai.messages.acknowledgePrivacy"));
      return;
    }
    if (settings.aiProvider === "byok" && !settings.aiApiKey.trim()) {
      setAiCalendarOutput(t("ai.messages.byokMissing"));
      return;
    }
    const quota = consumeAiQuota(settings.aiProvider);
    if (!quota.ok) {
      recordAiAuditEntry({
        module: "Calendar",
        action: `calendar_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: 0,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_quota",
      });
      setAiCalendarOutput(t("ai.messages.freeTierReached"));
      return;
    }

    const nextEvents = visibleEvents
      .slice(0, 8)
      .map((event) => `${new Date(event.startTime).toLocaleString()} ${event.title}`)
      .join(" | ");
    const solvedCount = problems.filter((problem) => problem.status === "Solved").length;
    const goalTarget = Math.max(0, settings.leetCodeGoal);
    const goalRemaining = Math.max(0, goalTarget - solvedCount);
    const focusBaseDate = focusDate || new Date().toISOString().slice(0, 10);
    const promptMap = {
      briefing: `Generate a concise daily briefing using these events: ${nextEvents}. Include priority order and likely risks.`,
      schedule: `Optimize my schedule to balance deep work and review sessions. Events snapshot: ${nextEvents}.`,
      plan: `[CAL_PLAN] ${focusBaseDate}::Generate a 3-day goal-based study plan. LeetCode solved=${solvedCount}, goal=${goalTarget}, remaining=${goalRemaining}. Due reviews: ${reviewDueProblemsCount} LeetCode, ${reviewDueKnowledgeCount} reading. Current events: ${nextEvents}. Return plan lines as PLAN_ITEM|title|YYYY-MM-DD|HH:mm|durationMinutes|type`,
    } as const;
    const rawPrompt = promptMap[mode];
    const safePrompt = sanitizeAiPrompt(rawPrompt);
    if (!safePrompt) {
      recordAiAuditEntry({
        module: "Calendar",
        action: `calendar_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_validation",
      });
      setAiCalendarOutput(t("ai.messages.invalidPrompt"));
      return;
    }
    recordAiAuditEntry({
      module: "Calendar",
      action: `calendar_${mode}`,
      provider: settings.aiProvider,
      model: settings.aiModel,
      promptChars: rawPrompt.length,
      sanitizedChars: safePrompt.length,
      quotaLimit: quota.limit,
      quotaUsed: quota.used,
      quotaRemaining: quota.remaining,
      outcome: "allowed",
    });

    setAiCalendarLoading(true);
    setAiCalendarOutput("");
    if (mode === "plan") {
      setCalendarPlanDrafts([]);
    }
    try {
      let fullText = "";
      for await (const chunk of streamAiResponseLazy({
        prompt: safePrompt,
        moduleName: "Calendar",
        backend: settings.aiBackend,
        provider: settings.aiProvider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        context: {
          eventsCount: events.length,
          problemsCount: problems.length,
          knowledgePointsCount: knowledgePoints.length,
        },
      })) {
        fullText += chunk;
        setAiCalendarOutput(fullText);
      }
      if (mode === "plan") {
        const parsed = parseCalendarPlanDrafts(fullText);
        setCalendarPlanDrafts(parsed);
        if (parsed.length === 0) {
          setAiCalendarOutput(
            t("calendar.noStructuredPlanLines")
          );
        }
      }
      recordAiAuditEntry({
        module: "Calendar",
        action: `calendar_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "success",
      });
    } catch {
      recordAiAuditEntry({
        module: "Calendar",
        action: `calendar_${mode}`,
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawPrompt.length,
        sanitizedChars: safePrompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "error",
      });
      setAiCalendarOutput(t("ai.messages.providerError"));
    } finally {
      setAiCalendarLoading(false);
    }
  }

  function parseCalendarPlanDrafts(text: string): CalendarPlanDraft[] {
    const allowedTypes: EventType[] = [
      "class",
      "study",
      "leetcode",
      "deadline",
      "meeting",
      "personal",
      "custom",
    ];
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("PLAN_ITEM|"))
      .map((line) => {
        const [, titleRaw, dateRaw, timeRaw, durationRaw, typeRaw] = line.split("|");
        const title = (titleRaw ?? "").trim();
        const date = /^\d{4}-\d{2}-\d{2}$/.test((dateRaw ?? "").trim())
          ? (dateRaw ?? "").trim()
          : new Date().toISOString().slice(0, 10);
        const time = /^([01]\d|2[0-3]):[0-5]\d$/.test((timeRaw ?? "").trim())
          ? (timeRaw ?? "").trim()
          : "19:00";
        const durationMinutes = Math.min(
          240,
          Math.max(15, Number.parseInt((durationRaw ?? "").trim(), 10) || 60)
        );
        const eventType = allowedTypes.includes((typeRaw ?? "").trim() as EventType)
          ? ((typeRaw ?? "").trim() as EventType)
          : "study";
        return {
          id: crypto.randomUUID(),
          selected: true,
          title: title || t("calendar.aiStudyBlock"),
          date,
          time,
          durationMinutes,
          type: eventType,
        };
      });
  }

  function insertSelectedPlanDrafts() {
    const selectedDrafts = calendarPlanDrafts.filter((item) => item.selected);
    if (selectedDrafts.length === 0) {
      setAiCalendarOutput(t("calendar.selectAtLeastOneDraft"));
      return;
    }
    let inserted = 0;
    for (const draft of selectedDrafts) {
      const start = new Date(`${draft.date}T${draft.time}:00`);
      if (Number.isNaN(start.getTime())) continue;
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + Math.max(15, draft.durationMinutes));
      upsertEvent({
        title: draft.title.trim() || t("calendar.aiStudyBlock"),
        type: draft.type,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        recurrence: "none",
        description: t("calendar.insertedFromPlanDraft"),
      });
      inserted += 1;
    }
    setAiCalendarOutput(t("calendar.insertedDraftBlocks", { count: inserted }));
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
      title={t("pages.calendar.title")}
      subtitle={t("pages.calendar.subtitle")}
    >
      <div className="actions-row">
        <button type="button" onClick={() => setShowEventForm((prev) => !prev)}>
          {showEventForm ? t("calendar.hideEventForm") : t("calendar.addEvent")}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => applyAcademicTemplate("cs-starter")}
        >
          {t("calendar.applyCsTermTemplate")}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => applyAcademicTemplate("exam-week")}
        >
          {t("calendar.applyExamWeekTemplate")}
        </button>
        <div className="view-switch">
          {(["day", "week", "month", "agenda"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={mode === viewMode ? "button-secondary view-active" : "button-secondary"}
              onClick={() => setViewMode(mode)}
            >
              {getViewModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-nav">
        <button type="button" onClick={() => shiftFocus(-1)}>
          {t("calendar.prev")}
        </button>
        <strong>{new Date(`${focusDate}T00:00:00`).toLocaleDateString()}</strong>
        <button type="button" onClick={() => shiftFocus(1)}>
          {t("calendar.next")}
        </button>
        <button type="button" className="button-secondary" onClick={() => setFocusDate(new Date().toISOString().slice(0, 10))}>
          {t("calendar.today")}
        </button>
      </div>

      {isMobileCalendar && (
        <div className="calendar-mobile-switch">
          <small>{t("calendar.mobileQuickViews")}</small>
          <div className="actions-row">
            <button
              type="button"
              className={viewMode === "day" ? "button-secondary view-active" : "button-secondary"}
              onClick={() => setViewMode("day")}
            >
              {t("calendar.day")}
            </button>
            <button
              type="button"
              className={viewMode === "agenda" ? "button-secondary view-active" : "button-secondary"}
              onClick={() => setViewMode("agenda")}
            >
              {t("calendar.agenda")}
            </button>
          </div>
        </div>
      )}

      <article className="tile focus-mode-tile">
        <h2>{t("calendar.focusMode")}</h2>
        <small>{t("calendar.focusSessionsCompletedToday", { count: completedFocusSessions })}</small>
        <div className="timer-presets">
          <button
            type="button"
            className={timerMode === "focus" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => resetTimerForMode("focus")}
          >
            {t("calendar.focus25m")}
          </button>
          <button
            type="button"
            className={timerMode === "shortBreak" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => resetTimerForMode("shortBreak")}
          >
            {t("calendar.shortBreak")}
          </button>
          <button
            type="button"
            className={timerMode === "longBreak" ? "button-secondary view-active" : "button-secondary"}
            onClick={() => resetTimerForMode("longBreak")}
          >
            {t("calendar.longBreak")}
          </button>
        </div>
        <div className="timer-display">{formatTimer(timerSecondsRemaining)}</div>
        <div className="actions-row">
          <button type="button" onClick={() => setTimerRunning((v) => !v)}>
            {timerRunning ? t("common.pause") : t("common.start")}
          </button>
          <button type="button" className="button-secondary" onClick={() => resetTimerForMode(timerMode)}>
            {t("common.reset")}
          </button>
        </div>
        {lastCompletedFocusSeconds && lastCompletedFocusAt && (
          <div className="timer-log-box">
            <small>
              {t("calendar.lastCompletedFocus", {
                minutes: Math.round(lastCompletedFocusSeconds / 60),
                at: new Date(lastCompletedFocusAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </small>
            <div className="filters-row timer-log-row">
              <select
                value={timerLogType}
                onChange={(e) => setTimerLogType(e.target.value as "study" | "leetcode")}
              >
                <option value="study">{t("calendar.eventTypeStudy")}</option>
                <option value="leetcode">{t("calendar.eventTypeLeetCode")}</option>
              </select>
              <input
                value={timerLogTitle}
                onChange={(e) => setTimerLogTitle(e.target.value)}
                placeholder={t("calendar.sessionTitlePlaceholder")}
              />
            </div>
            <div className="actions-row">
              <button type="button" onClick={logCompletedPomodoro}>
                {t("calendar.saveSessionToCalendar")}
              </button>
            </div>
          </div>
        )}
      </article>

      <article className="tile reminder-preview-tile">
        <h2>{t("calendar.upcomingReminderPreview")}</h2>
        <small>{t("calendar.next24Hours")}</small>
        {!settings.notificationsEnabled && (
          <p>{t("calendar.notificationsDisabled")}</p>
        )}
        {settings.notificationsEnabled && !settings.eventRemindersEnabled && (
          <p>{t("calendar.eventRemindersDisabled")}</p>
        )}
        {settings.notificationsEnabled && settings.eventRemindersEnabled && reminderPreview.length === 0 && (
          <p>{t("calendar.noUpcomingReminders")}</p>
        )}
        {settings.notificationsEnabled && settings.eventRemindersEnabled && reminderPreview.length > 0 && (
          <ul className="reminder-preview-list">
            {reminderPreview.map((item) => (
              <li key={`${item.event.occurrenceId}-${item.reminderAt.toISOString()}`}>
                <strong>{item.event.title}</strong>
                <small>
                  {t("calendar.notifyAt", {
                    notifyAt: item.reminderAt.toLocaleString(),
                    eventStarts: new Date(item.event.startTime).toLocaleString(),
                  })}
                </small>
                {item.suppressedByQuietHours && (
                  <small>{t("calendar.suppressedByQuietHours")}</small>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="tile leetcode-ai-panel">
        <h2>{t("calendar.aiTitle")}</h2>
        <p>{t("calendar.aiDesc")}</p>
        <div className="actions-row">
          <button
            type="button"
            className="button-secondary"
            disabled={aiCalendarLoading}
            onClick={() => void runCalendarAi("briefing")}
          >
            {t("calendar.generateDailyBriefing")}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={aiCalendarLoading}
            onClick={() => void runCalendarAi("schedule")}
          >
            {t("calendar.smartScheduleSuggestion")}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={aiCalendarLoading}
            onClick={() => void runCalendarAi("plan")}
          >
            {t("calendar.generateStudyPlan")}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={aiCalendarLoading || calendarPlanDrafts.length === 0}
            onClick={insertSelectedPlanDrafts}
          >
            {t("calendar.insertSelectedDrafts")}
          </button>
        </div>
        <div className="ai-inline-output">
          {aiCalendarLoading && <small>{t("calendar.generatingResponse")}</small>}
          {!aiCalendarLoading && !aiCalendarOutput && (
            <small>{t("calendar.aiRunPrompt")}</small>
          )}
          {aiCalendarOutput && <pre>{aiCalendarOutput}</pre>}
        </div>
        {calendarPlanDrafts.length > 0 && (
          <div className="ai-inline-output">
            <small>{t("calendar.editPlanDraftsBeforeInserting")}</small>
            {calendarPlanDrafts.map((draft) => (
              <div key={draft.id} className="problem-form">
                <div className="problem-form-grid">
                  <label>
                    <span>{t("calendar.include")}</span>
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) =>
                        setCalendarPlanDrafts((current) =>
                          current.map((item) =>
                            item.id === draft.id ? { ...item, selected: event.target.checked } : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>{t("calendar.title")}</span>
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        setCalendarPlanDrafts((current) =>
                          current.map((item) =>
                            item.id === draft.id ? { ...item, title: event.target.value } : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>{t("calendar.date")}</span>
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(event) =>
                        setCalendarPlanDrafts((current) =>
                          current.map((item) =>
                            item.id === draft.id ? { ...item, date: event.target.value } : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>{t("calendar.time")}</span>
                    <input
                      type="time"
                      value={draft.time}
                      onChange={(event) =>
                        setCalendarPlanDrafts((current) =>
                          current.map((item) =>
                            item.id === draft.id ? { ...item, time: event.target.value } : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>{t("calendar.durationMin")}</span>
                    <input
                      type="number"
                      min={15}
                      max={240}
                      step={15}
                      value={draft.durationMinutes}
                      onChange={(event) =>
                        setCalendarPlanDrafts((current) =>
                          current.map((item) =>
                            item.id === draft.id
                              ? {
                                  ...item,
                                  durationMinutes: Math.max(
                                    15,
                                    Math.min(240, Number(event.target.value) || 60)
                                  ),
                                }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>{t("calendar.type")}</span>
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        setCalendarPlanDrafts((current) =>
                          current.map((item) =>
                            item.id === draft.id
                              ? { ...item, type: event.target.value as EventType }
                              : item
                          )
                        )
                      }
                    >
                      <option value="class">{t("calendar.eventTypeClass")}</option>
                      <option value="study">{t("calendar.eventTypeStudy")}</option>
                      <option value="leetcode">{t("calendar.eventTypeLeetCode")}</option>
                      <option value="deadline">{t("calendar.eventTypeDeadline")}</option>
                      <option value="meeting">{t("calendar.eventTypeMeeting")}</option>
                      <option value="personal">{t("calendar.eventTypePersonal")}</option>
                      <option value="custom">{t("calendar.eventTypeCustom")}</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      {showEventForm && (
        <form className="problem-form" onSubmit={onSaveEvent}>
          <div className="problem-form-grid">
            <label>
              <span>{t("calendar.title")}</span>
              <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
            </label>
            <label>
              <span>{t("calendar.type")}</span>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                <option value="class">{t("calendar.eventTypeClass")}</option>
                <option value="study">{t("calendar.eventTypeStudy")}</option>
                <option value="leetcode">{t("calendar.eventTypeLeetCode")}</option>
                <option value="deadline">{t("calendar.eventTypeDeadline")}</option>
                <option value="meeting">{t("calendar.eventTypeMeeting")}</option>
                <option value="personal">{t("calendar.eventTypePersonal")}</option>
                <option value="custom">{t("calendar.eventTypeCustom")}</option>
              </select>
            </label>
            <label>
              <span>{t("calendar.start")}</span>
              <input
                type="datetime-local"
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                required
              />
            </label>
            <label>
              <span>{t("calendar.end")}</span>
              <input
                type="datetime-local"
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                required
              />
            </label>
            <label>
              <span>{t("calendar.recurrence")}</span>
              <select
                value={eventRecurrence}
                onChange={(e) =>
                  setEventRecurrence(e.target.value as "none" | "daily" | "weekly" | "monthly")
                }
              >
                <option value="none">{t("calendar.noRecurrence")}</option>
                <option value="daily">{t("calendar.daily")}</option>
                <option value="weekly">{t("calendar.weekly")}</option>
                <option value="monthly">{t("calendar.monthly")}</option>
              </select>
            </label>
            <label>
              <span>{t("calendar.repeatUntil")}</span>
              <input
                type="date"
                value={eventRecurrenceUntil}
                disabled={eventRecurrence === "none"}
                onChange={(e) => setEventRecurrenceUntil(e.target.value)}
              />
            </label>
            <label>
              <span>{t("calendar.reminder")}</span>
              <select
                value={eventReminderMinutesBefore}
                onChange={(e) =>
                  setEventReminderMinutesBefore(
                    e.target.value as "0" | "5" | "10" | "15" | "30" | "60"
                  )
                }
              >
                <option value="0">{t("calendar.noReminder")}</option>
                <option value="5">{t("calendar.reminder5")}</option>
                <option value="10">{t("calendar.reminder10")}</option>
                <option value="15">{t("calendar.reminder15")}</option>
                <option value="30">{t("calendar.reminder30")}</option>
                <option value="60">{t("calendar.reminder60")}</option>
              </select>
            </label>
            <label>
              <span>{t("calendar.linkedModule")}</span>
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
                <option value="none">{t("calendar.none")}</option>
                <option value="leetcode">{t("modules.leetcode")}</option>
                <option value="reading">{t("modules.reading")}</option>
                <option value="notes">{t("modules.notes")}</option>
                <option value="groups">{t("modules.groups")}</option>
              </select>
            </label>
            {eventLinkedModule === "leetcode" && (
              <label>
                <span>{t("calendar.linkedProblem")}</span>
                <select
                  value={eventLinkedItemId}
                  onChange={(e) => setEventLinkedItemId(e.target.value)}
                >
                  <option value="">{t("calendar.none")}</option>
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
                <span>{t("calendar.linkedBook")}</span>
                <select
                  value={eventLinkedItemId}
                  onChange={(e) => setEventLinkedItemId(e.target.value)}
                >
                  <option value="">{t("calendar.none")}</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="full-width">
              <span>{t("calendar.description")}</span>
              <textarea
                rows={3}
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </label>
          </div>
          <div className="actions-row">
            <button type="submit">{editingEventId ? t("calendar.updateEvent") : t("calendar.saveEvent")}</button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setShowEventForm(false);
                resetEventForm();
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      <article className="tile calendar-events">
        <h2>{t("calendar.viewTitle", { mode: getViewModeLabel(viewMode) })}</h2>
        {viewMode === "day" && (
          <div className="calendar-day-planner">
            <small>{t("calendar.dragToCreateEvent")}</small>
            {isMobileCalendar && (
              <div className="mobile-day-list">
                {dayEvents.length === 0 && <small>{t("calendar.noEventsForDay")}</small>}
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
                    <span className={`event-type event-type-${event.type}`}>{getEventTypeLabel(event.type)}</span>
                  </article>
                ))}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowMobileDayGrid((prev) => !prev)}
                >
                  {showMobileDayGrid ? t("calendar.hideTimeGrid") : t("calendar.showTimeGrid")}
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
        {visibleEvents.length === 0 && <p>{t("calendar.noEventsInRange")}</p>}
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
                    <span className={`event-type event-type-${event.type}`}>{getEventTypeLabel(event.type)}</span>
                    <strong>{event.title}</strong>
                    <small>
                      {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                      {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </small>
                    {(event.recurrence ?? "none") !== "none" && (
                      <small>
                        {t("calendar.repeats", { recurrence: event.recurrence })}
                        {event.recurrenceUntil ? t("calendar.until", { date: event.recurrenceUntil }) : ""}
                      </small>
                    )}
                    {typeof event.reminderMinutesBefore === "number" && (
                      <small>{t("calendar.reminderMinutesBefore", { minutes: event.reminderMinutesBefore })}</small>
                    )}
                    {event.linkedModule && (
                      <small>
                        {t("calendar.linked", {
                          module: getLinkedModuleLabel(event.linkedModule),
                        })}
                        {event.linkedItemId ? ` (${event.linkedItemId.slice(0, 8)})` : ""}
                      </small>
                    )}
                    {event.description && <small>{event.description}</small>}
                  </div>
                  <div className="inline-actions">
                    <button type="button" onClick={() => onEditEvent(events.find((item) => item.id === event.sourceEventId) ?? event)}>
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="button-secondary event-resize-handle"
                      title={t("calendar.resizeHint")}
                      disabled={event.isRecurringInstance}
                      onMouseDown={(mouseEvent) => startResizeDrag(mouseEvent, events.find((item) => item.id === event.sourceEventId) ?? event)}
                    >
                      {t("calendar.resize")}
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => deleteEvent(event.sourceEventId)}
                    >
                      {t("common.delete")}
                    </button>
                    {event.linkedModule && (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => goToLinkedTarget(event)}
                      >
                        {t("calendar.openLinked")}
                      </button>
                    )}
                    {event.type === "leetcode" && (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => navigate("/leetcode")}
                      >
                        {t("calendar.logProblem")}
                      </button>
                    )}
                    {event.type === "study" && (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => navigate("/reading")}
                      >
                        {t("calendar.captureKnowledge")}
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

export function NotesPage() {
  const { t } = useTranslation();
  type PasteAssistState = {
    sourceText: string;
    sourceFrom: number;
    sourceTo: number;
    format: "bullets" | "paragraph";
    insertionMode: "replace" | "below";
    loading: boolean;
    output: string;
  };

  const settings = useAppStore((state) => state.settings);
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
  const [pinned, setPinned] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [linkedModule, setLinkedModule] = useState<"none" | "leetcode" | "reading" | "calendar" | "groups">(
    "none"
  );
  const [linkedItemId, setLinkedItemId] = useState("");
  const [pasteAssist, setPasteAssist] = useState<PasteAssistState | null>(null);
  const imagePickerRef = useRef<HTMLInputElement | null>(null);

  const templateBodies: Record<NoteTemplate, { title: string; content: string }> = {
    custom: { title: "", content: "" },
    lecture: {
      title: "Lecture Notes",
      content:
        "<h1>Lecture</h1><h2>Key Ideas</h2><ul><li></li></ul><h2>Examples</h2><ul><li></li></ul><h2>Questions</h2><ul><li></li></ul><h2>Next Actions</h2><p>[[calendar]] Review and summarize</p>",
    },
    algorithm: {
      title: "Algorithm Note",
      content:
        "<h1>Problem Context</h1><h2>Approach</h2><ul><li></li></ul><h2>Complexity</h2><ul><li>Time:</li><li>Space:</li></ul><h2>Edge Cases</h2><ul><li></li></ul><h2>Related</h2><p>[[leetcode]]</p>",
    },
    meeting: {
      title: "Meeting Notes",
      content:
        "<h1>Agenda</h1><ul><li></li></ul><h2>Discussion</h2><ul><li></li></ul><h2>Decisions</h2><ul><li></li></ul><h2>Action Items</h2><ul><li>[ ]</li></ul><h2>Follow-up</h2><p>[[groups]]</p>",
    },
    weekly_reflection: {
      title: "Weekly Reflection",
      content:
        "<h1>Wins</h1><ul><li></li></ul><h1>Challenges</h1><ul><li></li></ul><h1>Learnings</h1><ul><li></li></ul><h1>Focus Next Week</h1><ul><li>[[reading]]</li><li>[[leetcode]]</li></ul>",
    },
  };

  function maybeOpenPasteAssist(pastedText: string, selectionFrom: number, insertedSize: number) {
    if (!settings.aiEnabled) return;
    if (!pastedText.trim()) return;
    const pastedLines = pastedText.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    if (pastedText.length < 800 && pastedLines < 8) return;
    setPasteAssist({
      sourceText: pastedText,
      sourceFrom: selectionFrom,
      sourceTo: selectionFrom + insertedSize,
      format: "bullets",
      insertionMode: "below",
      loading: false,
      output: "",
    });
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write notes here...",
      }),
      Image,
    ],
    content,
    editorProps: {
      handlePaste: (view, event, slice) => {
        const pastedText = event.clipboardData?.getData("text") ?? "";
        const selectionFrom = view.state.selection.from;
        maybeOpenPasteAssist(pastedText, selectionFrom, slice.content.size);
        return false;
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      setContent(nextEditor.getHTML());
    },
  });

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
    setPinned(Boolean(active.pinned));
    setTagsInput(active.tags.join(", "));
    setLinkedModule(active.linkedModule ?? "none");
    setLinkedItemId(active.linkedItemId ?? "");
  }, [activeNoteId, notes]);

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (content === currentHtml) return;
    editor.commands.setContent(content || "<p></p>", { emitUpdate: false });
  }, [editor, content]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? notes
      : notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.tags.some((tag) => tag.toLowerCase().includes(q))
    );
    return filtered.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
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
    setPinned(false);
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
      pinned,
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      linkedModule: linkedModule === "none" ? undefined : linkedModule,
      linkedItemId: linkedModule === "none" ? undefined : linkedItemId || undefined,
    });
  }

  function insertRichSnippet(text: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
  }

  async function onPickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      if (!editor) return;
      editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
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

  async function generatePasteAssistSummary() {
    if (!pasteAssist) return;
    if (!settings.aiEnabled) {
      setPasteAssist((current) =>
        current ? { ...current, output: t("ai.messages.enableFirst") } : current
      );
      return;
    }
    if (!settings.aiPrivacyAcknowledged) {
      setPasteAssist((current) =>
        current
          ? { ...current, output: t("ai.messages.acknowledgePrivacy") }
          : current
      );
      return;
    }
    if (settings.aiProvider === "byok" && !settings.aiApiKey.trim()) {
      setPasteAssist((current) =>
        current ? { ...current, output: t("ai.messages.byokMissing") } : current
      );
      return;
    }
    const quota = consumeAiQuota(settings.aiProvider);
    if (!quota.ok) {
      recordAiAuditEntry({
        module: "Notes",
        action: "notes_paste_assist",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: 0,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_quota",
      });
      setPasteAssist((current) =>
        current ? { ...current, output: t("ai.messages.freeTierReached") } : current
      );
      return;
    }

    const basePrompt =
      pasteAssist.format === "bullets"
        ? "Summarize the pasted text into concise knowledge-point bullet points for a CS student. Keep it short and high signal."
        : "Summarize the pasted text into a concise paragraph form for a CS student. Keep it short and high signal.";
    const prompt = sanitizeAiPrompt(
      `${basePrompt}\n\nSource text:\n${pasteAssist.sourceText.slice(0, 9000)}`
    );
    if (!prompt) {
      recordAiAuditEntry({
        module: "Notes",
        action: "notes_paste_assist",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: pasteAssist.sourceText.length,
        sanitizedChars: 0,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_validation",
      });
      setPasteAssist((current) =>
        current ? { ...current, output: t("ai.messages.invalidPrompt") } : current
      );
      return;
    }
    recordAiAuditEntry({
      module: "Notes",
      action: "notes_paste_assist",
      provider: settings.aiProvider,
      model: settings.aiModel,
      promptChars: pasteAssist.sourceText.length,
      sanitizedChars: prompt.length,
      quotaLimit: quota.limit,
      quotaUsed: quota.used,
      quotaRemaining: quota.remaining,
      outcome: "allowed",
    });

    setPasteAssist((current) => (current ? { ...current, loading: true, output: "" } : current));
    try {
      let full = "";
      for await (const chunk of streamAiResponseLazy({
        prompt,
        moduleName: "Notes",
        backend: settings.aiBackend,
        provider: settings.aiProvider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        context: {
          notesCount: notes.length,
        },
      })) {
        full += chunk;
        setPasteAssist((current) => (current ? { ...current, output: full } : current));
      }
      recordAiAuditEntry({
        module: "Notes",
        action: "notes_paste_assist",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: pasteAssist.sourceText.length,
        sanitizedChars: prompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "success",
      });
    } catch {
      recordAiAuditEntry({
        module: "Notes",
        action: "notes_paste_assist",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: pasteAssist.sourceText.length,
        sanitizedChars: prompt.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "error",
      });
      setPasteAssist((current) =>
        current ? { ...current, output: t("ai.messages.providerError") } : current
      );
    } finally {
      setPasteAssist((current) => (current ? { ...current, loading: false } : current));
    }
  }

  function applyPasteAssistSummary() {
    if (!editor || !pasteAssist || !pasteAssist.output.trim()) return;
    const summaryText = pasteAssist.output.trim();
    if (pasteAssist.insertionMode === "replace") {
      editor
        .chain()
        .focus()
        .setTextSelection({
          from: Math.max(1, pasteAssist.sourceFrom),
          to: Math.max(1, pasteAssist.sourceTo),
        })
        .insertContent(summaryText)
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setTextSelection(Math.max(1, pasteAssist.sourceTo))
        .insertContent(`\n\n${summaryText}`)
        .run();
    }
    setPasteAssist(null);
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
      const imageMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imageMatch) {
        flushParagraph();
        flushList();
        output.push(
          <figure key={`img-${output.length}`} className="markdown-image-block">
            <img src={imageMatch[2]} alt={imageMatch[1] || "note image"} />
            {imageMatch[1] && <figcaption>{imageMatch[1]}</figcaption>}
          </figure>
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
      title={t("pages.notes.title")}
      subtitle={t("pages.notes.subtitle")}
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
                  <strong>{note.pinned ? "📌 " : ""}{note.title}</strong>
                  <small>{new Date(note.updatedAt).toLocaleDateString()}</small>
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    upsertNote({
                      ...note,
                      pinned: !note.pinned,
                    })
                  }
                >
                  {note.pinned ? "Unpin" : "Pin"}
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
            <label>
              <span>Pin to top</span>
              <input
                type="checkbox"
                checked={pinned}
                onChange={(event) => setPinned(event.target.checked)}
              />
            </label>
            <label className="full-width">
              <span>Content (Rich Text + [[wikilink]])</span>
              <div className="notes-toolbar">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  H2
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>
                  Bold
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleCode().run()}>
                  Inline Code
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                >
                  Code Block
                </button>
                <button type="button" onClick={() => insertRichSnippet("$x^2 + y^2$")}>
                  Inline Math
                </button>
                <button type="button" onClick={() => insertRichSnippet("\n$$\nE = mc^2\n$$\n")}>
                  Math Block
                </button>
                <button
                  type="button"
                  onClick={() => insertRichSnippet("[[notes]]")}
                >
                  Wikilink
                </button>
                <button type="button" onClick={() => imagePickerRef.current?.click()}>
                  Image
                </button>
                <input
                  ref={imagePickerRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickImage}
                  style={{ display: "none" }}
                />
              </div>
              <EditorContent editor={editor} className="tiptap-editor" />
              {pasteAssist && (
                <div className="notes-paste-assist">
                  <small>Large paste detected. Generate a short AI summary?</small>
                  <div className="notes-paste-assist-controls">
                    <label>
                      <span>Summary format</span>
                      <select
                        value={pasteAssist.format}
                        onChange={(event) =>
                          setPasteAssist((current) =>
                            current
                              ? {
                                  ...current,
                                  format: event.target.value as "bullets" | "paragraph",
                                }
                              : current
                          )
                        }
                      >
                        <option value="bullets">Bullet knowledge points</option>
                        <option value="paragraph">Paragraph summary</option>
                      </select>
                    </label>
                    <label>
                      <span>Apply mode</span>
                      <select
                        value={pasteAssist.insertionMode}
                        onChange={(event) =>
                          setPasteAssist((current) =>
                            current
                              ? {
                                  ...current,
                                  insertionMode: event.target.value as "replace" | "below",
                                }
                              : current
                          )
                        }
                      >
                        <option value="replace">Replace original pasted block</option>
                        <option value="below">Insert summary below original block</option>
                      </select>
                    </label>
                  </div>
                  <div className="actions-row">
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={pasteAssist.loading}
                      onClick={() => void generatePasteAssistSummary()}
                    >
                      {pasteAssist.loading ? "Generating..." : "Generate Summary"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={pasteAssist.loading || !pasteAssist.output.trim()}
                      onClick={applyPasteAssistSummary}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setPasteAssist(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                  {pasteAssist.output && (
                    <div className="notes-paste-assist-output">
                      <pre>{pasteAssist.output}</pre>
                    </div>
                  )}
                </div>
              )}
            </label>
          </div>
        </article>

        <article className="tile notes-preview">
          <h2>Preview</h2>
          <div className="markdown-preview notes-rich-preview">{renderMarkdownPreview(content)}</div>
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

export function GroupsPage() {
  const { t } = useTranslation();
  return (
    <PageCard
      title={t("pages.groups.title")}
      subtitle={t("pages.groups.subtitle")}
    >
      <article className="tile">
        <h2>Group Setup</h2>
        <p>Create your first group and invite members.</p>
        <div className="groups-placeholder">
          <p>Shared notes, progress visibility, and group calendar tools will appear here.</p>
        </div>
      </article>
    </PageCard>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useAppStore((state) => state.settings);
  const syncMetadata = useAppStore((state) => state.leetCodeSyncMetadata);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const runLeetCodeSync = useAppStore((state) => state.runLeetCodeSync);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultPassphraseConfirm, setVaultPassphraseConfirm] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [vaultStatusMessage, setVaultStatusMessage] = useState("");
  const [auditEntries, setAuditEntries] = useState<AiAuditEntry[]>([]);
  const [auditChainValid, setAuditChainValid] = useState<boolean | null>(null);
  const [auditBrokenIndex, setAuditBrokenIndex] = useState<number | null>(null);
  const [auditEncryptExport, setAuditEncryptExport] = useState(false);
  const [auditExportPassphrase, setAuditExportPassphrase] = useState("");
  const [byokUnlocked, setByokUnlocked] = useState<boolean>(() =>
    Boolean(getSessionUnlockedByokKey())
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

  useEffect(() => {
    setByokUnlocked(Boolean(getSessionUnlockedByokKey()));
  }, [settings.aiByokRequirePassphrase, settings.aiProvider]);

  useEffect(() => {
    void refreshAiAuditEntries();
  }, []);

  async function requestNotificationPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  }

  async function setByokPassphrase() {
    if (vaultPassphrase.length < 8) {
      setVaultStatusMessage(t("settings.byokPassphraseLengthError"));
      return;
    }
    if (vaultPassphrase !== vaultPassphraseConfirm) {
      setVaultStatusMessage(t("settings.byokPassphraseMismatch"));
      return;
    }
    const hash = await createPassphraseHash(vaultPassphrase);
    updateSettings({
      aiByokRequirePassphrase: true,
      aiByokPassphraseHash: hash,
    });
    setVaultPassphrase("");
    setVaultPassphraseConfirm("");
    setVaultStatusMessage(t("settings.byokPassphraseSaved"));
  }

  async function unlockByokForSession() {
    if (!settings.aiByokPassphraseHash) {
      setVaultStatusMessage(t("settings.byokNoPassphraseSet"));
      return;
    }
    const valid = await verifyPassphrase(
      unlockPassphrase,
      settings.aiByokPassphraseHash
    );
    if (!valid) {
      setVaultStatusMessage(t("settings.byokUnlockFailed"));
      return;
    }
    const decrypted =
      settings.aiApiKey.trim() ||
      (settings.aiApiKeyEncrypted
        ? await decryptAtRestSecret(settings.aiApiKeyEncrypted)
        : "");
    setSessionUnlockedByokKey(decrypted);
    updateSettings({ aiApiKey: decrypted });
    setUnlockPassphrase("");
    setByokUnlocked(true);
    setVaultStatusMessage(t("settings.byokUnlockedForSession"));
  }

  function lockByokForSession() {
    clearSessionUnlockedByokKey();
    updateSettings({ aiApiKey: "" });
    setByokUnlocked(false);
    setVaultStatusMessage(t("settings.byokLockedForSession"));
  }

  async function refreshAiAuditEntries() {
    const entries = getAiAuditEntries(40);
    setAuditEntries(entries);
    const result = await verifyAiAuditChain(entries);
    setAuditChainValid(result.valid);
    setAuditBrokenIndex(typeof result.brokenIndex === "number" ? result.brokenIndex : null);
  }

  async function exportAiAuditJson() {
    const report = await exportAiAuditReport({
      encryptPassphrase: auditEncryptExport ? auditExportPassphrase : undefined,
    });
    const blob = new Blob([report.content], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = report.filename;
    link.click();
    URL.revokeObjectURL(url);
    if (auditEncryptExport) {
      setAuditExportPassphrase("");
    }
  }

  return (
    <PageCard
      title={t("pages.settings.title")}
      subtitle={t("pages.settings.subtitle")}
    >
      <div className="settings-list">
        <label className="setting-row">
          <span>{t("settings.enableAi")}</span>
          <input
            type="checkbox"
            checked={settings.aiEnabled}
            onChange={(event) =>
              updateSettings({ aiEnabled: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.aiBackend")}</span>
          <select
            value={settings.aiBackend}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({
                aiBackend: event.target.value as "mock" | "claw_agent_devtools",
              })
            }
          >
            <option value="mock">{t("settings.backendMock")}</option>
            <option value="claw_agent_devtools">{t("settings.backendClaw")}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t("settings.aiProvider")}</span>
          <select
            value={settings.aiProvider}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({
                aiProvider: event.target.value as "free_default" | "byok",
              })
            }
          >
            <option value="free_default">{t("settings.providerFree")}</option>
            <option value="byok">{t("settings.providerByok")}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t("settings.aiModel")}</span>
          <select
            value={settings.aiModel}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({
                aiModel: event.target.value as "gemma-3" | "llama-4-scout" | "gpt-4.1-mini",
              })
            }
          >
            <option value="gemma-3">Gemma 3 (Free Default)</option>
            <option value="llama-4-scout">Llama 4 Scout (Free Default)</option>
            <option value="gpt-4.1-mini">GPT-4.1 mini (BYOK)</option>
          </select>
        </label>
        <div className="setting-row">
          <span>{t("settings.aiPrivacyDisclosure")}</span>
          <div className="sync-box">
            <small>
              {t("settings.aiPrivacyDesc")}
            </small>
            <label>
              <input
                type="checkbox"
                checked={settings.aiPrivacyAcknowledged}
                onChange={(event) =>
                  updateSettings({ aiPrivacyAcknowledged: event.target.checked })
                }
              />{" "}
              {t("settings.aiConsent")}
            </label>
          </div>
        </div>
        <label className="setting-row">
          <span>{t("settings.aiChatPanel")}</span>
          <input
            type="checkbox"
            checked={settings.aiFeatureChat}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({ aiFeatureChat: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.leetcodeAiHints")}</span>
          <input
            type="checkbox"
            checked={settings.aiFeatureLeetCodeHints}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({ aiFeatureLeetCodeHints: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.readingAiExplainer")}</span>
          <input
            type="checkbox"
            checked={settings.aiFeatureReadingExplainer}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({ aiFeatureReadingExplainer: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.calendarAiPlanner")}</span>
          <input
            type="checkbox"
            checked={settings.aiFeatureCalendarPlanner}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({ aiFeatureCalendarPlanner: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.aiFlashcardGenerator")}</span>
          <input
            type="checkbox"
            checked={settings.aiFeatureFlashcardGenerator}
            disabled={!settings.aiEnabled}
            onChange={(event) =>
              updateSettings({ aiFeatureFlashcardGenerator: event.target.checked })
            }
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.enableNotifications")}</span>
          <div className="sync-box">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(event) =>
                updateSettings({ notificationsEnabled: event.target.checked })
              }
            />
            <small>
              {t("settings.browserPermission", { value: notificationPermission })}
            </small>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void requestNotificationPermission()}
              disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}
            >
              {t("settings.requestBrowserPermission")}
            </button>
          </div>
        </label>
        <label className="setting-row">
          <span>{t("settings.dailyDigest")}</span>
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
          <span>{t("settings.dailyDigestTime")}</span>
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
          <span>{t("settings.eventReminders")}</span>
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
          <span>{t("settings.reviewReminders")}</span>
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
          <span>{t("settings.reviewReminderTime")}</span>
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
          <span>{t("settings.streakReminders")}</span>
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
          <span>{t("settings.streakReminderTime")}</span>
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
          <span>{t("settings.quietHours")}</span>
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
          <span>{t("settings.quietHoursStart")}</span>
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
          <span>{t("settings.quietHoursEnd")}</span>
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
          <span>{t("settings.theme")}</span>
          <select
            value={settings.themePreference}
            onChange={(event) => onThemeChange(event.target.value as ThemePreference)}
          >
            <option value="dark">{t("settings.themeDark")}</option>
            <option value="light">{t("settings.themeLight")}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t("settings.accentColor")}</span>
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
          <span>{t("settings.leetcodeUsername")}</span>
          <input
            type="text"
            placeholder={t("settings.leetcodeUsernamePlaceholder")}
            value={settings.leetCodeUsername}
            onChange={(event) =>
              updateSettings({ leetCodeUsername: event.target.value })
            }
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.leetcodeGoal")}</span>
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
          <span>{t("settings.leetcodeSync")}</span>
          <div className="sync-box">
            <small>
              {syncMetadata.status} via {syncMetadata.method}
            </small>
            <small>
              {t("settings.lastSync")}{" "}
              {syncMetadata.lastSyncAt
                ? new Date(syncMetadata.lastSyncAt).toLocaleString()
                : "Never"}
            </small>
            {typeof syncMetadata.lastImportedCount === "number" && (
              <small>{t("settings.importedThisRun", { count: syncMetadata.lastImportedCount })}</small>
            )}
            {typeof syncMetadata.lastCreatedCount === "number" && (
              <small>{t("settings.createdCount", { count: syncMetadata.lastCreatedCount })}</small>
            )}
            {typeof syncMetadata.lastMergedCount === "number" && (
              <small>{t("settings.mergedCount", { count: syncMetadata.lastMergedCount })}</small>
            )}
            {typeof syncMetadata.scrapeSolvedCount === "number" && (
              <small>{t("settings.scrapeSolvedCount", { count: syncMetadata.scrapeSolvedCount })}</small>
            )}
            {syncMetadata.lastAttemptMethods.length > 0 && (
              <small>{t("settings.attemptChain", { chain: syncMetadata.lastAttemptMethods.join(" -> ") })}</small>
            )}
            <button
              type="button"
              disabled={syncMetadata.status === "syncing"}
              onClick={() => void runLeetCodeSync()}
            >
              {t("leetcode.syncNow")}
            </button>
          </div>
        </div>
        <label className="setting-row">
          <span>{t("settings.aiApiKeyOptional")}</span>
          <div className="sync-box">
            <input
              type="password"
              placeholder="sk-..."
              value={settings.aiApiKey}
              disabled={
                !settings.aiEnabled ||
                settings.aiProvider !== "byok" ||
                (Boolean(settings.aiByokRequirePassphrase) && !byokUnlocked)
              }
              onChange={(event) => {
                const value = event.target.value;
                updateSettings({ aiApiKey: value });
                if (byokUnlocked) {
                  setSessionUnlockedByokKey(value);
                }
              }}
            />
            <label>
              <input
                type="checkbox"
                checked={Boolean(settings.aiByokRequirePassphrase)}
                disabled={!settings.aiEnabled || settings.aiProvider !== "byok"}
                onChange={(event) =>
                  updateSettings({ aiByokRequirePassphrase: event.target.checked })
                }
              />{" "}
              {t("settings.byokRequirePassphrase")}
            </label>
            {settings.aiByokRequirePassphrase && (
              <>
                <div className="problem-form-grid">
                  <label>
                    <span>{t("settings.byokSetPassphrase")}</span>
                    <input
                      type="password"
                      value={vaultPassphrase}
                      onChange={(event) => setVaultPassphrase(event.target.value)}
                      placeholder={t("settings.byokPassphrasePlaceholder")}
                    />
                  </label>
                  <label>
                    <span>{t("settings.byokConfirmPassphrase")}</span>
                    <input
                      type="password"
                      value={vaultPassphraseConfirm}
                      onChange={(event) => setVaultPassphraseConfirm(event.target.value)}
                      placeholder={t("settings.byokPassphrasePlaceholder")}
                    />
                  </label>
                </div>
                <div className="actions-row">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void setByokPassphrase()}
                  >
                    {t("settings.byokSavePassphrase")}
                  </button>
                </div>
                {!byokUnlocked && (
                  <>
                    <label>
                      <span>{t("settings.byokUnlockForSession")}</span>
                      <input
                        type="password"
                        value={unlockPassphrase}
                        onChange={(event) => setUnlockPassphrase(event.target.value)}
                        placeholder={t("settings.byokPassphrasePlaceholder")}
                      />
                    </label>
                    <div className="actions-row">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => void unlockByokForSession()}
                      >
                        {t("settings.byokUnlockButton")}
                      </button>
                    </div>
                  </>
                )}
                {byokUnlocked && (
                  <div className="actions-row">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={lockByokForSession}
                    >
                      {t("settings.byokLockButton")}
                    </button>
                  </div>
                )}
                <small>
                  {byokUnlocked
                    ? t("settings.byokUnlockedState")
                    : t("settings.byokLockedState")}
                </small>
              </>
            )}
            {vaultStatusMessage && <small>{vaultStatusMessage}</small>}
          </div>
        </label>
        <div className="setting-row">
          <span>{t("settings.aiAuditTitle")}</span>
          <div className="sync-box">
            <div className="actions-row">
              <button
                type="button"
                className="button-secondary"
                onClick={() => void refreshAiAuditEntries()}
              >
                {t("settings.refreshAudit")}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={auditEncryptExport && !auditExportPassphrase.trim()}
                onClick={() => void exportAiAuditJson()}
              >
                {t("settings.exportAudit")}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  clearAiAuditEntries();
                  setAuditEntries([]);
                  setAuditChainValid(true);
                  setAuditBrokenIndex(null);
                }}
              >
                {t("settings.clearAudit")}
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={auditEncryptExport}
                onChange={(event) => setAuditEncryptExport(event.target.checked)}
              />{" "}
              {t("settings.auditEncryptExport")}
            </label>
            {auditEncryptExport && (
              <label>
                <span>{t("settings.auditExportPassphrase")}</span>
                <input
                  type="password"
                  value={auditExportPassphrase}
                  onChange={(event) => setAuditExportPassphrase(event.target.value)}
                  placeholder={t("settings.auditExportPassphrasePlaceholder")}
                />
              </label>
            )}
            {auditChainValid !== null && (
              <small>
                {auditChainValid
                  ? t("settings.auditChainValid")
                  : t("settings.auditChainBroken", {
                      index: auditBrokenIndex ?? -1,
                    })}
              </small>
            )}
            {auditEntries.length === 0 && <small>{t("settings.noAuditEntries")}</small>}
            {auditEntries.length > 0 && (
              <ul className="sync-history-list">
                {auditEntries.slice(0, 20).map((entry) => (
                  <li key={entry.id}>
                    <strong>
                      {entry.module} • {entry.action} • {entry.outcome}
                    </strong>
                    <small>{new Date(entry.at).toLocaleString()}</small>
                    <small>
                      {entry.provider} / {entry.model} • prompt {entry.sanitizedChars}/
                      {entry.promptChars}
                    </small>
                    {typeof entry.quotaRemaining === "number" && (
                      <small>
                        quota {entry.quotaRemaining}/{entry.quotaLimit}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageCard>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <PageCard
      title={t("pages.notFound.title")}
      subtitle={t("pages.notFound.subtitle")}
    />
  );
}

export default function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const hydrated = useAppStore((state) => state.hydrated);
  const hydrate = useAppStore((state) => state.hydrate);
  const settings = useAppStore((state) => state.settings);
  const events = useAppStore((state) => state.events);
  const notes = useAppStore((state) => state.notes);
  const upsertNote = useAppStore((state) => state.upsertNote);
  const books = useAppStore((state) => state.books);
  const groups = useAppStore((state) => state.groups);
  const problems = useAppStore((state) => state.problems);
  const knowledgePoints = useAppStore((state) => state.knowledgePoints);
  const runLeetCodeSync = useAppStore((state) => state.runLeetCodeSync);
  const syncMetadata = useAppStore((state) => state.leetCodeSyncMetadata);
  const themePreference = useAppStore((state) => state.settings.themePreference);
  const accentColor = useAppStore((state) => state.settings.accentColor);
  const notifiedReminderIdsRef = useRef<Set<string>>(new Set());
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [topbarSearchOpen, setTopbarSearchOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureTitle, setQuickCaptureTitle] = useState("");
  const [quickCaptureContent, setQuickCaptureContent] = useState("");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthConfigured) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    void getCurrentSession()
      .then((current) => {
        if (!active) return;
        setSession(current);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    const unsubscribe = subscribeAuthState((nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    document.body.dataset.theme = themePreference;
  }, [themePreference]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentColor || "#58a6ff");
  }, [accentColor]);

  useEffect(() => {
    const raw = localStorage.getItem("notebook-ai-chat-history-v1");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as AiChatMessage[];
      if (Array.isArray(parsed)) {
        setAiMessages(parsed.slice(-60));
      }
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("notebook-ai-chat-history-v1", JSON.stringify(aiMessages.slice(-60)));
  }, [aiMessages]);

  useEffect(() => {
    if (!hydrated) return;
    if (!settings.leetCodeUsername.trim()) return;

    let syncing = false;
    async function tryAutoSync() {
      if (syncing) return;
      if (syncMetadata.status === "syncing") return;
      const lastSyncMs = syncMetadata.lastSyncAt
        ? new Date(syncMetadata.lastSyncAt).getTime()
        : 0;
      if (Date.now() - lastSyncMs < 24 * 60 * 60 * 1000) return;
      syncing = true;
      try {
        await runLeetCodeSync();
      } finally {
        syncing = false;
      }
    }

    void tryAutoSync();
    const interval = window.setInterval(() => {
      void tryAutoSync();
    }, 30 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [
    hydrated,
    settings.leetCodeUsername,
    syncMetadata.lastSyncAt,
    syncMetadata.status,
    runLeetCodeSync,
  ]);

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
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setQuickCaptureOpen(true);
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
        setQuickCaptureOpen(false);
        setAiPanelOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  function saveQuickCapture() {
    const trimmedContent = quickCaptureContent.trim();
    if (!trimmedContent) return;
    upsertNote({
      title: quickCaptureTitle.trim() || t("quickCapture.defaultNoteTitle"),
      template: "custom",
      content: `<p>${trimmedContent.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`,
      tags: ["quick-capture"],
    });
    setQuickCaptureOpen(false);
    setQuickCaptureTitle("");
    setQuickCaptureContent("");
    navigate("/notes");
  }

  function currentModuleLabel(pathname: string):
    | "Dashboard"
    | "LeetCode"
    | "Reading"
    | "Calendar"
    | "Notes"
    | "Groups" {
    if (pathname.startsWith("/leetcode")) return "LeetCode";
    if (pathname.startsWith("/reading")) return "Reading";
    if (pathname.startsWith("/calendar")) return "Calendar";
    if (pathname.startsWith("/notes")) return "Notes";
    if (pathname.startsWith("/groups")) return "Groups";
    return "Dashboard";
  }

  function currentModuleDisplay(pathname: string): string {
    const module = currentModuleLabel(pathname);
    if (module === "LeetCode") return t("modules.leetcode");
    if (module === "Reading") return t("modules.reading");
    if (module === "Calendar") return t("modules.calendar");
    if (module === "Notes") return t("modules.notes");
    if (module === "Groups") return t("modules.groups");
    return t("modules.dashboard");
  }

  async function sendAiMessage(message: string) {
    const rawMessage = message;
    const trimmed = sanitizeAiPrompt(message, 6000);
    if (!trimmed) {
      recordAiAuditEntry({
        module: currentModuleLabel(location.pathname),
        action: "chat_message",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawMessage.length,
        sanitizedChars: 0,
        outcome: "blocked_validation",
      });
      return;
    }
    const userMessage: AiChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      at: new Date().toISOString(),
    };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput("");

    if (!settings.aiEnabled) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: t("ai.messages.chatDisabledGlobal"),
          at: new Date().toISOString(),
        },
      ]);
      return;
    }
    if (!settings.aiFeatureChat) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: t("ai.messages.chatPanelDisabled"),
          at: new Date().toISOString(),
        },
      ]);
      return;
    }
    if (!settings.aiPrivacyAcknowledged) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: t("ai.messages.acknowledgePrivacyChat"),
          at: new Date().toISOString(),
        },
      ]);
      return;
    }
    if (settings.aiProvider === "byok" && !settings.aiApiKey.trim()) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: t("ai.messages.byokMissingChat"),
          at: new Date().toISOString(),
        },
      ]);
      return;
    }
    const quota = consumeAiQuota(settings.aiProvider);
    if (!quota.ok) {
      recordAiAuditEntry({
        module: currentModuleLabel(location.pathname),
        action: "chat_message",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawMessage.length,
        sanitizedChars: trimmed.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "blocked_quota",
      });
      setAiMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: t("ai.messages.freeTierReached"),
          at: new Date().toISOString(),
        },
      ]);
      return;
    }
    recordAiAuditEntry({
      module: currentModuleLabel(location.pathname),
      action: "chat_message",
      provider: settings.aiProvider,
      model: settings.aiModel,
      promptChars: rawMessage.length,
      sanitizedChars: trimmed.length,
      quotaLimit: quota.limit,
      quotaUsed: quota.used,
      quotaRemaining: quota.remaining,
      outcome: "allowed",
    });

    setAiThinking(true);
    const assistantId = crypto.randomUUID();
    setAiMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        text: "",
        at: new Date().toISOString(),
      },
    ]);
    try {
      const moduleName = currentModuleLabel(location.pathname);
      for await (const chunk of streamAiResponseLazy({
        prompt: trimmed,
        moduleName,
        backend: settings.aiBackend,
        provider: settings.aiProvider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        context: {
          problemsCount: problems.length,
          knowledgePointsCount: knowledgePoints.length,
          eventsCount: events.length,
          notesCount: notes.length,
        },
      })) {
        setAiMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, text: msg.text + chunk } : msg
          )
        );
      }
      recordAiAuditEntry({
        module: moduleName,
        action: "chat_message",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawMessage.length,
        sanitizedChars: trimmed.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "success",
      });
    } catch {
      recordAiAuditEntry({
        module: currentModuleLabel(location.pathname),
        action: "chat_message",
        provider: settings.aiProvider,
        model: settings.aiModel,
        promptChars: rawMessage.length,
        sanitizedChars: trimmed.length,
        quotaLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        outcome: "error",
      });
      setAiMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                role: "system",
                text: t("ai.messages.providerError"),
              }
            : msg
        )
      );
    } finally {
      setAiThinking(false);
    }
  }

  const commandResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    const base = [
      { id: "go-home", label: t("command.goDashboard"), description: t("command.openDashboard"), route: "/" },
      { id: "go-leetcode", label: t("command.goLeetCode"), description: t("command.problemTracking"), route: "/leetcode" },
      { id: "go-reading", label: t("command.goReading"), description: t("command.booksKnowledge"), route: "/reading" },
      { id: "go-calendar", label: t("command.goCalendar"), description: t("command.scheduleReminders"), route: "/calendar" },
      { id: "go-notes", label: t("command.goNotes"), description: t("command.quickNotesTemplates"), route: "/notes" },
      { id: "go-groups", label: t("command.goGroups"), description: t("command.studyGroups"), route: "/groups" },
      { id: "go-settings", label: t("command.goSettings"), description: t("command.preferences"), route: "/settings" },
    ];
    const dynamic = [
      ...notes.map((note) => ({
        id: `note-${note.id}`,
        label: `${t("command.notePrefix")}: ${note.title}`,
        description: t("command.openNotesModule"),
        route: "/notes",
      })),
      ...books.map((book) => ({
        id: `book-${book.id}`,
        label: `${t("command.bookPrefix")}: ${book.title}`,
        description: t("command.openReadingModule"),
        route: "/reading",
      })),
      ...events.map((event) => ({
        id: `event-${event.id}`,
        label: `${t("command.eventPrefix")}: ${event.title}`,
        description: t("command.openCalendarModule"),
        route: "/calendar",
      })),
      ...groups.map((group) => ({
        id: `group-${group.id}`,
        label: `${t("command.groupPrefix")}: ${group.name}`,
        description: t("command.openGroupsModule"),
        route: "/groups",
      })),
      ...problems.map((problem) => ({
        id: `problem-${problem.id}`,
        label: `${t("command.problemPrefix")} #${problem.problemNumber}: ${problem.title}`,
        description: t("command.openLeetCodeModule"),
        route: "/leetcode",
      })),
      ...knowledgePoints.map((point) => ({
        id: `kp-${point.id}`,
        label: `${t("command.knowledgePrefix")}: ${point.title}`,
        description: t("command.openReadingModule"),
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

          const title = t("calendar.notificationUpcomingTitle", { title: event.title });
          const body = t("calendar.notificationUpcomingBody", {
            time: new Date(event.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            type: event.type,
          });
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
            new Notification(t("calendar.notificationDailyDigestTitle"), {
              body: t("calendar.notificationDailyDigestBody", {
                eventCount: todayEventCount,
                problemCount: reviewDueProblems,
                knowledgeCount: reviewDueKnowledge,
              }),
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
              new Notification(t("calendar.notificationStreakTitle"), {
                body: t("calendar.notificationStreakBody"),
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
              new Notification(t("calendar.notificationReviewDueTitle"), {
                body: t("calendar.notificationReviewDueBody", {
                  problemCount: reviewDueProblems,
                  knowledgeCount: reviewDueKnowledge,
                }),
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
    return <div className="loading-screen">{t("app.loadingWorkspace")}</div>;
  }

  if (isAuthConfigured && !session) {
    return <AuthPage loading={authLoading} onAuthenticated={setSession} />;
  }

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="brand">{t("appName")}</div>
        <nav aria-label="Primary Navigation">
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
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-item${isActive ? " nav-item-active" : ""}`
            }
          >
            <span aria-hidden>⚙️</span>
            <span>{t("common.settings")}</span>
          </NavLink>
        </nav>
      </aside>

      <main className="main-layout">
        <header className="topbar">
          <div className="global-search-wrap">
            <input
              type="search"
              aria-label={t("searchPlaceholder")}
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
                {commandResults.length === 0 && <small>{t("command.noResults")}</small>}
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
          <button
            type="button"
            onClick={() => {
              setAiPanelOpen((open) => !open);
              setCommandPaletteOpen(false);
              setTopbarSearchOpen(false);
            }}
          >
            {t("topbar.aiPanel")}
          </button>
          <button
            type="button"
            onClick={() => {
              setCommandPaletteOpen(true);
              setTopbarSearchOpen(false);
            }}
          >
            {t("topbar.commandPalette")}
          </button>
          <button type="button" onClick={() => setShortcutHelpOpen(true)}>
            {t("topbar.shortcuts")}
          </button>
          {isAuthConfigured && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => void signOutCurrentUser()}
            >
              {t("auth.signOut")}
            </button>
          )}
          {settings.aiEnabled && (
            <span className="ai-model-indicator">
              Powered by {settings.aiProvider === "byok" ? "BYOK" : "Free Default"} •{" "}
              {settings.aiModel}
            </span>
          )}
        </header>
        <Suspense fallback={<PageCard title={t("appName")} subtitle={t("app.loadingWorkspace")} />}>
          <Routes>
            <Route path="/" element={<LazyDashboardPage />} />
            <Route path="/leetcode" element={<LazyLeetCodePage />} />
            <Route path="/leetcode/topic/:topicName" element={<LazyTopicDeepDivePage />} />
            <Route path="/reading" element={<LazyReadingPage />} />
            <Route path="/calendar" element={<LazyCalendarPage />} />
            <Route path="/notes" element={<LazyNotesPage />} />
            <Route path="/groups" element={<LazyGroupsPage />} />
            <Route path="/settings" element={<LazySettingsPage />} />
            <Route path="*" element={<LazyNotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {navItems.map((item) => (
          <NavLink
            key={`mobile-${item.to}`}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `mobile-bottom-nav-item${isActive ? " mobile-bottom-nav-item-active" : ""}`
            }
          >
            <span aria-hidden>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `mobile-bottom-nav-item${isActive ? " mobile-bottom-nav-item-active" : ""}`
          }
        >
          <span aria-hidden>⚙️</span>
          <span>{t("common.settings")}</span>
        </NavLink>
      </nav>
      {commandPaletteOpen && (
        <div className="command-palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label={t("topbar.commandPalette")}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              type="search"
              placeholder={t("command.typeCommandSearch")}
              value={globalSearchQuery}
              onChange={(event) => setGlobalSearchQuery(event.target.value)}
            />
            <div className="command-list">
              {commandResults.length === 0 && <small>{t("command.noMatchingCommand")}</small>}
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
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label={t("shortcuts.title")}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{t("shortcuts.title")}</h2>
            <div className="shortcut-list">
              <div><kbd>⌘/Ctrl</kbd> + <kbd>K</kbd> <span>{t("shortcuts.openPalette")}</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>1</kbd> <span>{t("shortcuts.goDashboard")}</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>2</kbd> <span>{t("shortcuts.goLeetCode")}</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>3</kbd> <span>{t("shortcuts.goReading")}</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>4</kbd> <span>{t("shortcuts.goCalendar")}</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>5</kbd> <span>{t("shortcuts.goNotes")}</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>6</kbd> <span>{t("shortcuts.goGroups")}</span></div>
              <div><kbd>⌘/Ctrl</kbd> + <kbd>,</kbd> <span>{t("shortcuts.openSettings")}</span></div>
              <div><kbd>?</kbd> <span>{t("shortcuts.openHelp")}</span></div>
              <div><kbd>Esc</kbd> <span>{t("shortcuts.closeOverlays")}</span></div>
            </div>
            <div className="actions-row">
              <button type="button" onClick={() => setShortcutHelpOpen(false)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
      {quickCaptureOpen && (
        <div className="command-palette-overlay" onClick={() => setQuickCaptureOpen(false)}>
          <div
            className="quick-capture-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("quickCapture.title")}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{t("quickCapture.title")}</h3>
            <small>{t("quickCapture.subtitle")}</small>
            <label>
              <span>{t("quickCapture.titleOptional")}</span>
              <input
                value={quickCaptureTitle}
                onChange={(event) => setQuickCaptureTitle(event.target.value)}
                placeholder={t("quickCapture.titlePlaceholder")}
              />
            </label>
            <label>
              <span>{t("quickCapture.content")}</span>
              <textarea
                rows={7}
                value={quickCaptureContent}
                onChange={(event) => setQuickCaptureContent(event.target.value)}
                placeholder={t("quickCapture.contentPlaceholder")}
              />
            </label>
            <div className="actions-row">
              <button type="button" onClick={saveQuickCapture}>
                {t("quickCapture.save")}
              </button>
              <button type="button" className="button-secondary" onClick={() => setQuickCaptureOpen(false)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      {aiPanelOpen && (
        <aside className="ai-panel">
          <div className="ai-panel-header">
            <strong>{t("ai.panelTitle")}</strong>
            <button type="button" className="button-secondary" onClick={() => setAiPanelOpen(false)}>
              {t("common.close")}
            </button>
          </div>
          <small>
            Context: {currentModuleDisplay(location.pathname)} •{" "}
            {settings.aiProvider === "byok" ? "BYOK" : "Free Default"} • {settings.aiModel}
          </small>
          <div className="chip-list ai-quick-prompts">
            <button type="button" className="button-secondary" onClick={() => void sendAiMessage(t("ai.quickPromptNextAction"))}>
              {t("ai.quickNextAction")}
            </button>
            <button type="button" className="button-secondary" onClick={() => void sendAiMessage(t("ai.quickPromptDailyFocus"))}>
              {t("ai.quickDailyFocus")}
            </button>
            <button type="button" className="button-secondary" onClick={() => void sendAiMessage(t("ai.quickPromptChecklist"))}>
              {t("ai.quickChecklist")}
            </button>
          </div>
          <div className="ai-messages">
            {aiMessages.length === 0 && (
              <small>{t("ai.askAnythingPrompt")}</small>
            )}
            {aiMessages.map((message) => (
              <div key={message.id} className={`ai-msg ai-msg-${message.role}`}>
                <strong>{message.role}</strong>
                <p>{message.text}</p>
              </div>
            ))}
            {aiThinking && <small>Thinking...</small>}
          </div>
          <form
            className="ai-input-row"
            onSubmit={(event) => {
              event.preventDefault();
              void sendAiMessage(aiInput);
            }}
          >
            <input
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
              placeholder="Ask AI for hints, explainers, or planning help..."
            />
            <button type="submit" disabled={aiThinking}>
              Send
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}
