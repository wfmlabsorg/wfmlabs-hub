# TARS Memory System — WFM Labs Hub

This directory is the canonical record of project state, decisions, and learnings for the WFM Labs Hub. Every TARS session reads from and writes to this directory.

## Structure

```
MEMORY/
├── README.md              This file
├── current-state.md       What exists, what works, what's next (CRITICAL)
├── open-questions.md      Unresolved decisions needing Ted's input
├── decisions/             Architecture Decision Records (numbered, immutable)
├── learnings/             Discoveries during build (dated)
└── sessions/              Per-session work logs (dated)
```

## Session Protocol

### On Start
1. CLAUDE.md is auto-loaded (session bootstrap)
2. Read `current-state.md`
3. Read 3 most recent files in `sessions/`
4. If making architectural decisions, read relevant ADRs in `decisions/`

### On End (if meaningful work was done)
1. Write session note to `sessions/YYYY-MM-DD-HHMM-topic.md`
2. Update `current-state.md` if system state changed
3. Write ADR to `decisions/` if a significant decision was made
4. Update `CLAUDE.md` if phase status or conventions changed

## ADR Rules
- Numbered sequentially: `NNNN-descriptive-name.md`
- Immutable once status is `Accepted`
- To change a decision, write a new ADR that supersedes the old one
- Use the template in the seed doc (Appendix A)

## File Naming
- ADRs: `decisions/NNNN-descriptive-name.md`
- Learnings: `learnings/YYYY-MM-DD-topic.md`
- Sessions: `sessions/YYYY-MM-DD-HHMM-topic.md`
