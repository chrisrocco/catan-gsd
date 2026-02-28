# Domain Pitfalls

**Domain:** Browser-based real-time multiplayer board game (Catan)
**Researched:** 2026-02-28
**Confidence:** HIGH — core pitfalls are well-established across hex game implementations, WebSocket multiplayer patterns, and published Catan rule clarifications

---

## Critical Pitfalls

Mistakes that cause rewrites, game-breaking bugs, or complete architectural pivots.

---

### Pitfall 1: Choosing the Wrong Hex Coordinate System

**What goes wrong:** Developer picks offset coordinates (even-r, odd-r, even-q, odd-q) because they look "natural" on screen. Every direction calculation, neighbor lookup, distance function, and pathfinding algorithm requires if/else branches to handle even vs odd rows. Longest road calculation becomes a maze of special cases. Porting algorithms from references requires translation layers that introduce bugs.

**Why it happens:** Offset coordinates feel intuitive (row/col like a spreadsheet). Cube/axial coordinates look abstract until you understand why they exist.

**Consequences:** Neighbor calculations are bug-prone; longest road graph traversal is substantially harder; any hex-to-pixel or pixel-to-hex conversion requires row/column parity checks; debugging is painful because coordinates don't behave uniformly.

**Prevention:** Use **cube coordinates** (q, r, s where q+r+s=0) as the internal representation from day one. The three-axis system makes all six neighbors a simple add operation, distance is `max(|q|,|r|,|s|)`, and rotation/reflection are clean. Convert to pixel coordinates only for rendering. Redblobgames' hex grid guide is the canonical reference — follow it exactly.

**Detection:** If your neighbor-lookup function has if/else or modulo for even/odd rows, you are using offset coordinates. Migrate before writing game logic.

**Phase:** Foundation / hex grid module (Phase 1). This is unrecoverable without a rewrite if caught late.

---

### Pitfall 2: Conflating Vertex and Edge Identity Across Hexes

**What goes wrong:** Each hex has 6 vertices and 6 edges. A vertex is shared by up to 3 hexes; an edge is shared by 2. If you represent vertices/edges as per-hex local indices rather than globally unique IDs, you end up with duplicate vertex objects for the same board position. Settlement placement at a shared vertex only updates one hex's data structure. The "distance rule" check (no settlement within 2 roads of another) queries the wrong set of neighbors.

**Why it happens:** Natural to model a hex as {vertices: [0..5], edges: [0..5]}. Works for rendering. Fails for game state.

**Consequences:** Rule enforcement is broken; adjacency queries return incorrect results; "place settlement adjacent to road" checks fail intermittently; city upgrades only update one of several duplicate vertex records.

**Prevention:** Build a canonical vertex/edge index at board-initialization time. Each vertex gets a globally unique ID (e.g., cube-coordinate-derived). Each edge likewise. The hex data structure holds references (IDs) to shared vertex/edge objects, not copies. All game state (settlements, roads) is stored on the global vertex/edge objects.

**Detection:** If you can place a settlement at a vertex and a neighboring hex doesn't "know" about it without querying back through the settlement list, you have duplicated vertices.

**Phase:** Board data model (Phase 1). Must be correct before any rule enforcement code is written.

---

### Pitfall 3: Authoritative State Lives on the Client

**What goes wrong:** Server sends initial game state, client performs move validation, server just relays messages. Seems efficient. First player to open devtools and send a fabricated WebSocket message can place roads for free, steal resources, or win instantly.

**Why it happens:** Easier to prototype; client already has all the state for rendering, so validation logic feels natural there. "It's just for friends" doesn't help when a friend's browser extension intercepts traffic.

**Consequences:** All game integrity is lost. Fixing it later requires a complete architectural reversal — moving all rule logic to the server. If data model was client-centric, the server may not even have enough state to validate.

**Prevention:** Server holds the only authoritative GameState object. Clients send **intent messages** ("I want to place a settlement at vertex 42"). Server validates against its state, applies if legal, broadcasts the resulting state delta to all clients. Clients are display terminals. The project already has this as a key decision — enforce it architecturally from the start by never having the client perform moves directly on its local state model.

**Detection:** If client code calls `gameState.placeSettlement()` before receiving server confirmation, state is client-authoritative.

**Phase:** Architecture decision (Phase 1). Once baked in, very expensive to reverse.

---

### Pitfall 4: Mutable Shared State Object Sent Over WebSocket

**What goes wrong:** Server maintains a single `gameState` object. When broadcasting to clients, server does `socket.emit('state', gameState)`. Some libraries serialize by reference at call time; others hold a reference and serialize lazily. Meanwhile another event modifies `gameState`. Clients receive a state that never existed or is partially mutated mid-send.

