# Technology Stack

**Project:** Catan Web — Browser-based multiplayer Catan with bot AI
**Researched:** 2026-02-28
**Research constraints:** WebSearch, WebFetch, and npm registry tools were unavailable during this session. Versions are based on training data through August 2025 and should be verified against npm registry before pinning. Confidence levels reflect this.

---

## Recommended Stack

### Frontend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.x | UI component tree, game UI rendering | Dominant ecosystem, concurrent rendering stabilized in v19, ideal for turn-based game state that drives re-renders. Hooks model maps cleanly to game phase state machines. |
| TypeScript | 5.x | Type safety across shared game types | The hex grid, game state, and move validation logic are complex enough that runtime type errors become very costly. Shared types between client and server are a force multiplier. |
| Vite | 6.x | Build tool, dev server with HMR | Fastest DX for React+TS projects in 2026. The game loop is frontend-heavy; fast HMR speeds up visual iteration on board rendering. |

**Confidence:** MEDIUM — React 19 and Vite 6 were released in late 2024/early 2025; verify exact current patch versions before pinning.

### Game Board Rendering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SVG (inline, via React) | Native browser | Hex grid, board tiles, roads, settlements | Catan's board is a static hex grid — SVG is the right tool. Unlike canvas, SVG elements are DOM nodes: individually addressable, hoverable, animatable via CSS, and zero-dependency. No library needed. Each hex, vertex, and edge becomes a React component with its own state-driven styling. |

**Why NOT canvas:** Canvas requires manual hit-testing, redraw loops, and gives up DOM interactivity. Catan's board is not particle-physics — it's ~19 hexes, ~54 vertices, ~72 edges. SVG handles this without breaking a sweat and makes click/hover interactions trivial.

**Why NOT Pixi.js / Three.js / Phaser:** Overkill. These libraries shine for animation-heavy or 3D games. Catan is a board game: the "animation" is a settlement appearing. React + SVG is simpler, smaller, and the entire team already knows how to debug it.

**Confidence:** HIGH — SVG-via-React is the established pattern for board game UIs; no external library needed means no version concerns.

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.x | Client-side game state store | Catan has complex, deeply nested state (board, hands, decks, turn phase, dice). Zustand's flat, action-based model avoids Redux boilerplate while remaining debuggable. Devtools integration works out of the box. The game server is authoritative — the client store is a projection of server state, not the source of truth. Zustand handles that model elegantly (replace full state on server push). |
| Immer (via Zustand middleware) | 10.x | Immutable state updates | Game state mutations (distributing resources, placing settlements) are complex. Immer lets you write mutations as if they're mutable while producing immutable updates. This matters for the bot AI simulation too (see below). |

**Why NOT Redux Toolkit:** Redux adds indirection (actions, reducers, selectors) that buys nothing here. The client is a thin display layer — the server holds truth. Zustand is half the boilerplate.

**Why NOT Jotai/Valtio:** Jotai's atomic model is elegant for independent UI atoms but awkward when the entire game state arrives as one server payload. Zustand's `set(newState)` replacement pattern fits server-driven state better.

**Confidence:** MEDIUM — Zustand 5 was in RC as of mid-2025; verify release status.

### WebSocket / Real-time Communication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Socket.IO | 4.x | Bidirectional real-time game events | Socket.IO v4 is mature, well-documented, and includes automatic reconnection, room management, and fallback transport — all required for a lobby/room system. The room primitive maps directly to "a game session." Personal-use scale (handful of concurrent users) means there are no performance concerns that would push toward raw WebSocket. |

**Why NOT raw WebSocket:** You would rebuild rooms, reconnection logic, and event routing manually. For a personal project with friends, that engineering cost is waste.

**Why NOT Partykit / Liveblocks / Ably:** These are hosted real-time platforms. They add external dependencies, cost, and lock-in for a personal project. Self-hosted Socket.IO is zero-cost and fully controlled.

**Why NOT tRPC with WebSocket transport:** tRPC is excellent for request/response but its WebSocket support is secondary. Game events are fire-and-forget pushes from server to client — Socket.IO's event model fits better than tRPC's procedure model.

**Confidence:** HIGH — Socket.IO 4.x has been stable for several years; this is a safe choice.

### Backend / Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.x LTS | Runtime | Same language as frontend means shared TypeScript types for game state, moves, and events. Node 22 is the 2025 LTS line. |
| Fastify | 5.x | HTTP server (lobby API, game creation) | Non-game-event HTTP endpoints (create room, list rooms, join) need a proper HTTP server. Fastify is faster than Express, has first-class TypeScript support, and excellent plugin ecosystem. Socket.IO attaches cleanly to a Fastify HTTP instance. |
| Socket.IO (server) | 4.x | WebSocket server, room management | Same library, server-side. Rooms = game sessions. Events = moves and state broadcasts. |

