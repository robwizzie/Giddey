import { ACHIEVEMENTS, achievementsFor } from './achievements';
import { computeElo } from './elo';
import { seatGames } from './history';
import { champion, loadLeagues, leagueGames } from './league';
import type { RivalryGame } from './rivalry';
import { seasons } from './seasons';

// ═══════════════════════════════════════════════════════════════
//  CAREER — one coach across every opponent: record, titles, badges,
//  power rating, Players of the Game and favorite players. Built from
//  the log on this phone (plus anything synced), and published as a
//  public snapshot when the coach shares their career link.
// ═══════════════════════════════════════════════════════════════

export interface CareerData {
	v: 1;
	name: string;
	updated: number;
	wins: number;
	losses: number;
	titles: number;
	leagueTitles: string[];
	rating: number | null;
	peak: number | null;
	rank: number | null;
	badges: { icon: string; title: string }[];
	favorites: { id: string; count: number }[];
	potg: number;
	rivals: { name: string; wins: number; losses: number }[];
	bestWin: { opponent: string; score: string; ts: number } | null;
	since: number | null;
}

const norm = (n: string) => n.trim().toLowerCase();

/** Every coach name that appears in the log */
export function coachNames(all: RivalryGame[]): string[] {
	const seen = new Map<string, string>();
	for (const g of all) for (const n of g.names) if (n.trim() && !seen.has(norm(n))) seen.set(norm(n), n.trim());
	return [...seen.values()];
}

export function buildCareer(name: string, all: RivalryGame[]): CareerData {
	const me = norm(name);
	const mine = all.filter(g => g.names.some(n => norm(n) === me)).sort((a, b) => a.ts - b.ts);
	const side = (g: RivalryGame) => (norm(g.names[0]) === me ? 0 : 1);
	const wins = mine.filter(g => g.winner === side(g)).length;

	// head-to-head pieces (titles, badges) are worked out per opponent, then combined
	const opponents = [...new Set(mine.map(g => g.names[side(g) === 0 ? 1 : 0].trim()))];
	let titles = 0;
	const badgeIds = new Set<string>();
	const rivals: CareerData['rivals'] = [];
	for (const opp of opponents) {
		const pair = seatGames(all, [name, opp]);
		titles += seasons(pair).filter(s => s.champion === 0).length;
		for (const a of achievementsFor(pair, 0)) if (a.done) badgeIds.add(a.a.id);
		rivals.push({ name: opp, wins: pair.filter(g => g.winner === 0).length, losses: pair.filter(g => g.winner === 1).length });
	}

	const used = new Map<string, number>();
	let potg = 0;
	let best: CareerData['bestWin'] = null;
	let bestMargin = -1;
	for (const g of mine) {
		const s = side(g);
		for (const id of g.rosters[s] ?? []) used.set(id, (used.get(id) ?? 0) + 1);
		potg += (g.potg ?? []).filter(id => g.rosters[s]?.includes(id)).length;
		if (g.winner === s && g.score[0] !== null && g.score[1] !== null) {
			const m = g.score[s]! - g.score[s === 0 ? 1 : 0]!;
			if (m > bestMargin) {
				bestMargin = m;
				best = { opponent: g.names[s === 0 ? 1 : 0], score: `${g.score[s]}–${g.score[s === 0 ? 1 : 0]}`, ts: g.ts };
			}
		}
	}

	const { table } = computeElo(all);
	const rankIdx = table.findIndex(r => r.key === me);
	const row = rankIdx >= 0 ? table[rankIdx] : null;
	const leagueTitles = loadLeagues()
		.filter(l => {
			const c = champion(l, leagueGames(l, all));
			return c && norm(c) === me;
		})
		.map(l => l.name);

	return {
		v: 1,
		name: name.trim(),
		updated: Date.now(),
		wins,
		losses: mine.length - wins,
		titles,
		leagueTitles,
		rating: row?.rating ?? null,
		peak: row?.peak ?? null,
		rank: rankIdx >= 0 ? rankIdx + 1 : null,
		badges: ACHIEVEMENTS.filter(a => badgeIds.has(a.id)).map(a => ({ icon: a.icon, title: a.title })),
		favorites: [...used.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([id, count]) => ({ id, count })),
		potg,
		rivals: rivals.sort((a, b) => b.wins + b.losses - (a.wins + a.losses)).slice(0, 6),
		bestWin: best,
		since: mine[0]?.ts ?? null,
	};
}
