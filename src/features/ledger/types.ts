import { z } from "zod";

export const genesisHash = "0".repeat(64);

export const journalPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  createdAt: z.string(),
  body: z.string().min(1),
  mood: z.string(),
  tags: z.array(z.string()),
  transcript: z.string().optional(),
  reflection: z.string().optional(),
});

export type JournalPayload = z.infer<typeof journalPayloadSchema>;

export interface EntryDraft {
  body: string;
  mood: string;
  tags: string[];
  transcript?: string;
  reflection?: string;
}

export interface AgeKey {
  id: string;
  createdAt: string;
  identity: string;
  recipient: string;
}

export interface VaultSecret {
  schemaVersion: 1;
  createdAt: string;
  activeAgeKeyId: string;
  ageKeys: AgeKey[];
  signingSecretKey: string;
  signingPublicKey: string;
}

export interface VaultEnvelope {
  schemaVersion: 1;
  encryptedVaultArmor: string;
  createdAt: string;
  updatedAt: string;
  activeRecipient: string;
  signingPublicKey: string;
}

export interface EncryptedEntryRecord {
  schemaVersion: 1;
  id: string;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  keyId: string;
  recipient: string;
  ciphertextArmor: string;
  ciphertextHash: string;
  plaintextHash: string;
  previousEntryHash: string;
  entryHash: string;
  signature: string;
  signerPublicKey: string;
}

export interface DecryptedEntry {
  record: EncryptedEntryRecord;
  payload: JournalPayload;
}

export interface MerkleProofStep {
  siblingHash: string;
  position: "left" | "right";
}

export interface MerkleCheckpoint {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  entryCount: number;
  entryHashes: string[];
  merkleRoot: string;
  previousCheckpointHash: string;
  checkpointHash: string;
  signature: string;
  signerPublicKey: string;
}

export interface ProofBundle {
  proofVersion: 1;
  generatedAt: string;
  app: {
    version: string;
    commit: string;
    repository: string;
  };
  entry: {
    record: EncryptedEntryRecord;
    payload: JournalPayload;
  };
  checkpoint: MerkleCheckpoint;
  merkleProof: MerkleProofStep[];
}

export interface ChainVerification {
  status: "valid" | "invalid";
  checkedEntries: number;
  errors: string[];
}
