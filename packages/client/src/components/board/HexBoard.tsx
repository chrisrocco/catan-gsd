import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { PLAYER_COLORS } from '../../utils/colors';
import {
  cubeToPixel,
  vertexPosition,
  edgeEndpoints,
  computeBoardBounds,
  HEX_SIZE,
  type Point,
} from './hexMath';
import HexTile from './HexTile';
import PortLabel from './PortLabel';
import { Settlement, City, RoadSegment, Robber } from './Pieces';
import { submitAction } from '../../socket/client';

export default function HexBoard() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const pendingAction = useGameStore((s) => s.pendingAction);
  const clearPendingAction = useGameStore((s) => s.clearPendingAction);

  const { hexPositions, vertexPositions, bounds } = useMemo(() => {
    if (!gameState)
      return {
        hexPositions: new Map<string, Point>(),
        vertexPositions: new Map<string, Point>(),
        bounds: { minX: 0, minY: 0, width: 100, height: 100 },
      };

    const hp = new Map<string, Point>();
    for (const hex of Object.values(gameState.board.hexes)) {
      hp.set(hex.key, cubeToPixel(hex.q, hex.r));
    }

    const vp = new Map<string, Point>();
    for (const vertex of Object.values(gameState.board.vertices)) {
      vp.set(vertex.key, vertexPosition(vertex.key));
    }

    return { hexPositions: hp, vertexPositions: vp, bounds: computeBoardBounds(hp) };
  }, [gameState]);

  // Compute valid placements
  const { validVertices, validEdges, validHexes } = useMemo(() => {
    if (!gameState || !playerId)
      return { validVertices: new Set<string>(), validEdges: new Set<string>(), validHexes: new Set<string>() };

    const { board, phase } = gameState;
    const isSetup = phase === 'setup-forward' || phase === 'setup-reverse';
    const isMyTurn = gameState.activePlayer === playerId;
    const vv = new Set<string>();
    const ve = new Set<string>();
    const vh = new Set<string>();

    // Settlement placement
    if (
      (isMyTurn && pendingAction === 'settlement') ||
      (isMyTurn && isSetup && gameState.setupPlacementsDone % 2 === 0)
    ) {
      for (const vertex of Object.values(board.vertices)) {
        if (vertex.building) continue;
        // Distance rule: no adjacent vertex has a building
        const hasAdjacentBuilding = vertex.adjacentVertexKeys.some(
          (vk) => board.vertices[vk]?.building != null,
        );
        if (hasAdjacentBuilding) continue;

        if (isSetup) {
          // Setup: any isolated vertex
          vv.add(vertex.key);
        } else {
          // Normal: must be adjacent to own road
          const hasOwnRoad = vertex.adjacentEdgeKeys.some(
            (ek) => board.edges[ek]?.road?.playerId === playerId,
          );
          if (hasOwnRoad) vv.add(vertex.key);
        }
      }
    }

    // Road placement
    if (
      (isMyTurn && pendingAction === 'road') ||
      (isMyTurn && isSetup && gameState.setupPlacementsDone % 2 === 1) ||
      (isMyTurn && phase === 'road-building')
    ) {
      for (const edge of Object.values(board.edges)) {
        if (edge.road) continue;
        // Must connect to own building or own road
        const [v1Key, v2Key] = edge.vertexKeys;
        const v1 = board.vertices[v1Key];
        const v2 = board.vertices[v2Key];

        const touchesOwnBuilding =
          (v1?.building?.playerId === playerId) || (v2?.building?.playerId === playerId);

        const touchesOwnRoad =
          v1?.adjacentEdgeKeys.some((ek) => ek !== edge.key && board.edges[ek]?.road?.playerId === playerId) ||
          v2?.adjacentEdgeKeys.some((ek) => ek !== edge.key && board.edges[ek]?.road?.playerId === playerId);

        if (touchesOwnBuilding || touchesOwnRoad) {
          ve.add(edge.key);
        }
      }
    }

    // City upgrade
    if (isMyTurn && pendingAction === 'city') {
      for (const vertex of Object.values(board.vertices)) {
        if (vertex.building?.playerId === playerId && vertex.building.type === 'settlement') {
          vv.add(vertex.key);
        }
      }
    }

    // Robber placement
    if (isMyTurn && (pendingAction === 'robber' || phase === 'robber-move')) {
      for (const hex of Object.values(board.hexes)) {
        if (hex.key !== gameState.robberHex) {
          vh.add(hex.key);
        }
      }
    }

    return { validVertices: vv, validEdges: ve, validHexes: vh };
  }, [gameState, playerId, pendingAction]);

  if (!gameState) return null;

  const { board, players, robberHex, phase } = gameState;
  const isMyTurn = gameState.activePlayer === playerId;

  const handleVertexClick = (vertexKey: string) => {
    if (pendingAction === 'city') {
      submitAction({ type: 'UPGRADE_CITY', vertexKey });
    } else {
      submitAction({ type: 'PLACE_SETTLEMENT', vertexKey });
    }
    clearPendingAction();
  };

  const handleEdgeClick = (edgeKey: string) => {
    submitAction({ type: 'PLACE_ROAD', edgeKey });
    if (phase !== 'road-building') {
      clearPendingAction();
    }
  };

  const handleHexClick = (hexKey: string) => {
    submitAction({ type: 'MOVE_ROBBER', hexKey });
    clearPendingAction();
  };

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      className="h-full w-full max-h-[80vh]"
      style={{ maxWidth: bounds.width * 2 }}
    >
      {/* Layer 1: Hex tiles */}
      {Object.values(board.hexes).map((hex) => {
        const pos = hexPositions.get(hex.key);
        if (!pos) return null;
        return (
          <HexTile key={hex.key} hex={hex} cx={pos.x} cy={pos.y} size={HEX_SIZE} />
        );
      })}

      {/* Layer 1b: Valid hex highlights (for robber) */}
      {validHexes.size > 0 &&
        Array.from(validHexes).map((hexKey) => {
          const pos = hexPositions.get(hexKey);
          if (!pos) return null;
          return (
            <circle
              key={`hex-hl-${hexKey}`}
              cx={pos.x}
              cy={pos.y}
              r={HEX_SIZE * 0.7}
              fill="rgba(255, 0, 0, 0.15)"
              stroke="rgba(255, 0, 0, 0.5)"
              strokeWidth={2}
              className="cursor-pointer"
              onClick={() => handleHexClick(hexKey)}
            >
              <animate
                attributeName="stroke-opacity"
                values="0.5;1;0.5"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          );
        })}

      {/* Layer 2: Port labels */}
      {Object.values(board.vertices).map((vertex) => {
        if (!vertex.port) return null;
        const pos = vertexPositions.get(vertex.key);
        if (!pos) return null;
        return (
          <PortLabel key={`port-${vertex.key}`} port={vertex.port} position={pos} />
        );
      })}

      {/* Layer 3: Roads */}
      {Object.values(board.edges).map((edge) => {
        if (!edge.road) return null;
        const [from, to] = edgeEndpoints(edge);
        const player = players[edge.road.playerId];
        const color = player ? PLAYER_COLORS[player.color] ?? '#888' : '#888';
        return (
          <RoadSegment key={`road-${edge.key}`} from={from} to={to} color={color} />
        );
      })}

      {/* Layer 3b: Valid edge highlights */}
      {validEdges.size > 0 &&
        Array.from(validEdges).map((edgeKey) => {
          const edge = board.edges[edgeKey];
          if (!edge) return null;
          const [from, to] = edgeEndpoints(edge);
          return (
            <line
              key={`edge-hl-${edgeKey}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(255, 255, 100, 0.7)"
              strokeWidth={7}
              strokeLinecap="round"
              className="cursor-pointer"
              onClick={() => handleEdgeClick(edgeKey)}
            >
              <animate
                attributeName="stroke-opacity"
                values="0.4;0.9;0.4"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </line>
          );
        })}

      {/* Layer 4: Buildings */}
      {Object.values(board.vertices).map((vertex) => {
        if (!vertex.building) return null;
        const pos = vertexPositions.get(vertex.key);
        if (!pos) return null;
        const player = players[vertex.building.playerId];
        const color = player ? PLAYER_COLORS[player.color] ?? '#888' : '#888';

        if (vertex.building.type === 'city') {
          return <City key={`city-${vertex.key}`} position={pos} color={color} />;
        }
        return (
          <Settlement key={`settle-${vertex.key}`} position={pos} color={color} />
        );
      })}

      {/* Layer 4b: Valid vertex highlights */}
      {validVertices.size > 0 &&
        Array.from(validVertices).map((vKey) => {
          const pos = vertexPositions.get(vKey);
          if (!pos) return null;
          return (
            <circle
              key={`vert-hl-${vKey}`}
              cx={pos.x}
              cy={pos.y}
              r={9}
              fill="rgba(255, 255, 100, 0.5)"
              stroke="rgba(255, 255, 100, 0.9)"
              strokeWidth={2}
              className="cursor-pointer"
              onClick={() => handleVertexClick(vKey)}
            >
              <animate
                attributeName="fill-opacity"
                values="0.3;0.7;0.3"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          );
        })}

      {/* Layer 5: Robber */}
      {robberHex && hexPositions.get(robberHex) && (
        <Robber position={hexPositions.get(robberHex)!} />
      )}
    </svg>
  );
}
