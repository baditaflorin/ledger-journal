# 0004 - Static Data Contract

## Status

Accepted

## Context

Mode A has no shared static data. Personal data is browser-local.

## Decision

The only committed static data artifact is `docs/version.json`, containing app version, commit, repo URL, and build time.

## Consequences

No public data freshness contract is needed. Journal schema versions live in encrypted IndexedDB records.

## Alternatives Considered

Mode B JSON or Parquet artifacts were rejected because journal data must not be committed.