**Why it happens:** Convenience — one object, just emit it. Works 99% of the time until high message frequency exposes the race.

**Consequences:** Intermittent client desyncs that are extremely hard to reproduce. Two clients see different game states after the same action. Debugging requires replaying exact timing.

**Prevention:** Always serialize state snapshots: `socket.emit('state', JSON.parse(JSON.stringify(gameState)))` or use a proper immutable state pattern (e.g., Immer). Better: send state **deltas** not full state, computed from the action that was just applied before any subsequent mutation.

**Detection:** Clients occasionally show different board states after the same player action. More common under load or when bot actions fire in quick succession.

**Phase:** WebSocket layer (Phase 2 / multiplayer phase).

---

### Pitfall 5: Not Modeling the Game as a State Machine

**What goes wrong:** Game flow is implemented as a series of boolean flags: `isSetupPhase`, `waitingForRobberPlacement`, `canBuildThisTurn`, etc. Every action handler checks a combination of flags to decide if the action is valid. Flags get out of sync. A player who just rolled a 7 can somehow also build a road. The setup phase second-placement reverse order is incorrectly handled because nothing enforced the transition.

**Why it happens:** Adding flags as features are built feels incremental and easy. The true complexity isn't apparent until 8+ flags exist.

**Consequences:** Illegal move combinations become possible. Turn transitions have bugs. Testing requires manually constructing complex flag combinations. Every new feature requires auditing all existing flag combinations.

**Prevention:** Model game flow as an explicit finite state machine from the start. States: `SETUP_FORWARD`, `SETUP_REVERSE`, `PRE_ROLL`, `POST_ROLL`, `ROBBER_PLACEMENT`, `ROBBER_STEAL`, `GAME_OVER`, etc. Each state defines the set of legal actions. Transitions are explicit. A player action is valid only if the current state includes it. Libraries like XState work well; a hand-rolled enum + transition table also works.

**Detection:** You have more than 3 boolean "phase" flags. Action handlers start with more than 2 `if (!isX || !isY)` guards.

**Phase:** Game logic core (Phase 1). Retrofitting a state machine later is possible but requires touching every action handler.

---

### Pitfall 6: Longest Road Algorithm Is Harder Than It Looks

**What goes wrong:** Developer implements longest road as a simple DFS that finds the longest path in the road graph. Passes first tests. Fails when: (a) an opponent places a settlement on a vertex that breaks the road, (b) the algorithm counts a road twice by traversing a loop, (c) roads branch and the algorithm picks the wrong branch first, returning a suboptimal length.

**Why it happens:** "Find the longest path in a graph" sounds like a standard CS problem. It is NP-hard in the general case. The Catan-specific version is tractable (small graph, max 15 roads per player) but has specific rules that make naive implementations wrong.

**Consequences:** Longest Road award is given to the wrong player. Players who should have 10 VP remain at 8. Game never ends or ends incorrectly.

**Prevention:** Implement longest road as a **trail** (not path) search — edges can be revisited only if traveling through a vertex that is unoccupied or owned by the current player. Use a recursive DFS that tracks visited **edges** (not vertices) per branch. The key rule: a road is "broken" at a vertex if an opponent's settlement sits there (the road still exists but cannot be traversed through). Test with the specific edge cases: loops, branches, interrupted roads, roads that regain connection.

**Detection:** Unit test: build a hex ring of 6 roads (a loop) — longest road should be 6, not infinity. Build a Y-shape of 5 roads — longest road should be 5. Place opponent settlement midway through a 6-road chain — longest road should split.

**Phase:** Game rules engine (Phase 1 or 2). Write unit tests for this algorithm before integrating it into the win condition check.

---

### Pitfall 7: WebSocket Reconnection Without Session Resumption

**What goes wrong:** Player's browser tab reloads, loses connectivity for 10 seconds, or the tab goes to background on mobile. WebSocket connection drops. Server removes player from game. When player reconnects, they get a "game not found" error and the game is effectively abandoned mid-session.

**Why it happens:** WebSocket disconnection is treated as "player left." Easy to implement, wrong semantics for a game session.

**Consequences:** Any minor network hiccup kills the game for everyone. On mobile browsers, background tab suspension triggers this constantly.

**Prevention:** Separate "player identity" from "socket connection." Each player has a session token (UUID stored in browser sessionStorage). On disconnect, server marks player as "disconnected" but keeps their game slot open for a configurable grace period (60–120 seconds). On reconnect with matching session token, server sends full current state and resumes. Bot can optionally take over disconnected player's turns during grace period to keep the game moving.

