# 0006 - WASM Modules

## Status

Accepted

## Context

DuckDB and local AI require WASM or model runtimes.

## Decision

Use DuckDB-WASM lazily for session analytics and Transformers.js lazily in a Comlink Web Worker for local reflection and Whisper transcription.

## Consequences

Initial page load stays small. GitHub Pages cannot set COOP/COEP headers, so the app favors non-threaded/browser-compatible WASM paths.

## Alternatives Considered

Shipping WASM on first load was rejected due to payload budget. A backend AI service was rejected due to privacy.
