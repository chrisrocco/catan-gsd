// ============================================================
// Primitive domain types
// ============================================================

export type ResourceType = 'lumber' | 'wool' | 'grain' | 'brick' | 'ore';

export type DevCardType =
  | 'knight'
  | 'victory-point'
  | 'road-building'
  | 'year-of-plenty'
  | 'monopoly';

export type GamePhase =
  | 'setup-forward'
  | 'setup-reverse'
  | 'pre-roll'
  | 'post-roll'
  | 'robber-move'
  | 'robber-steal'
  | 'discard'
  | 'road-building'
  | 'year-of-plenty'
  | 'game-over';

export type PortType = '3:1' | ResourceType;

export type BuildingType = 'settlement' | 'city';

export type PieceColor = 'red' | 'blue' | 'white' | 'orange';

// ============================================================
// Board types (plain objects — no class instances)
// ============================================================

export interface Building {
  playerId: string;
  type: BuildingType;
}

export interface Road {
  playerId: string;
}

export interface Port {
  type: PortType;
}

export interface Hex {
  key: string;       // canonical cube coord string e.g. "0,0,0"
  q: number;
  r: number;
  s: number;
  resource: ResourceType | null;  // null = desert
  number: number | null;          // null = desert
  vertexKeys: string[];           // 6 vertex keys (references into Board.vertices)
  edgeKeys: string[];             // 6 edge keys (references into Board.edges)
}

export interface Vertex {
  key: string;                    // canonical 3-hex sorted string
  building: Building | null;
  port: Port | null;
  adjacentHexKeys: string[];      // land hexes adjacent to this vertex
  adjacentEdgeKeys: string[];
  adjacentVertexKeys: string[];
}

export interface Edge {
  key: string;                    // canonical 2-hex sorted string
  road: Road | null;
  vertexKeys: [string, string];   // exactly 2 vertex endpoints
  adjacentHexKeys: string[];      // 1 or 2 hexes sharing this edge
}

export interface Board {
  hexes: Record<string, Hex>;
  vertices: Record<string, Vertex>;
  edges: Record<string, Edge>;
}

// ============================================================
// Player state
// ============================================================

export type ResourceHand = Record<ResourceType, number>;

export interface Player {
  id: string;
  color: PieceColor;
  hand: ResourceHand;
  unplayedDevCards: DevCardType[];   // action cards not yet played (excludes VP cards)
  vpDevCards: number;                // count of VP dev cards (hidden until win)
  knightCount: number;               // knights played this game
  devCardBoughtThisTurn: boolean;    // true if player bought a dev card this turn
  devCardsPlayedThisTurn: number;    // max 1 action card per turn
  roadCount: number;                 // roads placed on board
  settlementCount: number;           // settlements on board
  cityCount: number;                 // cities on board
}

// ============================================================
// Game state — fully JSON-serializable
// ============================================================

export interface GameState {
  board: Board;
  players: Record<string, Player>;  // keyed by player ID
  playerOrder: string[];            // turn order array
  activePlayer: string;             // player ID of current actor
  phase: GamePhase;
  turnNumber: number;
  deck: DevCardType[];              // remaining draw pile
  discardPile: DevCardType[];       // played action cards
  bank: ResourceHand;               // resources remaining in bank (19 max each)
  robberHex: string;                // hex key where robber currently sits
  longestRoadHolder: string | null; // player ID or null
  longestRoadLength: number;        // current longest road length
  largestArmyHolder: string | null; // player ID or null
  largestArmyCount: number;         // current largest army count
  discardQueue: string[];           // player IDs still needing to discard (on 7 roll)
  roadBuildingRoadsLeft: number;    // 2 → 1 → 0 during road-building dev card
  yearOfPlentyResourcesLeft: number; // 2 → 1 → 0 during year-of-plenty
  winner: string | null;            // player ID or null
  setupPlacementsDone: number;      // tracks progress through setup phases
}

// ============================================================
// Actions — discriminated union by 'type' field
// ============================================================

export type Action =
  | { type: 'PLACE_SETTLEMENT'; playerId: string; vertexKey: string }
  | { type: 'PLACE_ROAD'; playerId: string; edgeKey: string }
  | { type: 'UPGRADE_CITY'; playerId: string; vertexKey: string }
  | { type: 'ROLL_DICE'; playerId: string; roll?: number }  // roll is injected for tests (seeded)
  | { type: 'MOVE_ROBBER'; playerId: string; hexKey: string }
  | { type: 'STEAL_RESOURCE'; playerId: string; targetPlayerId: string }
  | { type: 'SKIP_STEAL'; playerId: string }
  | { type: 'DISCARD_RESOURCES'; playerId: string; resources: Partial<ResourceHand> }
  | { type: 'BUY_DEV_CARD'; playerId: string }
  | { type: 'PLAY_DEV_CARD'; playerId: string; card: Exclude<DevCardType, 'victory-point'>; monopolyResource?: ResourceType; yearOfPlentyResources?: [ResourceType, ResourceType] }
  | { type: 'TRADE_BANK'; playerId: string; give: ResourceType; receive: ResourceType; amount: number }
  | { type: 'END_TURN'; playerId: string };

// ============================================================
// Events — emitted by applyAction for downstream consumers
// ============================================================

export type GameEvent =
  | { type: 'DICE_ROLLED'; roll: number; individual: [number, number] }
  | { type: 'RESOURCES_DISTRIBUTED'; grants: Record<string, Partial<ResourceHand>> }
  | { type: 'ROBBER_ACTIVATED'; playersDiscarding: string[] }
  | { type: 'RESOURCE_STOLEN'; fromPlayer: string; byPlayer: string; resource: ResourceType }
  | { type: 'DEV_CARD_DRAWN'; playerId: string; card: DevCardType }
  | { type: 'MONOPOLY_COLLECTED'; playerId: string; resource: ResourceType; totalTaken: number }
  | { type: 'YEAR_OF_PLENTY_GRANTED'; playerId: string; resources: [ResourceType, ResourceType] }
  | { type: 'LONGEST_ROAD_AWARDED'; playerId: string; length: number; previousHolder: string | null }
  | { type: 'LARGEST_ARMY_AWARDED'; playerId: string; count: number; previousHolder: string | null }
  | { type: 'GAME_WON'; playerId: string; finalVP: number }
  | { type: 'SETTLEMENT_PLACED'; playerId: string; vertexKey: string }
  | { type: 'CITY_PLACED'; playerId: string; vertexKey: string }
  | { type: 'ROAD_PLACED'; playerId: string; edgeKey: string }
  | { type: 'TRADE_COMPLETED'; playerId: string; gave: ResourceType; gaveAmount: number; received: ResourceType; receivedAmount: number };

// ============================================================
// applyAction return type
// ============================================================

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
  error?: string;
}
