import type { RivalryGame } from './rivalry';
import { seasons } from './seasons';

// ═══════════════════════════════════════════════════════════════
//  LEGACY — the championship belt and the Hall of Fame, both worked
//  out from the head-to-head log (so they sync with everything else).
//  `history` is already seated to the current names (coach 0 first).
// ═══════════════════════════════════════════════════════════════

type Side = 0 | 1;

export interface Belt {
	/** who holds it now */
	holder: Side;
	/** wins in a row since taking it (the win that took it doesn't count) */
	defenses: number;
	/** times each coach has won it */
	reigns: [number, number];
	/** most defenses in one reign */
	best: [number, number];
	/** the last game took the belt from the other coach */
	changed: boolean;
	/** games the belt has been on the line */
	games: number;
}

/**
 * The belt goes to the first winner. Every game is a title defense: the
 * holder keeps it by winning, and whoever beats the holder takes it.
 * League games don't count — the belt is head-to-head only.
 */
export function belt(history: RivalryGame[]): Belt | null {
	const games = history.filter(g => !g.league);
	if (!games.length) return null;
	let holder: Side = games[0].winner;
	let defenses = 0;
	const reigns: [number, number] = [0, 0];
	const best: [number, number] = [0, 0];
	reigns[holder] = 1;
	let changed = true;
	for (const g of games.slice(1)) {
		if (g.winner === holder) {
			defenses++;
			best[holder] = Math.max(best[holder], defenses);
			changed = false;
		} else {
			holder = g.winner;
			defenses = 0;
			reigns[holder]++;
			changed = true;
		}
	}
	return { holder, defenses, reigns, best, changed, games: games.length };
}

export interface Inductee {
	id: string;
	side: Side;
	/** titles he won for this coach */
	titles: number;
	finalsMvp: number;
	/** Player of the Game awards for this coach */
	potg: number;
	/** games he played for this coach */
	games: number;
	wins: number;
	/** first time he earned a spot */
	ts: number;
	why: string;
}

export const HOF_POTG = 4;

/**
 * Retired jerseys: a player goes up in a coach's rafters when he won them
 * a title (on the roster for the title-clinching game), or racked up
 * HOF_POTG Player of the Game awards for them.
 */
export function hallOfFame(history: RivalryGame[]): [Inductee[], Inductee[]] {
	const out: [Map<string, Inductee>, Map<string, Inductee>] = [new Map(), new Map()];
	const get = (side: Side, id: string, ts: number): Inductee => {
		let x = out[side].get(id);
		if (!x) {
			x = { id, side, titles: 0, finalsMvp: 0, potg: 0, games: 0, wins: 0, ts, why: '' };
			out[side].set(id, x);
		}
		return x;
	};
	// career numbers for everyone, so inductees show their full line
	const all: [Map<string, Inductee>, Map<string, Inductee>] = [new Map(), new Map()];
	for (const g of history) {
		for (const side of [0, 1] as Side[]) {
			for (const id of g.rosters[side] ?? []) {
				const x = all[side].get(id) ?? { id, side, titles: 0, finalsMvp: 0, potg: 0, games: 0, wins: 0, ts: g.ts, why: '' };
				x.games++;
				if (g.winner === side) x.wins++;
				if ((g.potg ?? []).includes(id)) x.potg++;
				all[side].set(id, x);
				if (x.potg === HOF_POTG) get(side, id, g.ts);
			}
		}
	}
	for (const season of seasons(history)) {
		if (season.champion === null) continue;
		const clincher = [...season.games].reverse().find(g => g.season?.stage === 'finals' && g.winner === season.champion);
		if (!clincher) continue;
		for (const id of clincher.rosters[season.champion] ?? []) get(season.champion, id, clincher.ts).titles++;
		if (season.finalsMvp) get(season.champion, season.finalsMvp, clincher.ts).finalsMvp++;
	}
	return ([0, 1] as Side[]).map(side =>
		[...out[side].values()]
			.map(x => {
				const c = all[side].get(x.id);
				const merged = { ...x, potg: c?.potg ?? 0, games: c?.games ?? 0, wins: c?.wins ?? 0 };
				const why = [merged.titles ? `${merged.titles}× champion` : '', merged.finalsMvp ? `${merged.finalsMvp}× Finals MVP` : '', merged.potg >= HOF_POTG ? `${merged.potg}× Player of the Game` : ''].filter(Boolean).join(' · ');
				return { ...merged, why };
			})
			.sort((a, b) => b.titles - a.titles || b.finalsMvp - a.finalsMvp || b.potg - a.potg || a.ts - b.ts),
	) as [Inductee[], Inductee[]];
}
