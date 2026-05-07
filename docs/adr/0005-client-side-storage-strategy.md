# 0005 - Client-Side Storage Strategy

## Status

Accepted

## Context

Entries, vault metadata, and checkpoints must persist locally without a server.

## Decision

Use IndexedDB through `idb`. Store only encrypted entries, encrypted vaults, signatures, hashes, and checkpoints.

## Consequences

The app works offline and avoids server trust. Users remain responsible for browser profile backups.

## Alternatives Considered

`localStorage` was too small and synchronous. OPFS is useful later for larger exports but not required for v0.1.0.
