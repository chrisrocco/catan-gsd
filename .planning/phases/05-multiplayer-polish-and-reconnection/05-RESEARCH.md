# Phase 5: Multiplayer Polish and Reconnection - Research

**Researched:** 2026-02-28
**Domain:** WebSocket reconnection, session management, real-time state sync
**Confidence:** HIGH

## Summary

Phase 5 adds reconnection/rejoin handling to the existing Socket.IO server and React client. The core challenge is differentiating lobby disconnects (remove player) from in-game disconnects (mark disconnected, start grace period). The existing codebase already has `RoomPlayer.connected` boolean, `filterStateForPlayer()`, and broadcast loops that skip disconnected players — reconnection primarily needs to flip the flag back and re-send state.

The second concern is session token management. The server issues a token on join, the client stores it in sessionStorage, and on reconnect the client presents the token to re-authenticate. Socket.IO's built-in reconnection handles transport-level reconnects, but app-level rejoin (new socket after tab close/refresh) requires a custom `rejoin-room` event.

**Primary recommendation:** Implement reconnection in two layers: (1) server-side disconnect/reconnect lifecycle with grace period timers, (2) client-side token persistence and reconnection UI overlay.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 5-minute grace period for reconnection — long enough for refresh/tab close, short enough to not stall games indefinitely
- When disconnected player's turn comes: wait 30-60 seconds for reconnect, then auto-end their turn and move to next player
- After grace period expires without reconnect: bot takes over the disconnected player's slot permanently
- On successful reconnect: send full current filtered game state immediately, no replay of missed actions
- Session token issued by server on initial join, stored client-side
- Client sends token on rejoin to verify identity — no name guessing
- Token stored in sessionStorage — survives page refresh within same tab, lost when tab is closed
- Same browser only — no cross-device rejoin support (matches token-based approach)
- Inline "disconnected" badge/icon next to player's name in scoreboard — no popup disruption
- Visible countdown timer when a disconnected player's turn is being waited on (e.g., "30s remaining")
- Reconnecting player sees semi-transparent overlay on game board: "Reconnecting..." with spinner, board still visible underneath
- Key validation scenario: 2 humans + 2 bots playing a full game to completion
- Automated Socket.IO integration test for reconnection flow (disconnect/reconnect/state delivery)

### Claude's Discretion
- Token generation strategy (UUID, crypto random, etc.)
- Server-side disconnect detection timing
- How to handle the "disconnecting" event vs socket timeout distinction
- Grace period timer implementation details
- Bot takeover transition mechanics
- Turn timeout implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NET-03 | Player who disconnects can rejoin the in-progress game using the original room code and display name | Session token auth, `rejoin-room` event, `markDisconnected()`/`reconnectPlayer()` on RoomSession, grace period timer, client reconnection overlay |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | 4.8.x | Already in use — WebSocket transport with rooms | Already installed, provides disconnect events, room management |
| crypto (Node built-in) | N/A | Token generation via `crypto.randomUUID()` | No external dependency, cryptographically random, already used in lobbyHandlers |
| zustand | 5.x | Already in use — client state management | Already installed, stores reconnection state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.x | Already in use — test framework | Reconnection integration tests |

### Alternatives Considered
None — this phase uses only existing dependencies. No new packages needed.

## Architecture Patterns

### Recommended Changes to Existing Structure
```
packages/server/src/
├── game/
│   └── RoomSession.ts      # Add markDisconnected(), reconnectPlayer(), grace period timer
├── socket/
│   ├── lobbyHandlers.ts     # Modify disconnecting handler for in-game state
│   └── gameHandlers.ts      # No changes needed (broadcast already skips disconnected)
└── types.ts                 # Add rejoin-room event, session token to SocketData

packages/client/src/
├── socket/
│   └── client.ts            # Add rejoinRoom(), token storage, reconnection logic
├── store/
│   └── gameStore.ts         # Add reconnection state (isReconnecting, disconnectedPlayers)
└── components/
    ├── hud/
    │   └── Scoreboard.tsx   # Add disconnected badge, turn timeout countdown
    └── board/
        └── ReconnectOverlay.tsx  # New: semi-transparent reconnection overlay
```

