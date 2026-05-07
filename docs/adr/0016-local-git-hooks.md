# 0016 - Local Git Hooks

## Status

Accepted

## Context

The workflow forbids GitHub Actions and requires local checks.

## Decision

Use plain `.githooks/` configured by `make install-hooks`.

## Consequences

Pre-commit runs formatting checks, lint, typecheck, audit, and gitleaks. Pre-push runs tests, build, and smoke.

## Alternatives Considered

Lefthook was not necessary for this small Mode A repo.
