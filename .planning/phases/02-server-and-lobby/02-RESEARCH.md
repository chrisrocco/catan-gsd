# Phase 2: Server and Lobby - Research

**Researched:** 2026-02-28
**Domain:** Fastify 5 + Socket.IO 4 — real-time game server, room management, state broadcast
**Confidence:** HIGH (stack verified via npm registry; patterns verified via official Socket.IO docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Server Framework & Transport**
- Fastify for HTTP REST endpoints + Socket.IO for real-time WebSocket communication
- Single process: Fastify and Socket.IO share one port
- REST API for room management (create, join, list); WebSocket for gameplay actions and state sync
- Default port 3000, configurable via PORT env var

**State Storage**
- In-memory game state (Map of room code → game session)
- No database persistence — games lost on server restart
- Acceptable for personal use with friends

**Room Lifecycle**
- Room codes: 4-letter uppercase words (e.g., CAKE) — easy to read aloud
- Host migration: if host disconnects, next connected player becomes host
- Auto-expiry: rooms cleaned up after 2 hours of inactivity
- Players pick colors (red/blue/white/orange) in lobby, first come first served

**Game Session Hosting**
- Full GameState broadcast after every action (not diffs) — state is small (~5KB)
- Server-side state filtering: each player receives a personalized view with opponents' hand details stripped (prevents cheating via dev tools)
- GameEvent array broadcast alongside state update — enables client animations and game log
- Invalid actions silently rejected with error event to submitting client only

**Validation & Security**
- All actions validated server-side via existing applyAction dispatcher
- Only active player may submit actions (enforced by game engine FSM)
- Invalid actions return error to submitter, no broadcast to other players

**Package Structure**
- New package: `packages/server`
- Imports `game-engine` as workspace dependency
- Integration tests spin up real Fastify+Socket.IO instance with test clients
- GET /health endpoint for server status and active room count

### Claude's Discretion

- Socket.IO event naming conventions
- Internal room/session class structure
- Error response format details
- Exact health endpoint response shape
- Test helper utilities

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROOM-01 | Player creates a new game room and receives a shareable room code | `generateRoomCode()` function + POST /rooms REST endpoint; room stored in `Map<string, RoomSession>` |
| ROOM-02 | Player joins a game by entering a room code and a display name (no account required) | POST /rooms/:code/join REST endpoint or Socket.IO `join-room` event; display name stored on socket.data |
| ROOM-03 | Host configures the number of bot players (0–3) to fill empty seats before starting | Lobby state on RoomSession; REST PATCH or Socket.IO `set-bot-count` event; enforced before `start-game` |
| ROOM-04 | Lobby displays the list of joined players; host starts the game when ready | `lobby:state` broadcast after every join/leave/config change; `start-game` Socket.IO event from host |
| NET-01 | Server maintains authoritative game state; all client actions validated server-side and rejected if illegal | `applyAction(state, action)` from game-engine is the validation boundary; error returned to submitter only |
| NET-02 | Server broadcasts full game state to all clients in the room after every state change | `io.to(roomCode).emit('game:state', filteredState)` after every successful `applyAction` |
</phase_requirements>

---

## Summary

Phase 2 builds a Fastify 5 HTTP server that shares a port with Socket.IO 4 for real-time gameplay. The server is the single source of truth: it stores all game sessions in memory (a `Map<string, RoomSession>`), validates every player action through the existing `applyAction` dispatcher, and broadcasts filtered state to all players in the room after each change. No persistence layer is needed; rooms expire after 2 hours of inactivity.

The critical ecosystem finding is that the popular `fastify-socket.io` plugin (ducktors) does **not** support Fastify 5 and appears abandoned. The replacement is `fastify-socket` (npm: `fastify-socket@5.1.4`), which declares `peerDependencies: { fastify: ">=4", "socket.io": ">=4" }` and is actively maintained. It provides the same `fastify.io` decorator API with `preClose` and `onClose` lifecycle hooks. Alternatively, Socket.IO can be attached directly to `fastify.server` (the raw Node.js `http.Server` exposed by Fastify) with manual lifecycle hook wiring — this requires no plugin at all.

Testing uses Vitest (already established in the project) with `socket.io-client` to spin up a real server on a random port per test suite. The pattern mirrors the official Socket.IO testing docs and is well-validated in the Node.js ecosystem.

**Primary recommendation:** Use `fastify-socket` (not `fastify-socket.io`) for Fastify 5 + Socket.IO 4 integration. Attach using `fastify.register(fastifySocket, { ...corsOptions })`, access via `fastify.io`. Write integration tests with Vitest + `socket.io-client`, using dynamic port assignment (`fastify.listen({ port: 0 })`).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | `^5.7.4` | HTTP server, REST routes, plugin system | Established in project via STATE.md; Fastify 5 is current major |
| `socket.io` | `^4.8.3` | WebSocket / long-polling transport, rooms, events | Industry standard for Node.js real-time; rooms are a first-class primitive |
| `fastify-socket` | `^5.1.4` | Fastify 5-compatible Socket.IO plugin | `fastify-socket.io` (ducktors) is Fastify-4-only and appears abandoned; `fastify-socket` declares `>=4` peer dep and is actively maintained |
| `fastify-plugin` | `^5.0.1` | Dependency of `fastify-socket`; also used if writing custom plugins | Required for correct Fastify plugin scoping |
| `@catan/game-engine` | `workspace:*` | Game logic, `applyAction`, `GameState`, `Action`, `ActionResult` | The authoritative game dispatcher is already built |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `socket.io-client` | `^4.8.3` | Test client | Integration tests only — never shipped in `packages/server` |
| `bad-words-next` | `^3.2.0` | Profanity filter for room code generation | Needed to screen 4-letter CAKE-style codes against offensive words |
| `@types/node` | `^25.3.3` | Node.js type definitions | Already installed at root; server package needs it too |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fastify-socket` | Raw `new Server(fastify.server)` | No plugin boilerplate, but must manually add `preClose` / `onClose` hooks — adds ~10 lines, acceptable if plugin license is a concern |
| `fastify-socket` | `fastify-socket.io` (ducktors) | DO NOT USE — Fastify 4 only, abandoned per open GitHub issue #180 |
| `bad-words-next` | Hand-rolled word list | Bad-words-next ships a curated multi-language list; hand-rolling misses long-tail offensive words |

**Installation:**
```bash
# In packages/server
npm install fastify socket.io fastify-socket bad-words-next
npm install --save-dev socket.io-client vitest @types/node typescript
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/server/
├── package.json            # "type": "module", imports @catan/game-engine
├── tsconfig.json           # extends ../../tsconfig.base.json
├── src/
│   ├── index.ts            # Entry point: build() → FastifyInstance, main() → listen
│   ├── plugins/
│   │   └── socketio.ts     # fastify-socket registration + typed io decorator
│   ├── routes/
│   │   ├── health.ts       # GET /health → { status, rooms, uptime }
│   │   └── rooms.ts        # POST /rooms, POST /rooms/:code/join
│   ├── game/
│   │   ├── RoomSession.ts  # Class holding GameState + players + metadata
│   │   ├── roomStore.ts    # Map<string, RoomSession> singleton + CRUD helpers
│   │   ├── roomCode.ts     # generateRoomCode() — 4-letter, no profanity
│   │   └── stateFilter.ts  # filterStateForPlayer(state, playerId) → GameState
│   ├── socket/
│   │   ├── lobbyHandlers.ts  # join-room, leave-room, set-bot-count, start-game
│   │   └── gameHandlers.ts   # submit-action → applyAction → broadcast
│   └── types.ts            # Socket.IO event type interfaces (ServerToClient, ClientToServer)
└── src/__tests__/
    ├── helpers.ts          # createTestServer(), connectClient()
    ├── lobby.test.ts       # ROOM-01 through ROOM-04
    └── game.test.ts        # NET-01 and NET-02
```

### Pattern 1: Fastify + Socket.IO Single Port

**What:** Register `fastify-socket` as a Fastify plugin; it attaches Socket.IO to `fastify.server` and decorates the instance with `fastify.io`.
**When to use:** Always — this is the decided architecture.

```typescript
// Source: https://github.com/yubarajshrestha/fastify-socket.io + Fastify 5 docs
import Fastify from 'fastify';
import fastifySocket from 'fastify-socket';
import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types.js';

// Augment FastifyInstance for typed io
declare module 'fastify' {
  interface FastifyInstance {
    io: Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
  }
}

export async function build() {
  const app = Fastify({ logger: true });

  await app.register(fastifySocket, {
    cors: { origin: '*' },  // tighten for production
  });

  // Now fastify.io is available
  app.io.on('connection', (socket) => {
    registerLobbyHandlers(app, socket);
    registerGameHandlers(app, socket);
  });

  await app.register(healthRoutes);
  await app.register(roomRoutes);

  return app;
}

export async function main() {
  const app = await build();
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
}
```

### Pattern 2: Socket.IO TypeScript Event Typing

**What:** Define typed event maps — eliminates string-based event bugs and provides IDE autocomplete.
**When to use:** From the start; retrofitting types is painful.

```typescript
// Source: https://socket.io/docs/v4/typescript/
// packages/server/src/types.ts

import type { GameState, GameEvent } from '@catan/game-engine';

// Events the server sends to clients
export interface ServerToClientEvents {
  'lobby:state': (payload: LobbyState) => void;
  'game:state': (payload: { state: GameState; events: GameEvent[] }) => void;
  'action:error': (payload: { message: string }) => void;
  'room:error': (payload: { message: string }) => void;
}

// Events clients send to the server
export interface ClientToServerEvents {
  'join-room': (payload: { code: string; displayName: string }) => void;
  'set-bot-count': (payload: { count: number }) => void;
  'start-game': () => void;
  'submit-action': (payload: Action) => void;
}

// Data persisted on socket across events (replaces socket.data any-casting)
export interface SocketData {
  roomCode: string | null;
  playerId: string | null;
  displayName: string;
  isHost: boolean;
}

// Server constructor typing
const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(httpServer);
```

### Pattern 3: RoomSession Class

**What:** Encapsulate all per-room state (game state, players, bot count, expiry timer) in a single object stored in a `Map`.
**When to use:** Keeps `roomStore.ts` thin; all mutation happens through `RoomSession` methods.

```typescript
// packages/server/src/game/RoomSession.ts
import type { GameState, Action, ActionResult } from '@catan/game-engine';
import { applyAction } from '@catan/game-engine';

export interface RoomPlayer {
  socketId: string;
  playerId: string;
  displayName: string;
  color: PieceColor;
  isHost: boolean;
  connected: boolean;
}

export class RoomSession {
  readonly code: string;
  players: RoomPlayer[] = [];
  botCount = 0;
  gameState: GameState | null = null;  // null = lobby phase
  started = false;
  private expiryTimer: NodeJS.Timeout;

  constructor(code: string) {
    this.code = code;
    this.resetExpiry();
  }

  applyPlayerAction(action: Action): ActionResult {
    if (!this.gameState) throw new Error('Game not started');
    const result = applyAction(this.gameState, action);
    if (!result.error) {
      this.gameState = result.state;
      this.resetExpiry();
    }
    return result;
  }

  // filterStateFor(playerId): strips opponents' hand contents
  filterStateFor(playerId: string): GameState { ... }

  // Host migration: first connected player after host departs
  promoteNextHost(): void { ... }

  private resetExpiry() {
    clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => roomStore.delete(this.code), 2 * 60 * 60 * 1000);
  }
}
```

### Pattern 4: Per-Player State Filtering

**What:** Before broadcasting, strip opponent hand contents (resources + unplayed dev cards) from `GameState`.
**When to use:** On every `game:state` emit — never send unfiltered state.

```typescript
// packages/server/src/game/stateFilter.ts
import type { GameState } from '@catan/game-engine';

