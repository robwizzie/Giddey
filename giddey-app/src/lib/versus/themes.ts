import { TEAMS_MAP } from '@/lib/teams';
import { Division } from '@/lib/types';
import { VersusPlayer } from './pool';

// ═══════════════════════════════════════════════════════════════
//  THEME DRAFTS — spin before the draft to force a different player mix.
//  A theme either narrows the pool (filter), splits it per coach
//  (East vs West), or adds a roster rule (One Per Franchise).
// ═══════════════════════════════════════════════════════════════

export type ThemeId = 'throwback' | 'eighties90s' | 'youngGuns' | 'division' | 'eastWest' | 'onePerFranchise' | 'cap95' | 'underdog';

export interface ActiveTheme {
	id: ThemeId;
	/** Division Night: which division; East vs West: which conference coach 1 drafts */
	param?: string;
}

export interface Theme {
	id: ThemeId;
	label: string;
	icon: string;
	desc: string;
	color: string;
	/** each coach draws from their own slice (can't share packs / auction boards) */
	split?: boolean;
	/** roster rule instead of (or on top of) a pool filter */
	onePerFranchise?: boolean;
	filter?: (p: VersusPlayer, side: 0 | 1, param?: string) => boolean;
}

export const DIVISIONS: Division[] = ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'];

const conf = (p: VersusPlayer) => TEAMS_MAP[p.teamId]?.conference;

export const THEMES: Theme[] = [
	{
		id: 'throwback',
		label: 'Throwback',
		icon: 'hourglass',
		color: '#f59e0b',
		desc: 'Legends who played before 2000 only.',
		filter: p => p.era === 'alltime' && ['50s', '60s', '70s', '80s', '90s'].includes(p.eraLabel ?? ''),
	},
	{
		id: 'eighties90s',
		label: '80s & 90s Night',
		icon: 'gamepad',
		color: '#ec4899',
		desc: 'Only legends from the 80s and 90s.',
		filter: p => p.era === 'alltime' && ['80s', '90s'].includes(p.eraLabel ?? ''),
	},
	{
		id: 'youngGuns',
		label: 'Young Guns',
		icon: 'sprout',
		color: '#22c55e',
		desc: 'Only current players drafted in 2022 or later.',
		filter: p => p.era === 'modern' && p.draftYear >= 2022,
	},
	{
		id: 'division',
		label: 'Division Night',
		icon: 'map',
		color: '#3b82f6',
		desc: 'Everyone comes from one division’s franchises.',
		filter: (p, _side, param) => TEAMS_MAP[p.teamId]?.division === param,
	},
	{
		id: 'eastWest',
		label: 'East vs West',
		icon: 'compass',
		color: '#06b6d4',
		split: true,
		desc: 'One coach drafts only Eastern Conference franchises, the other only Western.',
		filter: (p, side, param) => {
			const mine = side === 0 ? param : param === 'Eastern' ? 'Western' : 'Eastern';
			return conf(p) === mine;
		},
	},
	{
		id: 'onePerFranchise',
		label: 'One Per Franchise',
		icon: 'building',
		color: '#a855f7',
		onePerFranchise: true,
		desc: 'No two players on your roster can come from the same franchise.',
	},
	{
		id: 'cap95',
		label: 'No One Over 95',
		icon: 'ban',
		color: '#ef4444',
		desc: 'Nobody rated above 95 OVR — the true superstars sit this one out.',
		filter: p => p.overall <= 95,
	},
	{
		id: 'underdog',
		label: 'Underdog Night',
		icon: 'shield',
		color: '#64748b',
		desc: 'Nobody rated above 90 OVR. Role players get their moment.',
		filter: p => p.overall <= 90,
	},
];

export function getTheme(id: string | null | undefined): Theme | undefined {
	return THEMES.find(t => t.id === id);
}

/** Random parameter a theme needs once it lands */
export function rollThemeParam(id: ThemeId): string | undefined {
	if (id === 'division') return DIVISIONS[Math.floor(Math.random() * DIVISIONS.length)];
	if (id === 'eastWest') return Math.random() < 0.5 ? 'Eastern' : 'Western';
	return undefined;
}

export function themeTitle(t: ActiveTheme | null | undefined, names?: [string, string]): string {
	const theme = getTheme(t?.id);
	if (!theme) return '';
	if (theme.id === 'division' && t?.param) return `${t.param} Division Night`;
	if (theme.id === 'eastWest' && t?.param && names) return `${names[0]}: ${t.param === 'Eastern' ? 'East' : 'West'} · ${names[1]}: ${t.param === 'Eastern' ? 'West' : 'East'}`;
	return theme.label;
}
