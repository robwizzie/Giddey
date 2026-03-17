export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type GridPosition = Position | 'UTIL';

export type Tier = 'dark-matter' | 'pink-diamond' | 'diamond' | 'amethyst' | 'ruby';

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
  firstName: string;
  lastName: string;
  position: Position;
  teamId: string;
  draftYear: number;
  tier: Tier;
  overall: number;
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

export const TIER_CONFIG: Record<Tier, { label: string; talent: number; color: string; borderColor: string }> = {
  'dark-matter': { label: 'Dark Matter', talent: 15, color: '#8b5cf6', borderColor: 'rgba(138,43,226,0.8)' },
  'pink-diamond': { label: 'Pink Diamond', talent: 11, color: '#ec4899', borderColor: 'rgba(255,105,180,0.7)' },
  'diamond': { label: 'Diamond', talent: 8, color: '#22d3ee', borderColor: 'rgba(0,191,255,0.7)' },
  'amethyst': { label: 'Amethyst', talent: 5, color: '#a855f7', borderColor: 'rgba(155,89,182,0.7)' },
  'ruby': { label: 'Ruby', talent: 3, color: '#ef4444', borderColor: 'rgba(231,76,60,0.7)' },
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
  'SG', 'SF',           // Row 0: top pair
  'UTIL', 'PG', 'PG', 'UTIL', // Row 1: middle quad
  'SF', 'SG',           // Row 2: lower pair
  'C',                   // Row 3: bottom center
];

export const GRID_LABELS: string[] = [
  'SG', 'SF',
  'UTIL', 'PG', 'PG', 'UTIL',
  'SF', 'SG',
  'C',
];

// 13 adjacencies matching the formation connections
export const ADJACENCIES: [number, number][] = [
  [0, 2], [0, 3],       // SG top connects to UTIL-left and PG-left
  [1, 4], [1, 5],       // SF top connects to PG-right and UTIL-right
  [2, 3],               // UTIL-left to PG-left
  [3, 4],               // PG-left to PG-right
  [4, 5],               // PG-right to UTIL-right
  [2, 6],               // UTIL-left down to SF-bottom
  [5, 7],               // UTIL-right down to SG-bottom
  [3, 8], [4, 8],       // Both PGs to Center
  [6, 8], [7, 8],       // Both bottom wings to Center
];

// Pixel positions for each slot in the formation (within a 390×530 container)
// Card dimensions: 82w × 108h
export const CARD_W = 82;
export const CARD_H = 108;
export const GRID_CONTAINER_W = 390;
export const GRID_CONTAINER_H = 530;

export const SLOT_POSITIONS: { x: number; y: number }[] = [
  // Row 0: top pair (centered)
  { x: 110, y: 8 },    // 0: SG
  { x: 200, y: 8 },    // 1: SF
  // Row 1: middle quad (full width)
  { x: 8, y: 138 },    // 2: UTIL
  { x: 104, y: 138 },  // 3: PG
  { x: 200, y: 138 },  // 4: PG
  { x: 300, y: 138 },  // 5: UTIL
  // Row 2: lower pair (far edges)
  { x: 8, y: 275 },    // 6: SF
  { x: 300, y: 275 },  // 7: SG
  // Row 3: bottom center
  { x: 154, y: 400 },  // 8: C
];

export const DRAFT_ODDS: Record<number, Record<Tier, number>> = {
  1: { 'dark-matter': 2, 'pink-diamond': 80, 'diamond': 18, 'amethyst': 0, 'ruby': 0 },
  2: { 'dark-matter': 2, 'pink-diamond': 50, 'diamond': 45, 'amethyst': 3, 'ruby': 0 },
  3: { 'dark-matter': 2, 'pink-diamond': 10, 'diamond': 65, 'amethyst': 23, 'ruby': 0 },
  4: { 'dark-matter': 2, 'pink-diamond': 8, 'diamond': 45, 'amethyst': 40, 'ruby': 5 },
  5: { 'dark-matter': 2, 'pink-diamond': 8, 'diamond': 25, 'amethyst': 60, 'ruby': 5 },
  6: { 'dark-matter': 2, 'pink-diamond': 7, 'diamond': 10, 'amethyst': 50, 'ruby': 31 },
  7: { 'dark-matter': 2, 'pink-diamond': 7, 'diamond': 10, 'amethyst': 41, 'ruby': 40 },
  8: { 'dark-matter': 2, 'pink-diamond': 5, 'diamond': 7, 'amethyst': 21, 'ruby': 65 },
  9: { 'dark-matter': 2, 'pink-diamond': 4, 'diamond': 6, 'amethyst': 18, 'ruby': 70 },
};
