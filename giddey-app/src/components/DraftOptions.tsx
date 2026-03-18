'use client';

import { PlayerCard as PlayerCardType } from '@/lib/types';
import PlayerCard from './PlayerCard';

interface DraftOptionsProps {
  options: PlayerCardType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  round: number;
  onDragStart?: (index: number) => void;
  placedIndex?: number | null;
  cardSize?: { w: number; h: number };
}

export default function DraftOptions({
  options,
  selectedIndex,
  onSelect,
  round,
  onDragStart,
  placedIndex = null,
  cardSize,
}: DraftOptionsProps) {
  if (options.length === 0) return null;

  const isLocked = placedIndex !== null;

  return (
    <div className="w-full">
      <div className="flex justify-center gap-4">
        {options.map((card, index) => {
          const isSelected = selectedIndex === index;
          const isPlaced = placedIndex === index;
          const isGrayed = isLocked && !isPlaced;

          return (
            <div
              key={card.id}
              className={`option-card relative transition-all duration-200 ${
                isSelected
                  ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-[#0a0e17] rounded-[10px] scale-[1.05]'
                  : isPlaced
                  ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-[#0a0e17] rounded-[10px]'
                  : ''
              } ${isGrayed ? 'opacity-35 pointer-events-none grayscale-[0.4]' : ''}`}
              style={{ cursor: isLocked ? 'default' : 'grab' }}
              onClick={() => !isLocked && onSelect(index)}
            >
              <PlayerCard
                card={card}
                size="option"
                cardSize={cardSize}
                className="animate-card-enter"
                animationDelay={index * 100}
                draggable={!isLocked}
                onDragStart={(e) => {
                  e.dataTransfer.setData('source-type', 'option-card');
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                  if (onDragStart) onDragStart(index);
                }}
              />
              {/* Placed checkmark overlay */}
              {isPlaced && (
                <div className="absolute inset-0 flex items-start justify-end p-1.5 pointer-events-none z-30">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5 L4.2 7.2 L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
