import { GameResult, Settings, Side, teamName } from './engine';

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

function save(games: RivalryGame[]) {
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
	});
	save(games);
}

export function clearRivalry(): void {
	save([]);
}

const norm = (n: string) => n.trim().toLowerCase();

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
}

/** Head-to-head between the two current coach names (either seat) */
export function rivalryStats(all: RivalryGame[], names: [string, string]): RivalryStats {
	const [a, b] = names.map(norm);
	// each game re-seated so coach index 0 is names[0]
	const games = all
		.filter(g => {
			const n = g.names.map(norm);
			return (n[0] === a && n[1] === b) || (n[0] === b && n[1] === a);
		})
		.map(g => {
			if (norm(g.names[0]) === a) return g;
			const flip = <T,>(x: [T, T]): [T, T] => [x[1], x[0]];
			return {
				...g,
				names: flip(g.names),
				teams: flip(g.teams),
				winner: (g.winner === 0 ? 1 : 0) as Side,
				score: flip(g.score),
				teamOvr: flip(g.teamOvr),
				challenges: flip(g.challenges),
				rosters: flip(g.rosters),
			};
		})
		.sort((x, y) => x.ts - y.ts);

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

	return {
		games: games.length,
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
