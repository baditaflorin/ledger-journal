# Privacy

Ledger Journal collects no analytics in v0.1.0.

Stored locally:

- encrypted age vault containing private age identities and Ed25519 signing key material
- encrypted journal entries
- signed chain metadata and Merkle checkpoints
- browser cache entries for static app assets and optional local model weights

Not sent anywhere by default:

- passphrases
- plaintext entries
- private keys
- proof bundles
- audio recordings

Optional local AI features fetch model weights from public model hosting after the user presses the relevant button. Inference runs in the browser.
