'use client';

import { PlayerCard as PlayerCardType } from '@/lib/types';
import PlayerCard from './PlayerCard';

interface DraftOptionsProps {
  options: PlayerCardType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  round: number;
  onDragStart?: (index: number) => void;
}

export default function DraftOptions({ options, selectedIndex, onSelect, round, onDragStart }: DraftOptionsProps) {
  if (options.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex justify-center gap-4">
        {options.map((card, index) => {
          const isSelected = selectedIndex === index;

          return (
            <div
              key={card.id}
              className={`option-card relative ${
                isSelected
                  ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-[#0a0e17] rounded-xl scale-[1.05]'
                  : ''
              }`}
              onClick={() => onSelect(index)}
            >
              <PlayerCard
                card={card}
                size="option"
                className="animate-card-enter"
                animationDelay={index * 120}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                  if (onDragStart) onDragStart(index);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
