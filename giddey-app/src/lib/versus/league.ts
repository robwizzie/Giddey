import type { RivalryGame } from './rivalry';

// ═══════════════════════════════════════════════════════════════
//  LEAGUES — 3 to 12 coaches, a round-robin schedule, standings, then a
//  seeded playoff bracket and a champion.
//
//  Everything is worked out from the league itself plus the games in the
//  rivalry log tagged with its id, so a league can live on one phone or
//  be synced through the cloud the same way rivalries are.
// ═══════════════════════════════════════════════════════════════

export interface LeagueFormat {
	/** times each pair meets in the regular season */
	rounds: 1 | 2;
	/** teams that make the playoffs (0 = regular season only) */
	playoff: 0 | 2 | 4 | 8;
	/** games per playoff series */
	bestOf: 1 | 3 | 5;
}

export interface League {
	id: string;
	name: string;
	names: string[];
	format: LeagueFormat;
	createdAt: number;
	/** commissioner started the playoffs before every regular match was played */
	playoffsEarly?: boolean;
	/** set when the league lives in the cloud */
	cloud?: { inviteCode: string; isCommissioner: boolean };
}

/** What a logged game carries when it belongs to a league match */
export interface LeagueTag {
	id: string;
	/** "r:<round>:<a>|<b>" regular season, "p:<round>:<slot>" playoffs */
	match: string;
}

export interface Match {
	key: string;
	stage: 'regular' | 'playoff';
	names: [string, string];
	/** regular: the game; playoff: every game in the series */
	games: RivalryGame[];
	/** winner's name once decided */
	winner: string | null;
	/** playoff series wins, seated to `names` */
	wins: [number, number];
	label: string;
}

export interface Standing {
	name: string;
	wins: number;
	losses: number;
	pf: number;
	pa: number;
	played: number;
	streak: string;
}

const norm = (n: string) => n.trim().toLowerCase();

export const LEAGUE_MIN = 3;
export const LEAGUE_MAX = 12;
export const DEFAULT_FORMAT: LeagueFormat = { rounds: 1, playoff: 4, bestOf: 3 };

export function leagueGames(l: League, all: RivalryGame[]): RivalryGame[] {
	return all.filter(g => g.league?.id === l.id).sort((a, b) => a.ts - b.ts);
}

/** Round robin (circle method): every pair meets `rounds` times, home and away alternating */
export function schedule(l: League): { key: string; names: [string, string]; week: number }[] {
	const teams: (string | null)[] = [...l.names];
	if (teams.length % 2) teams.push(null);
	const n = teams.length;
	const out: { key: string; names: [string, string]; week: number }[] = [];
	for (let r = 0; r < l.format.rounds; r++) {
		const arr = [...teams];
		for (let w = 0; w < n - 1; w++) {
			for (let i = 0; i < n / 2; i++) {
				const a = arr[i];
				const b = arr[n - 1 - i];
				if (!a || !b) continue;
				const pair: [string, string] = (w + r) % 2 ? [b, a] : [a, b];
				out.push({ key: `r:${r}:${[a, b].map(norm).sort().join('|')}`, names: pair, week: r * (n - 1) + w + 1 });
			}
			arr.splice(1, 0, arr.pop()!);
		}
	}
	return out;
}

function sideOf(g: RivalryGame, name: string): 0 | 1 {
	return norm(g.names[0]) === norm(name) ? 0 : 1;
}

export function regularMatches(l: League, games: RivalryGame[]): Match[] {
	return schedule(l).map(s => {
		const g = games.find(x => x.league?.match === s.key);
		return {
			key: s.key,
			stage: 'regular',
			names: s.names,
			games: g ? [g] : [],
			winner: g ? g.names[g.winner] : null,
			wins: g ? ([g.names[g.winner] === s.names[0] ? 1 : 0, g.names[g.winner] === s.names[1] ? 1 : 0] as [number, number]) : [0, 0],
			label: `Week ${s.week}`,
		};
	});
}

