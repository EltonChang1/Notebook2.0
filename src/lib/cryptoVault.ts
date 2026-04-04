const VAULT_SECRET_STORAGE_KEY = "notebook-ai-vault-secret-v1";
const BYOK_SESSION_KEY = "notebook-byok-session-key-v1";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getOrCreateVaultSecret(): Uint8Array {
  const existing = localStorage.getItem(VAULT_SECRET_STORAGE_KEY);
  if (existing) {
    try {
      const parsed = base64ToBytes(existing);
      if (parsed.byteLength >= 32) return parsed;
    } catch {
      // Fall through to regenerate.
    }
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(VAULT_SECRET_STORAGE_KEY, bytesToBase64(bytes));
  return bytes;
}

export async function encryptAtRestSecret(plainText: string): Promise<string> {
  const input = plainText.trim();
  if (!input) return "";
  if (!("crypto" in window) || !crypto.subtle) {
    return `b64:${btoa(input)}`;
  }
  const secretBytes = getOrCreateVaultSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(secretBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(input))
  );
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptAtRestSecret(payload: string): Promise<string> {
  const raw = payload.trim();
  if (!raw) return "";
  if (raw.startsWith("b64:")) {
    try {
      return atob(raw.slice(4));
    } catch {
      return "";
    }
  }
  if (!raw.startsWith("v1:")) {
    return raw;
  }
  if (!("crypto" in window) || !crypto.subtle) return "";
  const [, ivB64, cipherB64] = raw.split(":");
  if (!ivB64 || !cipherB64) return "";
  try {
    const iv = base64ToBytes(ivB64);
    const cipher = base64ToBytes(cipherB64);
    const secretBytes = getOrCreateVaultSecret();
    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(secretBytes),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(cipher)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

export function getSessionUnlockedByokKey(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(BYOK_SESSION_KEY) ?? "";
}

export function setSessionUnlockedByokKey(value: string): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (!trimmed) {
    sessionStorage.removeItem(BYOK_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(BYOK_SESSION_KEY, trimmed);
}

export function clearSessionUnlockedByokKey(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BYOK_SESSION_KEY);
}

export async function createPassphraseHash(passphrase: string): Promise<string> {
  const trimmed = passphrase.trim();
  if (!trimmed) return "";
  if (!("crypto" in window) || !crypto.subtle) {
    return `b64:${btoa(trimmed)}`;
  }
  const data = new TextEncoder().encode(trimmed);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `sha256:${bytesToBase64(new Uint8Array(digest))}`;
}

export async function verifyPassphrase(
  passphrase: string,
  storedHash?: string
): Promise<boolean> {
  if (!storedHash) return false;
  const next = await createPassphraseHash(passphrase);
  return next === storedHash;
}
