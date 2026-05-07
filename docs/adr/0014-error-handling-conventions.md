# 0014 - Error Handling Conventions

## Status

Accepted

## Context

Errors should be clear without leaking secrets.

## Decision

Return typed results from ledger helpers where useful and show concise UI messages. Never include passphrases, private keys, or plaintext entries in error strings.

## Consequences

The UI can recover from bad passphrases, verification failures, and unavailable optional WASM modules.

## Alternatives Considered

Throw-only UI flows were rejected because they degrade key recovery and verification UX.
