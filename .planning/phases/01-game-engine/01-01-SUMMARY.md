---
phase: 01-game-engine
plan: 01
subsystem: game-engine
tags: [typescript, vitest, monorepo, npm-workspaces, cube-coordinates, discriminated-unions]

# Dependency graph
requires: []
provides:
  - "npm workspace monorepo root with packages/game-engine scaffolded"
  - "TypeScript 5.9 strict-mode compilation (NodeNext, ES2022)"
  - "Vitest 4 test runner configured and passing"
  - "All core Catan domain types exported: ResourceType, DevCardType, GamePhase, GameState, Action, GameEvent, ActionResult, Board, Hex, Vertex, Edge, Player, ResourceHand"
affects:
  - "02-board-generation: imports Board, Hex, Vertex, Edge, GameState"
  - "03-game-logic: imports all Action/GameEvent/GameState types"
  - "04-server: imports entire public API from @catan/game-engine"
  - "05-client: imports GameState, Action for type safety"

# Tech tracking
tech-stack:
  added:
    - "typescript@5.9.3 (strict mode, NodeNext module resolution)"
    - "vitest@4.0.18 (test runner, node environment)"
    - "@vitest/coverage-v8@4.0.18 (coverage provider)"
  patterns:
    - "npm workspaces monorepo: packages/* under root"
    - "NodeNext module resolution: .js extensions on imports of .ts files"
    - "Discriminated union pattern: Action type field, GameEvent type field"
    - "Pure function contract: applyAction(state, action) => ActionResult"
    - "JSON-serializable state: no class instances, no functions in GameState"

key-files:
  created:
    - "package.json: npm workspaces root with test/build scripts"
    - "tsconfig.base.json: shared strict TypeScript config (ES2022, NodeNext, skipLibCheck)"
    - "tsconfig.json: monorepo root references packages/game-engine"
    - "packages/game-engine/package.json: @catan/game-engine, zero runtime deps"
    - "packages/game-engine/tsconfig.json: extends base, rootDir=src, outDir=dist"
    - "packages/game-engine/vitest.config.ts: node environment, src/**/*.test.ts"
    - "packages/game-engine/src/types.ts: all 19 exported domain types"
    - "packages/game-engine/src/index.ts: re-exports types via export * from './types.js'"
    - "packages/game-engine/src/__tests__/types.test.ts: 12 type smoke tests"
    - ".gitignore: excludes node_modules, dist, tsbuildinfo"
  modified:
    - "tsconfig.base.json: added lib and skipLibCheck for Vitest 4 compatibility"

key-decisions:
  - "skipLibCheck: true added to tsconfig.base.json — Vitest 4 + Vite types require DOM/browser globals not available in Node-only lib, skipLibCheck avoids false positives in node_modules"
  - "lib: ['ES2022', 'ESNext.Disposable'] added — Vitest 4 MockInstance extends Disposable which requires ESNext.Disposable lib entry"
  - "NodeNext module resolution chosen — requires .js extensions on import paths even for .ts files"
  - "All types in single types.ts file — prevents circular imports, makes dependency graph of types explicit"
  - "devCardBoughtThisTurn boolean on Player — enforces one dev card buy per turn at type level"

patterns-established:
  - "Import with .js extension: export * from './types.js' (NodeNext requirement)"
  - "Discriminated unions via type field: Action and GameEvent are discriminated unions"
  - "ResourceHand as Record<ResourceType, number>: exhaustive resource tracking"
  - "Board as three Record maps (hexes/vertices/edges): globally unique shared objects"

requirements-completed:
  - "GAME-01"

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 1 Plan 1: Monorepo Scaffold and Core Type Definitions Summary

**npm workspace monorepo with TypeScript 5.9 strict mode, Vitest 4 test runner, and all Catan domain types (GameState, 13-variant Action union, 14-variant GameEvent union) exported from @catan/game-engine**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T01:06:20Z
- **Completed:** 2026-03-01T01:09:21Z
- **Tasks:** 2 (plus TDD RED commit)
- **Files modified:** 10

