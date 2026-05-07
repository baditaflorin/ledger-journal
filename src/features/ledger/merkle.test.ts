import { describe, expect, it } from "vitest";
import { merkleProof, merkleRoot, verifyMerkleProof } from "./merkle";

describe("Merkle tree", () => {
  it("builds and verifies an inclusion proof", async () => {
    const leaves = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
    const root = await merkleRoot(leaves);
    const proof = await merkleProof(leaves, 1);

    await expect(verifyMerkleProof(leaves[1], root, proof)).resolves.toBe(true);
    await expect(verifyMerkleProof("d".repeat(64), root, proof)).resolves.toBe(
      false,
    );
  });
});
