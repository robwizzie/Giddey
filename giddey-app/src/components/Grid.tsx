'use client';

import { GridSlot, ChemLine, ChemDot, SLOT_POSITIONS, CARD_W, CARD_H, GRID_CONTAINER_W, GRID_CONTAINER_H } from '@/lib/types';
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
  onDropOnSlot?: (slotIndex: number) => void;
}

function getCellCenter(index: number) {
  const pos = SLOT_POSITIONS[index];
  return {
    x: pos.x + CARD_W / 2,
    y: pos.y + CARD_H / 2,
  };
}

function CourtLines() {
  const cx = GRID_CONTAINER_W / 2;
  const cy = GRID_CONTAINER_H / 2;
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      viewBox={`0 0 ${GRID_CONTAINER_W} ${GRID_CONTAINER_H}`}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Court boundary */}
      <rect x="8" y="8" width={GRID_CONTAINER_W - 16} height={GRID_CONTAINER_H - 16} rx="6"
        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />

      {/* Center circle */}
      <circle cx={cx} cy={cy} r="50"
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="4"
        fill="rgba(255,255,255,0.06)" />

      {/* Half court line */}
      <line x1="8" y1={cy} x2={GRID_CONTAINER_W - 8} y2={cy}
        stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

      {/* Top key */}
      <rect x={cx - 65} y="8" width="130" height="100" rx="3"
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Bottom key */}
      <rect x={cx - 65} y={GRID_CONTAINER_H - 108} width="130" height="100" rx="3"
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
  onDropOnSlot,
}: GridProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    if (onDropOnSlot) {
      onDropOnSlot(slotIndex);
    }
  };

  return (
    <div
      className="court-container relative"
      style={{
        width: GRID_CONTAINER_W,
        height: GRID_CONTAINER_H,
        maxWidth: '100%',
      }}
    >
      <CourtLines />

      {/* Chemistry Lines SVG */}
      <svg
        className="absolute inset-0 pointer-events-none"
        viewBox={`0 0 ${GRID_CONTAINER_W} ${GRID_CONTAINER_H}`}
        style={{ width: '100%', height: '100%', zIndex: 5 }}
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
              strokeWidth={line.level === 'green' ? 3 : line.level === 'yellow' ? 2 : 1.5}
              strokeOpacity={line.level === 'red' ? 0.3 : 0.85}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Grid slots */}
      {grid.map((slot, index) => {
        const pos = SLOT_POSITIONS[index];
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
              height: CARD_H + 20,
              zIndex: isSwapSource ? 30 : 10,
            }}
            onDragOver={isValid ? handleDragOver : undefined}
            onDrop={isValid ? (e) => handleDrop(e, index) : undefined}
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
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <span className="text-[13px] font-black text-white/30 uppercase tracking-wider">
                  {slot.label}
                </span>
                {isValid && (
                  <span className="text-[9px] text-green-400/80 mt-1 font-semibold">Drop here</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
