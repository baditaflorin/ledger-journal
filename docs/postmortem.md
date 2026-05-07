# Postmortem

Completed for v0.1.0.

Built:

- Static GitHub Pages app at https://baditaflorin.github.io/ledger-journal/
- Browser-local vault creation and unlock
- age-encrypted entries stored in IndexedDB
- Ed25519 signatures over hash-chained entry records
- Merkle checkpoints and downloadable proof bundles
- age key rotation for future entries
- Lazy DuckDB-WASM session index
- Lazy local AI worker for reflection and Whisper transcription
- Local git hooks, smoke tests, ADRs, deploy docs, and privacy docs

Mode review:

Mode A was correct. The core product is private ownership, and every v0.1.0 write can happen in the browser. A backend would have added authentication, secret handling, backups, logging risk, and operational burden without improving the main proof workflow.

What worked:

- `age-encryption` was straightforward for passphrase-protected vaults and recipient-based entry encryption.
- Keeping `docs/` as both Pages output and documentation worked once generated files were cleaned before builds.
- Playwright smoke testing caught real static serving and IndexedDB flow issues early.

What did not work:

- The deprecated `@xenova/transformers` package pulled a critical audit advisory, so it was replaced with maintained `@huggingface/transformers`.
- Pre-push builds can update commit metadata in generated Pages files. The current build displays the source commit used for the Pages artifact, not the publish commit that contains the artifact.

Surprises:

- GitHub Pages was available quickly after enabling it from `main` `/docs`.
- The optional local AI WASM/model payload is large, but it stays off the initial load path.

Accepted tech debt:

- Proof bundles prove integrity and inclusion in a signed local checkpoint, but strong third-party timestamping still needs an external anchor adapter.
- Browser profile loss still means data loss unless the user backs up the profile.
- Whisper and local reflection depend on browser support and model download availability.

Next improvements:

1. Add encrypted vault import/export and recovery testing.
2. Add optional OpenTimestamps or user-published release-root anchoring.
3. Add proof-bundle verifier UI for importing old bundles and validating them without unlocking the whole vault.

Time spent vs estimate:

Estimated: 4-6 hours for a real v0.1.0 scaffold and local proof workflow. Actual: about 2 hours in this implementation pass, with the largest time sinks being Pages build reproducibility and smoke-test hardening.
