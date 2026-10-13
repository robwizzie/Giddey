import type { RivalryGame } from './rivalry';
import { Line, Side, teamOvr, VersusState } from './engine';

// ═══════════════════════════════════════════════════════════════
//  VEGAS LINE — a point spread set before tip-off from the team
//  ratings, the quarter length and how your recent games have gone.
//  Always ends in .5 so nobody pushes.
// ═══════════════════════════════════════════════════════════════

/** Recent head-to-head margin from coach 1's view (scored games only, newest weigh most) */
function formMargin(history: RivalryGame[]): number {
	const scored = history.filter(g => g.score[0] !== null && g.score[1] !== null).slice(-6);
	if (!scored.length) return 0;
	let sum = 0;
	let w = 0;
	scored.forEach((g, i) => {
		const wi = 1 + i * 0.5;
		sum += (g.score[0]! - g.score[1]!) * wi;
		w += wi;
	});
	return sum / w;
}

export function vegasLine(s: VersusState, history: RivalryGame[]): Line {
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	const q = s.gameday.quarter ?? 4;
	// ~2.5 points per OVR over four 4-minute quarters, scaled to the game length
	const ratings = (a - b) * 2.5 * (q / 4);
	const form = Math.max(-4, Math.min(4, formMargin(history) * 0.25));
	const raw = ratings + form;
	const fav: Side = raw > 0 || (raw === 0 && a >= b) ? 0 : 1;
	let spread = Math.round(Math.abs(raw) * 2) / 2;
	if (spread % 1 === 0) spread += 0.5;
	return { fav, spread };
}

/** The underdog who covered, or null (needs both scores) */
export function coveredBy(line: Line | null | undefined, score: [number | null, number | null]): Side | null {
	if (!line || score[0] === null || score[1] === null) return null;
	const dog: Side = line.fav === 0 ? 1 : 0;
	const margin = score[line.fav]! - score[dog]!;
	return margin < line.spread ? dog : null;
}

export function lineText(line: Line, names: [string, string]): string {
	return `${names[line.fav]} −${line.spread}`;
}
