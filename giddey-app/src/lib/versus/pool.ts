import { Position, Team, Tier } from '@/lib/types';
import { tierFromOverall } from '@/lib/players';
import { TEAMS_MAP } from '@/lib/teams';
import modernData from '@/data/2k27-modern.json';
import allTimeData from '@/data/2k27-alltime.json';

// ═══════════════════════════════════════════════════════════════
//  VERSUS PLAYER POOL — NBA 2K27 launch ratings
//  Modern = current 2026-27 rosters, All-Time = 2K27 All-Time teams.
//  Refresh by replacing the two JSON files in src/data/.
// ═══════════════════════════════════════════════════════════════

export type Era = 'modern' | 'alltime';
export type PoolMode = 'modern' | 'alltime' | 'mixed';

export interface VersusPlayer {
	id: string;
	firstName: string;
	lastName: string;
	position: Position;
	secondaryPosition: Position;
	teamId: string;
	draftYear: number;
	overall: number;
	tier: Tier;
	era: Era;
	/** e.g. "90s" — only for all-time legends */
	eraLabel?: string;
	verified: boolean;
}

interface RawVersusPlayer {
	first_name: string;
	last_name: string;
	position: string;
	ovr: number;
	team: string;
	draft_year: number;
	era?: string;
	verified?: boolean;
}

const POS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const DEFAULT_SECONDARY: Record<Position, Position> = { PG: 'SG', SG: 'SF', SF: 'PF', PF: 'C', C: 'PF' };

function slug(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/['.]/g, '')
		.replace(/[\s-]+/g, '_');
}

function convert(raw: RawVersusPlayer, era: Era): VersusPlayer {
	const parts = raw.position.split('/').map(s => s.trim().toUpperCase());
	const primary = (POS.includes(parts[0] as Position) ? parts[0] : 'SF') as Position;
	let secondary = (POS.includes(parts[1] as Position) ? parts[1] : undefined) as Position | undefined;
	if (!secondary || secondary === primary) secondary = DEFAULT_SECONDARY[primary];
	const ovr = Math.round(raw.ovr);
	return {
		id: `${era === 'alltime' ? 'at_' : ''}${slug(raw.first_name)}_${slug(raw.last_name)}`,
		firstName: raw.first_name,
		lastName: raw.last_name,
		position: primary,
		secondaryPosition: secondary,
		teamId: TEAMS_MAP[raw.team] ? raw.team : 'UTA',
		draftYear: raw.draft_year,
		overall: ovr,
		tier: tierFromOverall(ovr),
		era,
		eraLabel: era === 'alltime' ? raw.era : undefined,
		verified: raw.verified !== false,
	};
}

function build(data: RawVersusPlayer[], era: Era): VersusPlayer[] {
	const seen = new Set<string>();
	const out: VersusPlayer[] = [];
	for (const raw of data) {
		if (!raw || typeof raw.ovr !== 'number') continue;
		const p = convert(raw, era);
		if (seen.has(p.id)) continue;
		seen.add(p.id);
		out.push(p);
	}
	return out.sort((a, b) => b.overall - a.overall);
}

export const MODERN_PLAYERS = build(modernData as RawVersusPlayer[], 'modern');
export const ALLTIME_PLAYERS = build(allTimeData as RawVersusPlayer[], 'alltime');

const BY_ID = new Map<string, VersusPlayer>([...MODERN_PLAYERS, ...ALLTIME_PLAYERS].map(p => [p.id, p]));

export function getVersusPlayer(id: string): VersusPlayer | undefined {
	return BY_ID.get(id);
}

/** Pool sorted by OVR descending. */
const MIXED_PLAYERS = [...MODERN_PLAYERS, ...ALLTIME_PLAYERS].sort((a, b) => b.overall - a.overall);

export function getPool(mode: PoolMode): VersusPlayer[] {
	if (mode === 'modern') return MODERN_PLAYERS;
	if (mode === 'alltime') return ALLTIME_PLAYERS;
	return MIXED_PLAYERS;
}

export function getTeamFor(p: VersusPlayer): Team {
	return TEAMS_MAP[p.teamId];
}

export function teamLabel(p: VersusPlayer): string {
	const t = getTeamFor(p);
	return p.era === 'alltime' ? `All-Time ${t.name}` : `${t.city} ${t.name}`;
}
