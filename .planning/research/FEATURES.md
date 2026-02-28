# Feature Landscape

**Domain:** Browser-based multiplayer board game (Catan base game clone)
**Researched:** 2026-02-28
**Confidence note:** HIGH confidence on Catan rules (well-documented). MEDIUM confidence on ecosystem
comparisons (web search restricted; based on training knowledge of colonist.io, catan.com, BoardGameArena,
and open-source implementations through mid-2025).

---

## Table Stakes

Features the game cannot function without. Missing any of these = broken game.

### Core Game Rules

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hex board generation | The board IS the game | Medium | 19 land hexes, 9 sea hexes w/ 6 ports, standard or randomized layout |
| Randomized tile + number placement | Every game different; core Catan identity | Low | Must respect recommended number placement rules (red numbers not adjacent) |
| Settlement and city placement on vertices | Fundamental build mechanic | Medium | Vertex intersection detection on hex grid |
| Road placement on edges | Fundamental build mechanic | Medium | Edge adjacency to own roads/settlements |
| Initial placement phase (2 rounds, reverse turn order) | Rules-required setup | Medium | Round 2 is reversed; player 2 gets two starting settlements before player 1's second |
| Dice roll and resource distribution | Core game loop each turn | Medium | All settlements/cities adjacent to rolled number collect resources |
| Robber mechanic on 7 or knight | Major strategic element | Medium | Mover discards if >7 cards, moves robber, steals from adjacent player |
| Development card deck (fixed composition) | Core strategic tool | Medium | 14 knights, 5 VP, 2 monopoly, 2 year of plenty, 2 road building; shuffle once at game start |
| Play development card (once per turn, not same turn bought) | Rules enforcement | Low | State flag: "card bought this turn"; VP cards auto-count, never played explicitly |
| Bank trading (4:1) | Core economic mechanism | Low | Always available; requires 4 matching resources |
| Port trading (2:1 and 3:1) | Core economic mechanism | Low | Requires settlement/city on port vertex |
| Resource cost enforcement (road, settlement, city) | Rule enforcement | Low | Road: 1 brick + 1 lumber; Settlement: 1 each of all 4; City: 2 wheat + 3 ore; Dev card: 1 ore + 1 wheat + 1 sheep |
| Longest road tracking (5+ continuous, ties keep holder) | Victory mechanic | High | Continuous path algorithm; recalculate on every road build; tie-break: current holder keeps it |
| Largest army tracking (3+ knights, ties keep holder) | Victory mechanic | Low | Simple counter; same tie-break rule |
| Victory point calculation and win detection | Game end condition | Low | 10 VP wins; settlements=1, cities=2, longest road=2, largest army=2, VP cards=1 each |
| Turn order enforcement | Fairness | Low | Server enforces whose turn it is |
| Hand size limit enforcement | Rules: discard on 7 if >7 cards | Low | Trigger discard UI for all affected players when 7 rolled |

### Lobby / Room System

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create game room with code | Entry point for all sessions | Low | Generate short unique code (e.g. 6 alphanumeric chars) |
| Join game via room code | Entry point for guests | Low | Display name + code = access |
| Display name (no auth) | Identify players without accounts | Low | Store in session/cookie; no passwords needed |
| Configure bot count (0-3 bots to fill seats) | Core project requirement | Low | Seat count is always 3-4 players (base Catan) |
| Start game when host is ready | Session lifecycle | Low | Host controls start; show "waiting for host" to others |
| Player list with ready status in lobby | Basic UX polish | Low | Show who has joined |

### Real-Time Multiplayer Sync

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| WebSocket game state sync | All multiplayer board games require it | High | State changes broadcast to all players in room |
| Authoritative server-side game state | Prevents cheating; required for rules enforcement | High | Client is a view only; all moves validated server-side |
| Turn notification | Players must know when it's their turn | Low | Highlight / toast "Your turn" |
| Reconnect / rejoin in-progress game | Network drops happen | Medium | Session token + room code re-establishes connection |

