import type { RivalryGame } from './rivalry';
import type { SeasonTag, Settings } from './engine';

// ═══════════════════════════════════════════════════════════════
//  SEASONS — a set number of regular-season games, then a best-of
//  Finals. Every logged game carries its season tag, so standings,
//  champions and Finals MVPs are all worked out from the log (and
//  come along when you sync phones).
// ═══════════════════════════════════════════════════════════════

type Side = 0 | 1;

export interface SeasonSummary {
	n: number;
	len: number;
	finals: number;
	regular: [number, number];
	/** regular-season point differential (coach 1's view) */
	diff: number;
	finalsWins: [number, number];
	/** higher seed (home court in the Finals); null until the regular season ends */
	seed: Side | null;
	champion: Side | null;
	finalsMvp: string | null;
	/** the season's games, oldest first */
	games: RivalryGame[];
}

const winsNeeded = (bestOf: number) => Math.floor(bestOf / 2) + 1;

function summarize(n: number, games: RivalryGame[]): SeasonSummary {
	const first = games[0]?.season;
	const len = first?.len ?? 10;
	const finals = first?.finals ?? 7;
	const reg = games.filter(g => g.season?.stage === 'regular');
	const fin = games.filter(g => g.season?.stage === 'finals');
	const regular: [number, number] = [reg.filter(g => g.winner === 0).length, reg.filter(g => g.winner === 1).length];
	const diff = reg.reduce((d, g) => (g.score[0] !== null && g.score[1] !== null ? d + g.score[0] - g.score[1] : d), 0);
	const finalsWins: [number, number] = [fin.filter(g => g.winner === 0).length, fin.filter(g => g.winner === 1).length];
	const seed: Side | null = reg.length >= len ? (regular[0] !== regular[1] ? (regular[0] > regular[1] ? 0 : 1) : diff !== 0 ? (diff > 0 ? 0 : 1) : 0) : null;
	const need = winsNeeded(finals);
	const champion: Side | null = finalsWins[0] >= need ? 0 : finalsWins[1] >= need ? 1 : null;
	// Finals MVP: most Player of the Game awards in the Finals on the champion's roster
	let finalsMvp: string | null = null;
	if (champion !== null) {
		const count = new Map<string, number>();
		for (const g of fin) for (const id of g.potg ?? []) if (g.rosters[champion]?.includes(id)) count.set(id, (count.get(id) ?? 0) + 1);
		finalsMvp = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
	}
	return { n, len, finals, regular, diff, finalsWins, seed, champion, finalsMvp, games };
}

/** Every season played between these two coaches (history is already seated) */
export function seasons(history: RivalryGame[]): SeasonSummary[] {
	const byN = new Map<number, RivalryGame[]>();
	for (const g of history) if (g.season) byN.set(g.season.n, [...(byN.get(g.season.n) ?? []), g]);
	return [...byN.entries()].sort((a, b) => a[0] - b[0]).map(([n, games]) => summarize(n, games));
}

/** Season tag for the next game these coaches play (null when seasons are off) */
export function nextSeasonTag(history: RivalryGame[], settings: Pick<Settings, 'season' | 'finals'>): SeasonTag | null {
	if (!settings.season) return null;
	const all = seasons(history);
	const cur = all[all.length - 1];
	const fresh = (n: number): SeasonTag => ({ n, stage: 'regular', g: 1, len: settings.season, finals: settings.finals });
	if (!cur) return fresh(1);
	if (cur.champion !== null) return fresh(cur.n + 1);
	const reg = cur.regular[0] + cur.regular[1];
	if (reg < cur.len) return { n: cur.n, stage: 'regular', g: reg + 1, len: cur.len, finals: cur.finals };
	return { n: cur.n, stage: 'finals', g: cur.finalsWins[0] + cur.finalsWins[1] + 1, len: cur.len, finals: cur.finals };
}

/** The season the next game belongs to, as it stands right now */
export function currentSeason(history: RivalryGame[], tag: SeasonTag | null): SeasonSummary | null {
	if (!tag) return null;
	return seasons(history).find(x => x.n === tag.n) ?? summarize(tag.n, []);
}

export function seasonLabel(tag: SeasonTag | null | undefined): string {
	if (!tag) return '';
	return tag.stage === 'finals' ? `Season ${tag.n} · Finals G${tag.g}` : `Season ${tag.n} · Game ${tag.g}/${tag.len}`;
}

export function titles(history: RivalryGame[]): [number, number] {
	const t: [number, number] = [0, 0];
	for (const s of seasons(history)) if (s.champion !== null) t[s.champion]++;
	return t;
}

export { winsNeeded };
