import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  EncryptedEntryRecord,
  MerkleCheckpoint,
  VaultEnvelope,
} from "./types";

interface LedgerDb extends DBSchema {
  meta: {
    key: string;
    value: VaultEnvelope;
  };
  entries: {
    key: string;
    value: EncryptedEntryRecord;
    indexes: {
      sequence: number;
      createdAt: string;
    };
  };
  checkpoints: {
    key: string;
    value: MerkleCheckpoint;
    indexes: {
      createdAt: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<LedgerDb>> | undefined;

export function openLedgerDb() {
  dbPromise ??= openDB<LedgerDb>("ledger-journal-v1", 1, {
    upgrade(db) {
      db.createObjectStore("meta");
      const entries = db.createObjectStore("entries", { keyPath: "id" });
      entries.createIndex("sequence", "sequence");
      entries.createIndex("createdAt", "createdAt");
      const checkpoints = db.createObjectStore("checkpoints", {
        keyPath: "id",
      });
      checkpoints.createIndex("createdAt", "createdAt");
    },
  });
  return dbPromise;
}

export async function getVaultEnvelope(): Promise<VaultEnvelope | undefined> {
  return (await openLedgerDb()).get("meta", "vault");
}

export async function saveVaultEnvelope(
  envelope: VaultEnvelope,
): Promise<void> {
  await (await openLedgerDb()).put("meta", envelope, "vault");
}

export async function putEntry(record: EncryptedEntryRecord): Promise<void> {
  await (await openLedgerDb()).put("entries", record);
}

export async function listEntries(): Promise<EncryptedEntryRecord[]> {
  const entries = await (await openLedgerDb()).getAll("entries");
  return entries.sort((left, right) => left.sequence - right.sequence);
}

export async function putCheckpoint(
  checkpoint: MerkleCheckpoint,
): Promise<void> {
  await (await openLedgerDb()).put("checkpoints", checkpoint);
}

export async function listCheckpoints(): Promise<MerkleCheckpoint[]> {
  const checkpoints = await (await openLedgerDb()).getAll("checkpoints");
  return checkpoints.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}
