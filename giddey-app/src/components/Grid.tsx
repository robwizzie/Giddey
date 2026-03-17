'use client';

import { useState } from 'react';
import { GridSlot, ChemLine, ChemDot, SLOT_POSITIONS, CARD_W, CARD_H, GRID_CONTAINER_W, GRID_CONTAINER_H, ADJACENCIES } from '@/lib/types';
import PlayerCard from './PlayerCard';

interface GridProps {
  grid: GridSlot[];
  lines: ChemLine[];
  dots: ChemDot[];
  validSlots?: number[];
  onSlotClick: (index: number) => void;
  onCardClick?: (index: number) => void;
  swapSource?: number | null;
  swapTargets?: number[];
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
  swapTargets = [],
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

  // Compute matching traits per card slot
  const matchingTraitsMap: Record<number, Set<string>> = {};
  for (let i = 0; i < 9; i++) {
    matchingTraitsMap[i] = new Set<string>();
  }
  for (const [a, b] of ADJACENCIES) {
    const cardA = grid[a]?.card;
    const cardB = grid[b]?.card;
    if (!cardA || !cardB) continue;
    if (cardA.teamId === cardB.teamId) {
      matchingTraitsMap[a].add('team');
      matchingTraitsMap[b].add('team');
    }
    if (cardA.team.division === cardB.team.division) {
      matchingTraitsMap[a].add('division');
      matchingTraitsMap[b].add('division');
    }
    if (cardA.draftYear === cardB.draftYear) {
      matchingTraitsMap[a].add('year');
      matchingTraitsMap[b].add('year');
    }
  }

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
              strokeWidth={line.level === 'green' ? 4 : line.level === 'yellow' ? 3.5 : 1.5}
              strokeOpacity={line.level === 'red' ? 0.2 : 0.6}
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
        const isValidSwapTarget = swapTargets.includes(index);
        const isSwapInactive = swapSource !== null && !isSwapSource && !isValidSwapTarget && slot.card !== null;
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
              height: CARD_H + 24,
              zIndex: isDragSource ? 30 : isSwapSource ? 30 : 10,
            }}
          >
            {slot.card ? (
              <div
                className="flex flex-col items-center"
                onClick={() => {
                  if (onCardClick) onCardClick(index);
                  else onSlotClick(index);
                }}
                onDragOver={(e) => handleCardDragOver(e, index)}
                onDragLeave={handleCardDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Card wrapper — swap/drag styles only around the card itself */}
                <div
                  className={`
                    grid-slot-filled rounded-lg
                    ${isSwapSource ? 'swap-source' : ''}
                    ${isValidSwapTarget ? 'swap-target' : ''}
                    ${isSwapInactive ? 'swap-inactive' : ''}
                    ${isDragSource ? 'dragging-source' : ''}
                    ${isDragOverThis ? 'drag-swap-target' : ''}
                  `}
                >
                  <PlayerCard
                    card={slot.card}
                    size="grid"
                    showDot={false}
                    matchingTraits={matchingTraitsMap[index]}
                    className={isDragSource ? '' : isSwapSource ? '' : 'animate-card-place'}
                    draggable={true}
                    onDragStart={(e) => handleGridCardDragStart(e, index)}
                    onDragEnd={handleGridCardDragEnd}
                  />
                </div>
                {/* Dot sits outside the swap highlight */}
                <div className={`w-3.5 h-3.5 rounded-full chem-dot-${dot?.level || 'red'} mt-0.5`} />
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
                <span className={`text-[13px] font-black uppercase tracking-wider ${isValid ? 'text-green-400' : 'text-white/30'}`}>
                  {slot.label}
                </span>
                {isValid && (
                  <svg width="16" height="16" viewBox="0 0 16 16" className="mt-1 opacity-80">
                    <path d="M8 2 L8 11 M4 8 L8 12 L12 8" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
