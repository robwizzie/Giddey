import { PlayerCard, GridSlot, GridPosition, ChemLine, ChemDot, ChemLineLevel, ChemDotLevel, ScoreBreakdown, ADJACENCIES } from './types';

/**
 * Chemistry Scoring System for Giddey
 *
 * LINE CHEMISTRY (between adjacent cards):
 *   Green Line (+2 Chem): Same team OR (same division + same draft year)
 *   Yellow Line (+1 Chem): Same division OR same draft year
 *   Red Line (0 Chem): No matching traits
 *
 * DOT CHEMISTRY (per-player bonus based on accumulated line chem):
 *   Green Dot (+11 Chem): Player has 4+ line chem from adjacent connections
 *   Yellow Dot (+6 Chem): Player has 2-3 line chem from adjacent connections
 *   Red Dot (0 Chem): Player has 0-1 line chem
 *
 * MAX CHEMISTRY: 26 (lines) + 99 (dots) = 125
 *
 * TALENT: Sum of each player's (OVR - 75)
 *   100 OVR → 25 talent, 90 OVR → 15, 80 OVR → 5, 76 OVR → 1
 */

function getLineChemistry(cardA: PlayerCard, cardB: PlayerCard): { level: ChemLineLevel; points: number; reasons: string[] } {
  const sameTeam = cardA.teamId === cardB.teamId;
  const sameDivision = cardA.team.division === cardB.team.division;
  const sameDraftYear = cardA.draftYear === cardB.draftYear;

  const reasons: string[] = [];
  if (sameTeam) reasons.push('team');
  if (sameDivision) reasons.push('division');
  if (sameDraftYear) reasons.push('year');

  if (sameTeam || (sameDivision && sameDraftYear)) {
    return { level: 'green', points: 2, reasons };
  }

  if (sameDivision || sameDraftYear) {
    return { level: 'yellow', points: 1, reasons };
  }

  return { level: 'red', points: 0, reasons: [] };
}

function getDotChemistry(lineChem: number): { level: ChemDotLevel; points: number } {
  if (lineChem >= 4) {
    return { level: 'green', points: 11 };
  }
  if (lineChem >= 2) {
    return { level: 'yellow', points: 6 };
  }
  return { level: 'red', points: 0 };
}

/** Convert OVR to talent points: OVR - 75 (100→25, 90→15, 80→5, 76→1) */
export function ovrToTalent(ovr: number): number {
  return Math.max(ovr - 75, 1);
}

export function calculateScore(grid: GridSlot[]): ScoreBreakdown {
  const filledSlots = grid.filter((s) => s.card !== null);

  // Talent = sum of each player's (OVR - 75)
  const talent = filledSlots.reduce((sum, slot) => {
    if (!slot.card) return sum;
    return sum + ovrToTalent(slot.card.overall);
  }, 0);

  // Calculate line chemistry
  const lines: ChemLine[] = [];
  const playerLineChem: Record<number, number> = {};

  for (let i = 0; i < 9; i++) {
    playerLineChem[i] = 0;
  }

  for (const [from, to] of ADJACENCIES) {
    const cardA = grid[from]?.card;
    const cardB = grid[to]?.card;

    if (cardA && cardB) {
      const { level, points, reasons } = getLineChemistry(cardA, cardB);
      lines.push({ from, to, level, points, reasons });
      playerLineChem[from] += points;
      playerLineChem[to] += points;
    } else {
      lines.push({ from, to, level: 'red', points: 0, reasons: [] });
    }
  }

  const lineChem = lines.reduce((sum, l) => sum + l.points, 0);

  // Calculate dot chemistry
  const dots: ChemDot[] = [];
  for (let i = 0; i < 9; i++) {
    if (grid[i]?.card) {
      const lc = playerLineChem[i];
      const { level, points } = getDotChemistry(lc);
      dots.push({ slotIndex: i, level, points, lineChem: lc });
    } else {
      dots.push({ slotIndex: i, level: 'red', points: 0, lineChem: 0 });
    }
  }

  const dotChem = dots.reduce((sum, d) => sum + d.points, 0);

  const totalChem = lineChem + dotChem;
  const total = talent + totalChem;

  return {
    talent,
    lineChem,
    dotChem,
    totalChem,
    total,
    lines,
    dots,
  };
}

/**
 * Find the optimal arrangement of drafted players to maximize chemistry score.
 * Uses brute-force permutation with position-constraint pruning.
 * With 9 slots and position restrictions, the search space is very manageable.
 */
export function findOptimalLineup(grid: GridSlot[]): { bestScore: ScoreBreakdown; bestGrid: GridSlot[] } {
  const cards = grid.filter(s => s.card !== null).map(s => s.card!);
  if (cards.length < 9) {
    return { bestScore: calculateScore(grid), bestGrid: grid };
  }

  const slotPositions = grid.map(s => s.position);
  let bestTotal = -1;
  let bestArrangement: (PlayerCard | null)[] = grid.map(s => s.card);

  function canPlace(card: PlayerCard, slotPos: GridPosition): boolean {
    if (slotPos === 'UTIL') return true;
    return slotPos === card.position;
  }

  // Recursive permutation with pruning
  const used = new Array(cards.length).fill(false);
  const current: (PlayerCard | null)[] = new Array(9).fill(null);

  function solve(slotIdx: number) {
    if (slotIdx === 9) {
      // Build temporary grid and score it
      const tempGrid: GridSlot[] = grid.map((s, i) => ({ ...s, card: current[i] }));
      const sc = calculateScore(tempGrid);
      if (sc.total > bestTotal) {
        bestTotal = sc.total;
        bestArrangement = [...current];
      }
      return;
    }

    for (let c = 0; c < cards.length; c++) {
      if (used[c]) continue;
      if (!canPlace(cards[c], slotPositions[slotIdx])) continue;
      used[c] = true;
      current[slotIdx] = cards[c];
      solve(slotIdx + 1);
      used[c] = false;
      current[slotIdx] = null;
    }
  }

  solve(0);

  const bestGrid: GridSlot[] = grid.map((s, i) => ({ ...s, card: bestArrangement[i] }));
  const bestScore = calculateScore(bestGrid);
  return { bestScore, bestGrid };
}
