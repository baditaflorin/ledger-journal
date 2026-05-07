# 0009 - Configuration And Secrets Management

## Status

Accepted

## Context

The frontend must never contain secrets.

## Decision

Use build-time public constants only: Pages base path, version, commit, repo URL, and PayPal URL. `.env.example` documents the optional base path.

## Consequences

No API keys, passwords, private keys, or `.env` secrets are required.

## Alternatives Considered

Runtime configuration endpoints were rejected because there is no backend.
