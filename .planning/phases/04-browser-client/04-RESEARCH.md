# Phase 4: Browser Client - Research

**Researched:** 2026-02-28
**Domain:** React + SVG browser client for Catan game
**Confidence:** HIGH

## Summary

Phase 4 builds a React SPA that renders the Catan board as SVG, provides HUD panels for game state, and communicates with the existing Fastify/Socket.IO server. The existing game-engine package provides fully JSON-serializable `GameState`, `Action`, and `GameEvent` types that the client can consume directly. The server already handles state filtering (hiding opponent hands), action validation, and bot turns — the client only needs to display state and emit actions.

The hex grid uses flat-top orientation with cube coordinates (q, r, s). The `FLAT_TOP_CORNER_ANGLES_DEG` constant is already exported for Phase 4 rendering. Converting cube coords to pixel positions uses the standard formula: `x = size * 3/2 * q`, `y = size * sqrt(3) * (r + q/2)`.

**Primary recommendation:** Use Vite + React + Zustand + Socket.IO client + Tailwind CSS. Keep SVG rendering simple with direct coordinate math — no hex grid library needed since topology is already computed server-side.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Flat & clean aesthetic — solid resource colors, crisp SVG shapes, modern minimal look (Colonist.io style)
- Classic Catan color palette: forest green (lumber), light green (wool), gold/yellow (grain), brown/terra (brick), gray/slate (ore), tan (desert)
- Simple geometric shapes for pieces: settlements = small circles or triangles, cities = larger squares or pentagons, roads = thick lines
- Distinct player colors: red, blue, white, orange (matching PieceColor type)
- Number tokens: centered white/cream circle in hex center, number in bold, pip dots below, red text for 6 and 8
- Board dominates center, HUD panels around edges
- Desktop-first layout
- Resource hand displayed as card icons with count numbers
- Game log as collapsible sidebar
- Building cost reference card is toggleable
- Valid placement locations shown as glowing dots (vertices) and glowing lines (edges)
- Click to place — no drag and drop
- No confirmation step for placement
- Dice rolling with simple animation (~1 second)
- Simple form landing page: "Create Room" and "Join Room"
- Waiting room with room code, player list, bot count slider, Start Game button
- Victory overlay on win
- Tailwind CSS only — no component library

### Claude's Discretion
- React project setup (Vite vs Next.js — likely Vite for SPA)
- Zustand store structure and slice organization
- SVG hex grid math and coordinate system
- Socket.IO client connection management
- Component file structure and naming
- Exact spacing, typography, and responsive breakpoints
- Animation implementation details
- Error handling for connection issues

### Deferred Ideas (OUT OF SCOPE)
- Mobile-responsive layout
- Sound effects
- Player-to-player trade UI
- Spectator mode
- Game replay/history
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOARD-01 | Hex grid rendered in SVG with 19 land hexes, resource colors, number tokens with pips, port labels | SVG hex rendering with flat-top cube coord math; FLAT_TOP_CORNER_ANGLES_DEG already exported |
| BOARD-02 | Settlement, city, road pieces in player colors; robber token on hex | Simple SVG shapes (circle, pentagon, line) with PieceColor CSS mapping |
| BOARD-03 | Valid placement vertices/edges highlighted during build and setup | Filter vertices/edges from GameState, render with glow CSS class |
| HUD-01 | Player's own resource cards and dev cards in private panel | Read from filtered GameState.players[myId].hand and unplayedDevCards |
| HUD-02 | All players' total card counts visible | Sum opponent hand values + unplayedDevCards.length from filtered state |
| HUD-03 | Dice result and current turn phase displayed | GameState.phase + DICE_ROLLED event for last roll |
| HUD-04 | VP scoreboard; own VP dev cards hidden until win | Calculate VP from settlements/cities/awards; vpDevCards hidden by stateFilter |
| HUD-05 | Game log records significant actions | Accumulate GameEvent[] from game:state broadcasts |
| HUD-06 | Building cost reference card visible | Static UI component with BUILD_COSTS data |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | Industry standard, team familiarity |
| Vite | 6.x | Build tool & dev server | Fast HMR, native ESM, simple config for SPA |
| Zustand | 5.x | State management | Minimal API, no boilerplate, works well with external data sources (sockets) |
| socket.io-client | 4.8.x | WebSocket communication | Must match server's socket.io@4.8.3 |
| Tailwind CSS | 4.x | Styling | User locked decision — no component library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/react | 19.x | TypeScript types | Always — project is fully typed |
| @types/react-dom | 19.x | TypeScript types | Always |
| autoprefixer | 10.x | CSS vendor prefixes | Tailwind peer dependency |
| postcss | 8.x | CSS processing | Tailwind peer dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | Redux Toolkit | RTK has more boilerplate, overkill for this state shape |
| Vite | Next.js | Next.js adds SSR complexity not needed for SPA |
| Raw SVG | D3.js | D3 adds weight; hex math is simple enough without it |
| Raw SVG | Pixi.js/Canvas | Canvas loses SVG accessibility and CSS styling |

