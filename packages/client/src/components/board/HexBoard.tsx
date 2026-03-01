import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { PLAYER_COLORS } from '../../utils/colors';
import { cubeToPixel, parseCubeCoords, vertexPosition, edgeEndpoints, computeBoardBounds, HEX_SIZE, type Point } from './hexMath';
import HexTile from './HexTile';
import PortLabel from './PortLabel';
import { Settlement, City, RoadSegment, Robber } from './Pieces';

export default function HexBoard() {
  const gameState = useGameStore((s) => s.gameState);

  const { hexPositions, vertexPositions, bounds } = useMemo(() => {
    if (!gameState) return { hexPositions: new Map<string, Point>(), vertexPositions: new Map<string, Point>(), bounds: { minX: 0, minY: 0, width: 100, height: 100 } };

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

  if (!gameState) return null;

  const { board, players, robberHex } = gameState;

  // Render layers back to front
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
        return <HexTile key={hex.key} hex={hex} cx={pos.x} cy={pos.y} size={HEX_SIZE} />;
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
        return <Settlement key={`settle-${vertex.key}`} position={pos} color={color} />;
      })}

      {/* Layer 5: Robber */}
      {robberHex && hexPositions.get(robberHex) && (
        <Robber position={hexPositions.get(robberHex)!} />
      )}
    </svg>
  );
}
