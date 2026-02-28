# Catan Web

## What This Is

A fully playable browser-based implementation of the Catan base game for personal use with friends. Players can compete against reasonably strategic bots or join real-time multiplayer sessions with other humans. The game enforces all rules programmatically — no honor system required.

## Core Value

A complete, rules-enforced solo game against bots that plays like the real thing.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Hex board renders with randomized resource tiles and number tokens
- [ ] Full rule enforcement — illegal moves are rejected by the server
- [ ] Placement phase: initial settlement and road placement in turn order
- [ ] Dice roll, resource distribution, and robber mechanics
- [ ] Development card deck: knight, monopoly, year of plenty, road building, victory point
- [ ] Bank and port trading (4:1 and port-specific rates)
- [ ] Building: roads, settlements, cities with resource cost enforcement
- [ ] Largest army and longest road tracking
- [ ] Victory point calculation and win detection
- [ ] Reasonably competitive bot AI that makes strategic decisions
- [ ] Real-time online multiplayer (humans + bots in same game)
- [ ] Lobby/room system for creating and joining games

### Out of Scope

- Player-to-player trading — deferred to v2
- Expansions (Seafarers, Cities & Knights) — base game only
- Public sign-up / user accounts — private/friends use
- Mobile native app — web-only
- Spectator mode — not needed for personal use

## Context

- Starting from scratch — no existing code
- Personal and friends use only; no need for public auth, scaling, or monetization
- Priority order: solo/bots working end-to-end first, then real-time multiplayer
- Catan board is a hex grid: 19 land hexes, 6 sea hexes with ports, vertices for settlements/cities, edges for roads
- Dev card deck has fixed composition per rules: 14 knights, 5 VP, 2 each of monopoly/year of plenty/road building
- Bots should participate in trading turns and make reasonable build decisions (settle near numbers, diversify resources)

## Constraints

- **Tech stack**: Greenfield — no existing preferences locked in
- **Scope**: Base Catan rules only; no expansion content
- **Audience**: Personal/friends only — authentication can be lightweight (room codes, display names)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bank/port trading only for v1 | P2P trading adds UI complexity; bank trades cover the core loop | — Pending |
| Solo/bots before multiplayer | Validate the game works correctly before adding network complexity | — Pending |
| Full server-side rule enforcement | Prevents cheating and keeps game state authoritative | — Pending |

---
*Last updated: 2026-02-28 after initialization*
