const TOKEN_PIPS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

interface NumberTokenProps {
  cx: number;
  cy: number;
  number: number;
}

export default function NumberToken({ cx, cy, number }: NumberTokenProps) {
  const pips = TOKEN_PIPS[number] ?? 0;
  const isRed = number === 6 || number === 8;
  const textColor = isRed ? '#e74c3c' : '#333';

  const pipDots = Array.from({ length: pips }, (_, i) => {
    const spacing = 4;
    const startX = cx - ((pips - 1) * spacing) / 2;
    return (
      <circle
        key={i}
        cx={startX + i * spacing}
        cy={cy + 10}
        r={1.5}
        fill={textColor}
      />
    );
  });

  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill="#f5f0e8" stroke="#5a4a3a" strokeWidth={1} />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={14}
        fontWeight="bold"
        fill={textColor}
        style={{ userSelect: 'none' }}
      >
        {number}
      </text>
      {pipDots}
    </g>
  );
}
