import {
  ciphertextHash,
  decryptPayload,
  encryptPayload,
  getActiveAgeKey,
  plaintextHash,
  signHash,
  verifySignature,
} from "./crypto";
import { canonicalJson, downloadJson, sha256Hex } from "./encoding";
import { merkleProof, merkleRoot } from "./merkle";
import {
  genesisHash,
  journalPayloadSchema,
  type ChainVerification,
  type DecryptedEntry,
  type EncryptedEntryRecord,
  type EntryDraft,
  type MerkleCheckpoint,
  type ProofBundle,
  type VaultSecret,
} from "./types";

export async function createEntryRecord(
  secret: VaultSecret,
  draft: EntryDraft,
  previous: EncryptedEntryRecord | undefined,
): Promise<DecryptedEntry> {
  const createdAt = new Date().toISOString();
  const payload = journalPayloadSchema.parse({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt,
    body: draft.body.trim(),
    mood: draft.mood,
    tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
    transcript: draft.transcript?.trim() || undefined,
    reflection: draft.reflection?.trim() || undefined,
  });
  const ciphertextArmor = await encryptPayload(secret, payload);
  const activeKey = getActiveAgeKey(secret);
  const unsigned = {
    schemaVersion: 1,
    id: payload.id,
    sequence: previous ? previous.sequence + 1 : 1,
    createdAt,
    updatedAt: createdAt,
    keyId: activeKey.id,
    recipient: activeKey.recipient,
    ciphertextHash: await ciphertextHash(ciphertextArmor),
    plaintextHash: await plaintextHash(payload),
    previousEntryHash: previous?.entryHash ?? genesisHash,
    signerPublicKey: secret.signingPublicKey,
  } satisfies Omit<
    EncryptedEntryRecord,
    "ciphertextArmor" | "entryHash" | "signature"
  >;
  const entryHash = await hashEntry(unsigned);
  const signature = await signHash(secret, entryHash);
  return {
    payload,
    record: {
      ...unsigned,
      ciphertextArmor,
      entryHash,
      signature,
    },
  };
}

export async function decryptEntries(
  secret: VaultSecret,
  records: EncryptedEntryRecord[],
): Promise<DecryptedEntry[]> {
  const decrypted: DecryptedEntry[] = [];
  for (const record of records) {
    decrypted.push({
      record,
      payload: await decryptPayload(secret, record),
    });
  }
  return decrypted;
}

export async function verifyChain(
  secret: VaultSecret,
  records: EncryptedEntryRecord[],
): Promise<ChainVerification> {
  const errors: string[] = [];
  let previousHash = genesisHash;
  for (const record of records) {
    const recomputedCiphertextHash = await ciphertextHash(
      record.ciphertextArmor,
    );
    if (recomputedCiphertextHash !== record.ciphertextHash) {
      errors.push(`Entry ${record.sequence} ciphertext hash mismatch.`);
    }
    if (record.previousEntryHash !== previousHash) {
      errors.push(`Entry ${record.sequence} previous hash mismatch.`);
    }
    const expectedEntryHash = await hashEntry(stripEntry(record));
    if (expectedEntryHash !== record.entryHash) {
      errors.push(`Entry ${record.sequence} entry hash mismatch.`);
    }
    const signatureOk = await verifySignature(
      record.signature,
      record.entryHash,
      record.signerPublicKey,
    );
    if (!signatureOk)
      errors.push(`Entry ${record.sequence} Ed25519 signature is invalid.`);
    try {
      const payload = await decryptPayload(secret, record);
      const expectedPlaintextHash = await plaintextHash(payload);
      if (expectedPlaintextHash !== record.plaintextHash) {
        errors.push(`Entry ${record.sequence} plaintext hash mismatch.`);
      }
    } catch {
      errors.push(
        `Entry ${record.sequence} could not be decrypted with the current vault.`,
      );
    }
    previousHash = record.entryHash;
  }

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    checkedEntries: records.length,
    errors,
  };
}

export async function createCheckpoint(
  secret: VaultSecret,
  records: EncryptedEntryRecord[],
  previous: MerkleCheckpoint | undefined,
): Promise<MerkleCheckpoint> {
  const createdAt = new Date().toISOString();
  const entryHashes = records.map((record) => record.entryHash);
  const root = await merkleRoot(entryHashes);
  const unsigned = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt,
    entryCount: entryHashes.length,
    entryHashes,
    merkleRoot: root,
    previousCheckpointHash: previous?.checkpointHash ?? genesisHash,
    signerPublicKey: secret.signingPublicKey,
  } satisfies Omit<MerkleCheckpoint, "checkpointHash" | "signature">;
  const checkpointHash = await sha256Hex(canonicalJson(unsigned));
  return {
    ...unsigned,
    checkpointHash,
    signature: await signHash(secret, checkpointHash),
  };
}

export async function exportProofBundle(
  entry: DecryptedEntry,
  records: EncryptedEntryRecord[],
  checkpoint: MerkleCheckpoint,
): Promise<ProofBundle> {
  const scopedRecords = records.slice(0, checkpoint.entryCount);
  const index = scopedRecords.findIndex(
    (record) => record.id === entry.record.id,
  );
  if (index === -1)
    throw new Error("Entry is not covered by the selected checkpoint.");
  return {
    proofVersion: 1,
    generatedAt: new Date().toISOString(),
    app: {
      version: __APP_VERSION__,
      commit: __COMMIT_SHA__,
      repository: __REPO_URL__,
    },
    entry,
    checkpoint,
    merkleProof: await merkleProof(
      scopedRecords.map((record) => record.entryHash),
      index,
    ),
  };
}

export function downloadProofBundle(bundle: ProofBundle) {
  downloadJson(`ledger-proof-${bundle.entry.record.sequence}.json`, bundle);
}

async function hashEntry(
  unsigned: Omit<
    EncryptedEntryRecord,
    "ciphertextArmor" | "entryHash" | "signature"
  >,
) {
  return sha256Hex(canonicalJson(unsigned));
}

function stripEntry(
  record: EncryptedEntryRecord,
): Omit<EncryptedEntryRecord, "ciphertextArmor" | "entryHash" | "signature"> {
  return {
    schemaVersion: record.schemaVersion,
    id: record.id,
    sequence: record.sequence,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    keyId: record.keyId,
    recipient: record.recipient,
    ciphertextHash: record.ciphertextHash,
    plaintextHash: record.plaintextHash,
    previousEntryHash: record.previousEntryHash,
    signerPublicKey: record.signerPublicKey,
  };
}

export function latestCoveringCheckpoint(
  entry: DecryptedEntry,
  checkpoints: MerkleCheckpoint[],
): MerkleCheckpoint | undefined {
  return [...checkpoints]
    .reverse()
    .find((checkpoint) =>
      checkpoint.entryHashes.includes(entry.record.entryHash),
    );
}

export function emptyDraft(): EntryDraft {
  return {
    body: "",
    mood: "steady",
    tags: [],
  };
}
