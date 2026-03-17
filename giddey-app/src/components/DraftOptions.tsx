'use client';

import { PlayerCard as PlayerCardType, TIER_CONFIG } from '@/lib/types';
import PlayerCard from './PlayerCard';

interface DraftOptionsProps {
  options: PlayerCardType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  round: number;
}

export default function DraftOptions({ options, selectedIndex, onSelect, round }: DraftOptionsProps) {
  if (options.length === 0) return null;

  return (
    <div className="w-full">
      <div className="text-center mb-3">
        <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">
          Round {round} of 9 — Pick a player
        </span>
      </div>

      <div className="flex justify-center gap-3">
        {options.map((card, index) => {
          const isSelected = selectedIndex === index;
          const config = TIER_CONFIG[card.tier];

          return (
            <div
              key={card.id}
              className={`option-card relative rounded-xl p-1 transition-all ${
                isSelected
                  ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-transparent scale-105'
                  : 'hover:scale-102'
              }`}
              onClick={() => onSelect(index)}
            >
              {/* Talent badge */}
              <div className="absolute -top-2 -right-2 z-30 bg-black rounded-full px-1.5 py-0.5 border border-white/20">
                <span className="text-[9px] font-bold" style={{ color: config.color === '#1a0a2e' ? '#8b5cf6' : config.color }}>
                  +{config.talent}
                </span>
              </div>

              <PlayerCard
                card={card}
                size="md"
                className="animate-card-enter"
                animationDelay={index * 100}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