**Detection:** Close and reopen the browser tab mid-game. If the game is gone, reconnection is not implemented.

**Phase:** Multiplayer/WebSocket phase. Must be designed before the connection layer is finalized.

---

### Pitfall 8: Race Condition Between Bot Actions and Human Input

**What goes wrong:** Server processes a human player's action. While bot is "thinking" (async setTimeout), human sends another action. Bot fires its action into the same game state the human just modified. Two actions apply to the same state version. State diverges from what either player expected.

**Why it happens:** Bots are modeled as async timers. Human actions come in via WebSocket events. Both modify the same mutable state object without a queue.

**Consequences:** Cards get spent twice, resources appear from nowhere, illegal builds go through because the validation checked state before the concurrent mutation.

**Prevention:** Use an action queue. All actions (human and bot) are enqueued and processed serially by a single game loop tick. No action handler touches state directly — it submits to the queue. The queue processes one action at a time, updating state and broadcasting before processing the next. Node.js is single-threaded, so a simple array queue with a processing flag is sufficient.

**Detection:** Run a game with multiple bots at high speed. Watch for resource totals that don't add up or buildings placed with insufficient resources.

**Phase:** Game loop / bot integration phase. Design the queue before bots are implemented.

---

## Moderate Pitfalls

---

### Pitfall 9: Misimplementing the Robber Rules

**What goes wrong:** Several distinct robber triggers and mechanics get conflated or partially implemented:
- A 7 is rolled: robber moves, player must discard if over 7 cards, then current player moves robber and may steal
- Knight dev card: robber moves, may steal, counts toward Largest Army
- Both require moving the robber to a non-desert hex (technically it can stay on desert)
- Stealing: player chooses which opponent to steal from among those adjacent to the new robber hex (must have resources)
- If no adjacent opponent has resources, no steal occurs — but the robber still moves
- Players with more than 7 cards discard **half rounded down** when a 7 is rolled

**Prevention:** Implement each trigger and each sub-step as explicit state machine transitions. Write a test for: roll 7 with nobody over 7 (skip discard step), roll 7 with multiple players over 7 (both discard), knight card with no adjacent opponents (move robber, no steal prompt), robber placed on ocean hex (illegal — reject).

**Detection:** Play through a full game manually with logging. Check the discard calculation for odd-numbered hands (5 cards = discard 2, not 3).

**Phase:** Rule enforcement (Phase 1/2).

---

### Pitfall 10: Initial Placement Order Bug

