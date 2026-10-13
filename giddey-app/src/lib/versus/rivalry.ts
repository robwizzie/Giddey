import { GameResult, Grade, Halftime, Line, SeasonTag, Settings, Side, teamName } from './engine';
import { seatGames } from './history';
import { getPool } from './pool';

// ═══════════════════════════════════════════════════════════════
//  RIVALRY LOG — every game ever played, kept apart from the series
//  state so "New series" never wipes the all-time record.
// ═══════════════════════════════════════════════════════════════

const KEY = 'giddey-versus-rivalry-v1';

export interface RivalryGame {
	ts: number;
	names: [string, string];
	teams: [string, string];
	winner: Side;
	score: [number | null, number | null];
	teamOvr: [number, number];
	challenges: [boolean | null, boolean | null];
	rosters: [string[], string[]];
	quarter: number | null;
	style: string;
	pool: string;
	sabotage: string | null;
	/** Player of the Game (2 ids when the votes split) */
	potg?: string[];
	theme?: string | null;
	twist?: string | null;
	halftime?: Halftime | null;
	line?: Line | null;
	covered?: Side | null;
	grades?: [Grade, Grade] | null;
	season?: SeasonTag | null;
	sabotageOn?: Side | null;
}

export function loadRivalry(): RivalryGame[] {
	try {
		const raw = localStorage.getItem(KEY);
		const games = raw ? (JSON.parse(raw) as RivalryGame[]) : [];
		return Array.isArray(games) ? games : [];
	} catch {
		return [];
	}
}

export function saveRivalry(games: RivalryGame[]) {
	try {
		localStorage.setItem(KEY, JSON.stringify(games));
	} catch {
		/* storage full or blocked */
	}
}

export function logGame(settings: Settings, g: GameResult): void {
	const games = loadRivalry();
	games.push({
		ts: Date.now(),
		names: [...settings.names],
		teams: [teamName(settings, 0), teamName(settings, 1)],
		winner: g.winner,
		score: g.score,
		teamOvr: g.teamOvr,
		challenges: g.challenges,
		rosters: g.rosters ?? [[], []],
		quarter: g.quarter,
		style: settings.style,
		pool: settings.pool,
		sabotage: g.sabotage ?? null,
		potg: g.potg ?? [],
		theme: g.theme?.id ?? null,
		twist: g.twist ?? null,
		halftime: g.halftime ?? null,
		line: g.line ?? null,
		covered: g.covered ?? null,
		grades: g.grades ?? null,
		season: g.season ?? null,
		sabotageOn: g.sabotageOn ?? null,
	});
	saveRivalry(games);
}

export interface Matchup {
	names: [string, string];
	games: number;
	wins: [number, number];
	last: number;
}

/** Every pair of coaches with games on this device, most recent first */
export function matchups(all: RivalryGame[] = loadRivalry()): Matchup[] {
	const by = new Map<string, Matchup>();
	for (const g of [...all].sort((a, b) => a.ts - b.ts)) {
		const key = g.names.map(n => n.trim().toLowerCase()).sort().join('|');
		const m = by.get(key) ?? { names: g.names, games: 0, wins: [0, 0] as [number, number], last: 0 };
		// keep the seat order (and spelling) of the first game, count wins by name
		const seat = g.names[g.winner].trim().toLowerCase() === m.names[0].trim().toLowerCase() ? 0 : 1;
		m.wins[seat]++;
		m.games++;
		m.last = g.ts;
		by.set(key, m);
	}
	return [...by.values()].sort((a, b) => b.last - a.last);
}

/** Erase one pair's games (either seat order); other rivalries on the device stay */
export function clearMatchup(names: [string, string]): void {
	const key = names.map(n => n.trim().toLowerCase()).sort().join('|');
	saveRivalry(loadRivalry().filter(g => g.names.map(n => n.trim().toLowerCase()).sort().join('|') !== key));
}


export interface CoachStats {
	name: string;
	wins: number;
	losses: number;
	longestStreak: number;
	/** positive = current win streak, negative = losing streak */
	streak: number;
	challengesDone: number;
	challengesTried: number;
	avgTeamOvr: number;
	pointsFor: number;
	scoredGames: number;
	topPicks: { id: string; count: number }[];
	/** best-rated players this coach has never played with */
	neverUsed: string[];
	/** distinct players this coach has used */
	distinct: number;
}

export interface RivalryStats {
	games: number;
	coaches: [CoachStats, CoachStats];
	biggestBlowout: { game: RivalryGame; margin: number; winner: string } | null;
	closestGame: { game: RivalryGame; margin: number; winner: string } | null;
	/** games where the higher team OVR won, out of games with a real gap */
	favoriteWins: number;
	favoriteGames: number;
	upsets: { game: RivalryGame; winner: string; gap: number }[];
	recent: (RivalryGame & { winnerName: string })[];
	/** series lead after each game (+ = coach 1 ahead) */
	timeline: { lead: number; winner: Side; ts: number }[];
	/** record per draft style, most played first */
	byStyle: { style: string; wins: [number, number] }[];
	/** record per theme draft */
	byTheme: { theme: string; wins: [number, number] }[];
	/** Player of the Game leaderboard */
	potg: { id: string; count: number; side: Side }[];
}

