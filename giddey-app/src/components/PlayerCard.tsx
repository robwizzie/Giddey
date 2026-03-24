"use client";

import { PlayerCard as PlayerCardType, ChemDotLevel } from "@/lib/types";
import { getPlayerHeadshotUrl, getTeamLogoUrl } from "@/lib/images";

interface PlayerCardProps {
  card: PlayerCardType;
  size?: "grid" | "option" | "result";
  cardSize?: { w: number; h: number };
  showDot?: boolean;
  dotLevel?: ChemDotLevel;
  matchingTraits?: Set<string>;
  onClick?: () => void;
  className?: string;
  animationDelay?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const tierClassMap: Record<string, string> = {
  "dark-matter": "tier-dark-matter",
  "galaxy-opal": "tier-galaxy-opal",
  "pink-diamond": "tier-pink-diamond",
  diamond: "tier-diamond",
  amethyst: "tier-amethyst",
  ruby: "tier-ruby",
  sapphire: "tier-sapphire",
  emerald: "tier-emerald",
  gold: "tier-gold",
};

const gemColors: Record<string, { bg: string; border: string }> = {
  "dark-matter": { bg: "#7c3aed", border: "#a78bfa" },
  "galaxy-opal": { bg: "#9333ea", border: "#f0abfc" },
  "pink-diamond": { bg: "#db2777", border: "#f9a8d4" },
  diamond: { bg: "#0891b2", border: "#67e8f9" },
  amethyst: { bg: "#7c3aed", border: "#c4b5fd" },
  ruby: { bg: "#dc2626", border: "#fca5a5" },
  sapphire: { bg: "#2563eb", border: "#93c5fd" },
  emerald: { bg: "#16a34a", border: "#86efac" },
  gold: { bg: "#ca8a04", border: "#fde047" },
};

// Per-tier section colors: upper bg, lower bg, divider line, position badge
const tierSections: Record<string, { upper: string; lower: string; divider: string; badge: string }> = {
  "dark-matter": { upper: "#1a0533", lower: "#090115", divider: "#7c3aed", badge: "#8b5cf6" },
  "galaxy-opal": { upper: "#4a1a6b", lower: "#160828", divider: "#a855f7", badge: "#c084fc" },
  "pink-diamond": { upper: "#831843", lower: "#1f0416", divider: "#db2777", badge: "#ec4899" },
  diamond: { upper: "#0e4963", lower: "#041318", divider: "#0891b2", badge: "#06b6d4" },
  amethyst: { upper: "#3b1a7a", lower: "#12082e", divider: "#7c3aed", badge: "#a855f7" },
  ruby: { upper: "#7f1d1d", lower: "#1a0404", divider: "#dc2626", badge: "#ef4444" },
  sapphire: { upper: "#1e3a8a", lower: "#060f2a", divider: "#2563eb", badge: "#3b82f6" },
  emerald: { upper: "#064e2e", lower: "#01180d", divider: "#16a34a", badge: "#22c55e" },
  gold: { upper: "#713f12", lower: "#1a0c03", divider: "#ca8a04", badge: "#eab308" },
};

// Half-star system: each tier gets a unique rating so no two look the same
// Value is number of half-stars (e.g. 9 = 4.5 stars, 7 = 3.5 stars)
const tierHalfStars: Record<string, number> = {
  "dark-matter": 10,  // ★★★★★
  "galaxy-opal": 9,   // ★★★★½
  "pink-diamond": 8,  // ★★★★
  diamond: 7,          // ★★★½
  amethyst: 6,         // ★★★
  ruby: 5,             // ★★½
  sapphire: 4,         // ★★
  emerald: 3,          // ★½
  gold: 2,             // ★
};

// Static sizes for option/result cards
const CARD_SIZE = { w: 90, h: 126, gemSize: 24, nameFont: 11, infoFont: 9, yearFont: 12, posFont: 8 };
const sizeConfig = { grid: CARD_SIZE, option: CARD_SIZE, result: CARD_SIZE };

function computeCardSizes(w: number, h: number) {
  return {
    w,
    h,
    gemSize: Math.max(18, Math.round(w * 0.28)),
    nameFont: Math.max(8, Math.round(w * 0.12)),
    infoFont: Math.max(7, Math.round(w * 0.095)),
    yearFont: Math.max(9, Math.round(w * 0.13)),
    posFont: Math.max(7, Math.round(w * 0.09)),
  };
}

function GemBadge({ ovr, size, tier }: { ovr: number; size: number; tier: string }) {
  const colors = gemColors[tier];
  const s = size;
  const points = `${s / 2},1 ${s - 1},${s * 0.38} ${s / 2},${s - 1} 1,${s * 0.38}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>
      <defs>
        <linearGradient id={`gem-${tier}-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.border} />
          <stop offset="40%" stopColor={colors.bg} />
          <stop offset="100%" stopColor={colors.border} />
        </linearGradient>
      </defs>
      <polygon points={points} fill={`url(#gem-${tier}-${s})`} stroke={colors.border} strokeWidth="1.5" />
      <text x={s / 2} y={s * 0.47} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontWeight="900" fontSize={s * 0.42} fontFamily="-apple-system, sans-serif" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" } as React.CSSProperties}>
        {ovr}
      </text>
    </svg>
  );
}

