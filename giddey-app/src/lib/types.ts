export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type GridPosition = Position | 'UTIL';

export type Tier = 'dark-matter' | 'galaxy-opal' | 'pink-diamond' | 'diamond' | 'amethyst' | 'ruby' | 'sapphire' | 'emerald' | 'gold';

export type Conference = 'Eastern' | 'Western';

export type Division =
  | 'Atlantic'
  | 'Central'
  | 'Southeast'
  | 'Northwest'
  | 'Pacific'
  | 'Southwest';

export interface Team {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  conference: Conference;
  division: Division;
  primaryColor: string;
  secondaryColor: string;
}

export interface Player {
  id: string;
  /** Links card variants of the same real person — defaults to id if not set */
  playerId?: string;
  firstName: string;
  lastName: string;
  position: Position;
  secondaryPosition: Position;
  teamId: string;
  draftYear: number;
  tier: Tier;
  overall: number;
  /** Optional custom label shown on the card (e.g. "PROMO", "CHRISTMAS") */
  badge?: string;
}

export interface PlayerCard extends Player {
  team: Team;
}

export interface GridSlot {
  index: number;
  position: GridPosition;
  label: string;
  card: PlayerCard | null;
}

export type ChemLineLevel = 'green' | 'yellow' | 'red';
export type ChemDotLevel = 'green' | 'yellow' | 'red';

export interface ChemLine {
  from: number;
  to: number;
  level: ChemLineLevel;
  points: number;
  reasons: string[]; // e.g. ['team', 'division', 'year']
}

export interface ChemDot {
  slotIndex: number;
  level: ChemDotLevel;
  points: number;
  lineChem: number;
}

export interface ScoreBreakdown {
  talent: number;
  lineChem: number;
  dotChem: number;
  totalChem: number;
  total: number;
  lines: ChemLine[];
  dots: ChemDot[];
}

export const TIER_CONFIG: Record<Tier, { label: string; color: string; borderColor: string }> = {
  'dark-matter': { label: 'Dark Matter', color: '#8b5cf6', borderColor: 'rgba(138,43,226,0.8)' },
  'galaxy-opal': { label: 'Galaxy Opal', color: '#f0abfc', borderColor: 'rgba(240,171,252,0.8)' },
  'pink-diamond': { label: 'Pink Diamond', color: '#ec4899', borderColor: 'rgba(255,105,180,0.7)' },
  'diamond': { label: 'Diamond', color: '#22d3ee', borderColor: 'rgba(0,191,255,0.7)' },
  'amethyst': { label: 'Amethyst', color: '#a855f7', borderColor: 'rgba(155,89,182,0.7)' },
  'ruby': { label: 'Ruby', color: '#ef4444', borderColor: 'rgba(231,76,60,0.7)' },
  'sapphire': { label: 'Sapphire', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.7)' },
  'emerald': { label: 'Emerald', color: '#22c55e', borderColor: 'rgba(34,197,94,0.7)' },
  'gold': { label: 'Gold', color: '#eab308', borderColor: 'rgba(234,179,8,0.7)' },
};

/*
 * Grid Formation Layout (matches Griddy's football formation but for basketball)
 *
 *        [0:SG]    [1:SF]           ← Perimeter shooters
 *   [2:UTIL] [3:PG]  [4:PG] [5:UTIL] ← Playmakers + flex
 *   [6:SF]                  [7:SG]  ← Wings
 *              [8:C]                ← Center (the bridge)
 *
 * 13 adjacencies, max chem = 13×2 + 9×11 = 125
 */
export const GRID_POSITIONS: GridPosition[] = [
  'SG', 'PF',            // Row 0: top pair (SG left, PF right)
  'UTIL', 'PG', 'PG', 'UTIL', // Row 1: middle quad (UTIL flanking PGs)
  'SF', 'SG',            // Row 2: lower pair (SF left, SG right)
  'C',                   // Row 3: bottom center
];

export const GRID_LABELS: string[] = [
  'SG', 'PF',
  'UTIL', 'PG', 'PG', 'UTIL',
  'SF', 'SG',
  'C',
];