export function filterStateForPlayer(state: GameState, viewingPlayerId: string): GameState {
  const filteredPlayers = Object.fromEntries(
    Object.entries(state.players).map(([id, player]) => {
      if (id === viewingPlayerId) return [id, player];  // own hand: full
      return [id, {
        ...player,
        hand: { lumber: 0, wool: 0, grain: 0, brick: 0, ore: 0 },  // zeroed
        unplayedDevCards: [],   // hidden
        vpDevCards: 0,          // hidden until game-over revealed by GAME_WON event
      }];
    })
  );
  return { ...state, players: filteredPlayers };
}
```

### Pattern 5: Action Handler + Broadcast Loop

**What:** Single Socket.IO event handler that validates, applies, filters, and broadcasts.
**When to use:** This is NET-01 + NET-02 combined.

```typescript
// packages/server/src/socket/gameHandlers.ts
socket.on('submit-action', (action) => {
  const session = roomStore.get(socket.data.roomCode ?? '');
  if (!session?.started) return;

  const result = session.applyPlayerAction(action);

  if (result.error) {
    // Invalid action: error to submitter only (silent to others)
    socket.emit('action:error', { message: result.error });
    return;
  }

  // Broadcast filtered state to each player individually
  for (const player of session.players) {
    const filtered = session.filterStateFor(player.playerId);
    io.to(player.socketId).emit('game:state', {
      state: filtered,
      events: result.events,
    });
  }
});
```

**Note on per-player broadcasts:** The per-player loop (send individually to each socket) is required here because state differs per viewer. This is a known deliberate tradeoff — the `io.to(room).emit()` shortcut cannot be used when content is player-specific. For 4 players and ~5KB state, total bandwidth per action is ~20KB — negligible.

### Pattern 6: Integration Test Setup

**What:** Vitest + `socket.io-client` spins up a real server on port 0 (OS-assigned) per test file.
**When to use:** Always for testing WebSocket interactions.

```typescript
// Source: https://socket.io/docs/v4/testing/ + Vitest adaptation
// packages/server/src/__tests__/helpers.ts
import { io as createClient, type Socket } from 'socket.io-client';
import { build } from '../index.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types.js';

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

