'use client';

import { PlayerCard as PlayerCardType, ChemDotLevel } from '@/lib/types';
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
  grid: { w: 90, h: 118 },
  option: { w: 105, h: 138 },
  result: { w: 90, h: 118 },
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
  const headshotUrl = getPlayerHeadshotUrl(card.id);
  const teamLogoUrl = getTeamLogoUrl(card.team.abbreviation);
  const isSmall = size === 'grid' || size === 'result';

  // Truncate long last names
  const maxLen = isSmall ? 10 : 12;
  const lastName = card.lastName.length > maxLen ? card.lastName.substring(0, maxLen - 1) + '.' : card.lastName;

  return (
    <div className="flex flex-col items-center shrink-0">
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
          <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none" style={{ opacity: 0.12 }}>
            <img
              src={teamLogoUrl}
              alt=""
              style={{ width: '80%', height: '80%', objectFit: 'contain' }}
              draggable={false}
            />
          </div>
        )}

        {/* Team color gradient overlay */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${card.team.primaryColor}20 60%, ${card.team.primaryColor}40 100%)`,
          }}
        />

        {/* Position badge - inside top left */}
        <div
          className={`absolute ${isSmall ? 'top-[4px] left-[4px]' : 'top-[5px] left-[5px]'} z-10`}
        >
          <div
            className={`${isSmall ? 'text-[8px] px-[5px] py-[2px]' : 'text-[9px] px-[6px] py-[2px]'} font-black rounded uppercase leading-none`}
            style={{
              background: card.team.primaryColor,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {card.position}
          </div>
        </div>

        {/* Player headshot */}
        <div className={`relative z-[2] flex-1 flex items-end justify-center w-full ${isSmall ? 'pt-3' : 'pt-4'}`}>
          <img
            src={headshotUrl}
            alt={`${card.firstName} ${card.lastName}`}
            className="w-auto object-contain drop-shadow-lg"
            style={{ height: isSmall ? 58 : 68 }}
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Bottom info bar with dark gradient for readability */}
        <div
          className={`w-full z-10 ${isSmall ? 'px-[5px] pb-[4px] pt-[2px]' : 'px-[6px] pb-[5px] pt-[3px]'}`}
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 40%)' }}
        >
          {/* Player name */}
          <div
            className={`${isSmall ? 'text-[9px]' : 'text-[11px]'} font-extrabold text-white text-center leading-tight truncate`}
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {lastName}
          </div>

          {/* Team abbreviation + Division + Draft Year */}
          <div
            className={`${isSmall ? 'text-[7px]' : 'text-[8px]'} text-white/70 font-bold text-center uppercase tracking-wide leading-tight`}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
          >
            {card.team.abbreviation} &bull; {card.team.division} &bull; {card.draftYear}
          </div>

          {/* Stars */}
          <div className={`${isSmall ? 'text-[8px]' : 'text-[9px]'} text-yellow-400 text-center leading-none mt-[1px]`}>
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
          </div>
        </div>
      </div>

      {/* Chemistry Dot - bigger and more visible */}
      {showDot && (
        <div className={`w-3.5 h-3.5 rounded-full chem-dot-${dotLevel} mt-1`} />
      )}
    </div>
  );
}
