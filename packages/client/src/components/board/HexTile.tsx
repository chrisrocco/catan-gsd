import type { Hex } from '@catan/game-engine';
import { hexPoints } from './hexMath';
import { RESOURCE_COLORS, DESERT_COLOR } from '../../utils/colors';
import NumberToken from './NumberToken';

interface HexTileProps {
  hex: Hex;
  cx: number;
  cy: number;
  size: number;
}

export default function HexTile({ hex, cx, cy, size }: HexTileProps) {
  const points = hexPoints(cx, cy, size);
  const fillColor = hex.resource ? RESOURCE_COLORS[hex.resource] ?? '#888' : DESERT_COLOR;

  return (
    <g>
      <polygon points={points} fill={fillColor} stroke="#5a4a3a" strokeWidth={2} />
      {hex.number != null && <NumberToken cx={cx} cy={cy} number={hex.number} />}
    </g>
  );
}
