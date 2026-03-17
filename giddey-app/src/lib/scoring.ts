import { PlayerCard, GridSlot, ChemLine, ChemDot, ChemLineLevel, ChemDotLevel, ScoreBreakdown, ADJACENCIES, TIER_CONFIG } from './types';

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
 * FULL COURT BONUS:
 *   +2 Chem when ALL 9 players have at least a Yellow Dot (2+ line chem each)
 *
 * MAX CHEMISTRY: 24 (lines) + 99 (dots) + 2 (full court) = 125
 *
 * TALENT: Sum of all 9 player tier values (Dark Matter=15, Pink Diamond=11, Diamond=8, Amethyst=5, Ruby=3)
 */

function getLineChemistry(cardA: PlayerCard, cardB: PlayerCard): { level: ChemLineLevel; points: number } {
  const sameTeam = cardA.teamId === cardB.teamId;
  const sameDivision = cardA.team.division === cardB.team.division;
  const sameDraftYear = cardA.draftYear === cardB.draftYear;

  // Green Line (+2): Same team OR (same division + same draft year)
  if (sameTeam || (sameDivision && sameDraftYear)) {
    return { level: 'green', points: 2 };
  }

  // Yellow Line (+1): Same division OR same draft year
  if (sameDivision || sameDraftYear) {
    return { level: 'yellow', points: 1 };
  }

  // Red Line (0): No matching traits
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

export function calculateScore(grid: GridSlot[]): ScoreBreakdown {
  const filledSlots = grid.filter((s) => s.card !== null);

  // Calculate talent
  const talent = filledSlots.reduce((sum, slot) => {
    if (!slot.card) return sum;
    return sum + TIER_CONFIG[slot.card.tier].talent;
  }, 0);

  // Calculate line chemistry
  const lines: ChemLine[] = [];
  const playerLineChem: Record<number, number> = {};

  // Initialize all slots
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

  // Full Court Bonus: +2 when all 9 players have at least yellow dot (2+ line chem)
  const allFilled = filledSlots.length === 9;
  const hasFullCourt = allFilled && dots.every((d) => d.level !== 'red');
  const fullCourtBonus = hasFullCourt ? 2 : 0;

  const totalChem = lineChem + dotChem + fullCourtBonus;
  const total = talent + totalChem;

  return {
    talent,
    lineChem,
    dotChem,
    fullCourtBonus,
    totalChem,
    total,
    lines,
    dots,
    hasFullCourt,
  };
}
