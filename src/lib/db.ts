import Dexie, { type Table } from "dexie";
import type { AppDataSnapshot } from "../models/domain";

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
  return row?.value ?? null;
}

export async function saveSnapshot(value: AppDataSnapshot): Promise<void> {
  await db.appState.put({
    key: STATE_KEY,
    value,
    updatedAt: new Date().toISOString(),
  });
}
