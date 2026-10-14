import type { RivalryGame } from './rivalry';

// ═══════════════════════════════════════════════════════════════
//  POWER RANKINGS — an Elo-style skill rating for every coach in the
//  log (this phone's games plus anything synced from the cloud).
//
//  It rates the coach, not the draft: the team OVR gap counts like a
//  rating head start, so beating a better-drafted team moves you more
//  and winning with the stronger squad moves you less. Bigger margins
//  move it a bit more. Everyone starts at 1500.
// ═══════════════════════════════════════════════════════════════

export const START = 1500;
/** rating points one team-OVR point is worth */
const PER_OVR = 30;

export interface EloRow {
	key: string;
	name: string;
	rating: number;
	peak: number;
	games: number;
	wins: number;
	losses: number;
	/** rating after each game, oldest first */
	history: number[];
	/** change over the last 5 games */
	trend: number;
	/** distinct opponents */
	opponents: number;
}

export interface Upset {
	game: RivalryGame;
	winner: string;
	loser: string;
	/** winner's chance before tip-off (rating + team OVR) */
	chance: number;
}

export interface EloMove {
	before: [number, number];
	after: [number, number];
	chance: [number, number];
}

const norm = (n: string) => n.trim().toLowerCase();
export const eloGameKey = (g: Pick<RivalryGame, 'ts' | 'names'>) => `${g.ts}|${g.names.map(norm).sort().join('|')}`;

export function computeElo(all: RivalryGame[]): { table: EloRow[]; upsets: Upset[]; moves: Map<string, EloMove> } {
	const rows = new Map<string, EloRow>();
	const seen = new Set<string>();
	const opp = new Map<string, Set<string>>();
	const moves = new Map<string, EloMove>();
	const upsets: Upset[] = [];
	const row = (name: string) => {
		const key = norm(name);
		let r = rows.get(key);
		if (!r) {
			r = { key, name: name.trim(), rating: START, peak: START, games: 0, wins: 0, losses: 0, history: [], trend: 0, opponents: 0 };
			rows.set(key, r);
		}
		return r;
	};
	for (const g of [...all].sort((a, b) => a.ts - b.ts)) {
		const k = eloGameKey(g);
		if (seen.has(k) || !g.names[0]?.trim() || !g.names[1]?.trim()) continue;
		seen.add(k);
		const a = row(g.names[0]);
		const b = row(g.names[1]);
		const head = (g.teamOvr?.[0] ?? 0) - (g.teamOvr?.[1] ?? 0);
		const expA = 1 / (1 + Math.pow(10, (b.rating - a.rating - head * PER_OVR) / 400));
		const scoreA = g.winner === 0 ? 1 : 0;
		const margin = g.score?.[0] !== null && g.score?.[1] !== null && g.score ? Math.abs(g.score[0]! - g.score[1]!) : null;
		const mult = margin === null ? 1 : Math.min(1.75, 1 + Math.log(1 + margin) / 5);
		const k32 = (r: EloRow) => (r.games < 10 ? 40 : 28);
		const before: [number, number] = [a.rating, b.rating];
		a.rating += k32(a) * mult * (scoreA - expA);
		b.rating += k32(b) * mult * (1 - scoreA - (1 - expA));
		for (const [r, won] of [
			[a, g.winner === 0],
			[b, g.winner === 1],
		] as [EloRow, boolean][]) {
			r.games++;
			if (won) r.wins++;
			else r.losses++;
			r.peak = Math.max(r.peak, r.rating);
			r.history.push(Math.round(r.rating));
		}
		(opp.get(a.key) ?? opp.set(a.key, new Set()).get(a.key)!).add(b.key);
		(opp.get(b.key) ?? opp.set(b.key, new Set()).get(b.key)!).add(a.key);
		moves.set(k, { before: [Math.round(before[0]), Math.round(before[1])], after: [Math.round(a.rating), Math.round(b.rating)], chance: [expA, 1 - expA] });
		const winChance = g.winner === 0 ? expA : 1 - expA;
		upsets.push({ game: g, winner: g.names[g.winner], loser: g.names[g.winner === 0 ? 1 : 0], chance: winChance });
	}
	const table = [...rows.values()]
		.map(r => ({
			...r,
			rating: Math.round(r.rating),
			peak: Math.round(r.peak),
			trend: r.history.length ? r.history[r.history.length - 1] - (r.history[r.history.length - 6] ?? START) : 0,
			opponents: opp.get(r.key)?.size ?? 0,
		}))
		.sort((x, y) => y.rating - x.rating);
	return { table, upsets: upsets.filter(u => u.chance < 0.45).sort((x, y) => x.chance - y.chance).slice(0, 8), moves };
}
