import type { Port } from '@catan/game-engine';
import type { Point } from './hexMath';

const PORT_ABBREVIATIONS: Record<string, string> = {
  '3:1': '3:1',
  lumber: 'Lum',
  wool: 'Wol',
  grain: 'Gra',
  brick: 'Brk',
  ore: 'Ore',
};

interface PortLabelProps {
  port: Port;
  position: Point;
}

export default function PortLabel({ port, position }: PortLabelProps) {
  const label = PORT_ABBREVIATIONS[port.type] ?? port.type;

  return (
    <g>
      <rect
        x={position.x - 16}
        y={position.y - 8}
        width={32}
        height={16}
        rx={3}
        fill="#2c2c2c"
        fillOpacity={0.85}
        stroke="#888"
        strokeWidth={0.5}
      />
      <text
        x={position.x}
        y={position.y + 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight="bold"
        fill={port.type === '3:1' ? '#ccc' : '#f5c542'}
        style={{ userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}
