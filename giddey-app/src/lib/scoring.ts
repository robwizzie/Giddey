import { PlayerCard, GridSlot, ChemLine, ChemDot, ChemLineLevel, ChemDotLevel, ScoreBreakdown, ADJACENCIES } from './types';

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
 * TALENT: Sum of each player's (OVR - 79)
 *   99 OVR → 20 talent, 95 OVR → 16, 90 OVR → 11, 85 OVR → 6, 80 OVR → 1
 *   Range: 9 (all 80s) to 180 (all 99s), realistic ~60-110
 */

function getLineChemistry(cardA: PlayerCard, cardB: PlayerCard): { level: ChemLineLevel; points: number } {
  const sameTeam = cardA.teamId === cardB.teamId;
  const sameDivision = cardA.team.division === cardB.team.division;
  const sameDraftYear = cardA.draftYear === cardB.draftYear;

  if (sameTeam || (sameDivision && sameDraftYear)) {
    return { level: 'green', points: 2 };
  }

  if (sameDivision || sameDraftYear) {
    return { level: 'yellow', points: 1 };
  }

  return { level: 'red', points: 0 };
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

/** Convert OVR to talent points: OVR - 79 (80→1, 99→20) */
export function ovrToTalent(ovr: number): number {
  return Math.max(ovr - 79, 1);
}

export function calculateScore(grid: GridSlot[]): ScoreBreakdown {
  const filledSlots = grid.filter((s) => s.card !== null);

  // Talent = sum of each player's (OVR - 79)
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
      const { level, points } = getLineChemistry(cardA, cardB);
      lines.push({ from, to, level, points });
      playerLineChem[from] += points;
      playerLineChem[to] += points;
    } else {
      lines.push({ from, to, level: 'red', points: 0 });
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