// 15 adjacencies — PG-left and PG-right do NOT connect directly (like QBs in Griddy)
// Each PG connects 4 ways: top perimeter, outer UTIL, bottom wing, Center
export const ADJACENCIES: [number, number][] = [
  [0, 1],               // SG-top ↔ SF-top (top pair connected)
  [0, 2], [0, 3],       // SG-top → UTIL-left, PG-left
  [1, 4], [1, 5],       // SF-top → PG-right, UTIL-right
  [2, 3],               // UTIL-left ↔ PG-left
  [4, 5],               // PG-right ↔ UTIL-right
  [2, 6],               // UTIL-left → SF-bottom
  [5, 7],               // UTIL-right → SG-bottom
  [3, 6],               // PG-left ↔ SF-bottom
  [4, 7],               // PG-right ↔ SG-bottom
  [3, 8], [4, 8],       // Both PGs → Center
  [6, 8], [7, 8],       // Both wings → Center
];

// Legacy constants kept for any direct imports elsewhere
export const CARD_W = 90;
export const CARD_H = 120;
export const GRID_CONTAINER_W = 480;
export const GRID_CONTAINER_H = 540;
export const SLOT_POSITIONS: { x: number; y: number }[] = [
  { x: 140, y: 16  }, { x: 250, y: 16  },
  { x: 30,  y: 131 }, { x: 140, y: 131 }, { x: 250, y: 131 }, { x: 360, y: 131 },
  { x: 30,  y: 246 }, { x: 360, y: 246 },
  { x: 195, y: 361 },
];

/**
 * Dynamic grid layout — all values computed from viewport width.
 * No hardcoded magic numbers. Everything proportional.
 *
 * Formation (same as Griddy):
 *       [0:SG]    [1:SF]          ← inner pair, top row
 *  [2:UTIL] [3:PG] [4:PG] [5:UTIL] ← full-width quad
 *  [6:SF]              [7:SG]    ← outer pair, lower row
 *            [8:C]               ← center, bottom row
 */
export interface GridLayout {
  containerW: number;
  containerH: number;
  cardW: number;
  cardH: number;
  slotBelow: number;   // height below card reserved for label + dot
  labelFont: number;   // px size for slot position labels
  dotSize: number;     // px diameter of chemistry dots
  slotPositions: { x: number; y: number }[];
}

