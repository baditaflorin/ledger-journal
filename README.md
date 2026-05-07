# Ledger Journal

https://baditaflorin.github.io/ledger-journal/

Ledger Journal is a private, offline-first journal with encrypted, hash-chained entries and exportable cryptographic proof bundles.

[![Version](https://img.shields.io/badge/version-0.1.0-0f766e)](https://github.com/baditaflorin/ledger-journal)
[![Deployment](https://img.shields.io/badge/deploy-GitHub%20Pages-2563eb)](https://baditaflorin.github.io/ledger-journal/)
[![License](https://img.shields.io/badge/license-MIT-111827)](LICENSE)

## Quickstart

```sh
npm install
make install-hooks
make dev
make test
make smoke
```

## What It Does

Ledger Journal stores entries only in the browser using IndexedDB. Each entry is encrypted with age, hash-chained to the previous entry, signed with Ed25519, and included in Merkle checkpoints that can be exported as proof bundles. DuckDB-WASM, local text generation, and Whisper transcription load lazily behind user actions.

Repository: https://github.com/baditaflorin/ledger-journal

Support: https://www.paypal.com/paypalme/florinbadita

## Architecture

```mermaid
C4Context
  title Ledger Journal Context
  Person(user, "Journal owner", "Writes and verifies private entries")
  System_Boundary(pages, "GitHub Pages static boundary") {
    System(app, "Ledger Journal", "Vite React app served as static files")
  }
  SystemDb(browser, "Browser storage", "IndexedDB, Cache API, optional OPFS")
  System_Ext(modelCdn, "Model CDN", "Optional model weights fetched by local AI worker")
  Rel(user, app, "Uses")
  Rel(app, browser, "Stores encrypted entries")
  Rel(app, modelCdn, "Fetches model weights only after user action")
```

More detail: docs/architecture.md

ADRs: docs/adr/

Deployment guide: docs/deploy.md

Privacy notes: docs/privacy.md
