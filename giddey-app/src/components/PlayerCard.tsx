'use client';

import { PlayerCard as PlayerCardType, TIER_CONFIG, ChemDotLevel } from '@/lib/types';
import { getPlayerHeadshotUrl, getTeamLogoUrl } from '@/lib/images';

interface PlayerCardProps {
  card: PlayerCardType;
  size?: 'grid' | 'option' | 'result';
  showDot?: boolean;
  dotLevel?: ChemDotLevel;
  onClick?: () => void;
  className?: string;
  animationDelay?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

const tierClassMap: Record<string, string> = {
  'dark-matter': 'tier-dark-matter',
  'pink-diamond': 'tier-pink-diamond',
  'diamond': 'tier-diamond',
  'amethyst': 'tier-amethyst',
  'ruby': 'tier-ruby',
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

const sizeConfig = {
  grid: { w: 82, h: 108 },
  option: { w: 100, h: 132 },
  result: { w: 82, h: 108 },
};

export default function PlayerCard({
  card,
  size = 'option',
  showDot = false,
  dotLevel = 'red',
  onClick,
  className = '',
  animationDelay = 0,
  draggable = false,
  onDragStart,
}: PlayerCardProps) {
  const tierClass = tierClassMap[card.tier];
  const s = sizeConfig[size];
  const stars = getTierStars(card.tier);
  const lastName = card.lastName.length > 10 ? card.lastName.substring(0, 9) + '.' : card.lastName;
  const headshotUrl = getPlayerHeadshotUrl(card.id);
  const teamLogoUrl = getTeamLogoUrl(card.team.abbreviation);
  const isSmall = size === 'grid' || size === 'result';

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <div
        className={`${tierClass} rounded-xl flex flex-col items-center relative overflow-hidden cursor-pointer select-none shrink-0 ${className}`}
        style={{
          width: s.w,
          height: s.h,
          animationDelay: `${animationDelay}ms`,
        }}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        {/* Dark Matter shimmer overlay */}
        {card.tier === 'dark-matter' && (
          <div className="absolute inset-0 dark-matter-shimmer pointer-events-none z-20" />
        )}

        {/* Team logo watermark */}
        {teamLogoUrl && (
          <div className="absolute inset-0 flex items-center justify-center z-0 opacity-15">
            <img
              src={teamLogoUrl}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* Team color gradient overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${card.team.primaryColor}15 50%, ${card.team.primaryColor}30 100%)`,
          }}
        />

        {/* Position badge - top left */}
        <div className="absolute top-1 left-1 z-10">
          <div
            className={`${isSmall ? 'text-[7px] px-1 py-px' : 'text-[8px] px-1.5 py-0.5'} font-black rounded uppercase`}
            style={{
              background: card.team.primaryColor,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {card.position}
          </div>
        </div>

        {/* Player headshot */}
        <div className={`relative z-[2] flex-1 flex items-end justify-center w-full ${isSmall ? 'pt-2' : 'pt-3'}`}>
          <img
            src={headshotUrl}
            alt={`${card.firstName} ${card.lastName}`}
            className={`${isSmall ? 'h-[52px]' : 'h-[64px]'} w-auto object-contain drop-shadow-lg`}
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Bottom info bar */}
        <div className={`w-full z-10 ${isSmall ? 'px-1 pb-1' : 'px-1.5 pb-1.5'}`}
          style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6))' }}
        >
          {/* Player name */}
          <div className={`${isSmall ? 'text-[8px]' : 'text-[10px]'} font-bold text-white text-center leading-tight truncate`}>
            {lastName}
          </div>

          {/* Division + Draft Year */}
          <div className={`${isSmall ? 'text-[6px]' : 'text-[7px]'} text-white/60 font-semibold text-center uppercase tracking-wide`}>
            {card.team.division} &bull; {card.draftYear}
          </div>

          {/* Stars */}
          <div className={`${isSmall ? 'text-[6px]' : 'text-[7px]'} text-yellow-400 text-center leading-none`}>
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
          </div>
        </div>
      </div>

      {/* Chemistry Dot */}
      {showDot && (
        <div className={`w-2.5 h-2.5 rounded-full chem-dot-${dotLevel} mt-0.5`} />
      )}
    </div>
  );
}
