# 0017 - Dependency Policy

## Status

Accepted

## Context

The stack depends on cryptography, local storage, and browser WASM.

## Decision

Use production libraries for crypto and storage: `age-encryption`, `@noble/ed25519`, `@duckdb/duckdb-wasm`, `idb`, `zod`, `comlink`, and maintained Transformers.js.

## Consequences

The project avoids bespoke cryptographic primitives. `npm audit --audit-level=high` is part of the local checks.

## Alternatives Considered

Custom crypto and deprecated Transformers.js packages were rejected.