### Bot AI (Core Behavior)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bot takes turn automatically | Bot must play the full game | High | Full rules-compliant move execution |
| Bot initial placement logic | First moves set up entire game | Medium | Place near high-probability numbers, diversify resources |
| Bot resource trading (bank/port) | Bot must be able to trade | Medium | Trade when overloaded on one resource and can make progress |
| Bot build decisions | Bot must build | Medium | Prioritize settlements > cities > roads based on VP path |
| Bot robber placement | Robber mechanic applies to bots | Medium | Target leader or block key expansions |
| Bot dev card usage | Bot buys and plays dev cards | Medium | Knights used proactively; monopoly/YoP when strategically optimal |
| Configurable bot difficulty | Project says "reasonably strategic" | Low | Single difficulty tier is fine for v1 |

### UI — Board Rendering

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hex grid with correct topology | The board is the product | High | SVG or Canvas; 19 hexes, correct adjacency |
| Resource tile images or colors | Visual readability | Low | Distinct colors per resource type (forest, pasture, fields, hills, mountains, desert) |
| Number tokens on hexes | Players read the board constantly | Low | Show pip count (dots under number) — critical for strategy |
| Settlement/city indicators per player color | Board state readability | Low | 4 player colors, clearly distinguishable |
| Road indicators per player color | Board state readability | Low | Edge rendering |
| Port indicators | Players must know port locations | Low | 2:1 and 3:1 ports labeled on sea hexes |
| Robber piece position | Key board state element | Low | Visual token on current robber hex |
| Highlight valid placement locations | Reduce rules burden on player | Medium | During placement/build actions, show valid vertices/edges |

### UI — Game HUD

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Current player's resource hand display | Can't play without knowing your cards | Low | Private to each player |
| All players' card count (not content) | Standard Catan info | Low | Show count per player, not contents |
| Dev card hand display | Know what you can play | Low | Private; show unplayed cards in hand |
| Dice result display | Feedback for roll | Low | Last roll shown prominently |
| VP scoreboard (all players) | Game state awareness | Low | Show current score per player; hide VP cards from others |
| Game log / action history | Accountability and orientation | Medium | "Player X built a settlement", "Player Y rolled 8", etc. |
| Building cost reference card | Reduces cognitive overhead | Low | Static overlay or always-visible panel |
| Current turn phase indicator | Orientation within a turn | Low | "Roll phase", "Build phase", etc. |

---

## Differentiators

Features that improve experience but are not required for the game to work. These set a quality Catan implementation apart from a bare-bones one.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated dice roll | Tactile feedback; makes rolls feel meaningful | Low | CSS/JS animation, 1-2 seconds |
| Smooth piece placement animation | Polish; pieces "snap" onto board | Low | CSS transition |
| Resource gain animation (cards fly to hand) | Visual feedback on dice result | Medium | Per-hex animation tied to roll |
| Color-coded game log entries | Faster scanning of history | Low | Color by player |
| Hex board highlight on hover | Spatial orientation on hex grid | Low | Hover state on hexes |
| Sound effects (dice, build, robber) | Immersion | Low | Optional audio, user-toggleable |
| Bot "thinking" delay | Makes bot feel natural, not instant | Low | 300-800ms artificial delay before bot acts |
| Ping / latency indicator | Diagnose connection issues | Low | WebSocket heartbeat display |
| Rematch button | Core social loop for playing again | Low | Host can start new game with same players |
| Board layout seed sharing | Reproducible games for testing/fun | Low | Encode board layout in shareable URL param |
| Keyboard shortcuts | Power-user quality of life | Low | e.g. R=roll, B=build menu |
| Auto-end turn when nothing left to do | Reduces click overhead | Medium | Detect "no valid moves remain" state |
| Visual "longest road" path highlight | Helps players understand scoring | Medium | Highlight the actual path segments |
| Toast notifications for game events | Player awareness | Low | "Robber moved by Bot 1", etc. |
| Dark mode | Modern expectation | Low | CSS custom properties |

---

## Anti-Features

