import { describe, expect, it } from "vitest";
import { createVault } from "./crypto";
import { createCheckpoint, createEntryRecord, verifyChain } from "./ledger";
import { merkleProof, verifyMerkleProof } from "./merkle";

describe("ledger chain", () => {
  it("seals entries, verifies the hash chain, and anchors a checkpoint", async () => {
    const { secret } = await createVault("correct horse battery staple 123");
    const first = await createEntryRecord(
      secret,
      { body: "First thought", mood: "clear", tags: ["test"] },
      undefined,
    );
    const second = await createEntryRecord(
      secret,
      { body: "Second thought", mood: "steady", tags: ["test", "chain"] },
      first.record,
    );
    const records = [first.record, second.record];
    const verification = await verifyChain(secret, records);

    expect(verification.status).toBe("valid");
    expect(second.record.previousEntryHash).toBe(first.record.entryHash);

    const checkpoint = await createCheckpoint(secret, records, undefined);
    const proof = await merkleProof(checkpoint.entryHashes, 1);
    await expect(
      verifyMerkleProof(second.record.entryHash, checkpoint.merkleRoot, proof),
    ).resolves.toBe(true);
  });

  it("detects ciphertext tampering", async () => {
    const { secret } = await createVault("correct horse battery staple 123");
    const entry = await createEntryRecord(
      secret,
      { body: "Tamper me", mood: "heavy", tags: [] },
      undefined,
    );
    const tampered = {
      ...entry.record,
      ciphertextArmor: `${entry.record.ciphertextArmor.slice(0, -8)}AAAAAAAA`,
    };

    const verification = await verifyChain(secret, [tampered]);
    expect(verification.status).toBe("invalid");
    expect(
      verification.errors.some((item) =>
        item.includes("ciphertext hash mismatch"),
      ),
    ).toBe(true);
  });
});
