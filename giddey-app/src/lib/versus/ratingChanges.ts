import changes from '@/data/rating-changes.json';

// ═══════════════════════════════════════════════════════════════
//  2K RATING UPDATES — written by scripts/update-ratings.mjs. Each entry
//  is one update day; the player JSON already holds the new overalls,
//  this log just remembers what moved so the app can show it.
// ═══════════════════════════════════════════════════════════════

export interface RatingChange {
	id: string;
	name: string;
	from: number;
	to: number;
	team?: { from: string; to: string };
}

export interface RatingUpdate {
	date: string;
	changes: RatingChange[];
}

export const RATING_UPDATES: RatingUpdate[] = (changes as RatingUpdate[]).slice().sort((a, b) => b.date.localeCompare(a.date));

const delta = new Map<string, number>();
for (const u of RATING_UPDATES) for (const c of u.changes) delta.set(c.id, (delta.get(c.id) ?? 0) + (c.to - c.from));

/** OVR change since 2K27 launch (0 if never updated) */
export function ratingDelta(id: string): number {
	return delta.get(id) ?? 0;
}

export function lastRatingUpdate(): RatingUpdate | null {
	return RATING_UPDATES[0] ?? null;
}

export function fmtDate(d: string): string {
	return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
