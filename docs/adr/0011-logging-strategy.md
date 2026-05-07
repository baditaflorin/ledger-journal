# 0011 - Logging Strategy

## Status

Accepted

## Context

Mode A has no server logs.

## Decision

Production code avoids routine console logging. User-visible errors are rendered in the UI.

## Consequences

No private data is logged intentionally. Debugging relies on local browser tools.

## Alternatives Considered

Remote logging was rejected due to privacy.
