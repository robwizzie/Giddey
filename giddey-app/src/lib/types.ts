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
  fullCourtBonus: number;
  totalChem: number;
  total: number;
  lines: ChemLine[];
  dots: ChemDot[];
  hasFullCourt: boolean;
}

export interface DraftState {
  round: number;
  grid: GridSlot[];
  options: PlayerCard[];
  score: ScoreBreakdown;
  isComplete: boolean;
  selectedCards: PlayerCard[];
  usedPlayerIds: Set<string>;
}

export const TIER_CONFIG: Record<Tier, { label: string; talent: number; color: string; glow: string; bgGradient: string }> = {
  'dark-matter': {
    label: 'Dark Matter',
    talent: 15,
    color: '#1a0a2e',
    glow: 'rgba(138, 43, 226, 0.8)',
    bgGradient: 'linear-gradient(135deg, #0d0221, #1a0533, #2d0a4e, #1a0533)',
  },
  'pink-diamond': {
    label: 'Pink Diamond',
    talent: 11,
    color: '#ff69b4',
    glow: 'rgba(255, 105, 180, 0.7)',
    bgGradient: 'linear-gradient(135deg, #8b0a50, #c71585, #ff69b4, #c71585)',
  },
  'diamond': {
    label: 'Diamond',
    talent: 8,
    color: '#00bfff',
    glow: 'rgba(0, 191, 255, 0.7)',
    bgGradient: 'linear-gradient(135deg, #0066aa, #00aadd, #00ddff, #00aadd)',
  },
  'amethyst': {
    label: 'Amethyst',
    talent: 5,
    color: '#9b59b6',
    glow: 'rgba(155, 89, 182, 0.7)',
    bgGradient: 'linear-gradient(135deg, #6c3483, #8e44ad, #a569bd, #8e44ad)',
  },
  'ruby': {
    label: 'Ruby',
    talent: 3,
    color: '#e74c3c',
    glow: 'rgba(231, 76, 60, 0.7)',
    bgGradient: 'linear-gradient(135deg, #922b21, #c0392b, #e74c3c, #c0392b)',
  },
};

export const GRID_POSITIONS: GridPosition[] = [
  'SG', 'PG', 'SF',
  'UTIL', 'C', 'UTIL',
  'SG', 'PF', 'SF',
];

export const GRID_LABELS: string[] = [
  'SG', 'PG', 'SF',
  'UTIL', 'C', 'UTIL',
  'SG', 'PF', 'SF',
];

export const ADJACENCIES: [number, number][] = [
  [0, 1], [1, 2],
  [3, 4], [4, 5],
  [6, 7], [7, 8],
  [0, 3], [3, 6],
  [1, 4], [4, 7],
  [2, 5], [5, 8],
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
