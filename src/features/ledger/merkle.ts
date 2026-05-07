import { sha256Hex } from "./encoding";
import type { MerkleProofStep } from "./types";

export async function merkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return "0".repeat(64);
  let level = [...leaves];
  while (level.length > 1) {
    level = await nextLevel(level);
  }
  return level[0];
}

export async function merkleProof(
  leaves: string[],
  targetIndex: number,
): Promise<MerkleProofStep[]> {
  if (targetIndex < 0 || targetIndex >= leaves.length)
    throw new Error("Target index is outside the Merkle tree.");
  const proof: MerkleProofStep[] = [];
  let index = targetIndex;
  let level = [...leaves];

  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    const siblingHash = level[siblingIndex] ?? level[index];
    proof.push({
      siblingHash,
      position: index % 2 === 0 ? "right" : "left",
    });
    index = Math.floor(index / 2);
    level = await nextLevel(level);
  }

  return proof;
}

export async function verifyMerkleProof(
  leaf: string,
  root: string,
  proof: MerkleProofStep[],
): Promise<boolean> {
  let cursor = leaf;
  for (const step of proof) {
    cursor =
      step.position === "right"
        ? await combineHashes(cursor, step.siblingHash)
        : await combineHashes(step.siblingHash, cursor);
  }
  return cursor === root;
}

async function nextLevel(level: string[]): Promise<string[]> {
  const next: string[] = [];
  for (let index = 0; index < level.length; index += 2) {
    const left = level[index];
    const right = level[index + 1] ?? left;
    next.push(await combineHashes(left, right));
  }
  return next;
}

async function combineHashes(left: string, right: string): Promise<string> {
  return sha256Hex(`ledger-merkle-v1:${left}:${right}`);
}
