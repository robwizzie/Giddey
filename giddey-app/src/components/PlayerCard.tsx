'use client';

import { PlayerCard as PlayerCardType, ChemDotLevel, TIER_CONFIG } from '@/lib/types';
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
  onDragEnd?: (e: React.DragEvent) => void;
}

const tierClassMap: Record<string, string> = {
  'dark-matter': 'tier-dark-matter',
  'pink-diamond': 'tier-pink-diamond',
  'diamond': 'tier-diamond',
  'amethyst': 'tier-amethyst',
  'ruby': 'tier-ruby',
};

// Gem colors matching 2K tiers
const gemColors: Record<string, { bg: string; border: string; text: string }> = {
  'dark-matter': { bg: '#6d28d9', border: '#a78bfa', text: '#fff' },
  'pink-diamond': { bg: '#db2777', border: '#f9a8d4', text: '#fff' },
  'diamond': { bg: '#0891b2', border: '#67e8f9', text: '#fff' },
  'amethyst': { bg: '#7c3aed', border: '#c4b5fd', text: '#fff' },
  'ruby': { bg: '#dc2626', border: '#fca5a5', text: '#fff' },
};

const sizeConfig = {
  grid: { w: 90, h: 118, gemSize: 24, gemFont: 11, posFont: 7, nameFont: 9, detailFont: 6.5, imgH: 60, teamLogoSize: 18 },
  option: { w: 108, h: 142, gemSize: 30, gemFont: 14, posFont: 8, nameFont: 11, detailFont: 7.5, imgH: 72, teamLogoSize: 22 },
  result: { w: 90, h: 118, gemSize: 24, gemFont: 11, posFont: 7, nameFont: 9, detailFont: 6.5, imgH: 60, teamLogoSize: 18 },
};

// SVG gem/diamond shape for the overall rating badge
function GemBadge({ ovr, size, tier }: { ovr: number; size: number; tier: string }) {
  const colors = gemColors[tier];
  const fontSize = sizeConfig.grid.gemFont;
  const s = size;
  // Diamond/gem polygon points
  const points = `${s/2},0 ${s},${s*0.35} ${s/2},${s} 0,${s*0.35}`;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="gem-badge">
      <defs>
        <linearGradient id={`gem-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.border} />
          <stop offset="50%" stopColor={colors.bg} />
          <stop offset="100%" stopColor={colors.border} />
        </linearGradient>
      </defs>
      <polygon
        points={points}
        fill={`url(#gem-${tier})`}
        stroke={colors.border}
        strokeWidth="1.5"
      />
      <text
        x={s/2}
        y={s*0.52}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={colors.text}
        fontWeight="900"
        fontSize={s * 0.42}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
      >
        {ovr}
      </text>
    </svg>
  );
}

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
  onDragEnd,
}: PlayerCardProps) {
  const tierClass = tierClassMap[card.tier];
  const s = sizeConfig[size];
  const headshotUrl = getPlayerHeadshotUrl(card.id);
  const teamLogoUrl = getTeamLogoUrl(card.team.abbreviation);
  const isSmall = size === 'grid' || size === 'result';

  // Truncate long names
  const maxLen = isSmall ? 10 : 12;
  const lastName = card.lastName.length > maxLen ? card.lastName.substring(0, maxLen - 1) + '.' : card.lastName;

  return (
    <div className="flex flex-col items-center shrink-0">
      <div
        className={`${tierClass} card-2k rounded-lg flex flex-col relative overflow-hidden cursor-pointer select-none shrink-0 ${className}`}
        style={{
          width: s.w,
          height: s.h,
          animationDelay: `${animationDelay}ms`,
        }}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* Dark Matter shimmer overlay */}
        {card.tier === 'dark-matter' && (
          <div className="absolute inset-0 dark-matter-shimmer pointer-events-none z-20" />
        )}

        {/* Team logo watermark (large, centered, behind everything) */}
        {teamLogoUrl && (
          <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none" style={{ opacity: 0.1, top: '-5%' }}>
            <img
              src={teamLogoUrl}
              alt=""
              style={{ width: '90%', height: '90%', objectFit: 'contain' }}
              draggable={false}
            />
          </div>
        )}

        {/* Tier gradient overlay */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.5) 100%)`,
          }}
        />

        {/* Top section: OVR gem + position + team logo */}
        <div className="relative z-10 flex items-start justify-between w-full" style={{ padding: isSmall ? 3 : 4 }}>
          {/* OVR Gem Badge */}
          <div style={{ marginTop: -1, marginLeft: -1 }}>
            <GemBadge ovr={card.overall} size={s.gemSize} tier={card.tier} />
          </div>

          {/* Team logo (top right) */}
          {teamLogoUrl && (
            <div
              className="rounded-sm overflow-hidden flex items-center justify-center"
              style={{
                width: s.teamLogoSize,
                height: s.teamLogoSize,
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <img
                src={teamLogoUrl}
                alt={card.team.abbreviation}
                style={{ width: '85%', height: '85%', objectFit: 'contain' }}
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Position text below gem */}
        <div
          className="absolute z-10 font-black uppercase text-white/80"
          style={{
            top: isSmall ? s.gemSize + 2 : s.gemSize + 3,
            left: isSmall ? 5 : 6,
            fontSize: s.posFont,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            letterSpacing: '0.5px',
          }}
        >
          {card.position}
        </div>

        {/* Player headshot (centered, fills most of card) */}
        <div className="relative z-[2] flex-1 flex items-end justify-center w-full">
          <img
            src={headshotUrl}
            alt={`${card.firstName} ${card.lastName}`}
            className="w-auto object-contain"
            style={{
              height: s.imgH,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
            }}
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Bottom name bar */}
        <div
          className="w-full z-10 text-center"
          style={{
            padding: isSmall ? '2px 4px 3px' : '3px 5px 4px',
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 30%)',
          }}
        >
          {/* Player last name — 2K style, bold and prominent */}
          <div
            className="font-black text-white uppercase truncate leading-none"
            style={{
              fontSize: s.nameFont,
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              letterSpacing: '0.3px',
            }}
          >
            {lastName}
          </div>

          {/* Team + Division + Year */}
          <div
            className="font-bold text-white/60 uppercase leading-none truncate"
            style={{
              fontSize: s.detailFont,
              marginTop: 1,
              letterSpacing: '0.3px',
            }}
          >
            {card.team.abbreviation} &middot; {card.team.division} &middot; {card.draftYear}
          </div>
        </div>
      </div>

      {/* Chemistry Dot */}
      {showDot && (
        <div className={`w-3.5 h-3.5 rounded-full chem-dot-${dotLevel} mt-1`} />
      )}
    </div>
  );
}
