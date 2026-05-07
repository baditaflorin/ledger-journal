# Postmortem

Status: drafted during v0.1.0 implementation.

Mode A remains the right choice for v0.1.0 because the product promise is local ownership. A backend would add operational risk and a new trust surface without solving the core journaling workflow.

Most valuable next improvements:

1. Add import/export for encrypted vault backups.
2. Add external timestamp anchor adapters such as OpenTimestamps or user-published GitHub release attestations.
3. Add stronger recovery UX for key rotation and lost passphrases.
