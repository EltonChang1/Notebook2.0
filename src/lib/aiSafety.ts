import type { AiProvider } from "./ai";

const QUOTA_STORAGE_KEY = "notebook-ai-free-quota-v2";
const FREE_TIER_DAILY_LIMIT = 50;

type QuotaState = {
  date: string;
  count: number;
};

export function sanitizeAiPrompt(prompt: string, maxChars = 12000): string {
  return prompt
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxChars);
}

export function consumeAiQuota(provider: AiProvider): {
  ok: boolean;
  limit: number;
  used: number;
  remaining: number;
} {
  if (provider === "byok" || typeof window === "undefined") {
    return {
      ok: true,
      limit: FREE_TIER_DAILY_LIMIT,
      used: 0,
      remaining: FREE_TIER_DAILY_LIMIT,
    };
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
  let current: QuotaState | null = null;
  if (raw) {
    try {
      current = JSON.parse(raw) as QuotaState;
    } catch {
      current = null;
    }
  }
  const next =
    !current || current.date !== dateKey
      ? { date: dateKey, count: 1 }
      : { date: dateKey, count: current.count + 1 };
  if (next.count > FREE_TIER_DAILY_LIMIT) {
    const used = current?.date === dateKey ? current.count : FREE_TIER_DAILY_LIMIT;
    return {
      ok: false,
      limit: FREE_TIER_DAILY_LIMIT,
      used,
      remaining: Math.max(0, FREE_TIER_DAILY_LIMIT - used),
    };
  }
  localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(next));
  return {
    ok: true,
    limit: FREE_TIER_DAILY_LIMIT,
    used: next.count,
    remaining: Math.max(0, FREE_TIER_DAILY_LIMIT - next.count),
  };
}