export async function createTestServer() {
  const app = await build();
  await app.listen({ port: 0 });  // OS picks port
  const port = (app.server.address() as AddressInfo).port;
  return { app, port };
}

export function connectClient(port: number): TestClient {
  return createClient(`http://localhost:${port}`, {
    transports: ['websocket'],  // skip polling in tests for speed
    autoConnect: false,
  });
}

// In test file:
// beforeAll(async () => { ({ app, port } = await createTestServer()); })
// afterAll(async () => { await app.close(); client.disconnect(); })
```

### Anti-Patterns to Avoid

- **Using `fastify-socket.io` (ducktors):** It is Fastify-4-only and the repo appears abandoned (see GitHub issue #180). Peer dependency conflict will cause `npm install` failure with Fastify 5.
- **Using `socket.id` as the player identifier:** Socket IDs are ephemeral and regenerate on reconnection. Store `playerId` on `socket.data.playerId` (a stable UUID assigned at join time) and use that as the game identity.
- **Broadcasting unfiltered state to all:** `io.to(roomCode).emit('game:state', state)` sends the same object to everyone, leaking opponent hands. Must emit per-socket with filtered state.
- **Mutating GameState in place:** `applyAction` is pure and returns new state. Never mutate `session.gameState` directly — always `session.gameState = result.state`.
- **Listening on a fixed port in tests:** Always use `port: 0` and read the assigned port from `app.server.address()`. Fixed ports cause flaky test failures when the port is in use.
- **Handling `disconnect` synchronously:** Socket.IO fires `disconnect` before the socket leaves rooms. Host migration and reconnection logic should run inside the `disconnect` handler but after `socket.leave()` completes (or use the `disconnecting` event which fires before room departure).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fastify + Socket.IO integration | Custom `fastify.server` attachment + lifecycle hooks | `fastify-socket` plugin | Plugin handles `preClose` (graceful socket disconnect) and `onClose` (server teardown) correctly |
| Offensive word filtering | Manual banned-words array | `bad-words-next` | Curated, multi-language, maintained; hand-rolled lists miss long-tail words and regional slurs |
| Room-to-socket membership | Manual `Map<roomCode, Set<socketId>>` | Socket.IO rooms (`socket.join(code)`) | Socket.IO rooms are a first-class primitive with automatic cleanup on disconnect; no sync bugs |
| WebSocket transport negotiation | Raw `ws` library | Socket.IO (which uses `ws` internally) | Socket.IO adds polling fallback, reconnection logic, event framing, and acknowledgements on top of `ws` |

**Key insight:** Socket.IO rooms handle membership automatically — when a socket disconnects, it is automatically removed from all rooms. Building a parallel `Map<room, Set<socket>>` duplicates this and creates sync bugs.

---

## Common Pitfalls

### Pitfall 1: `fastify-socket.io` (ducktors) vs `fastify-socket`

**What goes wrong:** `npm install fastify-socket.io socket.io` with Fastify 5 produces a peer dependency warning/error. The plugin registers but may fail at runtime due to internal API changes between Fastify 4 and 5.
**Why it happens:** `fastify-socket.io` declares `peerDependencies: { fastify: "4.x.x" }` and the repo appears to have gone inactive (last release August 2024, open Fastify 5 issue since October 2024).
**How to avoid:** Use `fastify-socket` (npm: `fastify-socket@5.1.4`), which declares `fastify: ">=4"`.
**Warning signs:** `npm install` peer dependency conflict on `fastify@5.x.x` vs required `4.x.x`.

### Pitfall 2: Socket ID as Player Identity

**What goes wrong:** Player reconnects after network drop; server creates a new `socket.id`; the old player entry is still in the room with the old socket ID; broadcast goes to dead socket; player sees no updates.
**Why it happens:** Socket.IO's `socket.id` is a connection-scoped ephemeral ID, not a session ID. It changes on every reconnect.
**How to avoid:** Assign a stable `playerId` (UUID or hash of displayName+roomCode) at join time and store it on `socket.data.playerId`. Use `playerId` everywhere in game logic; use `socketId` only for targeted `io.to(socketId).emit()` calls.
**Warning signs:** Player rejoins and sees stale lobby or missing game state.

### Pitfall 3: Forgetting `disconnecting` vs `disconnect` for Host Migration

**What goes wrong:** In the `disconnect` handler, `socket.rooms` is already empty — the socket has already left all rooms. Code checking which room the player was in finds nothing.
**Why it happens:** Socket.IO fires `disconnect` after room departure. The `disconnecting` event fires before.
**How to avoid:** Use `socket.on('disconnecting', ...)` to read `socket.rooms` and trigger host migration. Use `socket.on('disconnect', ...)` only for final cleanup where room membership is not needed.
**Warning signs:** Host migration logic finds empty `socket.rooms` set and silently fails to promote next host.

### Pitfall 4: `io.to(room).emit()` Leaks Opponent Hands

**What goes wrong:** Broadcast sends full GameState to all players in the room. Players can inspect WebSocket frames in browser dev tools and see opponent resource hands.
**Why it happens:** `io.to(roomCode).emit('game:state', state)` sends the same object to every socket in the room.
**How to avoid:** Loop over `session.players`, call `filterStateForPlayer(state, player.playerId)` for each, emit to `io.to(player.socketId)` individually.
**Warning signs:** In tests, asserting that a player cannot see opponent hands — the assert passes but a browser network inspector shows hand data in the raw payload.

### Pitfall 5: Race Condition Between REST Join and Socket Connect

**What goes wrong:** Client calls `POST /rooms/:code/join` (REST) to get a `playerId`, then connects via Socket.IO. Between these two steps, another client grabs the last seat. The socket connect succeeds but the room is now full.
**Why it happens:** REST join and Socket.IO join are two separate round-trips; the room capacity check happens at REST time but the seat is not held.
**How to avoid:** One of two approaches: (a) do ALL joining over Socket.IO (no REST join endpoint); (b) use a reservation token — REST join returns a token that the Socket.IO handshake must present within N seconds. Given the phase decisions favor REST for room management, option (a) may be simpler for a 4-player friends-only game with low concurrency.
**Warning signs:** Intermittent "room full" errors visible only under concurrent load.

### Pitfall 6: Server Not Closing in Tests

**What goes wrong:** Vitest test suite hangs after tests complete; `--forceExit` is added as a workaround.
**Why it happens:** Socket.IO keeps the Node.js event loop alive with open connections if `io.close()` / `app.close()` is not called.
**How to avoid:** In `afterAll`, call `await app.close()` (which triggers `fastify-socket`'s `onClose` hook, closing Socket.IO). Disconnect all test clients with `client.disconnect()` before or after. Never use `--forceExit` in CI.
**Warning signs:** `vitest run` command does not exit; `--reporter=verbose` shows all tests passed but process hangs.

---

## Code Examples

### Room Code Generator (4-letter, no profanity)

```typescript
// Source: Pattern derived from bad-words-next docs + charset design
// packages/server/src/game/roomCode.ts
import { BadWordsNext } from 'bad-words-next';
import en from 'bad-words-next/data/en.json' assert { type: 'json' };

