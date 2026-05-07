# 0015 - Deployment Topology

## Status

Accepted

## Context

Mode A deploys static assets only.

## Decision

Use GitHub Pages at https://baditaflorin.github.io/ledger-journal/. No Docker Compose, nginx, Prometheus, or server host is used.

## Consequences

Operational burden is minimal and the attack surface is static.

## Alternatives Considered

Mode C topology was rejected for v0.1.0.
