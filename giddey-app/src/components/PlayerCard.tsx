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

const tierStars: Record<string, number> = {
  "dark-matter": 5,
  "galaxy-opal": 5,
  "pink-diamond": 4,
  diamond: 3,
  amethyst: 3,
  ruby: 2,
  sapphire: 2,
  emerald: 1,
  gold: 1,
};

// Static sizes for option/result cards
const CARD_SIZE = { w: 90, h: 126, gemSize: 18, nameFont: 11, infoFont: 9, yearFont: 12, posFont: 8 };
const sizeConfig = { grid: CARD_SIZE, option: CARD_SIZE, result: CARD_SIZE };

function computeCardSizes(w: number, h: number) {
  return {
    w,
    h,
    gemSize: Math.max(13, Math.round(w * 0.21)),
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
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      <defs>
        <linearGradient id={`gem-${tier}-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.border} />
          <stop offset="50%" stopColor={colors.bg} />
          <stop offset="100%" stopColor={colors.border} />
        </linearGradient>
      </defs>
      <polygon points={points} fill={`url(#gem-${tier}-${s})`} stroke={colors.border} strokeWidth="1" />
      <text x={s / 2} y={s * 0.48} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontWeight="900" fontSize={s * 0.38} fontFamily="-apple-system, sans-serif">
        {ovr}
      </text>
    </svg>
  );
}

export default function PlayerCard({ card, size = "option", cardSize, showDot = false, dotLevel = "red", matchingTraits, onClick, className = "", animationDelay = 0, draggable = false, onDragStart, onDragEnd }: PlayerCardProps) {
  const tierClass = tierClassMap[card.tier];
  const s = cardSize ? computeCardSizes(cardSize.w, cardSize.h) : sizeConfig[size];
  const sec = tierSections[card.tier];
  const headshotUrl = getPlayerHeadshotUrl(card.id);
  const teamLogoUrl = getTeamLogoUrl(card.team.abbreviation);
  const stars = tierStars[card.tier] || 2;

  const maxLen = 11;
  const lastName = card.lastName.length > maxLen ? card.lastName.substring(0, maxLen - 1) + "." : card.lastName;
  const displayName = `${card.firstName.charAt(0)}. ${lastName}`;

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
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
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
              padding: "2px 7px",
              fontSize: s.posFont,
              fontWeight: 800,
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              whiteSpace: "nowrap",
              fontFamily: "-apple-system, sans-serif",
              lineHeight: 1.3,
              zIndex: 4,
            }}
          >
            {card.position}
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
            padding: "10px 3px 4px",
            gap: 1,
          }}
        >
          {/* F. LastName */}
          <div
            style={{
              fontSize: s.nameFont,
              fontWeight: 900,
              color: "#ffffff",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
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

          {/* Stars */}
          <div style={{ lineHeight: 1, color: "#facc15", fontSize: s.infoFont, letterSpacing: "1px" }}>
            {"★".repeat(stars)}{"☆".repeat(Math.max(0, 5 - stars))}
          </div>
        </div>
      </div>

      {/* Chemistry dot */}
      {showDot && <div className={`w-3.5 h-3.5 rounded-full chem-dot-${dotLevel} mt-1`} />}
    </div>
  );
}
