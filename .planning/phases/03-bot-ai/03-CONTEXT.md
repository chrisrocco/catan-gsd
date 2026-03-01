# Phase 3: Bot AI - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side bot players that participate in complete Catan games, making legal and strategically reasonable decisions without human input. Bots handle all game phases: initial placement, rolling, building, trading (bank/port), robber placement, dev card usage, and end turn. Player-to-player trading and difficulty levels are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Strategy depth
- Single heuristic level — one bot personality with weighted-scoring evaluation
- Some randomness: top 2-3 scored options with weighted random selection to prevent scripted-feeling games
- Subtle weight variations per bot instance for variety (same core logic, slightly randomized priorities)
- Difficulty levels deferred to a future phase

### Settlement placement
- Probability-first for initial placement: prioritize high pip count (6/8/5/9), then diversify resources as tiebreaker
- Port access as a bonus factor in vertex scoring (not a primary driver)
- Goal-directed mid-game expansion: bot identifies best unoccupied vertices and builds roads toward them
- Context-dependent city vs settlement priority: score both options (cities = 2 VP + double production, settlements = new hex access), pick whichever scores higher

### Robber targeting
- Target the leader: move robber to the hex most productive for the highest-VP player
- Classic Catan strategy, straightforward to implement

### Trading behavior
- Bank/port trades only — no player-to-player negotiation (matches BOT-04 scope)
- Need-based triggers: bot identifies what it needs to build next, trades excess resources toward that goal
- Proactive 7-card avoidance: trade down when holding 6+ cards and can't build
- Smart discarding on 7: keep resources needed for current build goal, discard the rest

### Bot turn mechanics
- Instant execution — no artificial delays (Phase 4 can add visual delays later)
- Server-triggered: after any state change, server checks if activePlayer is a bot and immediately runs the bot's turn
- Bot logic lives in packages/server/ (server-side actors importing game-engine types)
- Headless test harness: ability to run 4 bots through a full game with no server/sockets for isolated testing and simulation

### Claude's Discretion
- Exact scoring formula weights and parameters
- Dev card play timing heuristics (when to play knight vs hold, monopoly resource choice)
- Road building card path selection
- Year of plenty resource selection logic
- Turn action ordering (when to trade before building, etc.)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `applyAction(state, action)`: Central dispatcher in game-engine — bot submits actions through same interface as human players
- `isActionLegalInPhase(phase, actionType)`: FSM validation — bot can check what actions are legal before choosing
- `Action` discriminated union: All 12 action types defined with exact payloads bot needs to construct
- `GameState`: Full game state is JSON-serializable — bot has complete information to evaluate
- `ActionResult`: Returns new state + events + optional error — bot can detect and recover from rejected actions

### Established Patterns
- Immutable state: `applyAction` never mutates input, returns new state — safe for bot evaluation/simulation
- Player IDs: Bots already use `bot-0`, `bot-1`, `bot-2` IDs (from `RoomSession.startGame()`)
- `connected` flag: `gameHandlers.ts` already skips disconnected/bot players for socket broadcasts

### Integration Points
- `RoomSession.startGame()`: Already creates bot player IDs and includes them in playerOrder
- `gameHandlers.ts`: After processing a human action, this is where bot turn triggering should hook in
- `Board.vertices` / `Board.edges`: Bot needs to iterate these to find valid placement locations
- `Player.hand` / `Player.unplayedDevCards`: Bot reads own resources and dev cards to decide actions

</code_context>

<deferred>
## Deferred Ideas

- Player-to-player trade negotiation — future phase or Phase 5 polish
- Multiple difficulty levels (easy/medium/hard) — future enhancement
- Bot personality profiles (aggressive builder, port trader, dev card hoarder) — future enhancement

</deferred>

---

*Phase: 03-bot-ai*
*Context gathered: 2026-02-28*
