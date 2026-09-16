# AGENTS.md — Ratio Soluciones

These instructions apply to Codex and any coding agent working in this repository.

## Project identity and scope

- The corresponding ChatGPT and Codex project name is exactly `Ratio Soluciones`.
- Canonical repository: `sgmasesoria-boop/ratio-soluciones-web`.
- Keep this repository isolated from OMEGA Trader and FacturaRadar work.

## Instruction bridge

Project-chat text does not alter the repository by name alone. When the user accepts a durable workflow, architecture, or safety decision in the Ratio Soluciones project, record it in this file or the appropriate checked-in decision document in the same work branch. That Git-tracked instruction is what Codex discovers after synchronization.

## Workflow

1. At the start of every task, inspect this file, the current branch, working tree, remotes, and existing user changes.
2. Continue existing work; do not duplicate active processes or discard unrelated changes.
3. Use a focused branch for substantial work. Implement, run the relevant checks, and report the branch and verification performed.
4. Keep scripts portable. Do not introduce absolute paths tied to a specific Windows user or Codex runtime.
5. On Windows, prefer `npm.cmd` or `pnpm.cmd` when PowerShell execution policy blocks `.ps1` shims.

## Security and data protection

- Never commit credentials, tokens, private legal-library content, OCR output containing personal data, database dumps, or client documents.
- Treat Supabase, Signaturit, production webhooks, CRM data, backups, and live services as sensitive.
- Do not deploy, connect to live services, alter credentials, initialize or restore production data, or perform irreversible operations without explicit confirmation.
- Use fictitious data for tests and demonstrations. Keep generated dependencies, caches, builds, and local state ignored unless the repository explicitly requires them.
