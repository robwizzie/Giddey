'use client';

import { useState } from 'react';
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
  onDragSwap?: (fromIndex: number, toIndex: number) => void;
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
      <rect x="8" y="8" width={GRID_CONTAINER_W - 16} height={GRID_CONTAINER_H - 16} rx="6"
        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="50"
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="4"
        fill="rgba(255,255,255,0.06)" />
      <line x1="8" y1={cy} x2={GRID_CONTAINER_W - 8} y2={cy}
        stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <rect x={cx - 65} y="8" width="130" height="100" rx="3"
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
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
  onDragSwap,
}: GridProps) {
  const [dragSource, setDragSource] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    setDragOverTarget(null);

    // Check if this is a grid-card-to-grid-card swap
    const sourceType = e.dataTransfer.getData('source-type');
    if (sourceType === 'grid-card' && onDragSwap) {
      const fromIndex = parseInt(e.dataTransfer.getData('grid-index'), 10);
      if (!isNaN(fromIndex) && fromIndex !== slotIndex) {
        onDragSwap(fromIndex, slotIndex);
      }
      setDragSource(null);
      return;
    }

    // Otherwise it's an option-card drop
    if (onDropOnSlot) {
      onDropOnSlot(slotIndex);
    }
  };

  const handleGridCardDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('source-type', 'grid-card');
    e.dataTransfer.setData('grid-index', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDragSource(index);
  };

  const handleGridCardDragEnd = () => {
    setDragSource(null);
    setDragOverTarget(null);
  };

  const handleCardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSource !== null && dragSource !== index) {
      setDragOverTarget(index);
    }
  };

  const handleCardDragLeave = () => {
    setDragOverTarget(null);
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
        const isDragSource = dragSource === index;
        const isDragOverThis = dragOverTarget === index;

        return (
          <div
            key={index}
            className="absolute"
            style={{
              left: pos.x,
              top: pos.y,
              width: CARD_W,
              height: CARD_H + 20,
              zIndex: isDragSource ? 30 : isSwapSource ? 30 : 10,
            }}
          >
            {slot.card ? (
              <div
                className={`
                  grid-slot-filled flex flex-col items-center
                  ${isSwapSource ? 'swap-source' : ''}
                  ${isSwapTarget ? 'swap-target' : ''}
                  ${isDragSource ? 'dragging-source' : ''}
                  ${isDragOverThis ? 'drag-swap-target' : ''}
                `}
                onClick={() => {
                  if (onCardClick) onCardClick(index);
                  else onSlotClick(index);
                }}
                onDragOver={(e) => handleCardDragOver(e, index)}
                onDragLeave={handleCardDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <PlayerCard
                  card={slot.card}
                  size="grid"
                  showDot={true}
                  dotLevel={dot?.level || 'red'}
                  className={isDragSource ? '' : isSwapSource ? '' : 'animate-card-place'}
                  draggable={true}
                  onDragStart={(e) => handleGridCardDragStart(e, index)}
                  onDragEnd={handleGridCardDragEnd}
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