**What goes wrong:** Catan initial placement is a "snake" order: 1,2,3,4,4,3,2,1. The second round is reverse order. Common bugs: (a) second-round starting player gets to place twice in a row, (b) resources are not granted after second settlement placement, (c) resources are granted after first settlement placement (they shouldn't be — only second placement yields starting resources).

**Prevention:** Explicitly model the two placement rounds as separate states. Track whose turn it is in the snake explicitly (compute the list [1,2,3,4,4,3,2,1] at game start; iterate through it). Grant resources only on second-round placements, immediately after road placement confirms the settlement.

**Detection:** 4-player game, verify player 4 gets resources before player 3's second placement, and player 1 goes last in round 2.

**Phase:** Rule enforcement (Phase 1).

---

### Pitfall 11: Port Trading Rate Not Checked Against All Ports

**What goes wrong:** Player has a 2:1 wheat port and a 3:1 general port. They try to trade 2 ore for 1 card. The system finds they have the 3:1 port and allows 3:1 ore trades, but doesn't check whether a 2:1 ore port exists on the board and whether this player has a settlement there. Or conversely, the system only checks the first matching port and misses a better rate.

**Prevention:** Trading rate calculation: for each resource being offered, find the best available rate for that player. Check: does player have a settlement/city on a 2:1 port for this resource type? If yes, rate is 2. Does player have a 3:1 general port? If yes, rate is 3 (unless 2:1 already found). Otherwise rate is 4. Use the minimum. Never allow a trade if the player offers less than the best rate.

**Detection:** Test: player with 2:1 wood port tries to trade 2 wood — should succeed. Player with 3:1 port tries to trade 3 ore — should succeed. Player with neither tries 3:1 — should fail (need 4).

**Phase:** Rule enforcement (Phase 1/2).

---

### Pitfall 12: Bot AI Gets Stuck in a Local Optimum and Stops Building

**What goes wrong:** Bot evaluates building options each turn, finds none are profitable enough by its scoring heuristic, and passes every turn. Game stalls because bots hold resources but never spend them. Or bot always builds roads into the ocean because road score doesn't account for "is there a viable settlement spot at the end?"

**Why it happens:** Pure greedy scoring without lookahead. A road that leads nowhere scores as "a road" not "a dead-end road."

**Consequences:** Games that run 2x longer than necessary; bots that never win; frustrating human experience when waiting for bot turns.

**Prevention:** Give bots a mild forcing function — after N consecutive turns without building, force the bot to make the highest-scoring available action regardless of threshold. Road building should check if a valid settlement vertex exists within 2 roads of the endpoint. Bot should prioritize breaking up an opponent's potential longest road. Include "bank trade to unlock a build" as a considered action, not just raw resource checks.

**Detection:** Run 1000 bot-vs-bot games. If average game length exceeds 120 turns, bots are not building efficiently.

**Phase:** Bot AI phase.

---

### Pitfall 13: Victory Point Count Is Computed On-Demand, Not Maintained

**What goes wrong:** VP count is calculated by a function that totals settlements + cities + VP cards + Largest Army + Longest Road every time it's needed. Works but introduces bugs when: a road is broken mid-calculation, Largest Army transfers but the old holder still appears to have it in the render, or VP dev cards are counted before they're "played" (VP cards are always active, unlike action cards).

**Prevention:** Maintain VP as a derived value recomputed after every state mutation, not as a stored value. Ensure Largest Army and Longest Road are single-owner fields on game state (not derived per player), updated explicitly on transfer. VP dev cards count from the moment they are drawn (not "played") — this is a commonly misunderstood rule.

**Detection:** Draw a VP card. Check that player's displayed score increases immediately without any "play card" action.

**Phase:** Rule enforcement (Phase 1).

---

### Pitfall 14: Resource Distribution Bug on 7 Roll

**What goes wrong:** When a 7 is rolled, no resources are distributed (only robber mechanics trigger). A common bug is that resource distribution runs first and then the 7-roll check cancels it, leaving players with extra resources. Or the check is: `if (roll !== 7) distributeResources()` which is correct, but the robber flow is only triggered for human players, not bots.

**Prevention:** Explicit state machine transition. Rolling a 7 always: (1) triggers discard phase for over-limit players, (2) transitions to ROBBER_PLACEMENT state for the rolling player. Rolling 2-6 or 8-12: distributes resources. These are mutually exclusive branches, not sequential steps.

**Detection:** Roll a 7 with bots in the game. Confirm no resources were distributed. Confirm bots with >7 cards discarded correctly.

**Phase:** Rule enforcement (Phase 1).

---

### Pitfall 15: Hex Pixel Coordinate Calculation for Click Detection

**What goes wrong:** Rendering hexes looks correct but clicking on a vertex near the edge of a hex triggers settlement placement on the wrong vertex, or doesn't trigger at all. The pixel-to-vertex mapping uses a bounding box check instead of proper distance-to-vertex calculation.

**Why it happens:** Hex centers are easy to compute. Vertex pixel positions require trigonometry (30-degree offsets from center). Click detection that uses hex bounding boxes will attribute clicks in hex corners to the wrong hex.

**Prevention:** For click/tap detection, compute the pixel coordinates of all vertices and edges at board initialization. Store them. On click, find the nearest vertex (or edge) within a threshold distance (e.g., 20px). Do not use hex bounding boxes for vertex/edge detection. Use the pointy-top vs flat-top convention consistently — pick one and use the same formula everywhere.

**Detection:** On a rendered board, click near a vertex that is shared by 3 hexes. Confirm the correct vertex is selected regardless of which hex center the click is "closer to."

**Phase:** Rendering / UI (Phase 1 or dedicated rendering phase).

---

## Minor Pitfalls

---

### Pitfall 16: Dev Card Draw from Empty Deck

**What goes wrong:** Player tries to buy a dev card when the deck is empty. If the server doesn't check deck size, it returns a card anyway (off the undefined end of the array), or throws an unhandled exception that crashes the game.

**Prevention:** Validate deck.length > 0 before allowing dev card purchase. Return an error action if empty. Disable the "Buy Dev Card" button on client when server broadcasts deck_remaining === 0.

**Phase:** Rule enforcement (Phase 1).

---

### Pitfall 17: Same Dev Card Can Be Played the Turn It Is Drawn

**What goes wrong:** Player buys a knight, plays it immediately in the same turn to move the robber and steal. Catan rules explicitly prohibit playing a dev card on the turn it was purchased (except VP cards which are never "played").

**Prevention:** Tag each dev card in the player's hand with the turn number it was acquired. Validate that card.acquiredTurn < currentTurn before allowing any action card to be played.

**Detection:** Buy a knight, immediately try to play it. Should be rejected.

**Phase:** Rule enforcement (Phase 1).

---

### Pitfall 18: Road Building Dev Card Doesn't Handle "Only 1 Road Remaining"

**What goes wrong:** Road Building card gives 2 free roads. If a player has only 1 road piece remaining in their supply (max 15 roads, 14 placed), they can place 1 road, but the card should not require them to place 2. Some implementations get stuck waiting for a second road placement that can never happen.

**Prevention:** Road Building places roads one at a time. After each placement, check if player has roads remaining AND if valid road placements exist. If either is 0, skip remaining placements and end the card's effect.

**Phase:** Rule enforcement (Phase 1/2).

---

### Pitfall 19: Year of Plenty Selects Two Resources Simultaneously

**What goes wrong:** UI requires selecting both resources at once in a single action. Player can't select one and then decide the other. Or the server allows selecting the same resource twice even when the bank has only 1 of that type — technically the bank can run out of a resource type.

**Prevention:** Year of Plenty selects two resources from the bank (bank must have them). Implement as a single action with a 2-element resource array. Check bank has at least 1 of each requested type before granting. Note: if bank has 0 of a type, that type is unavailable.

**Phase:** Rule enforcement (Phase 2).

---

### Pitfall 20: Monopoly Card Reveals Opponent's Hand Size Prematurely

**What goes wrong:** When a player plays Monopoly and declares a resource, the server collects all of that resource from all other players. If the UI shows each transfer animation separately (player A → Monopoly player: 3 ore, player B → Monopoly player: 1 ore), opponents now know each other's hand composition, which is private information.

**Prevention:** Reveal the total gained to all players, but not the breakdown by source. "Player A played Monopoly on Ore and gained 4 ore." Each individual player should see their own loss but not others' losses.

**Phase:** UI / information visibility design (multiplayer phase).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Hex board data model | Wrong coordinate system (offset vs cube) | Use cube coordinates from day one; never use offset internally |
| Vertex/edge representation | Duplicate vertex objects per hex | Global vertex/edge index with IDs; hexes hold references |
| Game flow control | Flag soup instead of state machine | Implement FSM before writing any action handler |
| Dice + resource distribution | 7 distributes resources before robber check | Make 7 and non-7 branches mutually exclusive |
| Initial placement | Snake order off-by-one, wrong resource grant turn | Pre-compute placement order list; test with 4 players |
| Longest road | Naive DFS double-counts edges, mishandles breaks | Track visited edges per branch; test loop/break cases |
| Dev cards | Play-on-draw-turn, empty deck, Road Building edge case | Tag cards with acquiredTurn; check deck size; handle 1-road case |
| Port trading | Rate check misses best available rate | Per-resource minimum-rate function; test 2:1 vs 3:1 priority |
| WebSocket state | Mutable shared state race condition | Serialize snapshots; use action queue |
| Reconnection | Disconnect = player ejected | Session tokens + grace period reconnect |
| Bot AI | Bot passes every turn (no building) | Forcing function after N idle turns |
| Click detection | Bounding box misattributes vertex clicks | Distance-to-vertex threshold; precompute pixel positions |
| Information hiding | Monopoly reveals per-player breakdown | Aggregate total only in broadcast |
| Victory points | VP dev cards require "playing" | VP cards are passive — count on draw, not on play |

---

## Sources

**Confidence note:** The hex coordinate pitfalls (Pitfall 1, 2, 15) are HIGH confidence based on the canonical redblobgames hex grid reference and consistent reporting across hex game implementations. The Catan rule pitfalls (Pitfalls 6, 9, 10, 11, 13, 14, 17, 18, 19) are HIGH confidence based on the official Catan rulebook rules and known FAQ items that appear consistently in digital Catan implementation discussions. The WebSocket/multiplayer pitfalls (Pitfalls 3, 4, 7, 8) are HIGH confidence based on established patterns in real-time multiplayer game architecture. Bot AI pitfalls (Pitfall 12) are MEDIUM confidence — specific behavior depends on implementation approach chosen.

- Redblobgames hex grid guide: https://www.redblobgames.com/grids/hexagons/ (canonical reference for Pitfalls 1, 2, 15)
- Official Catan rulebook and FAQ (Pitfalls 9, 10, 11, 13, 14, 17, 18, 19)
- XState documentation for FSM patterns: https://xstate.js.org/ (Pitfall 5)
- Real-time multiplayer game architecture patterns (Pitfalls 3, 4, 7, 8) — established industry practice
