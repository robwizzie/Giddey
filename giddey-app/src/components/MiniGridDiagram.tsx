'use client';

const GRID_NODES: { x: number; y: number; label: string }[] = [
  { x: 35, y: 10, label: 'SG' },
  { x: 65, y: 10, label: 'PF' },
  { x: 15, y: 32, label: 'UTIL' },
  { x: 38, y: 48, label: 'PG' },
  { x: 62, y: 48, label: 'PG' },
  { x: 85, y: 32, label: 'UTIL' },
  { x: 15, y: 66, label: 'SF' },
  { x: 85, y: 66, label: 'SG' },
  { x: 50, y: 86, label: 'C' },
];

const GRID_EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 4], [1, 5],
  [2, 3], [4, 5], [2, 6], [5, 7],
  [3, 6], [4, 7], [3, 8], [4, 8], [6, 8], [7, 8],
];

export default function MiniGridDiagram() {
  const w = 320, h = 260;
  return (
    <div className="rounded-xl overflow-hidden border-2 border-amber-900/60" style={{ background: 'linear-gradient(180deg, #c4651f 0%, #b5570f 30%, #a84e18 60%, #b5570f 85%, #c4651f 100%)' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
        <rect x="8" y="8" width={w - 16} height={h - 16} rx="6" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <line x1="8" y1={h / 2} x2={w - 8} y2={h / 2} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <circle cx={w / 2} cy={h / 2} r={30} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {GRID_EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={GRID_NODES[a].x * w / 100} y1={GRID_NODES[a].y * h / 100}
            x2={GRID_NODES[b].x * w / 100} y2={GRID_NODES[b].y * h / 100}
            stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"
          />
        ))}

        {GRID_NODES.map((node, i) => {
          const nx = node.x * w / 100;
          const ny = node.y * h / 100;
          const isUtil = node.label === 'UTIL';
          const rw = isUtil ? 30 : 22;
          const rh = 16;
          return (
            <g key={i}>
              <rect
                x={nx - rw / 2} y={ny - rh / 2}
                width={rw} height={rh} rx="4"
                fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.35)" strokeWidth="1"
              />
              <text
                x={nx} y={ny + 0.5}
                textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize="9" fontWeight="800"
                fontFamily="-apple-system, sans-serif"
                style={{ letterSpacing: '0.5px' } as React.CSSProperties}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