**Installation:**
```bash
npm create vite@latest client -- --template react-ts
cd packages/client
npm install zustand socket.io-client
npm install -D tailwindcss @tailwindcss/vite @types/react @types/react-dom
```

## Architecture Patterns

### Recommended Project Structure
```
packages/client/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Router/page switching
│   ├── store/
│   │   ├── gameStore.ts          # Zustand store for GameState + connection
│   │   └── types.ts              # Client-specific types
│   ├── socket/
│   │   └── client.ts             # Socket.IO connection + event wiring
│   ├── pages/
│   │   ├── LobbyPage.tsx         # Create/Join room
│   │   └── GamePage.tsx          # Board + HUD layout
│   ├── components/
│   │   ├── board/
│   │   │   ├── HexBoard.tsx      # SVG container + hex grid
│   │   │   ├── HexTile.tsx       # Single hex polygon
│   │   │   ├── NumberToken.tsx   # Number circle + pips
│   │   │   ├── Pieces.tsx        # Settlements, cities, roads, robber
│   │   │   └── hexMath.ts        # Cube-to-pixel conversion
│   │   ├── hud/
│   │   │   ├── PlayerHand.tsx    # Resource cards + dev cards
│   │   │   ├── Scoreboard.tsx    # VP table
│   │   │   ├── GameLog.tsx       # Collapsible event log
│   │   │   ├── DiceDisplay.tsx   # Dice result + roll button
│   │   │   ├── TurnInfo.tsx      # Phase label + active player
│   │   │   ├── BuildCosts.tsx    # Toggleable reference card
│   │   │   └── ActionBar.tsx     # Context-sensitive action buttons
│   │   └── lobby/
│   │       ├── CreateRoom.tsx    # Create room form
│   │       ├── JoinRoom.tsx      # Join room form
│   │       └── WaitingRoom.tsx   # Player list + start button
│   └── utils/
│       └── colors.ts             # Resource colors, player colors
```

### Pattern 1: Zustand Store with Socket.IO
**What:** Single Zustand store holds all client state; socket events update store directly.
**When to use:** Always — this is the primary state management pattern.
**Example:**
```typescript
import { create } from 'zustand';
import type { GameState, GameEvent, Action } from '@catan/game-engine';
import type { LobbyState } from './types';

interface GameStore {
  // Connection
  connected: boolean;
  playerId: string | null;
  roomCode: string | null;

  // Lobby
  lobbyState: LobbyState | null;

  // Game
  gameState: GameState | null;
  lastEvents: GameEvent[];
  gameLog: GameEvent[];
  lastDiceRoll: number | null;
  error: string | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setPlayerId: (id: string) => void;
  setRoomCode: (code: string) => void;
  setLobbyState: (state: LobbyState) => void;
  setGameState: (state: GameState, events: GameEvent[]) => void;
  setError: (error: string | null) => void;
}
```

### Pattern 2: Flat-Top Hex Pixel Coordinates
**What:** Convert cube coordinates to pixel positions for SVG rendering.
**When to use:** Every hex, vertex, and edge position.
**Example:**
```typescript
// Flat-top hex: pointy sides on top/bottom, flat sides on left/right
const HEX_SIZE = 50; // circumradius (center to vertex)

function cubeToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (3/2 * q);
  const y = HEX_SIZE * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
  return { x, y };
}

// Hex polygon points (flat-top: first vertex at 0°)
function hexPoints(cx: number, cy: number, size: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map(angle => {
      const rad = (Math.PI / 180) * angle;
      return `${cx + size * Math.cos(rad)},${cy + size * Math.sin(rad)}`;
    })
    .join(' ');
}
```

