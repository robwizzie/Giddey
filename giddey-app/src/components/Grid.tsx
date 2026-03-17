'use client';

import { GridSlot, ChemLine, ChemDot } from '@/lib/types';
import PlayerCard from './PlayerCard';

interface GridProps {
  grid: GridSlot[];
  lines: ChemLine[];
  dots: ChemDot[];
  validSlots?: number[];
  selectedCardIndex?: number | null;
  onSlotClick: (index: number) => void;
  onCardClick?: (index: number) => void;
  dragSource?: number | null;
}

// Grid cell positions for rendering (3x3)
// Each cell is positioned in a CSS grid
const CELL_POSITIONS = [
  { row: 0, col: 0 }, // 0: SG
  { row: 0, col: 1 }, // 1: PG
  { row: 0, col: 2 }, // 2: SF
  { row: 1, col: 0 }, // 3: UTIL
  { row: 1, col: 1 }, // 4: C
  { row: 1, col: 2 }, // 5: UTIL
  { row: 2, col: 0 }, // 6: SG
  { row: 2, col: 1 }, // 7: PF
  { row: 2, col: 2 }, // 8: SF
];

// SVG coordinates for chemistry lines (center of each cell)
// Based on a coordinate system where each cell is ~120px wide, ~150px tall, with gaps
const getCellCenter = (index: number, containerWidth: number) => {
  const pos = CELL_POSITIONS[index];
  const cellWidth = containerWidth / 3;
  const cellHeight = 155;
  return {
    x: pos.col * cellWidth + cellWidth / 2,
    y: pos.row * cellHeight + cellHeight / 2,
  };
};

export default function Grid({
  grid,
  lines,
  dots,
  validSlots = [],
  onSlotClick,
  onCardClick,
  dragSource,
}: GridProps) {
  const containerWidth = 360; // Approximate width for SVG

  return (
    <div className="relative">
      {/* Chemistry Lines SVG overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        viewBox={`0 0 ${containerWidth} 465`}
        preserveAspectRatio="xMidYMid meet"
      >
        {lines.map((line, i) => {
          const from = getCellCenter(line.from, containerWidth);
          const to = getCellCenter(line.to, containerWidth);
          const hasCards = grid[line.from]?.card && grid[line.to]?.card;

          if (!hasCards) return null;

          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={`chem-line-${line.level}`}
              strokeWidth={line.level === 'green' ? 3 : line.level === 'yellow' ? 2.5 : 2}
              strokeOpacity={line.level === 'red' ? 0.4 : 0.8}
            />
          );
        })}
      </svg>

      {/* Grid cells */}
      <div className="grid grid-cols-3 gap-3 relative z-20" style={{ width: containerWidth }}>
        {grid.map((slot, index) => {
          const dot = dots.find((d) => d.slotIndex === index);
          const isValid = validSlots.includes(index);
          const isDragSource = dragSource === index;

          return (
            <div
              key={index}
              className={`flex flex-col items-center justify-center rounded-xl min-h-[145px] relative
                ${!slot.card ? 'grid-slot' : 'grid-slot occupied'}
                ${isValid ? 'valid-target' : ''}
                ${isDragSource ? 'opacity-50' : ''}
              `}
              onClick={() => {
                if (slot.card && onCardClick) {
                  onCardClick(index);
                } else {
                  onSlotClick(index);
                }
              }}
            >
              {slot.card ? (
                <PlayerCard
                  card={slot.card}
                  size="sm"
                  showDot={true}
                  dotLevel={dot?.level || 'red'}
                  className="animate-card-enter"
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-white/30 uppercase tracking-wider">
                    {slot.label}
                  </span>
                  {isValid && (
                    <span className="text-[10px] text-green-400/70">Tap to place</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
