# 0002 - Architecture Overview And Module Boundaries

## Status

Accepted

## Context

The app needs crypto, storage, proof generation, lazy analytics, and optional local AI.

## Decision

Keep feature modules under `src/features/ledger/` and `src/features/ai/`. UI state stays in React. IndexedDB is the durable local store.

## Consequences

Crypto and proof logic are unit-testable outside the UI. Heavy WASM and model code are isolated behind dynamic imports and workers.

## Alternatives Considered

A single large app file was rejected because verification logic needs focused tests.
