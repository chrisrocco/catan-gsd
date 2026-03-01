# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** A complete, rules-enforced solo game against bots that plays like the real thing.
**Current focus:** Phase 1 — Game Engine

## Current Position

Phase: 1 of 5 (Game Engine)
Plan: 2 of 6 in current phase
Status: In progress
Last activity: 2026-03-01 — Completed 01-02 (hex grid topology + board generator)

Progress: [██░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 5 min
- Total execution time: 10 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-game-engine | 2/6 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (3 min), 01-02 (7 min)
- Trend: Establishing baseline

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Bank/port trading only for v1 — P2P trading deferred to v2
- [Init]: Solo/bots before multiplayer — validate rules before adding network complexity
- [Init]: Full server-side rule enforcement — authoritative state, no client-side mutation
- [Research]: Use cube coordinates (q, r, s) for hex grid — offset coords make longest road algorithm substantially harder
- [Research]: Build global canonical vertex/edge index at board init — prevents silent settlement placement bugs
- [Research]: Model turn flow as explicit FSM — boolean flag soup leads to illegal action combinations
- [01-01]: skipLibCheck: true in tsconfig.base.json — Vitest 4 bundles Vite types with browser globals; skipLibCheck avoids false positives in node_modules
- [01-01]: lib: ['ES2022', 'ESNext.Disposable'] — Vitest 4 MockInstance extends Disposable interface, requires ESNext.Disposable lib entry
- [01-01]: All core types in single types.ts — prevents circular imports, makes domain model explicit
- [01-02]: Vertex keys include virtual sea hex coordinates — using all 3 surrounding hex keys (real or virtual) guarantees globally unique vertex IDs even for border vertices with only 1 land neighbor
- [01-02]: cornerNeighborDirections uses (i+5)%6 not (i+1)%6 — flat-top vertex i is between edge (i-1) and edge i, sharing neighbors at directions (i+5)%6 and i
- [01-02]: Border edges keyed as hKey~sea~edgeIdx — prevents key collision when multiple outer-ring hexes have border edges in the same direction
- [01-02]: Flat-top orientation confirmed — FLAT_TOP_CORNER_ANGLES_DEG exported for Phase 4 rendering

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 1]: Verify npm package versions (React 19, Zustand 5, Fastify 5, Vite 6, Tailwind 4) before pinning in Phase 1 setup
- [01-02 RESOLVED]: Hex orientation was flat-top — confirmed and exported FLAT_TOP_CORNER_ANGLES_DEG

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 01-02-PLAN.md (hex grid topology + board generator)
Resume file: None
