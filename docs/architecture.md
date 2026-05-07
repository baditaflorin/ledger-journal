# Architecture

Ledger Journal is Mode A: a static GitHub Pages app with no runtime backend.

```mermaid
C4Container
  title Ledger Journal Containers
  Person(user, "Journal owner")
  System_Boundary(pages, "https://baditaflorin.github.io/ledger-journal/") {
    Container(ui, "React UI", "TypeScript, Vite", "Vault setup, entry writing, verification, proof export")
    Container(crypto, "Crypto module", "age, Web Crypto, noble Ed25519", "Encrypts entries, signs hashes, rotates age keys")
    ContainerDb(duck, "DuckDB-WASM", "WASM", "Lazy in-memory analytics over decrypted session rows")
    Container(ai, "Local AI worker", "Web Worker, Comlink, Transformers.js", "Optional reflection and Whisper transcription")
  }
  ContainerDb(indexedDb, "IndexedDB", "Browser storage", "Encrypted entries, checkpoints, encrypted vault")
  Rel(user, ui, "Writes and verifies")
  Rel(ui, crypto, "Calls")
  Rel(ui, duck, "Loads on demand")
  Rel(ui, ai, "Loads on demand")
  Rel(crypto, indexedDb, "Persists encrypted records")
```

The GitHub Pages boundary serves static files only. Journal data, passphrases, identities, signing keys, plaintext entries, and proof exports never leave the browser unless the user downloads or publishes them.
