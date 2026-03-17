'use client';

import { GridSlot, ChemLine, ChemDot } from '@/lib/types';
import PlayerCard from './PlayerCard';

interface GridProps {
  grid: GridSlot[];
  lines: ChemLine[];
  dots: ChemDot[];
  validSlots?: number[];
  onSlotClick: (index: number) => void;
  onCardClick?: (index: number) => void;
  swapSource?: number | null;
  isComplete?: boolean;
}

// Fixed pixel positions for each of 9 grid cells on the court
// Arranged in a 3x3 football-formation style like Griddy
// Cell dimensions: 96w x 128h, with gaps
const GRID_W = 354;
const GRID_H = 440;
const CARD_W = 96;
const CARD_H = 128;
const H_GAP = 12;
const V_GAP = 14;

// Compute positions: 3 columns, 3 rows, centered
const COL_X = [
  (GRID_W - 3 * CARD_W - 2 * H_GAP) / 2,                          // col 0
  (GRID_W - 3 * CARD_W - 2 * H_GAP) / 2 + CARD_W + H_GAP,        // col 1
  (GRID_W - 3 * CARD_W - 2 * H_GAP) / 2 + 2 * (CARD_W + H_GAP),  // col 2
];
const ROW_Y = [
  16,                                  // row 0
  16 + CARD_H + V_GAP,                // row 1
  16 + 2 * (CARD_H + V_GAP),          // row 2
];

const CELL_POSITIONS = [
  { x: COL_X[0], y: ROW_Y[0] }, // 0: SG
  { x: COL_X[1], y: ROW_Y[0] }, // 1: PG
  { x: COL_X[2], y: ROW_Y[0] }, // 2: SF
  { x: COL_X[0], y: ROW_Y[1] }, // 3: UTIL
  { x: COL_X[1], y: ROW_Y[1] }, // 4: C
  { x: COL_X[2], y: ROW_Y[1] }, // 5: UTIL
  { x: COL_X[0], y: ROW_Y[2] }, // 6: SG
  { x: COL_X[1], y: ROW_Y[2] }, // 7: PF
  { x: COL_X[2], y: ROW_Y[2] }, // 8: SF
];

function getCellCenter(index: number) {
  const pos = CELL_POSITIONS[index];
  return {
    x: pos.x + CARD_W / 2,
    y: pos.y + CARD_H / 2,
  };
}

// Basketball court SVG lines drawn on the wooden floor
function CourtLines() {
  const cx = GRID_W / 2;
  const cy = GRID_H / 2;
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      viewBox={`0 0 ${GRID_W} ${GRID_H}`}
      style={{ width: GRID_W, height: GRID_H }}
    >
      {/* Court boundary */}
      <rect x="8" y="8" width={GRID_W - 16} height={GRID_H - 16} rx="6"
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

      {/* Center circle */}
      <circle cx={cx} cy={cy} r="45"
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="4"
        fill="rgba(255,255,255,0.08)" />

      {/* Half court line */}
      <line x1="8" y1={cy} x2={GRID_W - 8} y2={cy}
        stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />

      {/* Top key / free throw area */}
      <rect x={cx - 55} y="8" width="110" height="80" rx="3"
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      {/* Bottom key */}
      <rect x={cx - 55} y={GRID_H - 88} width="110" height="80" rx="3"
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      {/* Three point arcs (partial) */}
      <path d={`M ${cx - 120} 8 Q ${cx - 120} 100 ${cx} 120`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <path d={`M ${cx + 120} 8 Q ${cx + 120} 100 ${cx} 120`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
    </svg>
  );
}

export default function Grid({
  grid,
  lines,
  dots,
  validSlots = [],
  onSlotClick,
  onCardClick,
  swapSource,
  isComplete = false,
}: GridProps) {
  return (
    <div className="court-container" style={{ width: GRID_W, height: GRID_H }}>
      {/* Court lines */}
      <CourtLines />

      {/* Chemistry Lines SVG */}
      <svg
        className="absolute inset-0 pointer-events-none"
        viewBox={`0 0 ${GRID_W} ${GRID_H}`}
        style={{ width: GRID_W, height: GRID_H, zIndex: 5 }}
      >
        {lines.map((line, i) => {
          const hasCards = grid[line.from]?.card && grid[line.to]?.card;
          if (!hasCards) return null;

          const from = getCellCenter(line.from);
          const to = getCellCenter(line.to);

          return (
            <line
              key={i}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              className={`chem-line-${line.level}`}
              strokeWidth={line.level === 'green' ? 3.5 : line.level === 'yellow' ? 2.5 : 1.5}
              strokeOpacity={line.level === 'red' ? 0.3 : 0.85}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Grid cells (absolute positioned) */}
      {grid.map((slot, index) => {
        const pos = CELL_POSITIONS[index];
        const dot = dots.find((d) => d.slotIndex === index);
        const isValid = validSlots.includes(index);
        const isSwapSource = swapSource === index;
        const isSwapTarget = swapSource !== null && swapSource !== index && slot.card !== null;

        return (
          <div
            key={index}
            className="absolute"
            style={{
              left: pos.x,
              top: pos.y,
              width: CARD_W,
              height: CARD_H + 14, // extra space for dot
              zIndex: isSwapSource ? 30 : 10,
            }}
          >
            {slot.card ? (
              <div
                className={`
                  grid-slot-filled flex flex-col items-center
                  ${isSwapSource ? 'swap-source' : ''}
                  ${isSwapTarget ? 'swap-target' : ''}
                `}
                onClick={() => {
                  if (onCardClick) onCardClick(index);
                  else onSlotClick(index);
                }}
              >
                <PlayerCard
                  card={slot.card}
                  size="grid"
                  showDot={true}
                  dotLevel={dot?.level || 'red'}
                  className={isSwapSource ? '' : 'animate-card-place'}
                />
              </div>
            ) : (
              <div
                className={`
                  grid-slot-empty flex flex-col items-center justify-center
                  ${isValid ? 'valid-target' : ''}
                `}
                style={{ width: CARD_W, height: CARD_H }}
                onClick={() => onSlotClick(index)}
              >
                <span className="text-[11px] font-black text-white/25 uppercase tracking-wider">
                  {slot.label}
                </span>
                {isValid && (
                  <span className="text-[9px] text-green-400/80 mt-1 font-semibold">Place here</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
