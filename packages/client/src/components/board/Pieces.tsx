import type { Point } from './hexMath';

interface PieceProps {
  position: Point;
  color: string;
}

export function Settlement({ position, color }: PieceProps) {
  return (
    <circle
      cx={position.x}
      cy={position.y}
      r={7}
      fill={color}
      stroke="#222"
      strokeWidth={1.5}
    />
  );
}

export function City({ position, color }: PieceProps) {
  // Pentagon shape
  const r = 10;
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = (Math.PI / 180) * (i * 72 - 90);
    return `${position.x + r * Math.cos(angle)},${position.y + r * Math.sin(angle)}`;
  }).join(' ');

  return (
    <polygon
      points={points}
      fill={color}
      stroke="#222"
      strokeWidth={1.5}
    />
  );
}

interface RoadSegmentProps {
  from: Point;
  to: Point;
  color: string;
}

export function RoadSegment({ from, to, color }: RoadSegmentProps) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
    />
  );
}

interface RobberProps {
  position: Point;
}

export function Robber({ position }: RobberProps) {
  return (
    <g>
      <circle
        cx={position.x}
        cy={position.y}
        r={12}
        fill="#333"
        fillOpacity={0.85}
        stroke="#111"
        strokeWidth={2}
      />
      <text
        x={position.x}
        y={position.y + 4}
        textAnchor="middle"
        fontSize={10}
        fill="#ddd"
        style={{ userSelect: 'none' }}
      >
        R
      </text>
    </g>
  );
}