### Pattern 3: Vertex/Edge Position from Keys
**What:** Derive pixel positions for vertices and edges from their hex-based keys.
**When to use:** Rendering pieces, placement highlights.
**Example:**
```typescript
// Vertex key = "h1|h2|h3" (sorted hex keys)
// Position = centroid of the 3 hex centers
function vertexPosition(vertexKey: string, hexPositions: Map<string, Point>): Point {
  const hexKeys = vertexKey.split('|');
  const positions = hexKeys.map(k => hexPositions.get(k)).filter(Boolean);
  const x = positions.reduce((sum, p) => sum + p!.x, 0) / positions.length;
  const y = positions.reduce((sum, p) => sum + p!.y, 0) / positions.length;
  return { x, y };
}

// Edge key = "h1~h2" (sorted hex keys)
// Position = midpoint of the 2 hex centers
function edgePosition(edgeKey: string, hexPositions: Map<string, Point>): Point {
  const [k1, k2] = edgeKey.split('~');
  const p1 = hexPositions.get(k1)!;
  const p2 = hexPositions.get(k2)!;
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}
```

### Anti-Patterns to Avoid
- **Mutating GameState directly:** The server is authoritative. Never optimistically update GameState — wait for `game:state` broadcast.
- **Building hex topology client-side:** The server already computes vertices, edges, adjacency. Use `GameState.board` directly.
- **Using useEffect for socket events:** Wire socket events to Zustand store outside React lifecycle. Connect once, update store.
- **Multiple socket connections:** Use a single socket instance. Don't create new connections per component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hex grid topology | Custom adjacency graph | Server-provided Board type | Board already has vertices, edges, adjacency — just render positions |
| State filtering | Client-side hand hiding | Server's filterStateForPlayer | Already implemented server-side |
| Action validation | Client-side rule checking | Server validation + action:error | Server is authoritative; client just sends actions |
| CSS framework | Custom CSS architecture | Tailwind CSS utility classes | User locked decision |
| Hex coordinate math | Custom coordinate system | cubeToPixel formula + FLAT_TOP_CORNER_ANGLES_DEG | Well-known formula, already exported from game-engine |

**Key insight:** The server-side architecture (authoritative state, filtered broadcasts, action validation) means the client is purely a view layer. All game logic already exists — the client renders state and sends user intents.

## Common Pitfalls

### Pitfall 1: Vertex Position Calculation with Virtual Hex Keys
**What goes wrong:** Vertex keys contain virtual sea hex coordinates (e.g., "0,0,0|1,-1,0|0,-1,1" where some keys reference hexes outside the 19-hex board). Trying to look up these keys in `board.hexes` returns undefined.
**Why it happens:** Border vertices are keyed using virtual sea hex coordinates to ensure global uniqueness (documented in STATE.md decision [01-02]).
**How to avoid:** When computing vertex pixel position, parse the cube coords directly from the key string (split by `|`, then split each by `,` to get q,r,s), then compute pixel position from the cube coords. Don't rely on hex lookup.
**Warning signs:** Vertices on the board edge not rendering or rendering at wrong positions.

### Pitfall 2: Border Edge Keys with Sea Marker
**What goes wrong:** Some edge keys use format "hKey~sea~edgeIdx" instead of "h1~h2". Standard split on `~` expecting exactly 2 parts breaks.
**Why it happens:** Border edges have only one land hex neighbor; the key format includes "sea" marker to prevent collisions (STATE.md decision [01-02]).
**How to avoid:** For edge position, use the edge's `vertexKeys` property (always exactly 2 vertex keys) — compute midpoint of the two vertex positions.
**Warning signs:** Missing roads or edges on the board border.

### Pitfall 3: Socket.IO Version Mismatch
**What goes wrong:** Client can't connect or gets protocol errors.
**Why it happens:** socket.io-client must match the server's socket.io major version (4.x).
**How to avoid:** Pin socket.io-client to 4.8.x to match server's socket.io@4.8.3.
**Warning signs:** Connection failures, "invalid namespace" errors.

### Pitfall 4: VP Calculation with Hidden Dev Cards
**What goes wrong:** Scoreboard shows wrong VP counts.
**Why it happens:** `vpDevCards` is zeroed out for opponents in filtered state. VP should be calculated from visible sources only (settlements, cities, awards).
**How to avoid:** Calculate VP as: settlements * 1 + cities * 2 + (longestRoadHolder === playerId ? 2 : 0) + (largestArmyHolder === playerId ? 2 : 0). Only show vpDevCards for the local player.
**Warning signs:** VP counts don't match expected totals.

### Pitfall 5: Connecting Before Room Join
**What goes wrong:** Socket events fire before the store is ready.
**Why it happens:** Socket connects on import, events arrive before join-room callback completes.
**How to avoid:** Connect socket lazily (on room create/join), wire event listeners before emitting join-room.
**Warning signs:** Missed initial lobby:state broadcasts.

