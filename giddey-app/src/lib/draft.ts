import { Player, PlayerCard, GridSlot, Position, GridPosition, Tier, GRID_POSITIONS, GRID_LABELS, DRAFT_ODDS } from './types';
import { PLAYERS } from './players';
import { TEAMS_MAP } from './teams';

function createPlayerCard(player: Player): PlayerCard {
  return {
    ...player,
    team: TEAMS_MAP[player.teamId],
  };
}

function rollTier(round: number): Tier {
  const odds = DRAFT_ODDS[round];
  const roll = Math.random() * 100;
  let cumulative = 0;

  const tiers: Tier[] = ['dark-matter', 'pink-diamond', 'diamond', 'amethyst', 'ruby'];
  for (const tier of tiers) {
    cumulative += odds[tier];
    if (roll < cumulative) return tier;
  }
  return 'ruby';
}

function getOpenPositions(grid: GridSlot[]): Position[] {
  const openSlots = grid.filter((s) => s.card === null);
  const positions = new Set<Position>();

  for (const slot of openSlots) {
    if (slot.position === 'UTIL') {
      // UTIL can be any position
      (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).forEach((p) => positions.add(p));
    } else {
      positions.add(slot.position as Position);
    }
  }

  return Array.from(positions);
}

function canPlaceInSlot(slot: GridSlot, position: Position): boolean {
  if (slot.card !== null) return false;
  if (slot.position === 'UTIL') return true;
  return slot.position === position;
}

export function getValidSlotsForCard(grid: GridSlot[], card: PlayerCard): number[] {
  return grid
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => canPlaceInSlot(slot, card.position))
    .map(({ index }) => index);
}

export function generateOptions(
  round: number,
  grid: GridSlot[],
  usedPlayerIds: Set<string>
): PlayerCard[] {
  const openPositions = getOpenPositions(grid);
  if (openPositions.length === 0) return [];

  const options: PlayerCard[] = [];
  const usedInThisRound = new Set<string>();

  for (let i = 0; i < 3; i++) {
    const tier = rollTier(round);

    // Get eligible players: correct tier, open position, not already used
    let eligible = PLAYERS.filter(
      (p) =>
        p.tier === tier &&
        openPositions.includes(p.position) &&
        !usedPlayerIds.has(p.id) &&
        !usedInThisRound.has(p.id)
    );

    // If no eligible players at this tier, try other tiers
    if (eligible.length === 0) {
      eligible = PLAYERS.filter(
        (p) =>
          openPositions.includes(p.position) &&
          !usedPlayerIds.has(p.id) &&
          !usedInThisRound.has(p.id)
      );
    }

    if (eligible.length === 0) continue;

    // Pick a random player from eligible
    const player = eligible[Math.floor(Math.random() * eligible.length)];
    usedInThisRound.add(player.id);
    options.push(createPlayerCard(player));
  }

  return options;
}

export function createInitialGrid(): GridSlot[] {
  return GRID_POSITIONS.map((position, index) => ({
    index,
    position,
    label: GRID_LABELS[index],
    card: null,
  }));
}

export function placeCard(grid: GridSlot[], slotIndex: number, card: PlayerCard): GridSlot[] {
  return grid.map((slot, i) =>
    i === slotIndex ? { ...slot, card } : slot
  );
}

export function swapCards(grid: GridSlot[], fromIndex: number, toIndex: number): GridSlot[] | null {
  const fromSlot = grid[fromIndex];
  const toSlot = grid[toIndex];
  const fromCard = fromSlot.card;
  const toCard = toSlot.card;

  // Check if the swap is valid (position compatibility)
  if (fromCard && !canPlaceInSlot({ ...toSlot, card: null }, fromCard.position)) return null;
  if (toCard && !canPlaceInSlot({ ...fromSlot, card: null }, toCard.position)) return null;

  return grid.map((slot, i) => {
    if (i === fromIndex) return { ...slot, card: toCard };
    if (i === toIndex) return { ...slot, card: fromCard };
    return slot;
  });
}
