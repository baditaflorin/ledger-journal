import { ciphertextHash, plaintextHash, verifySignature } from "./crypto";
import { canonicalJson, sha256Hex } from "./encoding";
import { verifyMerkleProof } from "./merkle";
import type {
  EncryptedEntryRecord,
  MerkleCheckpoint,
  ProofBundle,
} from "./types";

export interface ProofVerification {
  status: "valid" | "invalid";
  checks: ProofCheck[];
  errors: string[];
}

export interface ProofCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

/**
 * Verify that a downloaded proof bundle still anchors the included entry to
 * the included checkpoint. Designed so a third-party with only the bundle
 * (no vault key, no app state) can confirm the journal entry is genuine.
 *
 * Performs, in order:
 *  1. Recompute the entry hash from the unsigned record fields and verify it
 *     matches the embedded entryHash.
 *  2. Verify the ciphertext hash actually matches the ciphertext armor —
 *     proves the encrypted body the writer claims to anchor is the one in
 *     the bundle.
 *  3. Verify the plaintext hash matches the included payload — proves the
 *     decrypted payload the bundle says is in the entry is what the writer
 *     anchored.
 *  4. Verify the writer's Ed25519 signature on the entry hash.
 *  5. Recompute the Merkle root from the entry hash and the inclusion proof
 *     and verify it equals checkpoint.merkleRoot.
 *  6. Recompute the checkpoint hash and verify the writer's Ed25519
 *     signature on it.
 *  7. Verify the entry's signer and the checkpoint's signer agree (the same
 *     identity signed both — a checkpoint that anchors someone else's entry
 *     should not pass).
 */
export async function verifyProofBundle(
  bundle: ProofBundle,
): Promise<ProofVerification> {
  const checks: ProofCheck[] = [];
  const errors: string[] = [];

  const recomputedEntryHash = await hashEntry(stripEntry(bundle.entry.record));
  pushCheck(
    checks,
    errors,
    "entry-hash",
    recomputedEntryHash === bundle.entry.record.entryHash,
    `Expected ${bundle.entry.record.entryHash}, got ${recomputedEntryHash}.`,
  );

  const recomputedCiphertextHash = await ciphertextHash(
    bundle.entry.record.ciphertextArmor,
  );
  pushCheck(
    checks,
    errors,
    "ciphertext-hash",
    recomputedCiphertextHash === bundle.entry.record.ciphertextHash,
    "Ciphertext hash in the bundle does not match the included ciphertext.",
  );

  const recomputedPlaintextHash = await plaintextHash(bundle.entry.payload);
  pushCheck(
    checks,
    errors,
    "plaintext-hash",
    recomputedPlaintextHash === bundle.entry.record.plaintextHash,
    "Plaintext hash in the bundle does not match the included payload.",
  );

  const entrySignatureOk = await verifySignature(
    bundle.entry.record.signature,
    bundle.entry.record.entryHash,
    bundle.entry.record.signerPublicKey,
  );
  pushCheck(
    checks,
    errors,
    "entry-signature",
    entrySignatureOk,
    "The Ed25519 signature on the entry hash is not valid for the signer public key.",
  );

  const merkleOk = await verifyMerkleProof(
    bundle.entry.record.entryHash,
    bundle.checkpoint.merkleRoot,
    bundle.merkleProof,
  );
  pushCheck(
    checks,
    errors,
    "merkle-inclusion",
    merkleOk,
    "The Merkle inclusion proof does not anchor the entry hash to the checkpoint root.",
  );

  const checkpointStripped = stripCheckpoint(bundle.checkpoint);
  const recomputedCheckpointHash = await sha256Hex(
    canonicalJson(checkpointStripped),
  );
  pushCheck(
    checks,
    errors,
    "checkpoint-hash",
    recomputedCheckpointHash === bundle.checkpoint.checkpointHash,
    "Checkpoint hash in the bundle does not match the canonical checkpoint fields.",
  );

  const checkpointSignatureOk = await verifySignature(
    bundle.checkpoint.signature,
    bundle.checkpoint.checkpointHash,
    bundle.checkpoint.signerPublicKey,
  );
  pushCheck(
    checks,
    errors,
    "checkpoint-signature",
    checkpointSignatureOk,
    "The Ed25519 signature on the checkpoint hash is not valid for the checkpoint signer.",
  );

  pushCheck(
    checks,
    errors,
    "signer-consistency",
    bundle.entry.record.signerPublicKey === bundle.checkpoint.signerPublicKey,
    "The entry and the checkpoint were signed by different keys; the bundle does not prove that the entry writer also anchored the checkpoint.",
  );

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    checks,
    errors,
  };
}

function pushCheck(
  checks: ProofCheck[],
  errors: string[],
  name: string,
  passed: boolean,
  detail?: string,
) {
  checks.push(passed ? { name, passed } : { name, passed, detail });
  if (!passed && detail) errors.push(`${name}: ${detail}`);
}

async function hashEntry(
  unsigned: Omit<
    EncryptedEntryRecord,
    "ciphertextArmor" | "entryHash" | "signature"
  >,
): Promise<string> {
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

function stripCheckpoint(
  checkpoint: MerkleCheckpoint,
): Omit<MerkleCheckpoint, "checkpointHash" | "signature"> {
  return {
    schemaVersion: checkpoint.schemaVersion,
    id: checkpoint.id,
    createdAt: checkpoint.createdAt,
    entryCount: checkpoint.entryCount,
    entryHashes: checkpoint.entryHashes,
    merkleRoot: checkpoint.merkleRoot,
    previousCheckpointHash: checkpoint.previousCheckpointHash,
    signerPublicKey: checkpoint.signerPublicKey,
  };
}
