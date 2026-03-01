# Phase 5: Multiplayer Polish and Reconnection - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Reconnection/rejoin handling for players who disconnect mid-game, plus end-to-end multiplayer polish ensuring humans and bots can play complete games together with real-time state sync. No new game features, no account system, no matchmaking.

</domain>

<decisions>
## Implementation Decisions

### Reconnection behavior
- 5-minute grace period for reconnection — long enough for refresh/tab close, short enough to not stall games indefinitely
- When disconnected player's turn comes: wait 30-60 seconds for reconnect, then auto-end their turn and move to next player
- After grace period expires without reconnect: bot takes over the disconnected player's slot permanently
- On successful reconnect: send full current filtered game state immediately, no replay of missed actions

### Rejoin identity
- Session token issued by server on initial join, stored client-side
- Client sends token on rejoin to verify identity — no name guessing
- Token stored in sessionStorage — survives page refresh within same tab, lost when tab is closed
- Same browser only — no cross-device rejoin support (matches token-based approach)

### Disconnection UX
- Inline "disconnected" badge/icon next to player's name in scoreboard — no popup disruption
- Visible countdown timer when a disconnected player's turn is being waited on (e.g., "30s remaining")
- Reconnecting player sees semi-transparent overlay on game board: "Reconnecting..." with spinner, board still visible underneath

### End-to-end multiplayer testing
- Key validation scenario: 2 humans + 2 bots playing a full game to completion
- Automated Socket.IO integration test for reconnection flow (disconnect/reconnect/state delivery)

### Claude's Discretion
- Token generation strategy (UUID, crypto random, etc.)
- Server-side disconnect detection timing
- How to handle the "disconnecting" event vs socket timeout distinction
- Grace period timer implementation details
- Bot takeover transition mechanics
- Turn timeout implementation details

</decisions>

<specifics>
## Specific Ideas

- The current `lobbyHandlers.ts` disconnecting handler calls `session.removePlayer()` which fully removes the player — this needs to change to mark as disconnected instead of removing during an active game
- `RoomPlayer.connected` boolean already exists in the type system — reconnection can toggle this flag
- `gameHandlers.ts` already skips `!player.connected` for broadcasts — reconnection just needs to flip the flag and re-send state

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RoomPlayer.connected: boolean` — already tracks connection status per player
- `filterStateForPlayer()` — server already filters state per player, can be used on reconnect
- `gameHandlers.ts` broadcast loop — already skips disconnected players, will auto-include on reconnect
- `RoomSession.promoteNextHost()` — handles host disconnection in lobby, may need adjustment for in-game
- Bot infrastructure (BotPlayer, botRunner) — can be reused for bot takeover of disconnected player slots

### Established Patterns
- Socket events: `lobby:state`, `game:state`, `action:error` — reconnect can reuse these
- `socket.data` stores `roomCode`, `playerId`, `isHost` — reconnect needs to restore these
- `roomStore` maps room codes to sessions — reconnect looks up existing session

### Integration Points
- `lobbyHandlers.ts:122` disconnecting handler — needs to differentiate lobby disconnect vs in-game disconnect
- `RoomSession.removePlayer()` — needs a companion `markDisconnected()` for in-game disconnects
- Client Zustand store — needs reconnection state management (connecting, reconnecting, connected)
- Client Socket.IO — needs auto-reconnect with token handshake

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-multiplayer-polish-and-reconnection*
*Context gathered: 2026-02-28*