export function computeGridLayout(viewportW: number): GridLayout {
  // Court fills viewport width, capped at 680px for desktop
  const containerW = Math.min(viewportW, 680);

  // Card width: 4 cards fit across with equal gaps — slightly wider for readability
  const cardW = Math.min(Math.round(containerW / 5.2), 115);
  // Slightly squarer cards keep the 5-row court at ~Griddy's height:width ratio
  const cardH = Math.round(cardW * 1.2);

  // Label + dot space below each card — match Griddy's flat large dots + readable labels
  const labelFont = Math.max(13, Math.round(cardW * 0.19));
  const dotSize   = Math.max(16, Math.round(cardW * 0.22));
  const slotBelow = 3 + dotSize + 4 + labelFont + 2; // dot first, then label below

  // Percentage-based positions matching Griddy's formation proportions:
  // outer (UTIL/wings) at 13%/87%, PGs centered at 38%/62%,
  // top SG/SF pair at 25%/75% — between outer and PG, so PGs look centered
  const col0   = Math.max(0, Math.round(containerW * 0.13 - cardW / 2)); // UTIL-left, wings-left
  const colSG  = Math.round(containerW * 0.30 - cardW / 2);              // SG-top  (slot 0) — closer to center
  const col1   = Math.round(containerW * 0.38 - cardW / 2);              // PG-left (slot 3)
  const col2   = Math.round(containerW * 0.62 - cardW / 2);              // PG-right (slot 4)
  const colSF  = Math.round(containerW * 0.70 - cardW / 2);              // SF-top  (slot 1) — closer to center
  const col3   = Math.min(containerW - cardW, Math.round(containerW * 0.87 - cardW / 2)); // UTIL-right, wings-right
  const colC   = Math.round((containerW - cardW) / 2);

  // 5 distinct rows — PGs have their own row so they land at the half-court line
  //   row0   → SG-top / SF-top
  //   utilRow → UTIL-left / UTIL-right
  //   pgRow  → PG-left / PG-right  ← sits at containerH/2 (half-court)
  //   wingsRow → SF-bottom / SG-bottom
  //   cRow   → Center
  //
  // With equal rowSpacing the PG center falls within ~1 slotBelow/2 of cy.
  const topPad     = Math.round(cardW * 0.10);
  const rowGap     = Math.max(2, Math.round(cardW * 0.02));
  const rowSpacing = cardH + slotBelow + rowGap;

  const row0     = topPad;
  const utilRow  = topPad + rowSpacing;                          // UTIL
  const pgRow    = topPad + rowSpacing * 2;                      // PG  ≈ half-court
  const wingsRow = topPad + rowSpacing * 3;                      // wings
  // Center sits 0.7 rowSpacing below wings — "slightly lower, slight diagonal to wings"
  const cRow     = wingsRow + Math.round(rowSpacing * 0.7);

  // Include slotBelow for the last row so the C dot is never clipped
  const containerH = cRow + cardH + slotBelow + topPad;

  return {
    containerW,
    containerH,
    cardW,
    cardH,
    slotBelow,
    labelFont,
    dotSize,
    slotPositions: [
      { x: colSG, y: row0     }, // 0: SG-top
      { x: colSF, y: row0     }, // 1: SF-top
      { x: col0,  y: utilRow  }, // 2: UTIL-left
      { x: col1,  y: pgRow    }, // 3: PG-left  ← at half-court line
      { x: col2,  y: pgRow    }, // 4: PG-right ← at half-court line
      { x: col3,  y: utilRow  }, // 5: UTIL-right
      { x: col0,  y: wingsRow }, // 6: SF-bottom
      { x: col3,  y: wingsRow }, // 7: SG-bottom
      { x: colC,  y: cRow     }, // 8: C
    ],
  };
}

export const DRAFT_ODDS: Record<number, Record<Tier, number>> = {
  1: { 'dark-matter': 1, 'galaxy-opal': 5, 'pink-diamond': 55, 'diamond': 30, 'amethyst': 9, 'ruby': 0, 'sapphire': 0, 'emerald': 0, 'gold': 0 },
  2: { 'dark-matter': 1, 'galaxy-opal': 4, 'pink-diamond': 30, 'diamond': 45, 'amethyst': 18, 'ruby': 2, 'sapphire': 0, 'emerald': 0, 'gold': 0 },
  3: { 'dark-matter': 1, 'galaxy-opal': 3, 'pink-diamond': 10, 'diamond': 40, 'amethyst': 36, 'ruby': 10, 'sapphire': 0, 'emerald': 0, 'gold': 0 },
  4: { 'dark-matter': 1, 'galaxy-opal': 2, 'pink-diamond': 6, 'diamond': 20, 'amethyst': 40, 'ruby': 25, 'sapphire': 6, 'emerald': 0, 'gold': 0 },
  5: { 'dark-matter': 1, 'galaxy-opal': 2, 'pink-diamond': 5, 'diamond': 12, 'amethyst': 30, 'ruby': 35, 'sapphire': 12, 'emerald': 3, 'gold': 0 },
  6: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 3, 'diamond': 8, 'amethyst': 20, 'ruby': 35, 'sapphire': 22, 'emerald': 8, 'gold': 2 },
  7: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 2, 'diamond': 5, 'amethyst': 12, 'ruby': 30, 'sapphire': 28, 'emerald': 16, 'gold': 5 },
  8: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 2, 'diamond': 4, 'amethyst': 8, 'ruby': 20, 'sapphire': 30, 'emerald': 25, 'gold': 9 },
  9: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 1, 'diamond': 3, 'amethyst': 6, 'ruby': 15, 'sapphire': 28, 'emerald': 30, 'gold': 15 },
};
