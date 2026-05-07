# 0010 - GitHub Pages Publishing Strategy

## Status

Accepted

## Context

The live URL is a first-class deliverable and no GitHub Actions are allowed.

## Decision

Build Vite into `docs/` and configure GitHub Pages to serve `main` branch `/docs`. Keep `docs/` tracked and do not gitignore it.

## Consequences

Publishing is a normal commit. ADRs and deployment docs are also public under the Pages path.

## Alternatives Considered

A `gh-pages` branch was rejected to keep publishing visible in the main history.