**Why NOT Express:** Fastify has better TypeScript types, better performance, and schema validation built in. Express is showing its age.

**Why NOT Bun:** Bun's Socket.IO compatibility has had friction points. For a game where correctness matters more than raw performance, Node.js 22 LTS is the safer choice.

**Why NOT a separate game server framework (Colyseus, Nakama):** Colyseus is worth knowing about (purpose-built for multiplayer games, has a room/schema state-sync model), but it adds an opinionated framework layer and deployment complexity. For Catan's scale (friends-only, low concurrency), a lightweight custom Socket.IO server is simpler to reason about and debug. **FLAG: If the project later needs matchmaking, persistence, or scaling, evaluate Colyseus.**

**Confidence:** MEDIUM — Fastify 5 released in 2024; verify current patch version.

### Shared Types / Monorepo

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pnpm workspaces | 9.x | Monorepo (client + server + shared packages) | Catan's game logic needs to live in one place and be imported by both the frontend (for local move validation, bot AI display) and backend (authoritative rule enforcement). A monorepo with a `packages/game-engine` package solves this. pnpm workspaces is lightweight and fast. |
| `packages/game-engine` (custom) | — | Hex grid math, rule engine, game state machine | The core of the project. Pure TypeScript, no framework dependencies. Tests against this package become the spec for Catan rules. |

**Why NOT turborepo:** Turborepo adds build caching and pipeline orchestration. Useful at scale, but a single-developer personal project doesn't need that overhead. Plain pnpm workspaces is sufficient.

**Confidence:** HIGH — pnpm workspaces is the established lightweight monorepo approach.

### Bot AI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom heuristic engine (in `game-engine` package) | — | Bot decision-making | Catan bots do not need machine learning. The decision space per turn is: (1) what to build, (2) where to build it, (3) what to trade. Heuristic bots — scoring each valid move against hand-crafted rules — produce "reasonably competitive" play as specified in the requirements. |

**Bot architecture approach:**
- Bots run server-side as players in the game session
- Each bot has a `think(gameState, botPlayerId): Move` function
- The function scores legal moves and picks the highest-scoring one
- Strategy heuristics: prefer settlements near high-probability numbers (6, 8, 5, 9), prefer resource diversity, block leader settlements in late game
- Bot "thinking" can be given an artificial delay (500ms) to feel natural

**Why NOT MCTS (Monte Carlo Tree Search):** MCTS produces stronger play but requires simulating thousands of random game continuations per move. For a friends-casual game, this is engineering complexity without proportional user value. Heuristics are debuggable, tunable, and fast.

**Why NOT TensorFlow.js / ONNX:** ML inference in the browser or server for board game bots is massive overkill for Catan at personal-use scale. Training data doesn't exist for your specific ruleset. Heuristics are the right tool.

**Confidence:** HIGH — Heuristic bots are the standard approach for casual board game AI; no external library needed.

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Game UI layout and chrome styling | The game board is SVG (no Tailwind needed there), but the surrounding UI — lobby, player hands, action buttons, trade panels — needs styling. Tailwind 4's zero-config approach and JIT engine make it fast to ship. No design system needed for a personal project. |

**Why NOT CSS Modules:** Valid alternative, but Tailwind is faster for one-developer projects. The co-location of styles in JSX removes the context-switching cost.

**Why NOT styled-components / emotion:** CSS-in-JS runtime libraries add bundle weight and runtime overhead. Tailwind is zero-runtime.

**Confidence:** MEDIUM — Tailwind v4 was in active release cycle through 2025; verify current stable version.

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 2.x | Unit and integration tests | Same config as Vite. The `game-engine` package needs thorough testing — rule enforcement, hex math, state transitions. Vitest runs in Node with no browser needed for pure logic. Fast watch mode. |
| Playwright | 1.x | End-to-end browser tests (selective) | Full browser automation for critical paths (join game, place settlement, win condition). Don't overtest — E2E tests for 3-5 happy paths is sufficient for a personal project. |

