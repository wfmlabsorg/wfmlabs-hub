# WSL2 Cloud-Synced Directory: node_modules Performance

Date: 2026-05-09

## Problem
`bun install` fails or hangs when running in `~/cloud/projects/wfmlabs-hub/` because the directory is synced to Cloudflare R2. The R2 sync process creates filesystem overhead that makes extracting 600+ npm packages extremely slow (minutes → hang vs. 5 seconds on local disk).

## Solution
Install dependencies in a non-synced local directory and work from there for dev:

```bash
# Local dev directory (not R2-synced)
~/projects/wfmlabs-hub-local/

# Cloud project (R2-synced, source of truth for git)
~/cloud/projects/wfmlabs-hub/
```

Workflow:
1. Source files live in cloud dir (git, MEMORY, docs, seed doc)
2. `node_modules` + `bun.lock` live in local dir
3. Copy source files to local dir for dev (`bun run dev`, `bun run build`)
4. Sync changes back to cloud dir for git commits
5. `.gitignore` excludes `node_modules/` so this is transparent to GitHub

## Impact
This pattern applies to ALL cloud projects with heavy node_modules. Any future project in `~/cloud/projects/` that uses npm/bun packages should use a local dev directory.

## Versions
- Bun 1.3.11
- Payload 3.84.1 (600+ transitive dependencies)
- Next.js 16.2.6
- WSL2 on Windows, R2 sync active
