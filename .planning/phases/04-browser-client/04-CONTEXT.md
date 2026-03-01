# Phase 4: Browser Client - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

React + SVG browser client that lets a human player create/join a room, play a complete game of Catan against bots with full board visualization, HUD panels, and real-time state sync via Socket.IO. No account system, no mobile optimization, no multiplayer reconnection (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Board visual style
- Flat & clean aesthetic — solid resource colors, crisp SVG shapes, modern minimal look (Colonist.io style)
- Classic Catan color palette: forest green (lumber), light green (wool), gold/yellow (grain), brown/terra (brick), gray/slate (ore), tan (desert)
- Simple geometric shapes for pieces: settlements = small circles or triangles, cities = larger squares or pentagons, roads = thick lines
- Distinct player colors: red, blue, white, orange (matching PieceColor type from game-engine)
- Number tokens: centered white/cream circle in hex center, number in bold, pip dots below, red text for 6 and 8

### HUD layout & density
- Board dominates center, HUD panels around edges: player hand at bottom, scoreboard top or right, game log collapsible sidebar
- Desktop-first layout — responsive can come later
- Resource hand displayed as card icons with count numbers (one icon per resource type, compact and scannable)
- Game log as collapsible sidebar — visible by default, can be collapsed for more board space, shows last 5-10 entries, scrollable for history
- Building cost reference card is toggleable — hidden by default, shown on hover/click of a button (tooltip or floating panel)

### Interaction feedback
- Valid placement locations shown as glowing dots (vertices) and glowing lines (edges) — pulsing or highlighted, clear visual affordance
- Click to place — click a highlighted valid spot to place immediately, no drag and drop
- No confirmation step for placement — click places immediately (faster gameplay, undo too complex with server state)
- Dice rolling with simple animation — brief ~1 second tumble or number reveal animation, then shows final result prominently

### Lobby & game flow
- Simple form landing page: "Create Room" (generates code) and "Join Room" (enter code + display name), no account system
- Waiting room shows room code, player list with names/colors, bot count slider (host only), and "Start Game" button for host
- Victory overlay on win: modal/overlay announcing winner with final scores, board visible behind, "Play Again" returns to lobby
- Tailwind CSS only — no component library, full control over styling, lightweight

### Claude's Discretion
- React project setup (Vite vs Next.js — likely Vite for SPA)
- Zustand store structure and slice organization
- SVG hex grid math and coordinate system
- Socket.IO client connection management
- Component file structure and naming
- Exact spacing, typography, and responsive breakpoints
- Animation implementation details
- Error handling for connection issues

</decisions>

<specifics>
## Specific Ideas

- Board should feel like Colonist.io — clean, readable, functional over flashy
- Player pieces must be clearly distinguishable by color at small sizes
- The 4 player colors (red, blue, white, orange) are already defined in game-engine's PieceColor type

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GameState` type: Fully JSON-serializable state object — client can use directly as Zustand store shape
- `filterStateForPlayer()`: Server already sends filtered state per player — client receives pre-filtered data
- `Action` discriminated union: Client needs to construct and emit these exact types via socket
- `GameEvent` union: Client receives these in `game:state` broadcasts for log entries
- `PieceColor` type: `'red' | 'blue' | 'white' | 'orange'` — predefined player colors
- `Board`, `Hex`, `Vertex`, `Edge` types: Full topology data for SVG rendering
- `TOKEN_PIPS` from scoring.ts: Pip count per number token (for rendering dots)

### Established Patterns
- Socket events: `submit-action` (client→server), `game:state` (server→client), `action:error` (server→client)
- Lobby events: `create-room`, `join-room`, `set-bot-count`, `start-game`, `lobby:state`
- State filtering: Client receives `GameState` with opponent hands zeroed out but card counts derivable from total
- Server injects `playerId` into actions — client sends action type + params, server adds the player identity

### Integration Points
- Socket.IO client connects to server's HTTP port
- Client emits `submit-action` with Action payload (minus playerId — server injects it)
- Client listens for `game:state` with `{ state: GameState, events: GameEvent[] }`
- Client listens for `lobby:state` with `{ roomCode, players[], botCount, started }`
- Client listens for `action:error` with `{ message: string }`

</code_context>

<deferred>
## Deferred Ideas

- Mobile-responsive layout — future enhancement
- Sound effects for dice rolls, placements, trades — future enhancement
- Player-to-player trade UI — requires trade negotiation feature (not in current scope)
- Spectator mode — future phase
- Game replay/history — future enhancement

</deferred>

---

*Phase: 04-browser-client*
*Context gathered: 2026-02-28*
