'use client';

import { PlayerCard as PlayerCardType, TIER_CONFIG, ChemDotLevel } from '@/lib/types';

interface PlayerCardProps {
  card: PlayerCardType;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  dotLevel?: ChemDotLevel;
  onClick?: () => void;
  className?: string;
  animationDelay?: number;
}

const tierClassMap: Record<string, string> = {
  'dark-matter': 'tier-dark-matter',
  'pink-diamond': 'tier-pink-diamond',
  'diamond': 'tier-diamond',
  'amethyst': 'tier-amethyst',
  'ruby': 'tier-ruby',
};

const sizeMap = {
  sm: { card: 'w-[85px] h-[110px]', text: 'text-[9px]', name: 'text-[10px]', pos: 'text-[8px]', stars: 'text-[7px]' },
  md: { card: 'w-[100px] h-[130px]', text: 'text-[10px]', name: 'text-[11px]', pos: 'text-[9px]', stars: 'text-[8px]' },
  lg: { card: 'w-[120px] h-[155px]', text: 'text-[11px]', name: 'text-xs', pos: 'text-[10px]', stars: 'text-[9px]' },
};

function getTierStars(tier: string): number {
  switch (tier) {
    case 'dark-matter': return 5;
    case 'pink-diamond': return 4;
    case 'diamond': return 3;
    case 'amethyst': return 2;
    case 'ruby': return 1;
    default: return 1;
  }
}

export default function PlayerCard({
  card,
  size = 'md',
  showDot = false,
  dotLevel = 'red',
  onClick,
  className = '',
  animationDelay = 0,
}: PlayerCardProps) {
  const tierClass = tierClassMap[card.tier];
  const s = sizeMap[size];
  const config = TIER_CONFIG[card.tier];
  const stars = getTierStars(card.tier);
  const initials = `${card.firstName[0]}. ${card.lastName}`;
  const displayName = card.lastName.length > 10
    ? `${card.firstName[0]}. ${card.lastName.substring(0, 9)}..`
    : initials;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${s.card} ${tierClass} rounded-lg flex flex-col items-center justify-between p-1.5 relative overflow-hidden cursor-pointer select-none ${className}`}
        onClick={onClick}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Dark Matter shimmer overlay */}
        {card.tier === 'dark-matter' && (
          <div className="absolute inset-0 dark-matter-shimmer pointer-events-none" />
        )}

        {/* Position badge */}
        <div
          className={`absolute top-1 left-1 ${s.pos} font-bold px-1.5 py-0.5 rounded`}
          style={{
            background: card.team.primaryColor,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          {card.position}
        </div>

        {/* Overall badge */}
        <div className={`absolute top-1 right-1 ${s.pos} font-bold text-white/80`}>
          {card.overall}
        </div>

        {/* Team abbreviation circle */}
        <div className="mt-5 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
            style={{
              backgroundColor: card.team.primaryColor,
              borderColor: card.team.secondaryColor,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {card.team.abbreviation}
          </div>
        </div>

        {/* Player name */}
        <div className={`${s.name} font-bold text-white text-center leading-tight z-10`}>
          {displayName}
        </div>

        {/* Division & Draft Year */}
        <div className={`${s.text} text-white/70 font-semibold text-center z-10`}>
          {card.team.division}
        </div>
        <div className={`${s.text} text-white/70 font-semibold z-10`}>
          {card.draftYear}
        </div>

        {/* Stars */}
        <div className={`${s.stars} text-yellow-400 z-10`}>
          {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
        </div>
      </div>

      {/* Chemistry Dot */}
      {showDot && (
        <div
          className={`w-2.5 h-2.5 rounded-full chem-dot-${dotLevel}`}
        />
      )}
    </div>
  );
}
