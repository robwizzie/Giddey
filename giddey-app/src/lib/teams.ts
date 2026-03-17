import { Team } from './types';

export const TEAMS: Team[] = [
  // Eastern Conference - Atlantic
  { id: 'BOS', name: 'Celtics', city: 'Boston', abbreviation: 'BOS', conference: 'Eastern', division: 'Atlantic', primaryColor: '#007A33', secondaryColor: '#BA9653' },
  { id: 'BKN', name: 'Nets', city: 'Brooklyn', abbreviation: 'BKN', conference: 'Eastern', division: 'Atlantic', primaryColor: '#000000', secondaryColor: '#FFFFFF' },
  { id: 'NYK', name: 'Knicks', city: 'New York', abbreviation: 'NYK', conference: 'Eastern', division: 'Atlantic', primaryColor: '#006BB6', secondaryColor: '#F58426' },
  { id: 'PHI', name: '76ers', city: 'Philadelphia', abbreviation: 'PHI', conference: 'Eastern', division: 'Atlantic', primaryColor: '#006BB6', secondaryColor: '#ED174C' },
  { id: 'TOR', name: 'Raptors', city: 'Toronto', abbreviation: 'TOR', conference: 'Eastern', division: 'Atlantic', primaryColor: '#CE1141', secondaryColor: '#000000' },

  // Eastern Conference - Central
  { id: 'CHI', name: 'Bulls', city: 'Chicago', abbreviation: 'CHI', conference: 'Eastern', division: 'Central', primaryColor: '#CE1141', secondaryColor: '#000000' },
  { id: 'CLE', name: 'Cavaliers', city: 'Cleveland', abbreviation: 'CLE', conference: 'Eastern', division: 'Central', primaryColor: '#860038', secondaryColor: '#FDBB30' },
  { id: 'DET', name: 'Pistons', city: 'Detroit', abbreviation: 'DET', conference: 'Eastern', division: 'Central', primaryColor: '#C8102E', secondaryColor: '#1D42BA' },
  { id: 'IND', name: 'Pacers', city: 'Indiana', abbreviation: 'IND', conference: 'Eastern', division: 'Central', primaryColor: '#002D62', secondaryColor: '#FDBB30' },
  { id: 'MIL', name: 'Bucks', city: 'Milwaukee', abbreviation: 'MIL', conference: 'Eastern', division: 'Central', primaryColor: '#00471B', secondaryColor: '#EEE1C6' },

  // Eastern Conference - Southeast
  { id: 'ATL', name: 'Hawks', city: 'Atlanta', abbreviation: 'ATL', conference: 'Eastern', division: 'Southeast', primaryColor: '#E03A3E', secondaryColor: '#C1D32F' },
  { id: 'CHA', name: 'Hornets', city: 'Charlotte', abbreviation: 'CHA', conference: 'Eastern', division: 'Southeast', primaryColor: '#1D1160', secondaryColor: '#00788C' },
  { id: 'MIA', name: 'Heat', city: 'Miami', abbreviation: 'MIA', conference: 'Eastern', division: 'Southeast', primaryColor: '#98002E', secondaryColor: '#F9A01B' },
  { id: 'ORL', name: 'Magic', city: 'Orlando', abbreviation: 'ORL', conference: 'Eastern', division: 'Southeast', primaryColor: '#0077C0', secondaryColor: '#C4CED4' },
  { id: 'WAS', name: 'Wizards', city: 'Washington', abbreviation: 'WAS', conference: 'Eastern', division: 'Southeast', primaryColor: '#002B5C', secondaryColor: '#E31837' },

  // Western Conference - Northwest
  { id: 'DEN', name: 'Nuggets', city: 'Denver', abbreviation: 'DEN', conference: 'Western', division: 'Northwest', primaryColor: '#0E2240', secondaryColor: '#FEC524' },
  { id: 'MIN', name: 'Timberwolves', city: 'Minnesota', abbreviation: 'MIN', conference: 'Western', division: 'Northwest', primaryColor: '#0C2340', secondaryColor: '#236192' },
  { id: 'OKC', name: 'Thunder', city: 'Oklahoma City', abbreviation: 'OKC', conference: 'Western', division: 'Northwest', primaryColor: '#007AC1', secondaryColor: '#EF6C00' },
  { id: 'POR', name: 'Trail Blazers', city: 'Portland', abbreviation: 'POR', conference: 'Western', division: 'Northwest', primaryColor: '#E03A3E', secondaryColor: '#000000' },
  { id: 'UTA', name: 'Jazz', city: 'Utah', abbreviation: 'UTA', conference: 'Western', division: 'Northwest', primaryColor: '#002B5C', secondaryColor: '#00471B' },

  // Western Conference - Pacific
  { id: 'GSW', name: 'Warriors', city: 'Golden State', abbreviation: 'GSW', conference: 'Western', division: 'Pacific', primaryColor: '#1D428A', secondaryColor: '#FFC72C' },
  { id: 'LAC', name: 'Clippers', city: 'Los Angeles', abbreviation: 'LAC', conference: 'Western', division: 'Pacific', primaryColor: '#C8102E', secondaryColor: '#1D428A' },
  { id: 'LAL', name: 'Lakers', city: 'Los Angeles', abbreviation: 'LAL', conference: 'Western', division: 'Pacific', primaryColor: '#552583', secondaryColor: '#FDB927' },
  { id: 'PHX', name: 'Suns', city: 'Phoenix', abbreviation: 'PHX', conference: 'Western', division: 'Pacific', primaryColor: '#1D1160', secondaryColor: '#E56020' },
  { id: 'SAC', name: 'Kings', city: 'Sacramento', abbreviation: 'SAC', conference: 'Western', division: 'Pacific', primaryColor: '#5A2D81', secondaryColor: '#63727A' },

  // Western Conference - Southwest
  { id: 'DAL', name: 'Mavericks', city: 'Dallas', abbreviation: 'DAL', conference: 'Western', division: 'Southwest', primaryColor: '#00538C', secondaryColor: '#002B5E' },
  { id: 'HOU', name: 'Rockets', city: 'Houston', abbreviation: 'HOU', conference: 'Western', division: 'Southwest', primaryColor: '#CE1141', secondaryColor: '#000000' },
  { id: 'MEM', name: 'Grizzlies', city: 'Memphis', abbreviation: 'MEM', conference: 'Western', division: 'Southwest', primaryColor: '#5D76A9', secondaryColor: '#12173F' },
  { id: 'NOP', name: 'Pelicans', city: 'New Orleans', abbreviation: 'NOP', conference: 'Western', division: 'Southwest', primaryColor: '#0C2340', secondaryColor: '#C8102E' },
  { id: 'SAS', name: 'Spurs', city: 'San Antonio', abbreviation: 'SAS', conference: 'Western', division: 'Southwest', primaryColor: '#C4CED4', secondaryColor: '#000000' },
];

export const TEAMS_MAP: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t])
);

export function getTeam(teamId: string): Team {
  return TEAMS_MAP[teamId];
}