## Code Examples

### Socket.IO Client Setup
```typescript
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from './types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectAndJoin(code: string, displayName: string): Promise<string> {
  const s = getSocket();
  s.connect();

  return new Promise((resolve, reject) => {
    s.emit('join-room', { code, displayName }, (response) => {
      if (response.ok && response.playerId) {
        resolve(response.playerId);
      } else {
        reject(new Error(response.error ?? 'Failed to join room'));
      }
    });
  });
}
```

### Resource Color Map
```typescript
export const RESOURCE_COLORS: Record<string, string> = {
  lumber: '#2d6a2e',   // forest green
  wool: '#90c95e',     // light green
  grain: '#f5c542',    // gold/yellow
  brick: '#b05a3a',    // brown/terra
  ore: '#7a8b99',      // gray/slate
};

export const DESERT_COLOR = '#d4b896'; // tan

export const PLAYER_COLORS: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  white: '#ecf0f1',
  orange: '#e67e22',
};
```

### SVG Hex Rendering
```typescript
function HexTile({ hex, cx, cy, size }: HexTileProps) {
  const points = hexPoints(cx, cy, size);
  const fillColor = hex.resource ? RESOURCE_COLORS[hex.resource] : DESERT_COLOR;

  return (
    <g>
      <polygon
        points={points}
        fill={fillColor}
        stroke="#5a4a3a"
        strokeWidth={2}
      />
      {hex.number && (
        <NumberToken cx={cx} cy={cy} number={hex.number} />
      )}
    </g>
  );
}
```

### Token Pips Rendering
```typescript
const TOKEN_PIPS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

function NumberToken({ cx, cy, number }: { cx: number; cy: number; number: number }) {
  const pips = TOKEN_PIPS[number] ?? 0;
  const isRed = number === 6 || number === 8;
  const pipDots = Array.from({ length: pips }, (_, i) => (
    <circle
      key={i}
      cx={cx - (pips - 1) * 2 + i * 4}
      cy={cy + 10}
      r={1.5}
      fill={isRed ? '#e74c3c' : '#333'}
    />
  ));

  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill="#f5f0e8" stroke="#5a4a3a" strokeWidth={1} />
      <text
        x={cx} y={cy + 4}
        textAnchor="middle"
        fontSize={14}
        fontWeight="bold"
        fill={isRed ? '#e74c3c' : '#333'}
      >
        {number}
      </text>
      {pipDots}
    </g>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create React App | Vite | 2023 | CRA deprecated, Vite is default |
| Redux + thunks | Zustand | 2022+ | Simpler API, less boilerplate |
| Tailwind v3 (PostCSS) | Tailwind v4 (Vite plugin) | 2025 | @tailwindcss/vite plugin, no PostCSS config needed |
| socket.io-client callbacks | Promise wrappers | Current | Cleaner async flow for join/create |

**Deprecated/outdated:**
- Create React App: No longer maintained, use Vite
- Tailwind CSS v3: v4 uses Vite plugin (`@tailwindcss/vite`) instead of PostCSS, CSS-first config instead of JS config

## Open Questions

1. **Vite proxy for Socket.IO in development**
   - What we know: Vite dev server runs on different port than Fastify server
   - What's unclear: Exact proxy config for WebSocket upgrade
   - Recommendation: Use Vite `server.proxy` config to proxy `/socket.io` to the Fastify server

2. **Workspace TypeScript references**
   - What we know: Client needs to import types from `@catan/game-engine` and server types
   - What's unclear: Whether to duplicate types or use workspace references
   - Recommendation: Import game-engine types via workspace dependency; duplicate the server's `ServerToClientEvents`/`ClientToServerEvents` types in a shared package or copy to client

## Sources

### Primary (HIGH confidence)
- Existing codebase: game-engine types.ts, server types.ts, socket handlers, coordinates.ts
- FLAT_TOP_CORNER_ANGLES_DEG exported from coordinates.ts for Phase 4 rendering
- Server socket event protocol from lobbyHandlers.ts and gameHandlers.ts

### Secondary (MEDIUM confidence)
- React 19, Vite 6, Zustand 5, Tailwind 4 — current stable versions
- Cube-to-pixel formula from Red Blob Games hex grid reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - well-established libraries, versions verified
- Architecture: HIGH - server-side types and protocols already defined, client is view layer
- Pitfalls: HIGH - derived from actual codebase analysis (vertex keys, edge keys, state filtering)

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable domain, unlikely to change)
