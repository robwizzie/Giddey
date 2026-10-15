import type { RivalryGame } from './rivalry';

// ═══════════════════════════════════════════════════════════════
//  HEAD-TO-HEAD STATS — everything the stats page charts, worked out
//  from one pair's games (already seated: coach 0 is names[0]).
//  League games count: they're still these two coaches playing.
// ═══════════════════════════════════════════════════════════════

type Side = 0 | 1;

export interface TimelinePoint {
	i: number;
	ts: number;
	winner: Side;
	/** coach 0's score minus coach 1's (null when the score wasn't entered) */
	margin: number | null;
	score: [number | null, number | null];
	/** coach 0's share of all games so far, 0–100 */
	share: number;
}

export interface Drafted {
	id: string;
	count: number;
	wins: number;
}

export interface Night {
	/** local calendar day, YYYY-MM-DD */
	day: string;
	ts: number;
	games: number;
	wins: [number, number];
	/** coach 0's points minus coach 1's over the night's scored games */
	diff: number;
}

export interface H2H {
	games: number;
	wins: [number, number];
	timeline: TimelinePoint[];
	/** current streak */
	streak: { side: Side; n: number } | null;
	longest: [number, number];
	/** average winning margin per coach (scored games only) */
	avgWinBy: [number | null, number | null];
	blowout: TimelinePoint | null;
	closest: TimelinePoint | null;
	drafted: [Drafted[], Drafted[]];
	nights: Night[];
	/** best and worst night per coach (null until they've played a night) */
	best: [Night | null, Night | null];
	worst: [Night | null, Night | null];
	nightWins: [number, number];
}

const dayOf = (ts: number) => {
	const d = new Date(ts);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Night score for one coach: net games won, then points, then more games played */
const nightScore = (n: Night, s: Side) => {
	const o = s === 0 ? 1 : 0;
	const net = n.wins[s] - n.wins[o];
	const pts = s === 0 ? n.diff : -n.diff;
	return net * 10000 + pts * 10 + n.games;
};

export function headToHead(games: RivalryGame[]): H2H {
	const sorted = [...games].sort((a, b) => a.ts - b.ts);
	const wins: [number, number] = [0, 0];
	const timeline: TimelinePoint[] = sorted.map((g, i) => {
		wins[g.winner]++;
		const margin = g.score[0] !== null && g.score[1] !== null ? g.score[0] - g.score[1] : null;
		return { i, ts: g.ts, winner: g.winner, margin, score: g.score, share: (wins[0] / (i + 1)) * 100 };
	});

	let streak: H2H['streak'] = null;
	const longest: [number, number] = [0, 0];
	let run = 0;
	let runSide: Side | null = null;
	for (const t of timeline) {
		run = t.winner === runSide ? run + 1 : 1;
		runSide = t.winner;
		longest[t.winner] = Math.max(longest[t.winner], run);
	}
	if (runSide !== null) streak = { side: runSide, n: run };

	const avgWinBy = ([0, 1] as Side[]).map(s => {
		const m = timeline.filter(t => t.winner === s && t.margin !== null).map(t => Math.abs(t.margin!));
		return m.length ? m.reduce((a, b) => a + b, 0) / m.length : null;
	}) as [number | null, number | null];
	const scored = timeline.filter(t => t.margin !== null && t.margin !== 0);
	const blowout = scored.length ? scored.reduce((a, b) => (Math.abs(b.margin!) > Math.abs(a.margin!) ? b : a)) : null;
	const closest = scored.length ? scored.reduce((a, b) => (Math.abs(b.margin!) < Math.abs(a.margin!) ? b : a)) : null;

	const drafted = ([0, 1] as Side[]).map(s => {
		const by = new Map<string, Drafted>();
		for (const g of sorted) {
			for (const id of g.rosters?.[s] ?? []) {
				const d = by.get(id) ?? { id, count: 0, wins: 0 };
				d.count++;
				if (g.winner === s) d.wins++;
				by.set(id, d);
			}
		}
		return [...by.values()].sort((a, b) => b.count - a.count || b.wins - a.wins || a.id.localeCompare(b.id));
	}) as [Drafted[], Drafted[]];

	const byDay = new Map<string, Night>();
	for (const t of timeline) {
		const day = dayOf(t.ts);
		const n = byDay.get(day) ?? { day, ts: t.ts, games: 0, wins: [0, 0], diff: 0 };
		n.games++;
		n.wins[t.winner]++;
		if (t.margin !== null) n.diff += t.margin;
		byDay.set(day, n);
	}
	const nights = [...byDay.values()].sort((a, b) => a.ts - b.ts);
	const pick = (s: Side, better: boolean) =>
		nights.length ? nights.reduce((a, b) => (better ? nightScore(b, s) > nightScore(a, s) : nightScore(b, s) < nightScore(a, s)) ? b : a) : null;
	const nightWins: [number, number] = [0, 0];
	for (const n of nights) if (n.wins[0] !== n.wins[1]) nightWins[n.wins[0] > n.wins[1] ? 0 : 1]++;

	return {
		games: timeline.length,
		wins,
		timeline,
		streak,
		longest,
		avgWinBy,
		blowout,
		closest,
		drafted,
		nights,
		best: [pick(0, true), pick(1, true)],
		worst: [pick(0, false), pick(1, false)],
		nightWins,
	};
}

// ─── chart colors ───────────────────────────────────────────────

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/**
 * A coach's color stepped into the dark-surface lightness band (OKLCH L
 * 0.52–0.64) for chart marks — same hue, so it still reads as theirs, but
 * not glaring on the dark card. Text never uses it.
 */
export function chartTone(hex: string, lo = 0.52, hi = 0.64): string {
	const n = parseInt(hex.replace('#', ''), 16);
	if (Number.isNaN(n)) return hex;
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => toLin(v / 255));
	const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const L = Math.min(hi, Math.max(lo, 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_));
	const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
	return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, toSrgb(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
}
