import Dexie, { type Table } from "dexie";
import type { AppDataSnapshot } from "../models/domain";
import {
  decryptAtRestSecret,
  encryptAtRestSecret,
  getSessionUnlockedByokKey,
} from "./cryptoVault";

type PersistedEntry = {
  key: string;
  value: AppDataSnapshot;
  updatedAt: string;
};

class NotebookDb extends Dexie {
  appState!: Table<PersistedEntry, string>;

  constructor() {
    super("notebook2_db");
    this.version(1).stores({
      appState: "key, updatedAt",
    });
  }
}

export const db = new NotebookDb();
const STATE_KEY = "root";

export async function loadSnapshot(): Promise<AppDataSnapshot | null> {
  const row = await db.appState.get(STATE_KEY);
  const snapshot = row?.value ?? null;
  if (!snapshot?.settings) return snapshot;
  const plainFromLegacy = snapshot.settings.aiApiKey?.trim() ?? "";
  const encrypted = snapshot.settings.aiApiKeyEncrypted?.trim() ?? "";
  const requiresPassphrase = Boolean(snapshot.settings.aiByokRequirePassphrase);
  const sessionKey = getSessionUnlockedByokKey();
  const decrypted = requiresPassphrase
    ? sessionKey || ""
    : encrypted
      ? await decryptAtRestSecret(encrypted)
      : plainFromLegacy;
  const needsMigration = Boolean(plainFromLegacy && !encrypted);
  let encryptedValue = encrypted;
  if (needsMigration && plainFromLegacy) {
    encryptedValue = await encryptAtRestSecret(plainFromLegacy);
  }
  const hydrated: AppDataSnapshot = {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      aiApiKey: decrypted,
      aiApiKeyEncrypted: encryptedValue || undefined,
    },
  };
  if (needsMigration) {
    void db.appState.put({
      key: STATE_KEY,
      value: {
        ...snapshot,
        settings: {
          ...snapshot.settings,
          aiApiKey: "",
          aiApiKeyEncrypted: encryptedValue || undefined,
        },
      },
      updatedAt: new Date().toISOString(),
    });
  }
  return hydrated;
}

export async function saveSnapshot(value: AppDataSnapshot): Promise<void> {
  const plainApiKey = value.settings.aiApiKey?.trim() ?? "";
  const encryptedApiKey =
    value.settings.aiApiKeyEncrypted?.trim() ||
    (plainApiKey ? await encryptAtRestSecret(plainApiKey) : "");
  await db.appState.put({
    key: STATE_KEY,
    value: {
      ...value,
      settings: {
        ...value.settings,
        aiApiKey: "",
        aiApiKeyEncrypted: encryptedApiKey || undefined,
      },
    },
    updatedAt: new Date().toISOString(),
  });
}