## Accomplishments
- npm workspace monorepo initialized with packages/game-engine scaffold, zero runtime dependencies
- TypeScript 5.9 strict mode with NodeNext module resolution compiling cleanly (zero errors)
- Vitest 4 configured for Node environment; 12/12 type smoke tests passing
- All 19 exported types cover the full Catan domain: primitives, board topology, player state, game state, actions, events, and the applyAction return contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize monorepo structure** - `99f672e` (chore)
2. **Task 2 RED: Failing type smoke tests** - `5040b80` (test)
3. **Task 2 GREEN: Core types and index** - `3d232a1` (feat)

_Note: Task 2 used TDD — test commit followed by implementation commit_

## Files Created/Modified
- `package.json` - npm workspaces root, private, test/build scripts
- `tsconfig.base.json` - strict TypeScript base: ES2022, NodeNext, skipLibCheck, ESNext.Disposable lib
- `tsconfig.json` - monorepo root, references packages/game-engine
- `packages/game-engine/package.json` - @catan/game-engine v0.1.0, zero runtime deps
- `packages/game-engine/tsconfig.json` - extends base, rootDir=src, outDir=dist
- `packages/game-engine/vitest.config.ts` - node environment, src/**/*.test.ts pattern
- `packages/game-engine/src/types.ts` - all core domain types (ResourceType, DevCardType, GamePhase, Board, Hex, Vertex, Edge, Player, GameState, Action x13, GameEvent x14, ActionResult)
- `packages/game-engine/src/index.ts` - re-exports all types via `export * from './types.js'`
- `packages/game-engine/src/__tests__/types.test.ts` - 12 type smoke tests
- `.gitignore` - excludes node_modules, dist, tsbuildinfo

## Decisions Made
- `skipLibCheck: true` added — Vitest 4 bundles Vite which references browser globals (WebSocket, EventTarget) not in Node ES2022 lib; skipLibCheck prevents false positives in node_modules type checking
- `lib: ['ES2022', 'ESNext.Disposable']` — Vitest 4's MockInstance extends the `Disposable` interface from the ESNext.Disposable lib entry
- All types in a single `types.ts` — prevents circular import risk and makes the domain model easy to review at a glance
- NodeNext module resolution enforced — requires `.js` extensions on all imports, even when the source is `.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added lib and skipLibCheck to tsconfig.base.json**
- **Found during:** Task 2 (TypeScript compilation verification)
- **Issue:** TypeScript compilation failed with `Cannot find name 'Disposable'` from Vitest 4's spy types, then further failures from browser globals in Vite's type declarations
- **Fix:** Added `"lib": ["ES2022", "ESNext.Disposable"]` for the Disposable interface and `"skipLibCheck": true` to skip node_modules type checking
- **Files modified:** `tsconfig.base.json`
- **Verification:** `tsc --build --noEmit` exits 0 with zero errors
- **Committed in:** 3d232a1 (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required to achieve the plan's stated success criteria of "TypeScript strict compilation succeeds". No scope creep.

## Issues Encountered
- Vitest 4 type declarations require ESNext.Disposable and reference browser globals through Vite. Using `skipLibCheck` is the standard industry practice for packages that have devDependencies with mixed browser/node types.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All types are in place and exported from `@catan/game-engine`
- Plan 01-02 (board generation) can import `Board`, `Hex`, `Vertex`, `Edge`, `GameState` immediately
- The `applyAction(state, action): ActionResult` contract is defined — implementation follows in subsequent plans
- TypeScript compilation and Vitest test infrastructure are proven working

---
*Phase: 01-game-engine*
*Completed: 2026-03-01*

## Self-Check: PASSED

- types.ts: FOUND
- index.ts: FOUND
- SUMMARY.md: FOUND
- package.json: FOUND
- Commit 99f672e: FOUND
- Commit 5040b80: FOUND
- Commit 3d232a1: FOUND
