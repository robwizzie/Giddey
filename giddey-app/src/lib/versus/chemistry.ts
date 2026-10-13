import { Position } from '@/lib/types';
import { bestLineup } from './engine';
import { VersusPlayer } from './pool';

// ═══════════════════════════════════════════════════════════════
//  LINEUP BALANCE (estimated)
//  We only have OVR + positions, not 2K attributes, so each category
//  blends starters' OVR by how much their positions usually contribute.
//  A lineup missing a big gets a visibly low Rim Protection, etc.
// ═══════════════════════════════════════════════════════════════

export type Category = 'shooting' | 'playmaking' | 'rim' | 'rebounding' | 'depth';

export const CATEGORY_INFO: Record<Category, { label: string; short: string }> = {
	shooting: { label: 'Shooting', short: 'SHT' },
	playmaking: { label: 'Playmaking', short: 'PLY' },
	rim: { label: 'Rim Protection', short: 'RIM' },
	rebounding: { label: 'Rebounding', short: 'REB' },
	depth: { label: 'Bench Depth', short: 'BEN' },
};

const POS_WEIGHT: Record<Position, Record<Exclude<Category, 'depth'>, number>> = {
	PG: { shooting: 0.85, playmaking: 1, rim: 0.1, rebounding: 0.2 },
	SG: { shooting: 1, playmaking: 0.65, rim: 0.15, rebounding: 0.3 },
	SF: { shooting: 0.8, playmaking: 0.5, rim: 0.4, rebounding: 0.5 },
	PF: { shooting: 0.5, playmaking: 0.3, rim: 0.8, rebounding: 0.85 },
	C: { shooting: 0.3, playmaking: 0.25, rim: 1, rebounding: 1 },
};

// what a "normal" PG-SG-SF-PF-C lineup puts into each category
const IDEAL: Record<Exclude<Category, 'depth'>, number> = {
	shooting: 0.85 + 1 + 0.8 + 0.5 + 0.3,
	playmaking: 1 + 0.65 + 0.5 + 0.3 + 0.25,
	rim: 0.1 + 0.15 + 0.4 + 0.8 + 1,
	rebounding: 0.2 + 0.3 + 0.5 + 0.85 + 1,
};

function weightOf(p: VersusPlayer, cat: Exclude<Category, 'depth'>): number {
	return POS_WEIGHT[p.position][cat] * 0.7 + POS_WEIGHT[p.secondaryPosition][cat] * 0.3;
}

export interface Chemistry {
	ratings: Record<Category, number>;
	/** the lineup's weakest area (excluding depth when there's no bench) */
	weakest: Category | null;
	hint: string | null;
}

export function lineupChemistry(ids: string[], rosterSize: number): Chemistry {
	const lu = bestLineup(ids);
	const starters = lu.starters.map(s => s.player).filter((p): p is VersusPlayer => !!p);
	const ratings = {} as Record<Category, number>;
	(['shooting', 'playmaking', 'rim', 'rebounding'] as const).forEach(cat => {
		if (!starters.length) return (ratings[cat] = 0);
		let wsum = 0;
		let osum = 0;
		for (const p of starters) {
			const w = weightOf(p, cat);
			wsum += w;
			osum += w * p.overall;
		}
		const avg = osum / (wsum || 1);
		// coverage: half a lineup can't rebound like a whole one
		const coverage = Math.min(1.15, wsum / IDEAL[cat]);
		ratings[cat] = Math.round(Math.max(0, Math.min(99, avg * Math.pow(coverage, 0.6))));
	});
	const benchSlots = Math.max(0, rosterSize - 5);
	const bench = lu.bench.slice(0, benchSlots);
	ratings.depth = bench.length ? Math.round(bench.reduce((a, p) => a + p.overall, 0) / bench.length) : 0;

	// benches always rate below starters, so depth is shown but never flagged
	const cats: Category[] = ['shooting', 'playmaking', 'rim', 'rebounding'];
	const low = starters.length >= 2 ? cats.reduce((a, b) => (ratings[b] < ratings[a] ? b : a)) : null;
	// only call it a weakness when it clearly lags the rest
	const othersAvg = low ? cats.filter(c => c !== low).reduce((n, c) => n + ratings[c], 0) / (cats.length - 1) : 0;
	const weakest = low && ratings[low] < othersAvg - 5 ? low : null;
	const HINTS: Record<Category, string> = {
		shooting: 'Needs shooting — look for a wing or guard.',
		playmaking: 'Needs a playmaker — a PG would help.',
		rim: 'Needs a big — nobody protects the rim.',
		rebounding: 'Needs size on the glass.',
		depth: 'Bench is thin.',
	};
	return { ratings, weakest, hint: weakest ? HINTS[weakest] : null };
}
