import { PlayerCard, Tier } from './types';
import { TEAMS_MAP } from './teams';

export interface ExampleCard {
  card: PlayerCard;
  talent: number;
}

export const EXAMPLE_CARDS: ExampleCard[] = [
  { card: { id: 'nikola_jokic', firstName: 'Nikola', lastName: 'Jokic', position: 'C', secondaryPosition: 'PF', teamId: 'DEN', draftYear: 2014, tier: 'dark-matter', overall: 100, team: TEAMS_MAP['DEN'] }, talent: 15 },
  { card: { id: 'giannis_antetokounmpo', firstName: 'Giannis', lastName: 'Antetokounmpo', position: 'PF', secondaryPosition: 'C', teamId: 'MIL', draftYear: 2013, tier: 'galaxy-opal', overall: 97, team: TEAMS_MAP['MIL'] }, talent: 13 },
  { card: { id: 'anthony_edwards', firstName: 'Anthony', lastName: 'Edwards', position: 'SG', secondaryPosition: 'SF', teamId: 'MIN', draftYear: 2020, tier: 'pink-diamond', overall: 96, team: TEAMS_MAP['MIN'] }, talent: 11 },
  { card: { id: 'jayson_tatum', firstName: 'Jayson', lastName: 'Tatum', position: 'PF', secondaryPosition: 'SF', teamId: 'BOS', draftYear: 2017, tier: 'diamond', overall: 94, team: TEAMS_MAP['BOS'] }, talent: 9 },
  { card: { id: 'kyrie_irving', firstName: 'Kyrie', lastName: 'Irving', position: 'PG', secondaryPosition: 'SG', teamId: 'DAL', draftYear: 2011, tier: 'amethyst', overall: 90, team: TEAMS_MAP['DAL'] }, talent: 7 },
  { card: { id: 'ja_morant', firstName: 'Ja', lastName: 'Morant', position: 'PG', secondaryPosition: 'SG', teamId: 'MEM', draftYear: 2019, tier: 'ruby', overall: 87, team: TEAMS_MAP['MEM'] }, talent: 5 },
  { card: { id: 'domantas_sabonis', firstName: 'Domantas', lastName: 'Sabonis', position: 'C', secondaryPosition: 'PF', teamId: 'SAC', draftYear: 2016, tier: 'sapphire', overall: 86, team: TEAMS_MAP['SAC'] }, talent: 4 },
  { card: { id: 'dyson_daniels', firstName: 'Dyson', lastName: 'Daniels', position: 'SG', secondaryPosition: 'PG', teamId: 'ATL', draftYear: 2022, tier: 'emerald', overall: 83, team: TEAMS_MAP['ATL'] }, talent: 2 },
  { card: { id: 'rui_hachimura', firstName: 'Rui', lastName: 'Hachimura', position: 'SF', secondaryPosition: 'PF', teamId: 'LAL', draftYear: 2019, tier: 'gold', overall: 79, team: TEAMS_MAP['LAL'] }, talent: 1 },
];

export const TIER_DISPLAY: { tier: Tier; label: string; color: string }[] = [
  { tier: 'dark-matter', label: 'Dark Matter', color: '#8b5cf6' },
  { tier: 'galaxy-opal', label: 'Galaxy Opal', color: '#f0abfc' },
  { tier: 'pink-diamond', label: 'Pink Diamond', color: '#ec4899' },
  { tier: 'diamond', label: 'Diamond', color: '#06b6d4' },
  { tier: 'amethyst', label: 'Amethyst', color: '#a855f7' },
  { tier: 'ruby', label: 'Ruby', color: '#ef4444' },
  { tier: 'sapphire', label: 'Sapphire', color: '#3b82f6' },
  { tier: 'emerald', label: 'Emerald', color: '#22c55e' },
  { tier: 'gold', label: 'Gold', color: '#eab308' },
];