### Pattern 1: Two-Phase Disconnect Handling
**What:** Differentiate lobby disconnect (remove player) from in-game disconnect (mark disconnected).
**When to use:** In the `disconnecting` event handler.
**Example:**
```typescript
socket.on('disconnecting', () => {
  const session = roomStore.get(socket.data.roomCode);
  if (!session) return;

  if (session.started && session.gameState) {
    // In-game: mark as disconnected, start grace period
    session.markDisconnected(socket.data.playerId);
    // Start 5-minute grace period timer
  } else {
    // Lobby: remove player entirely (existing behavior)
    session.removePlayer(socket.data.playerId);
  }
});
```

### Pattern 2: Token-Based Rejoin
**What:** Server issues a session token on join, client stores in sessionStorage, presents on rejoin.
**When to use:** New `rejoin-room` socket event.
**Example:**
```typescript
// Server: on initial join, generate and return token
const sessionToken = crypto.randomUUID();
session.setPlayerToken(playerId, sessionToken);
callback({ ok: true, playerId, sessionToken });

// Client: store in sessionStorage
sessionStorage.setItem('catan-session-token', sessionToken);

// Server: rejoin-room handler
socket.on('rejoin-room', ({ code, sessionToken }, callback) => {
  const session = roomStore.get(code);
  const player = session?.findPlayerByToken(sessionToken);
  if (player && !player.connected) {
    session.reconnectPlayer(player.playerId, socket.id);
    // Send current filtered state
  }
});
```

### Pattern 3: Grace Period with Turn Timeout
**What:** 5-minute window for reconnect. If disconnected player's turn arrives, 30s countdown then auto-skip.
**When to use:** When a disconnect is detected during a game.
**Example:**
```typescript
// RoomSession manages grace period
markDisconnected(playerId: string): void {
  const player = this.players.find(p => p.playerId === playerId);
  if (player) {
    player.connected = false;
    this.disconnectTimers.set(playerId, setTimeout(() => {
      this.convertToBot(playerId);
    }, 5 * 60 * 1000)); // 5 minutes
  }
}

// Turn timeout when disconnected player is active
startTurnTimeout(playerId: string, io: Server): void {
  this.turnTimer = setTimeout(() => {
    // Auto-end turn via END_TURN action
    this.applyPlayerAction({ type: 'END_TURN', playerId });
    // Broadcast + trigger next player
  }, 30 * 1000);
}
```

### Pattern 4: Bot Takeover
**What:** After grace period expires, convert disconnected player slot to bot.
**When to use:** When the 5-minute grace period timer fires.
**Example:**
```typescript
convertToBot(playerId: string): void {
  // Remove from human players list
  this.players = this.players.filter(p => p.playerId !== playerId);
  // Bot infrastructure already handles bot-* prefixed IDs
  // For takeover: just mark the player as a bot so chooseBotAction picks them up
  // Option: add playerId to a botTakeover set that getBotToAct checks
}
```

### Anti-Patterns to Avoid
- **Replaying missed actions:** Context decision says send full current state, no replay. Don't build an event log replay system.
- **Complex handshake protocols:** A single token + room code is sufficient. Don't build multi-step auth.
- **Client-side state reconciliation:** Server is authoritative. On reconnect, replace entire client state with server state, don't try to merge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random string | `crypto.randomUUID()` | Already used in codebase, cryptographically secure |
| Timer management | Manual setInterval tracking | `setTimeout` with Map<playerId, NodeJS.Timeout> | Simple, clearable, per-player |
| Transport reconnection | Custom WebSocket reconnect | Socket.IO built-in reconnection | Handles exponential backoff, transport fallback |

## Common Pitfalls

### Pitfall 1: Race Condition Between Disconnect and Rejoin
**What goes wrong:** Player disconnects and immediately reconnects. Old disconnect handler fires after new connection is established.
**Why it happens:** Socket.IO `disconnecting` event may fire asynchronously relative to a new connection.
**How to avoid:** In `rejoin-room`, cancel any pending grace period timer before marking reconnected. Check if player is already connected.
**Warning signs:** Player appears disconnected after successful reconnect.

### Pitfall 2: Turn Timer Not Cancelled on Reconnect
**What goes wrong:** Player reconnects but the 30s turn timeout still fires and auto-skips their turn.
**Why it happens:** Timer reference not cleared when player reconnects.
**How to avoid:** Store timer references in a Map, clear on reconnect.
**Warning signs:** Turn skipped despite player being online.