Features to explicitly NOT build for v1. Each has a specific reason and a stated deferral strategy.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Player-to-player trading | Requires offer/counter-offer UI, acceptance state, interruption of turn flow — doubles UI complexity for core loop | Bank/port trading covers most strategic needs; defer to v2 |
| Maritime trading UI beyond bank/port | Not in base rules | Only implement what rules require |
| Expansions (Seafarers, Cities & Knights, etc.) | Separate rules systems; entirely different board geometry | Out of scope — base game only |
| User accounts / auth / passwords | Not needed for friends use; adds backend complexity | Room codes + display names; optionally persist display name in localStorage |
| Email / social login (OAuth) | Same as above | Skip entirely for v1 |
| Public matchmaking / ranked play | Not needed for friends use; requires significant backend | Friends create/share room codes |
| Spectator mode | Listed as out of scope in PROJECT.md | Skip for v1 |
| Chat / messaging | Nice-to-have but adds moderation surface area for zero benefit in friends use | Out of scope v1 |
| Game replay / recording | Useful but non-trivial; requires full event log persistence | Could be added later if game log is event-sourced |
| Mobile native app | Out of scope per PROJECT.md | Responsive web is sufficient |
| Multiple board sizes (3-player, 5-6 player) | 5-6 player is an expansion; 3-player is a configuration variant | Standard 4-player board only for v1 |
| Asynchronous (async) play | "Play by email" style; different architecture | Real-time only |
| Undo/redo moves | Breaks server-side authority model; complex to implement correctly | Not needed; all moves intentional |
| Admin panel / game management UI | Overkill for personal use | A simple "reset" or "abandon game" endpoint is sufficient |
| Leaderboards / stats | No persistent identity | Not applicable without user accounts |

---

## Feature Dependencies

Understanding these prevents building in wrong order.

```
Board generation
  → Vertex/edge topology model
      → Placement validation (settlements must be 2+ roads apart)
      → Road adjacency validation
      → Port detection (which vertices get port rates)
      → Longest road algorithm

Resource distribution
  → Dice roll
  → Hex-to-vertex adjacency map (settlements/cities)
  → Player hand state

Development card system
  → Shuffled deck on game start (fixed composition)
  → "bought this turn" flag (can't play same turn)
  → Knight → Largest army tracking
  → Monopoly → All players' hands accessible to server
  → Year of Plenty → Bank resource pool
  → Road Building → Road placement (2 roads, free)
  → VP cards → Victory point total (hidden until win check)

Win detection
  → VP tracking (settlements + cities + special cards + VP dev cards)
  → Largest army (2 VP, requires 3+ knights)
  → Longest road (2 VP, requires 5+ continuous)

Lobby system
  → WebSocket room management
  → Player session (display name + room code)
  → Bot slot configuration

Bot AI
  → Full rules engine (bots use same validation as humans)
  → Game state read access
  → Action execution path (bots submit moves same as human clients)

Real-time sync
  → WebSocket infrastructure
  → Authoritative server state
  → All other features (game loop, bots, lobby)
```

---

## MVP Recommendation

Given the project's stated priority ("solo/bots working end-to-end first, then real-time multiplayer"), a two-stage MVP is appropriate.

### Stage 1: Single-player vs bots (no networking)

Prioritize in this order:

1. Board generation + topology model (everything depends on this)
2. Full game rules engine (placement, build, dice, robber, dev cards, win detection)
3. Local game loop — human takes a turn, then bots take turns
4. Bot AI — initial placement + basic build decisions + bank trades
5. Board UI + HUD (hex rendering, resource display, game log)

This validates the game is correct before any networking complexity.

### Stage 2: Real-time multiplayer

1. WebSocket room infrastructure
2. Lobby (create/join with room code, configure bots)
3. Server-authoritative state with client sync
4. Reconnection handling

### Deferred from v1

- Player-to-player trading: add in v2 once the base loop is proven
- All expansion content: out of scope by design
- Spectator mode: explicitly listed as not needed
- Chat: not needed for friends use
- Async play: architectural choice was real-time

---

## Sources

- Project context: `/home/chris/projects/catan-gst/.planning/PROJECT.md`
- Catan base game rules (Klaus Teuber, Catan GmbH) — rule set is fixed and well-known; HIGH confidence on rules features
- Knowledge of colonist.io, catan.com, BoardGameArena Catan implementations (training data through mid-2025) — MEDIUM confidence on ecosystem comparisons
- Open-source Catan implementations on GitHub (JSettlers2, piotrbelina/catan, etc.) — MEDIUM confidence
- Web search restricted in this session; no live verification of competitor feature lists performed
