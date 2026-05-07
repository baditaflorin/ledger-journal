# 0008 - Go Backend Project Layout

## Status

Accepted

## Context

The requested bootstrap includes Go layout for Modes B and C.

## Decision

Skip Go backend layout in Mode A.

## Consequences

No `cmd/`, `internal/`, Dockerfile, migrations, or server health endpoints are present.

## Alternatives Considered

A local Go CLI was rejected because browser-only implementation is enough for v0.1.0.
