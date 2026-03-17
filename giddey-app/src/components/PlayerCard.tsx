'use client';

import { PlayerCard as PlayerCardType, TIER_CONFIG, ChemDotLevel } from '@/lib/types';

interface PlayerCardProps {
  card: PlayerCardType;
  size?: 'grid' | 'option' | 'result';
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

// Basketball player silhouette SVG
function PlayerSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 100" fill={color} xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="40" cy="18" r="12" />
      {/* Body */}
      <path d="M24 35 C24 30, 56 30, 56 35 L58 60 C58 62, 54 63, 52 62 L48 50 L46 75 C46 77, 42 78, 40 78 C38 78, 34 77, 34 75 L32 50 L28 62 C26 63, 22 62, 22 60 Z" />
      {/* Arms */}
      <path d="M24 36 L12 52 C10 54, 8 52, 10 50 L22 38 Z" />
      <path d="M56 36 L68 52 C70 54, 72 52, 70 50 L58 38 Z" />
      {/* Ball */}
      <circle cx="70" cy="48" r="7" strokeWidth="1" stroke={color} fill="none" />
      <path d="M63 48 Q70 45, 77 48" strokeWidth="0.8" stroke={color} fill="none" />
      <path d="M70 41 Q68 48, 70 55" strokeWidth="0.8" stroke={color} fill="none" />
    </svg>
  );
}

const sizeConfig = {
  grid: {
    width: 'w-[90px]',
    height: 'h-[120px]',
    nameText: 'text-[10px]',
    detailText: 'text-[8px]',
    posText: 'text-[7px]',
    starText: 'text-[7px]',
    silhouetteSize: 'w-8 h-10',
    teamBadgeSize: 'w-6 h-6 text-[7px]',
    padding: 'p-1',
  },
  option: {
    width: 'w-[105px]',
    height: 'h-[140px]',
    nameText: 'text-[11px]',
    detailText: 'text-[9px]',
    posText: 'text-[8px]',
    starText: 'text-[8px]',
    silhouetteSize: 'w-10 h-12',
    teamBadgeSize: 'w-7 h-7 text-[8px]',
    padding: 'p-1.5',
  },
  result: {
    width: 'w-[90px]',
    height: 'h-[120px]',
    nameText: 'text-[10px]',
    detailText: 'text-[8px]',
    posText: 'text-[7px]',
    starText: 'text-[7px]',
    silhouetteSize: 'w-8 h-10',
    teamBadgeSize: 'w-6 h-6 text-[7px]',
    padding: 'p-1',
  },
};

export default function PlayerCard({
  card,
  size = 'option',
  showDot = false,
  dotLevel = 'red',
  onClick,
  className = '',
  animationDelay = 0,
}: PlayerCardProps) {
  const tierClass = tierClassMap[card.tier];
  const s = sizeConfig[size];
  const stars = getTierStars(card.tier);
  const displayName = `${card.firstName[0]}. ${card.lastName}`;
  const truncatedName = displayName.length > 14 ? displayName.substring(0, 13) + '.' : displayName;

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <div
        className={`${s.width} ${s.height} ${tierClass} rounded-xl flex flex-col items-center justify-between ${s.padding} relative overflow-hidden cursor-pointer select-none shrink-0 ${className}`}
        onClick={onClick}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Dark Matter shimmer overlay */}
        {card.tier === 'dark-matter' && (
          <div className="absolute inset-0 dark-matter-shimmer pointer-events-none z-20" />
        )}

        {/* Team color background watermark */}
        <div
          className="absolute inset-0 opacity-15 z-0"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${card.team.primaryColor} 0%, transparent 70%)`,
          }}
        />

        {/* Top row: Position badge + OVR */}
        <div className="w-full flex items-start justify-between z-10 mb-0.5">
          <div
            className={`${s.posText} font-black px-1.5 py-0.5 rounded-md uppercase`}
            style={{
              background: card.team.primaryColor,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {card.position}
          </div>
          <div className={`${s.posText} font-bold text-white/60 mt-0.5`}>
            {card.overall}
          </div>
        </div>

        {/* Player silhouette with team badge behind */}
        <div className="relative flex items-center justify-center z-10 flex-1">
          {/* Team badge (behind silhouette) */}
          <div
            className={`absolute ${s.teamBadgeSize} rounded-full flex items-center justify-center font-black border-2 opacity-70`}
            style={{
              backgroundColor: card.team.primaryColor,
              borderColor: card.team.secondaryColor,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {card.team.abbreviation}
          </div>
          {/* Player silhouette (in front) */}
          <div className={`${s.silhouetteSize} relative z-10`}>
            <PlayerSilhouette color="rgba(255,255,255,0.85)" />
          </div>
        </div>

        {/* Player name */}
        <div className={`${s.nameText} font-bold text-white text-center leading-tight z-10 w-full truncate px-0.5`}>
          {truncatedName}
        </div>

        {/* Division */}
        <div className={`${s.detailText} text-white/60 font-bold uppercase tracking-wide z-10`}>
          {card.team.division}
        </div>

        {/* Draft Year */}
        <div className={`${s.detailText} text-white/60 font-bold z-10`}>
          {card.draftYear}
        </div>

        {/* Stars */}
        <div className={`${s.starText} text-yellow-400 z-10 leading-none`}>
          {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
        </div>
      </div>

      {/* Chemistry Dot */}
      {showDot && (
        <div className={`w-2.5 h-2.5 rounded-full chem-dot-${dotLevel} mt-0.5`} />
      )}
    </div>
  );
}