### Pitfall 3: Bot Takeover with Active Turn
**What goes wrong:** Grace period expires while it's the disconnected player's turn. Bot takes over mid-turn in an unknown phase state.
**Why it happens:** Bot needs to handle arbitrary game phases, not just the start of a turn.
**How to avoid:** When converting to bot, if it's currently their turn, let `chooseBotAction` handle the current state as-is. The bot logic already handles all game phases.
**Warning signs:** Game gets stuck after bot takeover.

### Pitfall 4: sessionStorage vs localStorage
**What goes wrong:** Token persists across sessions if stored in localStorage, allowing stale reconnections.
**Why it happens:** Using wrong storage API.
**How to avoid:** Use `sessionStorage` as decided — survives refresh but not tab close. This is the correct behavior per user decision.
**Warning signs:** Players reconnecting to games that ended hours ago.

### Pitfall 5: Socket Room Membership Lost
**What goes wrong:** Reconnected player doesn't receive broadcasts because they're not in the Socket.IO room.
**Why it happens:** New socket connection doesn't auto-join rooms.
**How to avoid:** In `rejoin-room` handler, explicitly `socket.join(roomCode)` after authentication.
**Warning signs:** Reconnected player sees stale state after other players act.

## Code Examples

### Existing Code Integration Points

**lobbyHandlers.ts disconnect handler (line 122)** — currently calls `session.removePlayer()` unconditionally:
```typescript
// CURRENT: removes player always
session.removePlayer(playerId);

// NEEDED: differentiate lobby vs in-game
if (session.started && session.gameState) {
  session.markDisconnected(playerId);
} else {
  session.removePlayer(playerId);
}
```

**RoomSession.addPlayer** returns the new player — reconnect needs a different path:
```typescript
// New method on RoomSession
reconnectPlayer(playerId: string, newSocketId: string): RoomPlayer | null {
  const player = this.players.find(p => p.playerId === playerId);
  if (!player) return null;
  player.socketId = newSocketId;
  player.connected = true;
  // Clear grace period timer
  const timer = this.disconnectTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    this.disconnectTimers.delete(playerId);
  }
  this.touch();
  return player;
}
```

**Client reconnection on page load:**
```typescript
// On app initialization, check for existing session
const savedToken = sessionStorage.getItem('catan-session-token');
const savedRoom = sessionStorage.getItem('catan-room-code');
if (savedToken && savedRoom) {
  // Attempt rejoin
  socket.emit('rejoin-room', { code: savedRoom, sessionToken: savedToken }, (response) => {
    if (response.ok) {
      // Restore game state from server response
    } else {
      // Clear stale session data
      sessionStorage.removeItem('catan-session-token');
      sessionStorage.removeItem('catan-room-code');
    }
  });
}
```

### Turn Timeout Broadcast
```typescript
// Server broadcasts countdown to all players when disconnected player's turn arrives
io.to(roomCode).emit('turn:timeout', {
  playerId: disconnectedPlayerId,
  remainingSeconds: 30,
});
// Client shows countdown in scoreboard next to that player's name
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual WebSocket reconnect | Socket.IO reconnection option | Socket.IO 3.x+ | Transport reconnect is automatic; app-level rejoin still needs custom event |
| Cookie-based sessions | Token in sessionStorage | Modern SPAs | Simpler, no CORS cookie issues, appropriate for this use case |

## Open Questions

1. **Turn timeout for complex phases**
   - What we know: 30s timeout for simple turn skip works for normal turns
   - What's unclear: What happens if disconnected player needs to discard (7 rolled)? Do we auto-discard for them?
   - Recommendation: Auto-discard random cards for disconnected player (same as what a bot would do). The `chooseBotAction` already handles discard phase.

2. **Multiple disconnects during same game**
   - What we know: Each player gets independent grace period
   - What's unclear: What if all human players disconnect?
   - Recommendation: Game continues with bots. If all humans disconnect and grace periods expire, room eventually expires via existing SESSION_TTL_MS (2 hours).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/server/src/` — all socket handlers, RoomSession, types
- Codebase analysis: `packages/client/src/` — socket client, Zustand store, components
- Socket.IO docs — reconnection options, room membership

### Secondary (MEDIUM confidence)
- sessionStorage API behavior — MDN documentation on session scope

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing
- Architecture: HIGH - clear integration points identified in existing code
- Pitfalls: HIGH - patterns well-understood from codebase analysis

**Research date:** 2026-02-28
**Valid until:** 2026-03-28
