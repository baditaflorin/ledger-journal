import { describe, expect, it } from "vitest";
import { createVault } from "./crypto";
import {
  createCheckpoint,
  createEntryRecord,
  exportProofBundle,
} from "./ledger";
import { verifyProofBundle } from "./proof";

describe("proof bundle verification", () => {
  it("verifies a freshly generated proof bundle end-to-end", async () => {
    const { secret } = await createVault("verify this is real");
    const first = await createEntryRecord(
      secret,
      { body: "First", mood: "clear", tags: [] },
      undefined,
    );
    const second = await createEntryRecord(
      secret,
      { body: "Second", mood: "steady", tags: [] },
      first.record,
    );
    const third = await createEntryRecord(
      secret,
      { body: "Third", mood: "tired", tags: [] },
      second.record,
    );
    const records = [first.record, second.record, third.record];
    const checkpoint = await createCheckpoint(secret, records, undefined);
    const bundle = await exportProofBundle(second, records, checkpoint);

    const result = await verifyProofBundle(bundle);
    expect(result.status).toBe("valid");
    expect(result.errors).toEqual([]);
    expect(result.checks.length).toBeGreaterThanOrEqual(7);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("fails verification when the entry payload is tampered", async () => {
    const { secret } = await createVault("verify this is real");
    const entry = await createEntryRecord(
      secret,
      { body: "Truth", mood: "clear", tags: [] },
      undefined,
    );
    const checkpoint = await createCheckpoint(
      secret,
      [entry.record],
      undefined,
    );
    const bundle = await exportProofBundle(entry, [entry.record], checkpoint);

    const tamperedBundle = {
      ...bundle,
      entry: {
        ...bundle.entry,
        payload: { ...bundle.entry.payload, body: "Lie" },
      },
    };
    const result = await verifyProofBundle(tamperedBundle);
    expect(result.status).toBe("invalid");
    expect(
      result.errors.some((error) => error.includes("plaintext-hash")),
    ).toBe(true);
  });

  it("fails verification when the checkpoint signature is tampered", async () => {
    const { secret } = await createVault("verify this is real");
    const entry = await createEntryRecord(
      secret,
      { body: "Truth", mood: "clear", tags: [] },
      undefined,
    );
    const checkpoint = await createCheckpoint(
      secret,
      [entry.record],
      undefined,
    );
    const bundle = await exportProofBundle(entry, [entry.record], checkpoint);

    const tamperedBundle = {
      ...bundle,
      checkpoint: {
        ...bundle.checkpoint,
        signature: bundle.checkpoint.signature.replace(/^./, (c) =>
          c === "0" ? "1" : "0",
        ),
      },
    };
    const result = await verifyProofBundle(tamperedBundle);
    expect(result.status).toBe("invalid");
    expect(
      result.errors.some((error) => error.includes("checkpoint-signature")),
    ).toBe(true);
  });

  it("fails verification when the Merkle proof is missing a step", async () => {
    const { secret } = await createVault("verify this is real");
    const first = await createEntryRecord(
      secret,
      { body: "First", mood: "clear", tags: [] },
      undefined,
    );
    const second = await createEntryRecord(
      secret,
      { body: "Second", mood: "steady", tags: [] },
      first.record,
    );
    const records = [first.record, second.record];
    const checkpoint = await createCheckpoint(secret, records, undefined);
    const bundle = await exportProofBundle(second, records, checkpoint);

    const tamperedBundle = { ...bundle, merkleProof: [] };
    const result = await verifyProofBundle(tamperedBundle);
    expect(result.status).toBe("invalid");
    expect(
      result.errors.some((error) => error.includes("merkle-inclusion")),
    ).toBe(true);
  });

  it("fails verification when the entry and checkpoint were signed by different keys", async () => {
    const writerVault = await createVault("writer key");
    const otherVault = await createVault("attacker key");
    const entry = await createEntryRecord(
      writerVault.secret,
      { body: "Mine", mood: "clear", tags: [] },
      undefined,
    );
    // Anchor the writer's entry hash, but sign the checkpoint with a
    // different identity — a hostile witness could try this to lay claim to
    // the writer's entry.
    const realCheckpoint = await createCheckpoint(
      writerVault.secret,
      [entry.record],
      undefined,
    );
    const fakeCheckpoint = await createCheckpoint(
      otherVault.secret,
      [entry.record],
      undefined,
    );
    const bundle = await exportProofBundle(
      entry,
      [entry.record],
      realCheckpoint,
    );
    const tamperedBundle = { ...bundle, checkpoint: fakeCheckpoint };
    const result = await verifyProofBundle(tamperedBundle);
    expect(result.status).toBe("invalid");
    expect(
      result.errors.some((error) => error.includes("signer-consistency")),
    ).toBe(true);
  });
});