/** Head-to-head between the two current coach names (either seat) */
export function rivalryStats(all: RivalryGame[], names: [string, string]): RivalryStats {
	const games = seatGames(all, names);

	const coach = (side: Side): CoachStats => {
		let streak = 0;
		let longest = 0;
		let run = 0;
		const counts = new Map<string, number>();
		let done = 0;
		let tried = 0;
		let ovr = 0;
		let pts = 0;
		let scored = 0;
		for (const g of games) {
			const won = g.winner === side;
			run = won ? run + 1 : 0;
			longest = Math.max(longest, run);
			streak = won ? (streak > 0 ? streak + 1 : 1) : streak < 0 ? streak - 1 : -1;
			if (g.challenges[side] !== null) {
				tried++;
				if (g.challenges[side]) done++;
			}
			ovr += g.teamOvr[side];
			if (g.score[side] !== null) {
				pts += g.score[side]!;
				scored++;
			}
			for (const id of g.rosters[side]) counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		return {
			name: names[side],
			wins: games.filter(g => g.winner === side).length,
			losses: games.filter(g => g.winner !== side).length,
			longestStreak: longest,
			streak,
			challengesDone: done,
			challengesTried: tried,
			avgTeamOvr: games.length ? Math.round((ovr / games.length) * 10) / 10 : 0,
			pointsFor: pts,
			scoredGames: scored,
			topPicks: [...counts.entries()]
				.sort((x, y) => y[1] - x[1])
				.slice(0, 5)
				.map(([id, count]) => ({ id, count })),
			neverUsed: getPool('mixed')
				.filter(p => !counts.has(p.id))
				.sort((x, y) => y.overall - x.overall)
				.slice(0, 5)
				.map(p => p.id),
			distinct: counts.size,
		};
	};

	const scored = games.filter(g => g.score[0] !== null && g.score[1] !== null).map(g => ({ g, margin: Math.abs(g.score[0]! - g.score[1]!) }));
	const blow = scored.reduce<(typeof scored)[number] | null>((m, x) => (!m || x.margin > m.margin ? x : m), null);
	const close = scored.reduce<(typeof scored)[number] | null>((m, x) => (!m || x.margin < m.margin ? x : m), null);
	const withFav = games.filter(g => Math.abs(g.teamOvr[0] - g.teamOvr[1]) >= 0.3);
	const favWins = withFav.filter(g => (g.teamOvr[0] > g.teamOvr[1] ? 0 : 1) === g.winner);
	const upsets = withFav
		.filter(g => (g.teamOvr[0] > g.teamOvr[1] ? 0 : 1) !== g.winner)
		.map(g => ({ game: g, winner: names[g.winner], gap: Math.round(Math.abs(g.teamOvr[0] - g.teamOvr[1]) * 10) / 10 }))
		.sort((x, y) => y.gap - x.gap)
		.slice(0, 3);

	let lead = 0;
	const timeline = games.map(g => {
		lead += g.winner === 0 ? 1 : -1;
		return { lead, winner: g.winner, ts: g.ts };
	});
	const tally = (key: (g: RivalryGame) => string | null | undefined) => {
		const m = new Map<string, [number, number]>();
		for (const g of games) {
			const k = key(g);
			if (!k) continue;
			const w = m.get(k) ?? [0, 0];
			w[g.winner]++;
			m.set(k, w);
		}
		return [...m.entries()].sort((x, y) => y[1][0] + y[1][1] - (x[1][0] + x[1][1]));
	};
	const potgCount = new Map<string, { count: number; side: Side }>();
	for (const g of games)
		for (const id of g.potg ?? []) {
			const side: Side = g.rosters[1]?.includes(id) ? 1 : 0;
			const cur = potgCount.get(id);
			potgCount.set(id, { count: (cur?.count ?? 0) + 1, side: cur?.side ?? side });
		}

	return {
		games: games.length,
		timeline,
		byStyle: tally(g => g.style).map(([style, wins]) => ({ style, wins })),
		byTheme: tally(g => g.theme).map(([theme, wins]) => ({ theme, wins })),
		potg: [...potgCount.entries()]
			.sort((x, y) => y[1].count - x[1].count)
			.slice(0, 5)
			.map(([id, v]) => ({ id, ...v })),
		coaches: [coach(0), coach(1)],
		biggestBlowout: blow ? { game: blow.g, margin: blow.margin, winner: names[blow.g.winner] } : null,
		closestGame: close ? { game: close.g, margin: close.margin, winner: names[close.g.winner] } : null,
		favoriteWins: favWins.length,
		favoriteGames: withFav.length,
		upsets,
		recent: games
			.slice(-8)
			.reverse()
			.map(g => ({ ...g, winnerName: names[g.winner] })),
	};
}