/** SVG star path for a 10×10 viewBox */
const STAR_PATH = "M5 0.5L6.18 3.82L9.75 3.82L6.79 5.93L7.94 9.27L5 7.18L2.06 9.27L3.21 5.93L0.25 3.82L3.82 3.82Z";

function StarRating({ halfStars, size }: { halfStars: number; size: number }) {
  const gap = Math.max(1, Math.round(size * 0.15));
  const totalW = size * 5 + gap * 4;
  return (
    <svg width={totalW} height={size} viewBox={`0 0 ${totalW} ${size}`} style={{ display: "block" }}>
      <defs>
        {/* Reusable clip for half-star: clips to left 50% */}
        <clipPath id="half-star-clip">
          <rect x="0" y="0" width="5" height="10" />
        </clipPath>
      </defs>
      {Array.from({ length: 5 }, (_, i) => {
        const needed = halfStars - i * 2;
        const x = i * (size + gap);
        return (
          <g key={i} transform={`translate(${x}, 0) scale(${size / 10})`}>
            {/* Empty star background */}
            <path d={STAR_PATH} fill="rgba(255,255,255,0.15)" />
            {needed >= 2 ? (
              /* Full star */
              <path d={STAR_PATH} fill="#facc15" />
            ) : needed === 1 ? (
              /* Half star — gold left half over the empty background */
              <path d={STAR_PATH} fill="#facc15" clipPath="url(#half-star-clip)" />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export default function PlayerCard({ card, size = "option", cardSize, showDot = false, dotLevel = "red", matchingTraits, onClick, className = "", animationDelay = 0, draggable = false, onDragStart, onDragEnd }: PlayerCardProps) {
  const tierClass = tierClassMap[card.tier];
  const s = cardSize ? computeCardSizes(cardSize.w, cardSize.h) : sizeConfig[size];
  const sec = tierSections[card.tier];
  const headshotUrl = getPlayerHeadshotUrl(card.id, card.firstName, card.lastName);
  const teamLogoUrl = getTeamLogoUrl(card.team.abbreviation);
  const halfStars = tierHalfStars[card.tier] || 2;

  const displayName = `${card.firstName.charAt(0)}. ${card.lastName}`;
  // Scale name font down for long names so nothing gets cut off
  const nameLen = displayName.length;
  const nameFontScale = nameLen > 12 ? Math.max(0.7, 12 / nameLen) : 1;
  const scaledNameFont = Math.round(s.nameFont * nameFontScale);

  // Upper section: 54% of card height
  const upperPct = 54;

  return (
    <div className="flex flex-col items-center shrink-0">
      <div
        className={`${tierClass} card-2k relative cursor-pointer select-none shrink-0 ${className}`}
        style={{ width: s.w, height: s.h, borderRadius: 10, overflow: "hidden", animationDelay: `${animationDelay}ms` }}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* Shimmer for top tiers */}
        {(card.tier === "dark-matter" || card.tier === "galaxy-opal") && (
          <div className="absolute inset-0 dark-matter-shimmer z-20 pointer-events-none" />
        )}

        {/* ── UPPER SECTION: team logo (left) + player headshot (right) ── */}
        <div
          className="absolute left-0 right-0 top-0"
          style={{ height: `${upperPct}%`, background: sec.upper, overflow: "hidden" }}
        >
          {/* Team logo — left side */}
          {teamLogoUrl && (
            <img
              src={teamLogoUrl}
              alt=""
              referrerPolicy="no-referrer"
              style={{
                position: "absolute",
                left: "4%",
                top: "50%",
                transform: "translateY(-50%)",
                width: "38%",
                height: "58%",
                objectFit: "contain",
                opacity: 0.9,
                pointerEvents: "none",
              }}
              draggable={false}
            />
          )}
          {/* Player headshot — right side, bottom-anchored */}
          <img
            src={headshotUrl}
            alt={`${card.firstName} ${card.lastName}`}
            referrerPolicy="no-referrer"
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: "62%",
              height: "96%",
              objectFit: "cover",
              objectPosition: "top center",
              filter: "drop-shadow(-3px 2px 8px rgba(0,0,0,0.7))",
              pointerEvents: "none",
            }}
            draggable={false}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (!img.src.includes('cdn.nba.com')) {
                img.src = `https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png`;
              } else {
                img.style.display = "none";
              }
            }}
          />
          {/* OVR gem — top left */}
          <div style={{ position: "absolute", top: 3, left: 3, zIndex: 5 }}>
            <GemBadge ovr={card.overall} size={s.gemSize} tier={card.tier} />
          </div>
        </div>

        {/* ── BADGE ROW: 1px divider + centered position pill ── */}
        <div
          className="absolute left-0 right-0"
          style={{ top: `${upperPct}%`, height: 1, background: sec.divider, zIndex: 3, boxShadow: "0 0 8px rgba(0,0,0,0.6)" }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: sec.badge,
              borderRadius: 3,
              padding: `${Math.max(1, Math.round(s.w * 0.022))}px ${Math.max(4, Math.round(s.w * 0.06))}px`,
              fontSize: s.posFont,
              fontWeight: 800,
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              whiteSpace: "nowrap",
              fontFamily: "-apple-system, sans-serif",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
            }}
          >
            {card.position} / {card.secondaryPosition}
          </div>
        </div>

        {/* ── LOWER SECTION: name / division / year / stars ── */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            top: `${upperPct}%`,
            background: sec.lower,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: `${Math.max(8, Math.round(s.h * 0.07))}px 3px ${Math.max(2, Math.round(s.h * 0.025))}px`,
            gap: 1,
          }}
        >
          {/* F. LastName */}
          <div
            style={{
              fontSize: scaledNameFont,
              fontWeight: 900,
              color: "#ffffff",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.2px",
              whiteSpace: "nowrap",
              width: "100%",
              lineHeight: 1.1,
              fontFamily: "-apple-system, sans-serif",
            }}
          >
            {displayName}
          </div>

          {/* Division — green when matching */}
          <div
            style={{
              fontSize: s.infoFont,
              fontWeight: 700,
              color: matchingTraits?.has("division") ? "#4ade80" : "rgba(255,255,255,0.65)",
              textShadow: matchingTraits?.has("division") ? "0 0 6px rgba(74,222,128,0.8)" : "none",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              lineHeight: 1,
              fontFamily: "-apple-system, sans-serif",
            }}
          >
            {card.team.division}
          </div>

          {/* Year — bigger, green when matching */}
          <div
            style={{
              fontSize: s.yearFont,
              fontWeight: 900,
              color: matchingTraits?.has("year") ? "#4ade80" : "#ffffff",
              textShadow: matchingTraits?.has("year") ? "0 0 6px rgba(74,222,128,0.8)" : "none",
              lineHeight: 1,
              fontFamily: "-apple-system, sans-serif",
            }}
          >
            {card.draftYear}
          </div>

          {/* Stars — SVG half-star system */}
          <StarRating halfStars={halfStars} size={Math.max(8, Math.round(s.infoFont * 1.1))} />
        </div>
      </div>

      {/* Chemistry dot */}
      {showDot && <div className={`w-3.5 h-3.5 rounded-full chem-dot-${dotLevel} mt-1`} />}
    </div>
  );
}
