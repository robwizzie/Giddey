// ═══════════════════════════════════════════════════════════════
//  PLAYER USAGE — who each coach has played with, built from the
//  permanent rivalry log. Drives the freshness boost, the Never drafted / Nth time card
//  tags, Fresh Faces and Hot Hand badges.
//
//  The page rebuilds this whenever the log or coach names change and
//  hands it over with setUsage(); the engine only ever reads it.
// ═══════════════════════════════════════════════════════════════

/** The bits of a logged game usage cares about (kept structural to avoid an import cycle) */
export interface UsageGame {
	ts: number;
	names: [string, string];
	rosters: [string[], string[]];
	potg?: string[];
}

export interface UsageIndex {
	names: [string, string];
	/** games each coach (current seats) has played with a player */
	count: [Map<string, number>, Map<string, number>];
	/** recency-weighted use across both coaches: last game 1, game before 0.7, … */
	recent: Map<string, number>;
	/** everyone either coach has ever played with */
	any: Set<string>;
	/** Player of the Game awards */
	potg: Map<string, number>;
}

const norm = (n: string) => n.trim().toLowerCase();

export function emptyUsage(names: [string, string] = ['', '']): UsageIndex {
	return { names, count: [new Map(), new Map()], recent: new Map(), any: new Set(), potg: new Map() };
}

export function buildUsage(games: UsageGame[], names: [string, string]): UsageIndex {
	const u = emptyUsage(names);
	const seats = names.map(norm);
	// newest first so recency decays from the latest game
	const sorted = [...games].sort((a, b) => b.ts - a.ts);
	sorted.forEach((g, age) => {
		const decay = Math.pow(0.7, age);
		g.names.forEach((n, i) => {
			const seat = seats.indexOf(norm(n));
			for (const id of g.rosters[i] ?? []) {
				u.any.add(id);
				if (seat >= 0) u.count[seat].set(id, (u.count[seat].get(id) ?? 0) + 1);
				// recency only counts games between these two coaches
				if (seat >= 0 && seats.includes(norm(g.names[1 - i]))) u.recent.set(id, (u.recent.get(id) ?? 0) + decay);
			}
		});
		for (const id of g.potg ?? []) u.potg.set(id, (u.potg.get(id) ?? 0) + 1);
	});
	return u;
}

let current: UsageIndex = emptyUsage();

export function setUsage(u: UsageIndex): void {
	current = u;
}

export function usage(): UsageIndex {
	return current;
}

export function timesUsed(side: 0 | 1, id: string): number {
	return current.count[side].get(id) ?? 0;
}

/** Never on this coach's roster before */
export function isFreshFor(side: 0 | 1, id: string): boolean {
	return timesUsed(side, id) === 0;
}

export function neverDrafted(id: string): boolean {
	return !current.any.has(id);
}

export function hotHand(id: string): number {
	return current.potg.get(id) ?? 0;
}

/**
 * Pack weight for the freshness boost: never-used players come up more,
 * players you both keep taking come up less.
 */
export function freshnessWeight(id: string, level: 'off' | 'light' | 'strong'): number {
	if (level === 'off') return 1;
	const [newBoost, recentDrag] = level === 'strong' ? [3, 1.6] : [1.8, 0.7];
	if (neverDrafted(id)) return newBoost;
	return 1 / (1 + (current.recent.get(id) ?? 0) * recentDrag);
}