const filter = new BadWordsNext({ data: en });

// Consonant-vowel alternation: CVCV pattern → pronounceable, less likely to form words
const CONSONANTS = 'BCDFGHJKLMNPRSTVWXZ';
const VOWELS = 'AEIOU';

function randomLetter(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)];
}

export function generateRoomCode(existingCodes: Set<string>, maxAttempts = 100): string {
  for (let i = 0; i < maxAttempts; i++) {
    const code = [
      randomLetter(CONSONANTS),
      randomLetter(VOWELS),
      randomLetter(CONSONANTS),
      randomLetter(VOWELS),
    ].join('');
    if (!existingCodes.has(code) && !filter.check(code)) {
      return code;
    }
  }
  throw new Error('Could not generate a unique clean room code — increase charset or retry');
}
```

### Health Endpoint

```typescript
// packages/server/src/routes/health.ts
import type { FastifyPluginAsync } from 'fastify';
import { roomStore } from '../game/roomStore.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => ({
    status: 'ok',
    rooms: roomStore.size,
    uptime: Math.floor(process.uptime()),
  }));
};

export default healthRoutes;
```

### Lobby Broadcast Helper

```typescript
// packages/server/src/socket/lobbyHandlers.ts
function broadcastLobbyState(io: Server, session: RoomSession): void {
  const lobbyState: LobbyState = {
    code: session.code,
    players: session.players.map(p => ({
      playerId: p.playerId,
      displayName: p.displayName,
      color: p.color,
      isHost: p.isHost,
      connected: p.connected,
    })),
    botCount: session.botCount,
    started: session.started,
  };
  io.to(session.code).emit('lobby:state', lobbyState);
}
```

### Integration Test Skeleton

```typescript
// Source: https://socket.io/docs/v4/testing/ + Vitest pattern
// packages/server/src/__tests__/lobby.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as createClient } from 'socket.io-client';
import { createTestServer } from './helpers.js';

