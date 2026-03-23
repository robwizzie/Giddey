import { Player } from './types';
import { ALL_PLAYERS } from './players';

/**
 * Load all available players (base roster from JSON + custom cards).
 * This is synchronous since the data is bundled in the app.
 * Kept as an async function for API compatibility if we add
 * dynamic fetching in the future.
 */
export async function loadPlayers(): Promise<Player[]> {
  return ALL_PLAYERS;
}
