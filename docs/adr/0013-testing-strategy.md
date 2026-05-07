# 0013 - Testing Strategy

## Status

Accepted

## Context

Crypto and proof logic need deterministic tests, and Pages output needs smoke coverage.

## Decision

Use Vitest for unit tests and Playwright smoke tests against a local server serving `docs/` under `/ledger-journal/`.

## Consequences

`make test` and `make smoke` validate the main paths without CI.

## Alternatives Considered

Browser-only manual testing was rejected.
