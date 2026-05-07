# 0001 - Deployment Mode

## Status

Accepted

## Context

The journal must be private, local-first, and usable without trusting a service.

## Decision

Use Mode A: Pure GitHub Pages. The app is static Vite output served from `main` branch `docs/`.

## Consequences

There is no runtime backend, server database, auth system, Docker image, or nginx layer. Browser storage and client-side crypto carry the product.

## Alternatives Considered

Mode B was unnecessary because there is no shared public dataset. Mode C was rejected because server writes would weaken the local ownership model.
