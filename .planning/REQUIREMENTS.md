# Requirements: Catan Web

**Defined:** 2026-02-28
**Core Value:** A complete, rules-enforced solo game against bots that plays like the real thing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Game Rules

- [ ] **GAME-01**: Board generates with 19 randomized land hexes (resource types) and number tokens (red numbers not adjacent)
- [ ] **GAME-02**: Initial placement phase runs 2 rounds with reverse turn order in round 2; each player places 1 settlement + 1 road per round
- [ ] **GAME-03**: Dice roll distributes resources each turn; all settlements/cities adjacent to the rolled number receive 1 resource (cities receive 2)
- [ ] **GAME-04**: Rolling 7 activates robber; any player with more than 7 cards must discard half (rounded down)
- [ ] **GAME-05**: Active player moves robber to any land hex; may steal one random card from one opponent with a settlement/city on that hex
- [ ] **GAME-06**: Development card deck has fixed composition (14 knights, 5 VP, 2 monopoly, 2 year of plenty, 2 road building); shuffled once at game start
- [ ] **GAME-07**: Dev cards cannot be played on the same turn they were purchased
- [ ] **GAME-08**: Knight card moves robber and allows steal (same as rolling 7); Monopoly takes all of one resource type from all opponents; Year of Plenty grants 2 any resources from bank; Road Building places 2 free roads; VP cards count immediately and are kept secret until win
- [ ] **GAME-09**: Bank trading available at 4:1 any resource; port trading at 2:1 specific resource or 3:1 any resource based on settlement/city presence at port vertex
- [ ] **GAME-10**: Resource costs enforced: road (1 brick + 1 lumber), settlement (1 brick + 1 lumber + 1 wheat + 1 sheep), city (2 wheat + 3 ore), dev card (1 ore + 1 wheat + 1 sheep)
- [ ] **GAME-11**: Longest road award (2 VP) goes to first player with 5+ continuous road segments; recalculated after every road build; ties keep current holder
- [ ] **GAME-12**: Largest army award (2 VP) goes to first player to play 3+ knight cards; subsequent players must exceed current holder's count to claim it
- [ ] **GAME-13**: Victory points calculated continuously (1 per settlement, 2 per city, +2 largest army, +2 longest road, +1 per VP dev card); first player to reach 10 VP on their turn wins
- [ ] **GAME-14**: Turn order enforced server-side; only the active player may submit actions during their turn

### Board Rendering

- [ ] **BOARD-01**: Hex grid rendered in SVG with 19 land hexes, correct vertex/edge topology, distinct resource type colors, number tokens with pip-count dots, and port labels on sea hexes
- [ ] **BOARD-02**: Settlement, city, and road pieces rendered in distinct player colors; robber token shows its current hex position
- [ ] **BOARD-03**: Valid placement vertices/edges are highlighted during build actions and initial placement phase

### HUD

- [ ] **HUD-01**: Player's own resource cards and unplayed dev cards displayed in a private hand panel
- [ ] **HUD-02**: All players' total card counts (not contents) visible to everyone
- [ ] **HUD-03**: Last dice result and current turn phase displayed ("Roll", "Build", "Place Robber", etc.)
- [ ] **HUD-04**: VP scoreboard shows all players' current scores; own VP dev cards excluded from displayed count until that player wins
- [ ] **HUD-05**: Game log records all significant actions (dice rolls, builds, robber moves, trades, dev card plays, win)
- [ ] **HUD-06**: Building cost reference card is visible during play

### Bot AI

- [ ] **BOT-01**: Bot takes turns automatically without human input and only submits legal moves
- [ ] **BOT-02**: Bot initial settlement placement targets vertices adjacent to high-probability numbers with resource type diversity
- [ ] **BOT-03**: Bot builds roads, settlements, and cities using heuristic scoring that prioritizes VP gain
- [ ] **BOT-04**: Bot executes bank and port trades when holding an excess of one resource and needing another
- [ ] **BOT-05**: Bot moves robber to block the current leader or a high-production opponent hex
- [ ] **BOT-06**: Bot buys dev cards when able and plays knight, monopoly, year of plenty, and road building cards using basic strategic criteria

