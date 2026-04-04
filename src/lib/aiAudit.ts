import type { AiModel, AiModuleName, AiProvider } from "./ai";

const AI_AUDIT_STORAGE_KEY = "notebook-ai-audit-v1";
const AI_AUDIT_SIGNING_SECRET_KEY = "notebook-ai-audit-signing-secret-v1";

export type AiAuditOutcome =
  | "allowed"
  | "blocked_quota"
  | "blocked_validation"
  | "success"
  | "error";

export type AiAuditEntry = {
  id: string;
  at: string;
  module: AiModuleName;
  action: string;
  provider: AiProvider;
  model: AiModel;
  promptChars: number;
  sanitizedChars: number;
  quotaLimit?: number;
  quotaUsed?: number;
  quotaRemaining?: number;
  outcome: AiAuditOutcome;
  details?: string;
  prevHash: string;
  entryHash: string;
};

type RecordInput = Omit<AiAuditEntry, "id" | "at" | "prevHash" | "entryHash">;

type ExportOptions = {
  encryptPassphrase?: string;
};

function stableStringify(value: Record<string, unknown>): string {
  const orderedKeys = Object.keys(value).sort();
  const ordered: Record<string, unknown> = {};
  for (const key of orderedKeys) ordered[key] = value[key];
  return JSON.stringify(ordered);
}

function fallbackHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return `fnv:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof window === "undefined" || !("crypto" in window) || !crypto.subtle) {
    return fallbackHash(text);
  }
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getOrCreateSigningSecret(): Uint8Array {
  const existing = localStorage.getItem(AI_AUDIT_SIGNING_SECRET_KEY);
  if (existing) {
    try {
      const binary = atob(existing);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      if (bytes.byteLength >= 32) return bytes;
    } catch {
      // regenerate
    }
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(AI_AUDIT_SIGNING_SECRET_KEY, bytesToBase64(bytes));
  return bytes;
}

async function signChecksum(checksum: string): Promise<string> {
  if (typeof window === "undefined" || !("crypto" in window) || !crypto.subtle) {
    return fallbackHash(`sign:${checksum}`);
  }
  const secret = getOrCreateSigningSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(checksum)
  );
  return `hmac-sha256:${bytesToBase64(new Uint8Array(signature))}`;
}

async function encryptExportPayload(
  payload: string,
  passphrase: string
): Promise<{
  algorithm: string;
  iterations: number;
  saltB64: string;
  ivB64: string;
  cipherB64: string;
}> {
  const trimmed = passphrase.trim();
  const normalized = payload;
  if (!trimmed || typeof window === "undefined" || !("crypto" in window) || !crypto.subtle) {
    return {
      algorithm: "none",
      iterations: 0,
      saltB64: "",
      ivB64: "",
      cipherB64: btoa(normalized),
    };
  }
  const iterations = 120000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(trimmed),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    new TextEncoder().encode(normalized)
  );
  return {
    algorithm: "aes-256-gcm+pbkdf2-sha256",
    iterations,
    saltB64: bytesToBase64(salt),
    ivB64: bytesToBase64(iv),
    cipherB64: bytesToBase64(new Uint8Array(cipher)),
  };
}

function maskPotentialPii(value?: string): string | undefined {
  if (!value) return value;
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\bsk-[A-Za-z0-9._-]{12,}\b/g, "[redacted-api-key]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-number]")
    .replace(/\b[A-Za-z0-9+/_-]{24,}={0,2}\b/g, "[redacted-token]");
}

export async function recordAiAuditEntry(entry: RecordInput): Promise<void> {
  if (typeof window === "undefined") return;
  const details = maskPotentialPii(entry.details);
  const next: AiAuditEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    prevHash: "GENESIS",
    entryHash: "",
    ...entry,
    details,
  };
  const raw = localStorage.getItem(AI_AUDIT_STORAGE_KEY);
  let current: AiAuditEntry[] = [];
  if (raw) {
    try {
      current = JSON.parse(raw) as AiAuditEntry[];
    } catch {
      current = [];
    }
  }
  const prevHash = current[0]?.entryHash ?? "GENESIS";
  const payload = stableStringify({
    at: next.at,
    module: next.module,
    action: next.action,
    provider: next.provider,
    model: next.model,
    promptChars: next.promptChars,
    sanitizedChars: next.sanitizedChars,
    quotaLimit: next.quotaLimit ?? null,
    quotaUsed: next.quotaUsed ?? null,
    quotaRemaining: next.quotaRemaining ?? null,
    outcome: next.outcome,
    details: next.details ?? "",
    prevHash,
  });
  const entryHash = await sha256Hex(payload);
  next.prevHash = prevHash;
  next.entryHash = entryHash;
  const merged = [next, ...current].slice(0, 300);
  localStorage.setItem(AI_AUDIT_STORAGE_KEY, JSON.stringify(merged));
}

export function getAiAuditEntries(limit = 60): AiAuditEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(AI_AUDIT_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AiAuditEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

export function clearAiAuditEntries(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AI_AUDIT_STORAGE_KEY);
}

export async function verifyAiAuditChain(
  entries: AiAuditEntry[] = getAiAuditEntries(300)
): Promise<{ valid: boolean; brokenIndex?: number }> {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (i < entries.length - 1) {
      if (entry.prevHash !== entries[i + 1].entryHash) {
        return { valid: false, brokenIndex: i };
      }
    } else if (entry.prevHash !== "GENESIS") {
      return { valid: false, brokenIndex: i };
    }
    const payload = stableStringify({
      at: entry.at,
      module: entry.module,
      action: entry.action,
      provider: entry.provider,
      model: entry.model,
      promptChars: entry.promptChars,
      sanitizedChars: entry.sanitizedChars,
      quotaLimit: entry.quotaLimit ?? null,
      quotaUsed: entry.quotaUsed ?? null,
      quotaRemaining: entry.quotaRemaining ?? null,
      outcome: entry.outcome,
      details: entry.details ?? "",
      prevHash: entry.prevHash,
    });
    const recomputed = await sha256Hex(payload);
    if (recomputed !== entry.entryHash) {
      return { valid: false, brokenIndex: i };
    }
  }
  return { valid: true };
}

export async function exportAiAuditReport(options: ExportOptions = {}): Promise<{
  filename: string;
  content: string;
}> {
  const entries = getAiAuditEntries(300);
  const verification = await verifyAiAuditChain(entries);
  const reportCore = {
    exportedAt: new Date().toISOString(),
    chainVerification: verification,
    entries,
  };
  const payloadJson = JSON.stringify(reportCore);
  const checksum = await sha256Hex(payloadJson);
  const signature = await signChecksum(checksum);
  const passphrase = options.encryptPassphrase?.trim() ?? "";
  const isEncrypted = Boolean(passphrase);
  const encryptedPayload = isEncrypted
    ? await encryptExportPayload(payloadJson, passphrase)
    : null;
  return {
    filename: `ai-audit-${new Date().toISOString().slice(0, 10)}${isEncrypted ? ".encrypted" : ""}.json`,
    content: JSON.stringify(
      isEncrypted
        ? {
            exportedAt: reportCore.exportedAt,
            checksum,
            signature,
            signatureType: "hmac-sha256-device-local",
            encrypted: true,
            payload: encryptedPayload,
          }
        : {
            ...reportCore,
            checksum,
            signature,
            signatureType: "hmac-sha256-device-local",
            encrypted: false,
          },
      null,
      2
    ),
  };
}
