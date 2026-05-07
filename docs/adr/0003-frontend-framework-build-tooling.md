# 0003 - Frontend Framework And Build Tooling

## Status

Accepted

## Context

The app needs a rich local workflow, strict TypeScript, and GitHub Pages output.

## Decision

Use React, TypeScript strict mode, Vite, Tailwind CSS, Vitest, and Playwright.

## Consequences

Builds are fast, static, and Pages-compatible. The initial bundle remains focused while heavy modules lazy-load.

## Alternatives Considered

Vanilla TypeScript was possible but would slow UI iteration. Next.js was rejected because a static Vite app is simpler for Pages.
