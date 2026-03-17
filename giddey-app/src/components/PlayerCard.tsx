'use client';

import { PlayerCard as PlayerCardType, ChemDotLevel } from '@/lib/types';
import { getPlayerHeadshotUrl, getTeamLogoUrl } from '@/lib/images';

/** Lighten dark team colors so they're always readable on dark card backgrounds */
function ensureReadable(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  if (luminance > 90) return hex;
  // Boost towards white to ensure readability
  const boost = 1.8;
  const nr = Math.min(255, Math.round(r * boost + 60));
  const ng = Math.min(255, Math.round(g * boost + 60));
  const nb = Math.min(255, Math.round(b * boost + 60));
  return `rgb(${nr},${ng},${nb})`;
}

interface PlayerCardProps {
  card: PlayerCardType;
  size?: 'grid' | 'option' | 'result';
  showDot?: boolean;
  dotLevel?: ChemDotLevel;
  /** Which traits are matching with at least one neighbor: 'team', 'division', 'year' */
  matchingTraits?: Set<string>;
  onClick?: () => void;
  className?: string;
  animationDelay?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const tierClassMap: Record<string, string> = {
  'dark-matter': 'tier-dark-matter',
  'galaxy-opal': 'tier-galaxy-opal',
  'pink-diamond': 'tier-pink-diamond',
  'diamond': 'tier-diamond',
  'amethyst': 'tier-amethyst',
  'ruby': 'tier-ruby',
  'sapphire': 'tier-sapphire',
  'emerald': 'tier-emerald',
  'gold': 'tier-gold',
};

// Gem badge colors per tier
const gemColors: Record<string, { bg: string; border: string }> = {
  'dark-matter': { bg: '#7c3aed', border: '#a78bfa' },
  'galaxy-opal': { bg: '#9333ea', border: '#f0abfc' },
  'pink-diamond': { bg: '#db2777', border: '#f9a8d4' },
  'diamond': { bg: '#0891b2', border: '#67e8f9' },
  'amethyst': { bg: '#7c3aed', border: '#c4b5fd' },
  'ruby': { bg: '#dc2626', border: '#fca5a5' },
  'sapphire': { bg: '#2563eb', border: '#93c5fd' },
  'emerald': { bg: '#16a34a', border: '#86efac' },
  'gold': { bg: '#ca8a04', border: '#fde047' },
};

// All card sizes are now unified for consistent look across draft options and grid
const CARD_SIZE = { w: 90, h: 118, gemSize: 22, imgH: 56, nameFont: 10, infoFont: 7.5, posFont: 7.5, teamLogo: 22 };
const sizeConfig = {
  grid: CARD_SIZE,
  option: CARD_SIZE,
  result: CARD_SIZE,
};

// Short division abbreviations for compact cards
const divisionShort: Record<string, string> = {
  Atlantic: 'ATL',
  Central: 'CEN',
  Southeast: 'SE',
  Northwest: 'NW',
  Pacific: 'PAC',
  Southwest: 'SW',
};

function GemBadge({ ovr, size, tier }: { ovr: number; size: number; tier: string }) {
  const colors = gemColors[tier];
  const s = size;
  // Diamond shape
  const points = `${s / 2},1 ${s - 1},${s * 0.38} ${s / 2},${s - 1} 1,${s * 0.38}`;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      <defs>
        <linearGradient id={`gem-${tier}-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.border} />
          <stop offset="50%" stopColor={colors.bg} />
          <stop offset="100%" stopColor={colors.border} />
        </linearGradient>
      </defs>
      <polygon
        points={points}
        fill={`url(#gem-${tier}-${s})`}
        stroke={colors.border}
        strokeWidth="1"
      />
      <text
        x={s / 2}
        y={s * 0.48}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontWeight="900"
        fontSize={s * 0.4}
        fontFamily="-apple-system, sans-serif"
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
  matchingTraits,
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

  const maxLen = 10;
  const lastName = card.lastName.length > maxLen
    ? card.lastName.substring(0, maxLen - 1) + '.'
    : card.lastName;

  return (
    <div className="flex flex-col items-center shrink-0">
      <div
        className={`${tierClass} card-2k rounded-lg relative cursor-pointer select-none shrink-0 flex flex-col ${className}`}
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
        {/* Clip area for headshot/gradient — does NOT clip bottom bar */}
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          {/* Dark Matter / Galaxy Opal shimmer */}
          {(card.tier === 'dark-matter' || card.tier === 'galaxy-opal') && (
            <div className="absolute inset-0 dark-matter-shimmer z-20" />
          )}

          {/* Subtle team logo watermark behind everything */}
          {teamLogoUrl && (
            <div
              className="absolute z-0"
              style={{
                top: '5%',
                left: '15%',
                right: '15%',
                bottom: '25%',
                opacity: 0.08,
              }}
            >
              <img
                src={teamLogoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                draggable={false}
              />
            </div>
          )}

          {/* Darkening gradient for bottom text */}
          <div
            className="absolute inset-0 z-[1]"
            style={{
              background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.65) 100%)',
            }}
          />
        </div>

        {/* === TOP BAR: OVR gem + Position === */}
        <div
          className="relative z-10 flex items-start justify-between"
          style={{ padding: '3px 4px 0' }}
        >
          <GemBadge ovr={card.overall} size={s.gemSize} tier={card.tier} />

          {/* Position + Team logo cluster */}
          <div className="flex items-center gap-1">
            <span
              className="font-black text-white/90 uppercase"
              style={{
                fontSize: s.posFont,
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              {card.position}
            </span>
            {teamLogoUrl && (
              <div
                className="rounded overflow-hidden flex items-center justify-center"
                style={{
                  width: s.teamLogo,
                  height: s.teamLogo,
                  background: matchingTraits?.has('team')
                    ? 'rgba(34,197,94,0.5)'
                    : 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(4px)',
                  padding: 2,
                  boxShadow: matchingTraits?.has('team') ? '0 0 8px rgba(34,197,94,0.6)' : undefined,
                  border: matchingTraits?.has('team') ? '1px solid rgba(34,197,94,0.7)' : undefined,
                }}
              >
                <img
                  src={teamLogoUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  draggable={false}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* === PLAYER HEADSHOT === */}
        <div className="relative z-[2] flex-1 flex items-end justify-center overflow-hidden">
          <img
            src={headshotUrl}
            alt={`${card.firstName} ${card.lastName}`}
            className="w-auto object-contain"
            style={{
              height: s.imgH,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
            }}
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* === BOTTOM INFO BAR === */}
        <div
          className="relative z-10 w-full"
          style={{
            padding: '4px 5px 5px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.75) 100%)',
            backdropFilter: 'blur(4px)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Player name */}
          <div
            className="font-black text-white uppercase leading-none text-center whitespace-nowrap overflow-hidden text-ellipsis"
            style={{
              fontSize: s.nameFont,
              letterSpacing: '0.5px',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {lastName}
          </div>

          {/* Chemistry info: Team • Division • Year */}
          <div
            className="flex items-center justify-center gap-0 leading-none text-center whitespace-nowrap"
            style={{
              marginTop: 2,
              fontSize: s.infoFont,
            }}
          >
            <span
              className="font-bold"
              style={{
                color: matchingTraits?.has('team') ? '#4ade80' : ensureReadable(card.team.primaryColor),
                textShadow: matchingTraits?.has('team')
                  ? '0 0 6px rgba(34,197,94,0.8), 0 0 2px rgba(0,0,0,1)'
                  : '0 0 6px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1), 0 1px 1px rgba(0,0,0,0.9)',
                WebkitTextStroke: matchingTraits?.has('team') ? undefined : '0.3px rgba(255,255,255,0.25)',
              }}
            >
              {card.team.abbreviation}
            </span>
            <span className="text-white/30 mx-[2px] font-light">&bull;</span>
            <span
              className="font-semibold"
              style={{
                color: matchingTraits?.has('division') ? '#4ade80' : 'rgba(255,255,255,0.75)',
                textShadow: matchingTraits?.has('division') ? '0 0 6px rgba(34,197,94,0.8)' : undefined,
              }}
            >
              {divisionShort[card.team.division] || card.team.division}
            </span>
            <span className="text-white/30 mx-[2px] font-light">&bull;</span>
            <span
              className="font-semibold"
              style={{
                color: matchingTraits?.has('year') ? '#4ade80' : 'rgba(255,255,255,0.75)',
                textShadow: matchingTraits?.has('year') ? '0 0 6px rgba(34,197,94,0.8)' : undefined,
              }}
            >
              &apos;{String(card.draftYear).slice(-2)}
            </span>
          </div>
        </div>
      </div>

      {/* Chemistry Dot */}
      {showDot && (
        <div className={`w-4 h-4 rounded-full chem-dot-${dotLevel} mt-1.5`} />
      )}
    </div>
  );
}
