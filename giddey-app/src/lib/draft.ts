import { Player, PlayerCard, GridSlot, Position, GridPosition, Tier, GRID_POSITIONS, GRID_LABELS, DRAFT_ODDS } from './types';
import { ALL_PLAYERS } from './players';
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

  const tiers: Tier[] = ['dark-matter', 'galaxy-opal', 'pink-diamond', 'diamond', 'amethyst', 'ruby', 'sapphire', 'emerald', 'gold'];
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
      (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).forEach((p) => positions.add(p));
    } else {
      positions.add(slot.position as Position);
    }
  }

  return Array.from(positions);
}

function canPlaceInSlot(slot: GridSlot, position: Position, secondaryPosition?: Position): boolean {
  if (slot.card !== null) return false;
  if (slot.position === 'UTIL') return true;
  if (slot.position === position) return true;
  if (secondaryPosition && slot.position === secondaryPosition) return true;
  return false;
}

export function getValidSlotsForCard(grid: GridSlot[], card: PlayerCard): number[] {
  return grid
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => canPlaceInSlot(slot, card.position, card.secondaryPosition))
    .map(({ index }) => index);
}

/**
 * Generate 3 draft options for a round.
 * Accepts a `playerPool` parameter so it can use either static or dynamically-loaded players.
 * Falls back to ALL_PLAYERS (static) if no pool provided.
 */
export function generateOptions(
  round: number,
  grid: GridSlot[],
  usedPlayerIds: Set<string>,
  playerPool?: Player[],
): PlayerCard[] {
  const pool = playerPool ?? ALL_PLAYERS;
  const openPositions = getOpenPositions(grid);
  if (openPositions.length === 0) return [];

  const options: PlayerCard[] = [];
  const usedInThisRound = new Set<string>();

  // Build set of real-person IDs already used (prevents LeBron base + LeBron promo in same draft)
  const usedPersonIds = new Set<string>();
  for (const uid of usedPlayerIds) {
    const pl = pool.find(p => p.id === uid);
    usedPersonIds.add(pl?.playerId ?? uid);
  }

  const positionMatches = (p: Player) =>
    openPositions.includes(p.position) || openPositions.includes(p.secondaryPosition);

  const isAvailable = (p: Player) => {
    if (usedPlayerIds.has(p.id)) return false;
    if (usedInThisRound.has(p.id)) return false;
    const personId = p.playerId ?? p.id;
    if (usedPersonIds.has(personId)) return false;
    if (usedInThisRound.has(personId)) return false;
    return true;
  };

  for (let i = 0; i < 3; i++) {
    const tier = rollTier(round);

    let eligible = pool.filter(
      (p) => p.tier === tier && positionMatches(p) && isAvailable(p)
    );

    if (eligible.length === 0) {
      eligible = pool.filter(
        (p) => positionMatches(p) && isAvailable(p)
      );
    }

    if (eligible.length === 0) continue;

    const player = eligible[Math.floor(Math.random() * eligible.length)];
    usedInThisRound.add(player.id);
    usedInThisRound.add(player.playerId ?? player.id);
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

export function getValidSwapTargets(grid: GridSlot[], fromIndex: number): number[] {
  const fromSlot = grid[fromIndex];
  const fromCard = fromSlot.card;
  if (!fromCard) return [];

  return grid
    .map((slot, i) => {
      if (i === fromIndex || !slot.card) return -1;
      if (!canPlaceInSlot({ ...slot, card: null }, fromCard.position, fromCard.secondaryPosition)) return -1;
      if (!canPlaceInSlot({ ...fromSlot, card: null }, slot.card.position, slot.card.secondaryPosition)) return -1;
      return i;
    })
    .filter(i => i !== -1);
}

export function swapCards(grid: GridSlot[], fromIndex: number, toIndex: number): GridSlot[] | null {
  const fromSlot = grid[fromIndex];
  const toSlot = grid[toIndex];
  const fromCard = fromSlot.card;
  const toCard = toSlot.card;

  if (fromCard && !canPlaceInSlot({ ...toSlot, card: null }, fromCard.position, fromCard.secondaryPosition)) return null;
  if (toCard && !canPlaceInSlot({ ...fromSlot, card: null }, toCard.position, toCard.secondaryPosition)) return null;

  return grid.map((slot, i) => {
    if (i === fromIndex) return { ...slot, card: toCard };
    if (i === toIndex) return { ...slot, card: fromCard };
    return slot;
  });
}