export function standings(l: League, games: RivalryGame[]): Standing[] {
	const rows = new Map<string, Standing & { results: boolean[] }>(l.names.map(n => [norm(n), { name: n, wins: 0, losses: 0, pf: 0, pa: 0, played: 0, streak: '', results: [] }]));
	const regular = games.filter(g => g.league?.match.startsWith('r:'));
	for (const g of regular) {
		for (const side of [0, 1] as const) {
			const r = rows.get(norm(g.names[side]));
			if (!r) continue;
			const won = g.winner === side;
			r.played++;
			if (won) r.wins++;
			else r.losses++;
			r.results.push(won);
			if (g.score[0] !== null && g.score[1] !== null) {
				r.pf += g.score[side]!;
				r.pa += g.score[side === 0 ? 1 : 0]!;
			}
		}
	}
	const h2h = (a: string, b: string) => regular.filter(g => [norm(g.names[0]), norm(g.names[1])].sort().join('|') === [norm(a), norm(b)].sort().join('|')).reduce((n, g) => n + (norm(g.names[g.winner]) === norm(a) ? 1 : -1), 0);
	return [...rows.values()]
		.map(r => {
			let k = 0;
			for (let i = r.results.length - 1; i >= 0 && r.results[i] === r.results[r.results.length - 1]; i--) k++;
			return { name: r.name, wins: r.wins, losses: r.losses, pf: r.pf, pa: r.pa, played: r.played, streak: k ? `${r.results[r.results.length - 1] ? 'W' : 'L'}${k}` : '—' };
		})
		.sort((a, b) => {
			const pa = a.played ? a.wins / a.played : 0;
			const pb = b.played ? b.wins / b.played : 0;
			return pb - pa || b.wins - a.wins || h2h(b.name, a.name) || b.pf - b.pa - (a.pf - a.pa) || a.name.localeCompare(b.name);
		});
}

const seedPairs: Record<number, [number, number][]> = {
	2: [[0, 1]],
	4: [
		[0, 3],
		[1, 2],
	],
	8: [
		[0, 7],
		[3, 4],
		[1, 6],
		[2, 5],
	],
};

const ROUND_NAMES: Record<number, string[]> = { 2: ['Final'], 4: ['Semifinal', 'Final'], 8: ['Quarterfinal', 'Semifinal', 'Final'] };

export function regularDone(l: League, games: RivalryGame[]): boolean {
	return regularMatches(l, games).every(m => m.winner !== null);
}

/** Bracket rounds (first round first); later rounds fill in as series finish */
export function bracket(l: League, games: RivalryGame[]): Match[][] {
	const cap = Math.min(l.format.playoff, l.names.length);
	const n = [8, 4, 2].find(x => x <= cap) ?? 0;
	if (!n || !(regularDone(l, games) || l.playoffsEarly)) return [];
	const seeds = standings(l, games)
		.slice(0, n)
		.map(s => s.name);
	const need = Math.floor(l.format.bestOf / 2) + 1;
	const rounds: Match[][] = [];
	let entrants: (string | null)[][] = seedPairs[n].map(([a, b]) => [seeds[a], seeds[b]]);
	for (let r = 0; r < ROUND_NAMES[n].length; r++) {
		const round: Match[] = entrants.map((pair, slot) => {
			const key = `p:${r}:${slot}`;
			const names = [pair[0] ?? 'TBD', pair[1] ?? 'TBD'] as [string, string];
			const series = games.filter(g => g.league?.match === key);
			const wins: [number, number] = [0, 0];
			for (const g of series) {
				const w = g.names[g.winner];
				if (norm(w) === norm(names[0])) wins[0]++;
				else if (norm(w) === norm(names[1])) wins[1]++;
			}
			const winner = wins[0] >= need ? names[0] : wins[1] >= need ? names[1] : null;
			return { key, stage: 'playoff', names, games: series, winner, wins, label: `${ROUND_NAMES[n][r]}${l.format.bestOf > 1 ? ` · best of ${l.format.bestOf}` : ''}` };
		});
		rounds.push(round);
		const next: (string | null)[][] = [];
		for (let i = 0; i < round.length; i += 2) if (round[i + 1]) next.push([round[i].winner, round[i + 1].winner]);
		entrants = next;
	}
	return rounds;
}

export function champion(l: League, games: RivalryGame[]): string | null {
	if (!l.format.playoff) return regularDone(l, games) ? (standings(l, games)[0]?.name ?? null) : null;
	const b = bracket(l, games);
	return b.length ? (b[b.length - 1][0]?.winner ?? null) : null;
}

/** Matches ready to be played now (both coaches known, not decided) */
export function upNext(l: League, games: RivalryGame[]): Match[] {
	const b = bracket(l, games);
	if (b.length) return b.flat().filter(m => !m.winner && !m.names.includes('TBD'));
	return regularMatches(l, games).filter(m => !m.winner);
}

export function matchByKey(l: League, games: RivalryGame[], key: string): Match | undefined {
	return [...regularMatches(l, games), ...bracket(l, games).flat()].find(m => m.key === key);
}

export { sideOf };

// ─── local storage ──────────────────────────────────────────────

const KEY = 'giddey-versus-leagues';

export function loadLeagues(): League[] {
	try {
		const raw = localStorage.getItem(KEY);
		const list = raw ? (JSON.parse(raw) as League[]) : [];
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

export function saveLeagues(list: League[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		/* storage full or blocked */
	}
}

export function upsertLeague(l: League): void {
	const list = loadLeagues().filter(x => x.id !== l.id);
	saveLeagues([...list, l]);
}

export function removeLeague(id: string): void {
	saveLeagues(loadLeagues().filter(x => x.id !== id));
}

export function newLeagueId(): string {
	return `lg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
