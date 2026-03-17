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
        <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">
          Round {round} of 9 &mdash; Select a player
        </span>
      </div>

      <div className="flex justify-center gap-4">
        {options.map((card, index) => {
          const isSelected = selectedIndex === index;
          const config = TIER_CONFIG[card.tier];

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
              {/* Talent badge */}
              <div className="absolute -top-2.5 -right-2 z-30 bg-black/90 rounded-full px-2 py-0.5 border border-white/20 backdrop-blur-sm">
                <span className="text-[10px] font-black" style={{
                  color: card.tier === 'dark-matter' ? '#a78bfa' :
                         card.tier === 'pink-diamond' ? '#f472b6' :
                         card.tier === 'diamond' ? '#22d3ee' :
                         card.tier === 'amethyst' ? '#a78bfa' :
                         '#f87171'
                }}>
                  +{config.talent}
                </span>
              </div>

              <PlayerCard
                card={card}
                size="option"
                className="animate-card-enter"
                animationDelay={index * 120}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