describe('ROOM-01: Create room', () => {
  let app: Awaited<ReturnType<typeof createTestServer>>['app'];
  let port: number;

  beforeAll(async () => {
    ({ app, port } = await createTestServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a 4-letter room code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const body = response.json<{ code: string; playerId: string }>();
    expect(response.statusCode).toBe(201);
    expect(body.code).toMatch(/^[A-Z]{4}$/);
  });

  it('two clients in the same room both receive lobby:state', async () => {
    // Create room
    const createRes = await app.inject({ method: 'POST', url: '/rooms', body: { displayName: 'Alice' } });
    const { code } = createRes.json<{ code: string }>();

    // Two clients connect and join
    const client1 = createClient(`http://localhost:${port}`, { transports: ['websocket'] });
    const client2 = createClient(`http://localhost:${port}`, { transports: ['websocket'] });

    const bothReceived = new Promise<void>((resolve) => {
      let count = 0;
      const onState = () => { if (++count === 2) resolve(); };
      client1.on('lobby:state', onState);
      client2.on('lobby:state', onState);
    });

    client1.connect();
    client2.connect();
    await new Promise(r => setTimeout(r, 50));  // let connections establish
    client1.emit('join-room', { code, displayName: 'Alice' });
    client2.emit('join-room', { code, displayName: 'Bob' });

    await expect(bothReceived).resolves.toBeUndefined();
    client1.disconnect();
    client2.disconnect();
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fastify-socket.io` (ducktors) for Fastify+Socket.IO | `fastify-socket` (yubarajshrestha) | Fastify 5 release (Oct 2024) | Must use `fastify-socket`; old plugin has unresolved Fastify 5 peer dep conflict |
| Socket.IO `socket.id` as session identity | Stable UUID assigned at join, stored on `socket.data` | Socket.IO 4.6+ (connection state recovery docs) | Socket IDs are explicitly documented as ephemeral; use `socket.data` for app-level session state |
| Per-tick game state diffs | Full state broadcast (decided by user) | N/A — design choice | Simpler server logic; ~5KB per event is fine for friends-only use; no diff merge bugs |
| Callback-based acknowledgement pattern | `emitWithAck()` async/await | Socket.IO 4.6+ | Cleaner test assertions; prefer `await socket.emitWithAck('event', payload)` in tests |

**Deprecated/outdated:**
- `fastify-socket.io` (npm: `fastify-socket.io`): Fastify 4 only, repo appears inactive since August 2024. Open GitHub issue #180 (Fastify 5 support) has no resolution as of February 2026.
- `socket.io-mock-ts`: A mock library for Socket.IO in Vitest — not needed when the integration test pattern spins up a real server on port 0. Real server tests are more valuable than mocked ones for this phase.

---

## Open Questions

1. **Room code strategy: REST-first vs Socket-first join**
   - What we know: CONTEXT.md says REST for room management; Socket.IO for gameplay. A REST `POST /rooms/:code/join` creates the player record before the WebSocket connects.
   - What's unclear: If the client crashes between REST join and Socket.IO connect, the seat is occupied but no socket holds it. For 4-player friends-only with low concurrency, this is low risk.
   - Recommendation: Implement REST join with a 30-second reservation window (player record is "pending" until socket connects and claims it). If socket does not connect in 30 seconds, evict the reservation. Alternatively, simplify by doing join entirely over Socket.IO — one round-trip instead of two.

2. **`bad-words-next` ESM compatibility**
   - What we know: `packages/server` will use `"type": "module"`. `bad-words-next@3.2.0` is a modern package; need to verify JSON data file import works with `assert { type: 'json' }` or `with { type: 'json' }` in Node.js 20+.
   - What's unclear: Whether Node.js import assertions vs import attributes syntax applies (Node 22 changed from `assert` to `with`).
   - Recommendation: Verify at package setup time. Fallback: copy the word list into a `.ts` file as a plain array — avoids the JSON import syntax issue entirely.

3. **State filtering: `vpDevCards` during active game vs game-over reveal**
   - What we know: The `GAME_WON` event includes `finalVP`; `vpDevCards` is a count in `Player`. The filter zeroes `vpDevCards` for opponents.
   - What's unclear: At game-over, should the filter be lifted so all players see everyone's final hand? The `GAME_WON` event already carries `finalVP`. Lifting the filter post-win is a UX decision (show scores) but leaks internal state.
   - Recommendation: Keep filter active throughout. The `GAME_WON` GameEvent carries enough information. The client can derive final scores from the event alone.

---

## Validation Architecture

*(nyquist_validation is not set in config.json — this section documents the test plan as specified in CONTEXT.md)*

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.17 (established in Phase 1) |
| Config file | `packages/server/vitest.config.ts` (Wave 0 gap — must be created) |
| Quick run command | `npm test --workspace=packages/server` |
| Full suite command | `npm test --workspace=packages/server -- --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File |
|--------|----------|-----------|------|
| ROOM-01 | POST /rooms returns 4-letter code + playerId | integration | `lobby.test.ts` |
| ROOM-02 | POST /rooms/:code/join with displayName joins successfully | integration | `lobby.test.ts` |
| ROOM-03 | Host sets botCount 0–3; non-hosts cannot set | integration | `lobby.test.ts` |
| ROOM-04 | Lobby:state broadcasts to all on join/leave/config change; host-only start-game | integration | `lobby.test.ts` |
| NET-01 | Invalid action rejected with action:error to submitter only; state unchanged | integration | `game.test.ts` |
| NET-02 | Valid action triggers game:state to all room players with filtered hands | integration | `game.test.ts` |

### Wave 0 Gaps

- [ ] `packages/server/vitest.config.ts` — configure Vitest for ESM, Node environment
- [ ] `packages/server/src/__tests__/helpers.ts` — `createTestServer()` and `connectClient()` utilities
- [ ] `packages/server/package.json` — `"test": "vitest run"` script

---

## Sources

### Primary (HIGH confidence)

- npm registry (`npm show fastify version`, `npm show socket.io version`, `npm show fastify-socket version`, `npm show socket.io-client version`) — all version numbers verified live
- npm registry (`npm show fastify-socket peerDependencies`) — verified `fastify: ">=4"` peer dep, Fastify 5 compatible
- https://socket.io/docs/v4/typescript/ — Socket.IO 4 TypeScript interfaces (ServerToClientEvents, ClientToServerEvents, SocketData)
- https://socket.io/docs/v4/rooms/ — Socket.IO rooms API (join, to, except, auto-cleanup on disconnect)
- https://socket.io/docs/v4/testing/ — Official Vitest integration test pattern (beforeAll/afterAll, port 0, emitWithAck)
- https://socket.io/docs/v4/server-options/ — CORS, transports, pingInterval, pingTimeout
- https://fastify.dev/docs/latest/Reference/TypeScript/ — Fastify 5 TypeScript plugin patterns, declaration merging, FastifyPluginAsync
- https://fastify.dev/docs/latest/Reference/Server/ — `fastify.server` property (raw Node.js http.Server)
- https://github.com/ducktors/fastify-socket.io/issues/180 — Confirmed: `fastify-socket.io` does not support Fastify 5; repo described as abandoned

### Secondary (MEDIUM confidence)

- https://github.com/yubarajshrestha/fastify-socket.io — `fastify-socket` README: API mirrors `fastify-socket.io` with `fastify.io` decorator, `preClose`/`onClose` hooks. Verified via npm peerDependencies.
- WebSearch results confirming Socket.IO connection state recovery docs (socket.id is ephemeral, stable identity must come from application layer)

### Tertiary (LOW confidence)

- `bad-words-next` ESM/JSON import compatibility with Node.js 22 import attributes syntax — flagged as Open Question #2; needs verification at package setup time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified live from npm registry
- Architecture: HIGH — patterns derived from official Socket.IO docs and Fastify TypeScript docs
- fastify-socket plugin: MEDIUM — npm peerDeps verified, README reviewed; live Fastify 5 test not run
- Pitfalls: HIGH — `disconnecting` vs `disconnect`, socket.id ephemerality, and filter leak are all documented in official Socket.IO sources
- bad-words-next ESM compatibility: LOW — flagged as open question

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable stack; Socket.IO 4.x and Fastify 5.x are mature)