### Room / Lobby

- [ ] **ROOM-01**: Player creates a new game room and receives a shareable room code
- [ ] **ROOM-02**: Player joins a game by entering a room code and a display name (no account required)
- [ ] **ROOM-03**: Host configures the number of bot players (0–3) to fill empty seats before starting
- [ ] **ROOM-04**: Lobby displays the list of joined players; host starts the game when ready

### Networking

- [ ] **NET-01**: Server maintains authoritative game state; all client actions validated server-side and rejected if illegal
- [ ] **NET-02**: Server broadcasts full game state to all clients in the room after every state change
- [ ] **NET-03**: Player who disconnects can rejoin the in-progress game using the original room code and display name

---

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Trading

- **TRADE-01**: Player can offer resources to all opponents during their turn
- **TRADE-02**: Opponent can accept, decline, or counter-offer a trade proposal
- **TRADE-03**: Bot evaluates and responds to incoming trade offers

### Bot Improvements

- **BOT-07**: Bot uses sophisticated dev card timing (e.g. save monopoly until opponents are resource-rich)
- **BOT-08**: Bot considers opponent board positions and blocking strategies more deeply

### Polish

- **UX-01**: Animated dice roll (1–2 second CSS/JS animation)
- **UX-02**: Resource gain animation (cards visually flow to player hand on dice result)
- **UX-03**: Bot "thinking" delay (300–800ms artificial pause before bot acts)
- **UX-04**: Rematch button (host can restart with same players)
- **UX-05**: Sound effects for dice, building, robber (user-toggleable)
- **UX-06**: Dark mode

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Player-to-player trading | Doubles UI complexity with offer/counter-offer state; bank/port trades cover core loop |
| Expansions (Seafarers, Cities & Knights, etc.) | Separate rule systems and board geometry; base game only |
| User accounts / auth / passwords | Friends-only use; room codes + display names are sufficient |
| OAuth / social login | Not needed for personal use |
| Public matchmaking / ranked play | Not needed for personal use; no persistent identity |
| Spectator mode | Explicitly not needed per project scope |
| Chat / messaging | Not needed for friends use |
| Game replay / recording | Non-trivial; no event-sourcing infrastructure planned |
| Mobile native app | Web-only; responsive is sufficient |
| 5–6 player variant | Separate expansion content |
| Async / play-by-email | Real-time only by design |
| Undo / redo moves | Breaks server-authority model |
| Leaderboards / stats | No persistent identity |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GAME-01 | — | Pending |
| GAME-02 | — | Pending |
| GAME-03 | — | Pending |
| GAME-04 | — | Pending |
| GAME-05 | — | Pending |
| GAME-06 | — | Pending |
| GAME-07 | — | Pending |
| GAME-08 | — | Pending |
| GAME-09 | — | Pending |
| GAME-10 | — | Pending |
| GAME-11 | — | Pending |
| GAME-12 | — | Pending |
| GAME-13 | — | Pending |
| GAME-14 | — | Pending |
| BOARD-01 | — | Pending |
| BOARD-02 | — | Pending |
| BOARD-03 | — | Pending |
| HUD-01 | — | Pending |
| HUD-02 | — | Pending |
| HUD-03 | — | Pending |
| HUD-04 | — | Pending |
| HUD-05 | — | Pending |
| HUD-06 | — | Pending |
| BOT-01 | — | Pending |
| BOT-02 | — | Pending |
| BOT-03 | — | Pending |
| BOT-04 | — | Pending |
| BOT-05 | — | Pending |
| BOT-06 | — | Pending |
| ROOM-01 | — | Pending |
| ROOM-02 | — | Pending |
| ROOM-03 | — | Pending |
| ROOM-04 | — | Pending |
| NET-01 | — | Pending |
| NET-02 | — | Pending |
| NET-03 | — | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 0
- Unmapped: 36 ⚠️

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