**Confidence:** MEDIUM — Vitest 2.x released 2024; verify current version.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI Framework | React 19 | Vue 3 / Svelte 5 | Both are viable; React chosen for ecosystem depth and team familiarity in 2026 |
| Rendering | SVG via React | Pixi.js / Konva.js | Overkill for a static board; adds bundle weight and a canvas hit-testing burden |
| Rendering | SVG via React | Phaser 3 | Game engine framework too heavy; designed for action games not board games |
| State | Zustand | Redux Toolkit | RTK's boilerplate buys nothing when server is authoritative source of truth |
| Real-time | Socket.IO | Raw WebSocket | Socket.IO's room/reconnection primitives are free features for a lobby-based game |
| Real-time | Socket.IO | Partykit / Liveblocks | Hosted platforms add cost and lock-in; self-hosted fine for friends-only scale |
| Backend | Fastify + Node | Deno + Fresh | Deno's ecosystem maturity lags Node for Socket.IO production use |
| Backend | Fastify + Node | Colyseus | Purpose-built but adds opinionated framework; Socket.IO is simpler at this scale |
| Bot AI | Custom heuristics | MCTS | MCTS is stronger but complex to implement and unnecessary for casual play target |
| Monorepo | pnpm workspaces | Turborepo | Turborepo's build caching is unnecessary overhead for single-developer personal project |
| Build | Vite | Next.js | SSR/RSC adds complexity; this is a WebSocket-heavy SPA, not a content site |

---

## Project Structure (Recommended)

```
catan-web/
├── packages/
│   ├── game-engine/          # Pure TS: hex math, rule engine, state machine, bot AI
│   │   ├── src/
│   │   │   ├── board/        # Hex grid, tile placement, adjacency
│   │   │   ├── rules/        # Move validation, resource distribution, win conditions
│   │   │   ├── state/        # GameState type, state transitions
│   │   │   └── bots/         # Heuristic bot implementation
│   │   └── package.json
│   ├── client/               # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/   # Board, Hex, Vertex, Edge, PlayerHand, Lobby
│   │   │   ├── store/        # Zustand store (server state projection)
│   │   │   └── socket/       # Socket.IO client event handlers
│   │   └── package.json
│   └── server/               # Fastify + Socket.IO backend
│       ├── src/
│       │   ├── rooms/        # Game room management
│       │   ├── game/         # Authoritative game loop, move processing
│       │   └── bots/         # Bot player scheduling
│       └── package.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Installation (When Starting)

```bash
# Initialize monorepo
pnpm init
echo "packages:\n  - 'packages/*'" > pnpm-workspace.yaml

# Client
pnpm create vite packages/client --template react-ts
cd packages/client && pnpm add zustand immer socket.io-client
pnpm add -D tailwindcss @tailwindcss/vite

# Server
mkdir -p packages/server/src && cd packages/server
pnpm init && pnpm add fastify socket.io
pnpm add -D typescript tsx @types/node vitest

# Game engine
mkdir -p packages/game-engine/src && cd packages/game-engine
pnpm init && pnpm add -D typescript vitest

# Root dev tooling
pnpm add -D -w typescript vitest playwright
```

**Note:** Pin to specific versions after verifying latest stable releases on npmjs.com for each package. The versions listed in this document reflect the known-stable baseline as of mid-2025.

---

## Key Technical Decision: Game Engine as Shared Package

The most important architectural decision in this stack is treating game logic as a pure, framework-free package imported by both client and server.

**Why this matters:**
- Server enforces rules authoritatively (no cheating possible)
- Client can run the same validation locally for instant feedback (highlight valid placements)
- Bot AI runs server-side using the same engine
- The game engine can be unit-tested exhaustively in isolation
- All three packages share the same `GameState`, `Move`, and `Player` TypeScript types — no translation layer

This is not a performance optimization; it's a correctness optimization.

---

## Version Verification Required

The following should be verified against current npm registry before starting implementation:

| Package | Last Known Version | Verify At |
|---------|-------------------|-----------|
| react | 19.x | npmjs.com/package/react |
| typescript | 5.x | npmjs.com/package/typescript |
| vite | 6.x | npmjs.com/package/vite |
| zustand | 5.x | npmjs.com/package/zustand |
| socket.io | 4.x | npmjs.com/package/socket.io |
| fastify | 5.x | npmjs.com/package/fastify |
| tailwindcss | 4.x | npmjs.com/package/tailwindcss |
| vitest | 2.x | npmjs.com/package/vitest |
| immer | 10.x | npmjs.com/package/immer |
| playwright | 1.x | npmjs.com/package/playwright |

---

## Sources

- Training knowledge through August 2025 (MEDIUM confidence baseline)
- Socket.IO documentation architecture patterns: socket.io/docs/v4
- React 19 release notes: react.dev
- Vite 6 release notes: vitejs.dev
- Zustand documentation: github.com/pmndrs/zustand
- Fastify documentation: fastify.dev
- Tailwind CSS v4 documentation: tailwindcss.com
- Colyseus (considered but not recommended): colyseus.io

**Overall stack confidence: MEDIUM** — All core choices are well-established patterns; specific version numbers need verification before implementation begins.
