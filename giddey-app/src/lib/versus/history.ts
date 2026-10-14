import type { RivalryGame } from './rivalry';

// ═══════════════════════════════════════════════════════════════
//  HEAD-TO-HEAD HISTORY — every logged game between the two coaches
//  playing now, re-seated so coach index 0 is always names[0].
//  Seasons, the Vegas line and achievements all read from here.
//
//  The page rebuilds it whenever the log or the names change; the
//  engine only reads it (no imports at runtime, so no cycles).
// ═══════════════════════════════════════════════════════════════

type Side = 0 | 1;

const norm = (n: string) => n.trim().toLowerCase();

const flip = <T>(x: [T, T]): [T, T] => [x[1], x[0]];
const flipSide = (x: Side | null | undefined): Side | null | undefined => (x === 0 ? 1 : x === 1 ? 0 : x);

/** Games between these two names (either seat), oldest first, seated to `names` */
export function seatGames(all: RivalryGame[], names: [string, string]): RivalryGame[] {
	const [a, b] = names.map(norm);
	return all
		.filter(g => {
			const n = g.names.map(norm);
			return (n[0] === a && n[1] === b) || (n[0] === b && n[1] === a);
		})
		.map(g => {
			if (norm(g.names[0]) === a) return g;
			return {
				...g,
				names: flip(g.names),
				teams: flip(g.teams),
				winner: flipSide(g.winner) as Side,
				score: flip(g.score),
				teamOvr: flip(g.teamOvr),
				challenges: flip(g.challenges),
				rosters: flip(g.rosters),
				grades: g.grades ? flip(g.grades) : g.grades,
				line: g.line ? { ...g.line, fav: flipSide(g.line.fav) as Side } : g.line,
				covered: flipSide(g.covered),
				halftime: g.halftime ? { ...g.halftime, leader: flipSide(g.halftime.leader) as Side } : g.halftime,
				sabotageOn: flipSide(g.sabotageOn),
				oracle: flipSide(g.oracle),
				predictions: g.predictions ? ([g.predictions[1], g.predictions[0]].map(p => (p ? { ...p, winner: flipSide(p.winner) as Side } : null)) as RivalryGame['predictions']) : g.predictions,
			};
		})
		.sort((x, y) => x.ts - y.ts);
}

let current: RivalryGame[] = [];

export function setHistory(all: RivalryGame[], names: [string, string]): void {
	current = seatGames(all, names);
}

export function history(): RivalryGame[] {
	return current;
}
