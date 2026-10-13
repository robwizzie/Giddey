import { Position } from '@/lib/types';
import { getPool, getVersusPlayer, PoolMode, VersusPlayer } from './pool';
import { BoostId } from './wheels';

// ═══════════════════════════════════════════════════════════════
//  VERSUS DRAFT ENGINE
//  Pure state transitions. Randomness lives here but every function
//  is only ever called from event handlers (never inside render or a
//  reducer), so React strict mode can't double-roll anything.
// ═══════════════════════════════════════════════════════════════

export type Side = 0 | 1;
export type DraftStyle = 'snake' | 'cut' | 'franchise';
export type Band = 'superstar' | 'star' | 'starter' | 'rotation' | 'deep';
export type Phase = 'setup' | 'coin' | 'draft' | 'equalizer' | 'trade' | 'boosts' | 'reveal' | 'gameday' | 'postgame';

export interface Settings {
	names: [string, string];
	pool: PoolMode;
	style: DraftStyle;
	/** how many players of each tier each coach drafts (one round per player) */
	tiers: Record<Band, number>;
	/** derived: total of `tiers` */
	rosterSize: number;
	/** draft the tier rounds in random order instead of stars first */
	shuffleRounds: boolean;
	/** auto-offer the Equalizer when teams finish 1.5+ OVR apart */
	equalizer: boolean;
	packSize: 3 | 4 | 5;
	rerolls: 0 | 1 | 2;
	underdogFirst: boolean;
	blind: boolean;
	trades: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	names: ['Rob', 'Dave'],
	pool: 'mixed',
	style: 'snake',
	tiers: { superstar: 1, star: 2, starter: 2, rotation: 2, deep: 1 },
	rosterSize: 8,
	shuffleRounds: false,
	equalizer: true,
	packSize: 4,
	rerolls: 1,
	underdogFirst: true,
	blind: false,
	trades: true,
};

export const BAND_INFO: Record<Band, { label: string; range: [number, number]; color: string }> = {
	superstar: { label: 'Superstar', range: [0, 0.07], color: '#c084fc' },
	star: { label: 'All-Star', range: [0.07, 0.2], color: '#22d3ee' },
	starter: { label: 'Starter', range: [0.2, 0.42], color: '#f87171' },
	rotation: { label: 'Rotation', range: [0.42, 0.7], color: '#60a5fa' },
	deep: { label: 'Deep Bench', range: [0.7, 1], color: '#4ade80' },
};

export const BANDS: Band[] = ['superstar', 'star', 'starter', 'rotation', 'deep'];
export const MIN_ROSTER = 5;
export const MAX_ROSTER = 15;
export const MAX_PER_TIER = 8;

export const TIER_PRESETS: { id: string; label: string; icon: string; desc: string; tiers: Record<Band, number> }[] = [
	{ id: 'balanced', label: 'Balanced', icon: '⚖️', desc: 'A star, some help, real depth', tiers: { superstar: 1, star: 2, starter: 2, rotation: 2, deep: 1 } },
	{ id: 'five', label: 'Starting Five', icon: '🖐️', desc: '5 picks, no bench', tiers: { superstar: 1, star: 2, starter: 2, rotation: 0, deep: 0 } },
	{ id: 'bigthree', label: 'Big Three', icon: '🔥', desc: '3 superstars + role players', tiers: { superstar: 3, star: 0, starter: 1, rotation: 2, deep: 2 } },
	{ id: 'super', label: 'Superteams', icon: '🚀', desc: 'Overpowered. Nothing but stars', tiers: { superstar: 4, star: 4, starter: 0, rotation: 0, deep: 0 } },
	{ id: 'underdogs', label: 'Underdogs', icon: '🐕', desc: 'No stars — pure grit', tiers: { superstar: 0, star: 0, starter: 2, rotation: 3, deep: 3 } },
	{ id: 'deep', label: 'Full Rotation', icon: '📋', desc: '12-man 2K-style roster', tiers: { superstar: 1, star: 2, starter: 3, rotation: 3, deep: 3 } },
];

export function rosterTotal(tiers: Record<Band, number>): number {
	return BANDS.reduce((n, b) => n + (tiers[b] ?? 0), 0);
}

/** Fill gaps from older saved settings (fixed 5/8/10 rosters) and recompute the total */
export function normalizeSettings(raw: Partial<Settings> & { rosterSize?: number }): Settings {
	const legacy: Record<number, Record<Band, number>> = {
		5: { superstar: 1, star: 2, starter: 1, rotation: 1, deep: 0 },
		8: DEFAULT_SETTINGS.tiers,
		10: { superstar: 1, star: 2, starter: 3, rotation: 2, deep: 2 },
	};
	const tiers = { ...(raw.tiers ?? legacy[raw.rosterSize ?? 8] ?? DEFAULT_SETTINGS.tiers) };
	const s: Settings = { ...DEFAULT_SETTINGS, ...raw, tiers, rosterSize: 0 };
	return { ...s, rosterSize: rosterTotal(tiers) };
}

/** One band per round, stars first unless shuffled */
export function buildBlueprint(settings: Settings): Band[] {
	const rounds = BANDS.flatMap(b => Array.from({ length: settings.tiers[b] ?? 0 }, () => b));
	return settings.shuffleRounds ? shuffle(rounds) : rounds;
}

export interface DraftState {
	round: number;
	/** tier for each round, fixed when the draft starts */
	blueprint: Band[];
	/** order[0] acts first this round (picks first, or chooses in cut mode) */
	order: [Side, Side];
	/** index into order of who is acting now */
	turn: 0 | 1;
	stage: 'spin' | 'cut' | 'pick';
	pack: string[];
	/** cut mode: the two cards the cutter put on the table */
	offered: string[];
	franchise: string | null;
	rerolls: [number, number];
	/** most recent pick, used for the reveal animation */
	lastPick: { side: Side; id: string; round: number } | null;
	log: { side: Side; id: string; round: number }[];
}

export interface GameResult {
	game: number;
	winner: Side;
	score: [number | null, number | null];
	challenges: [boolean | null, boolean | null];
	quarter: number | null;
	teamOvr: [number, number];
}

export interface GameDay {
	quarter: number | null;
	modifier: string | null;
	challenges: [string | null, string | null];
	rewards: [BoostId | null, BoostId | null];
}

export interface TradeState {
	turn: Side;
	done: [boolean, boolean];
	proposal: { from: Side; give: string; get: string } | null;
	history: { from: Side; give: string; get: string; accepted: boolean }[];
}

export interface VersusState {
	v: 1;
	phase: Phase;
	settings: Settings;
	teams: [string[], string[]];
	draft: DraftState | null;
	equalizer: { side: Side; options: string[]; replaces: string } | null;
	trade: TradeState | null;
	/** mechanical boosts still to resolve before the game (upgrade / steal) */
	boostQueue: { side: Side; boost: BoostId }[];
	/** boost being resolved right now (options rolled once) */
	boostOptions: string[] | null;
	gameNo: number;
	series: GameResult[];
	/** boosts earned last game, waiting for the next one */
	earned: [BoostId[], BoostId[]];
	/** honor-system boosts active for the current game */
	honor: [BoostId[], BoostId[]];
	firstPickBoost: Side | null;
	extraRerolls: [number, number];
	gameday: GameDay;
	coinWinner: Side | null;
}

export const EMPTY_GAMEDAY: GameDay = { quarter: null, modifier: null, challenges: [null, null], rewards: [null, null] };

export function initialState(settings: Settings = DEFAULT_SETTINGS): VersusState {
	return {
		v: 1,
		phase: 'setup',
		settings,
		teams: [[], []],
		draft: null,
		equalizer: null,
		trade: null,
		boostQueue: [],
		boostOptions: null,
		gameNo: 1,
		series: [],
		earned: [[], []],
		honor: [[], []],
		firstPickBoost: null,
		extraRerolls: [0, 0],
		gameday: EMPTY_GAMEDAY,
		coinWinner: null,
	};
}

// ─── helpers ────────────────────────────────────────────────────

export const other = (s: Side): Side => (s === 0 ? 1 : 0);

export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function players(ids: string[]): VersusPlayer[] {
	return ids.map(getVersusPlayer).filter((p): p is VersusPlayer => !!p);
}

function draftedSet(s: VersusState): Set<string> {
	return new Set([...s.teams[0], ...s.teams[1]]);
}

// ─── team rating ────────────────────────────────────────────────

// Starters carry the rating, like 2K's own team overall.
const WEIGHTS = [1, 0.95, 0.9, 0.85, 0.8, 0.55, 0.45, 0.35, 0.3, 0.25];

export function teamOvr(ids: string[]): number {
	const ovrs = players(ids)
		.map(p => p.overall)
		.sort((a, b) => b - a);
	if (!ovrs.length) return 0;
	let sum = 0;
	let w = 0;
	ovrs.forEach((o, i) => {
		const wi = WEIGHTS[i] ?? 0.2;
		sum += o * wi;
		w += wi;
	});
	return Math.round((sum / w) * 10) / 10;
}

/** 100 = dead even, drops 12 pts per OVR of gap */
export function fairness(a: string[], b: string[]): number {
	const gap = Math.abs(teamOvr(a) - teamOvr(b));
	return Math.max(0, Math.round(100 - gap * 12));
}

export const EQUALIZER_GAP = 1.5;

// ─── lineup (best fit to 5 positions) ───────────────────────────

export const SLOTS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export interface Lineup {
	starters: { slot: Position; player: VersusPlayer | null; fit: 'primary' | 'secondary' | 'out' | 'empty' }[];
	bench: VersusPlayer[];
}

function fitOf(p: VersusPlayer, slot: Position): 'primary' | 'secondary' | 'out' {
	if (p.position === slot) return 'primary';
	if (p.secondaryPosition === slot) return 'secondary';
	return 'out';
}
const FIT_PENALTY = { primary: 0, secondary: 1, out: 8 };

export function bestLineup(ids: string[]): Lineup {
	const ps = players(ids);
	let best = -Infinity;
	let bestAssign: (VersusPlayer | null)[] = [null, null, null, null, null];
	const used = new Array(ps.length).fill(false);
	const cur: (VersusPlayer | null)[] = [];

	const dfs = (slot: number, score: number) => {
		if (slot === 5) {
			if (score > best) {
				best = score;
				bestAssign = [...cur];
			}
			return;
		}
		let any = false;
		for (let i = 0; i < ps.length; i++) {
			if (used[i]) continue;
			any = true;
			used[i] = true;
			cur.push(ps[i]);
			dfs(slot + 1, score + ps[i].overall - FIT_PENALTY[fitOf(ps[i], SLOTS[slot])]);
			cur.pop();
			used[i] = false;
		}
		// leave slot empty only when fewer than 5 players remain
		const remaining = ps.length - used.filter(Boolean).length;
		if (!any || remaining < 5 - slot) {
			cur.push(null);
			dfs(slot + 1, score);
			cur.pop();
		}
	};
	dfs(0, 0);

	const startIds = new Set(bestAssign.filter(Boolean).map(p => p!.id));
	return {
		starters: SLOTS.map((slot, i) => {
			const p = bestAssign[i];
			return { slot, player: p, fit: p ? fitOf(p, slot) : 'empty' };
		}),
		bench: ps.filter(p => !startIds.has(p.id)).sort((a, b) => b.overall - a.overall),
	};
}

/** Starting spots the best-fit lineup can't fill with a natural (primary/secondary) player yet */
export function missingPositions(ids: string[]): Position[] {
	return bestLineup(ids)
		.starters.filter(s => s.fit === 'empty' || s.fit === 'out')
		.map(s => s.slot);
}

export function fitsNeed(p: VersusPlayer, needs: Position[]): Position | null {
	return needs.find(pos => p.position === pos || p.secondaryPosition === pos) ?? null;
}

// ─── pack generation ────────────────────────────────────────────

export interface SideNeeds {
	needs: Position[];
	/** remaining picks barely cover the holes */
	urgent: boolean;
	/** every remaining pick has to fill a hole */
	must: boolean;
}

export function sideNeeds(s: VersusState, side: Side): SideNeeds {
	const total = s.draft?.blueprint.length ?? s.settings.rosterSize;
	const needs = missingPositions(s.teams[side]);
	const picksLeft = total - s.teams[side].length;
	return { needs, urgent: needs.length > 0 && picksLeft <= needs.length + 1, must: needs.length > 0 && picksLeft <= needs.length };
}

function bandSlice(pool: VersusPlayer[], band: Band, widen = 0): VersusPlayer[] {
	const [lo, hi] = BAND_INFO[band].range;
	const n = pool.length;
	const start = Math.max(0, Math.floor((lo - widen) * n));
	const end = Math.min(n, Math.ceil((hi + widen) * n));
	return pool.slice(start, end);
}

/**
 * Draw `size` undrafted cards from the round's band. Samples a handful
 * of candidate packs and keeps the one that best covers positions both
 * coaches still need, so nobody gets stuck without a center.
 */
export function makePack(s: VersusState, band: Band, size: number, exclude: string[] = [], franchise: string | null = null): string[] {
	const pool = getPool(s.settings.pool);
	const taken = draftedSet(s);
	exclude.forEach(id => taken.add(id));

	let candidates: VersusPlayer[] = [];
	if (franchise) {
		// Franchise wheel: that team's players, closest to the round's band first
		const ranked = pool.filter(p => p.teamId === franchise && !taken.has(p.id));
		const [lo, hi] = BAND_INFO[band].range;
		const mid = ((lo + hi) / 2) * pool.length;
		const rankOf = new Map(pool.map((p, i) => [p.id, i]));
		const sorted = ranked.sort((a, b) => Math.abs(rankOf.get(a.id)! - mid) - Math.abs(rankOf.get(b.id)! - mid));
		candidates = sorted.slice(0, size + 2);
		// keep that team's players who fill a must-have hole in the mix
		for (const side of [0, 1] as Side[]) {
			const n = sideNeeds(s, side);
			if (n.must) candidates.push(...sorted.filter(p => fitsNeed(p, n.needs) && !candidates.includes(p)).slice(0, 2));
		}
	} else {
		for (let widen = 0; widen <= 1 && candidates.length < size * 2; widen += 0.05) {
			candidates = bandSlice(pool, band, widen).filter(p => !taken.has(p.id));
		}
	}
	// What each coach still needs at the five starting spots, and how urgent it is
	const sides = ([0, 1] as Side[]).map(side => sideNeeds(s, side));

	// A coach running out of picks must see someone who fits — pull the closest-ranked fit in if the band has none
	if (!franchise) {
		const rankOf = new Map(pool.map((p, i) => [p.id, i]));
		const [lo, hi] = BAND_INFO[band].range;
		const mid = ((lo + hi) / 2) * pool.length;
		for (const side of sides) {
			if (!side.must || candidates.some(p => fitsNeed(p, side.needs))) continue;
			const fit = pool
				.filter(p => !taken.has(p.id) && fitsNeed(p, side.needs) && !candidates.includes(p))
				.sort((a, b) => Math.abs(rankOf.get(a.id)! - mid) - Math.abs(rankOf.get(b.id)! - mid))
				.slice(0, 2);
			candidates = [...candidates, ...fit];
		}
	}
	if (candidates.length <= size) return shuffle(candidates).sort((a, b) => b.overall - a.overall).map(p => p.id);

	const scorePack = (pack: VersusPlayer[]) => {
		let score = 0;
		for (const side of sides) {
			if (!side.needs.length) continue;
			const fits = pack.filter(p => fitsNeed(p, side.needs));
			const distinct = new Set(fits.map(p => fitsNeed(p, side.needs))).size;
			// two fits per coach so the second picker isn't left with nothing
			score += Math.min(fits.length, 2) * (side.urgent ? 30 : 12) + distinct * 4;
			if (side.must && fits.length === 0) score -= 1000;
		}
		score += new Set(pack.map(p => p.position)).size * 2;
		return score;
	};

	let best: VersusPlayer[] = [];
	let bestScore = -Infinity;
	for (let i = 0; i < 40; i++) {
		const pack = shuffle(candidates).slice(0, size);
		const score = scorePack(pack) + Math.random(); // tie-break randomly
		if (score > bestScore) {
			bestScore = score;
			best = pack;
		}
	}
	return best.sort((a, b) => b.overall - a.overall).map(p => p.id);
}

/**
 * Franchises that still have at least 2 undrafted players in the pool. When a
 * coach is down to must-fill picks, only teams that can fill that hole make the wheel.
 */
export function franchiseOptions(s: VersusState): string[] {
	const taken = draftedSet(s);
	const left = getPool(s.settings.pool).filter(p => !taken.has(p.id));
	const counts = new Map<string, number>();
	for (const p of left) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
	const all = [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t);
	const musts = ([0, 1] as Side[]).map(side => sideNeeds(s, side)).filter(n => n.must);
	if (!musts.length) return all;
	const ok = all.filter(t => musts.every(n => left.some(p => p.teamId === t && fitsNeed(p, n.needs))));
	return ok.length >= 2 ? ok : all;
}

// ─── draft flow ─────────────────────────────────────────────────

function roundOrder(s: VersusState, round: number, prev: DraftState | null): [Side, Side] {
	if (round === 0) {
		const first = s.firstPickBoost ?? s.coinWinner ?? 0;
		return [first, other(first)];
	}
	const prevFirst = prev!.order[0];
	const snake: [Side, Side] = [other(prevFirst), prevFirst];
	if (!s.settings.underdogFirst) return snake;
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	if (Math.abs(a - b) < 0.05) return snake;
	return a < b ? [0, 1] : [1, 0];
}

export function currentBand(s: VersusState): Band {
	return s.draft!.blueprint[s.draft!.round];
}

export function actingSide(d: DraftState): Side {
	return d.order[d.turn];
}

export function startRound(s: VersusState, round: number, blueprint?: Band[]): VersusState {
	const prev = s.draft;
	const order = roundOrder(s, round, prev);
	const bp = blueprint ?? prev?.blueprint ?? buildBlueprint(s.settings);
	const base: DraftState = {
		round,
		blueprint: bp,
		order,
		turn: 0,
		stage: 'pick',
		pack: [],
		offered: [],
		franchise: null,
		rerolls: prev ? prev.rerolls : [s.settings.rerolls + s.extraRerolls[0], s.settings.rerolls + s.extraRerolls[1]],
		lastPick: prev?.lastPick ?? null,
		log: prev?.log ?? [],
	};
	const next: VersusState = { ...s, phase: 'draft', draft: base };
	const band = bp[round];

	if (s.settings.style === 'franchise') return { ...next, draft: { ...base, stage: 'spin' } };

	if (s.settings.style === 'cut') {
		// Chooser acts first (order[0]); the cutter (order[1]) builds the offer.
		const pack = makePack(next, band, Math.max(3, s.settings.packSize));
		return { ...next, draft: { ...base, pack, stage: 'cut', turn: 1 } };
	}
	return { ...next, draft: { ...base, pack: makePack(next, band, s.settings.packSize) } };
}

export function startDraft(s: VersusState): VersusState {
	return startRound({ ...s, teams: [[], []], draft: null, equalizer: null, trade: null }, 0, buildBlueprint(s.settings));
}

export function landFranchise(s: VersusState, franchise: string): VersusState {
	const d = s.draft!;
	const pack = makePack(s, currentBand(s), s.settings.packSize, [], franchise);
	return { ...s, draft: { ...d, franchise, pack, stage: 'pick' } };
}

export function reroll(s: VersusState): VersusState {
	const d = s.draft!;
	const side = actingSide(d);
	if (d.rerolls[side] <= 0) return s;
	const rerolls: [number, number] = [...d.rerolls];
	rerolls[side]--;
	let pack = makePack(s, currentBand(s), d.pack.length, d.pack, d.franchise);
	// franchise ran dry — fall back to the band
	if (pack.length < d.pack.length) pack = makePack(s, currentBand(s), d.pack.length, d.pack);
	return { ...s, draft: { ...d, pack, rerolls } };
}

/**
 * Cut-mode guard: when a coach must fill a starting hole with every remaining
 * pick, the offer has to give them a way to do it. Returns why an offer is invalid.
 */
export function cutOfferProblem(s: VersusState, offered: string[]): string | null {
	if (offered.length !== 2) return null;
	const problem = rawCutProblem(s, offered);
	if (!problem) return null;
	// never deadlock: if no pair in the pack satisfies the rule, any offer goes
	const pack = s.draft!.pack;
	for (let i = 0; i < pack.length; i++) for (let j = i + 1; j < pack.length; j++) if (!rawCutProblem(s, [pack[i], pack[j]])) return problem;
	return null;
}

function rawCutProblem(s: VersusState, offered: string[]): string | null {
	const d = s.draft!;
	const chooser = d.order[0];
	const cutter = d.order[1];
	const [a, b] = players(offered);
	const c = sideNeeds(s, chooser);
	const k = sideNeeds(s, cutter);
	const name = (side: Side) => s.settings.names[side];
	const fitsC = (p: VersusPlayer) => !!fitsNeed(p, c.needs);
	const fitsK = (p: VersusPlayer) => !!fitsNeed(p, k.needs);
	if (c.must && !fitsC(a) && !fitsC(b)) return `${name(chooser)} still needs ${c.needs.join('/')} — offer at least one.`;
	// the cutter gets the leftover, so either card might come back to them
	if (k.must && !(fitsK(a) && fitsK(b))) return `You still need ${k.needs.join('/')} — both cards must fill it, since you get whichever is left.`;
	return null;
}

export function cutOffer(s: VersusState, offered: string[]): VersusState {
	const d = s.draft!;
	return { ...s, draft: { ...d, offered, stage: 'pick', turn: 0 } };
}

function addToTeam(s: VersusState, side: Side, id: string): VersusState {
	const teams: [string[], string[]] = [[...s.teams[0]], [...s.teams[1]]];
	teams[side].push(id);
	const d = s.draft!;
	const entry = { side, id, round: d.round };
	return { ...s, teams, draft: { ...d, lastPick: entry, log: [...d.log, entry] } };
}

export function pick(s: VersusState, id: string): VersusState {
	const d = s.draft!;
	const side = actingSide(d);
	let next = addToTeam(s, side, id);

	if (s.settings.style === 'cut') {
		// Cutter gets whatever is left on the table.
		const leftover = d.offered.find(x => x !== id)!;
		next = addToTeam(next, other(side), leftover);
		return finishRound(next);
	}

	if (d.turn === 0) {
		return { ...next, draft: { ...next.draft!, turn: 1, pack: d.pack.filter(x => x !== id) } };
	}
	return finishRound(next);
}

function finishRound(s: VersusState): VersusState {
	const d = s.draft!;
	if (d.round + 1 < d.blueprint.length) return startRound(s, d.round + 1);
	return endDraft(s);
}

/** After the last pick: equalizer if lopsided, then trades / boosts / reveal */
export function endDraft(s: VersusState): VersusState {
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	if (s.settings.equalizer && Math.abs(a - b) >= EQUALIZER_GAP) {
		const side: Side = a < b ? 0 : 1;
		const eq = equalizerOptions(s, side);
		if (eq.options.length) return { ...s, phase: 'equalizer', equalizer: { side, ...eq } };
	}
	return afterEqualizer({ ...s, equalizer: null });
}

export function afterEqualizer(s: VersusState): VersusState {
	if (s.settings.trades) {
		const t: TradeState = { turn: other(s.coinWinner ?? 0), done: [false, false], proposal: null, history: [] };
		return { ...s, phase: 'trade', trade: t };
	}
	return toBoosts(s);
}

/** Replace the trailing team's weakest player with one that closes the gap */
export function equalizerOptions(s: VersusState, side: Side): { options: string[]; replaces: string } {
	const mine = players(s.teams[side]).sort((x, y) => x.overall - y.overall);
	const weakest = mine[0];
	const theirs = teamOvr(s.teams[other(side)]);
	const taken = draftedSet(s);
	const without = s.teams[side].filter(id => id !== weakest.id);
	const scored = getPool(s.settings.pool)
		.filter(p => !taken.has(p.id) && p.overall > weakest.overall)
		.map(p => ({ p, gap: Math.abs(teamOvr([...without, p.id]) - theirs) }))
		.sort((x, y) => x.gap - y.gap)
		.slice(0, 10);
	return { options: shuffle(scored).slice(0, 3).sort((x, y) => y.p.overall - x.p.overall).map(x => x.p.id), replaces: weakest.id };
}

export function applyEqualizer(s: VersusState, id: string | null): VersusState {
	const eq = s.equalizer!;
	if (!id) return afterEqualizer({ ...s, equalizer: null });
	const teams: [string[], string[]] = [[...s.teams[0]], [...s.teams[1]]];
	teams[eq.side] = teams[eq.side].map(x => (x === eq.replaces ? id : x));
	return afterEqualizer({ ...s, teams, equalizer: null });
}

// ─── trades ─────────────────────────────────────────────────────

export function proposeTrade(s: VersusState, give: string, get: string): VersusState {
	const t = s.trade!;
	return { ...s, trade: { ...t, proposal: { from: t.turn, give, get } } };
}

export function answerTrade(s: VersusState, accepted: boolean): VersusState {
	const t = s.trade!;
	const p = t.proposal!;
	let teams = s.teams;
	if (accepted) {
		const to = other(p.from);
		teams = [[...s.teams[0]], [...s.teams[1]]];
		teams[p.from] = teams[p.from].map(x => (x === p.give ? p.get : x));
		teams[to] = teams[to].map(x => (x === p.get ? p.give : x));
	}
	return passTrade({ ...s, teams, trade: { ...t, proposal: null, history: [...t.history, { ...p, accepted }] } });
}

export function passTrade(s: VersusState): VersusState {
	const t = s.trade!;
	const done: [boolean, boolean] = [...t.done];
	done[t.turn] = true;
	if (done[0] && done[1]) return toBoosts({ ...s, trade: { ...t, done } });
	return { ...s, trade: { ...t, done, turn: other(t.turn), proposal: null } };
}

// ─── earned boosts ──────────────────────────────────────────────

const MECHANICAL: BoostId[] = ['upgrade', 'steal'];

export function toBoosts(s: VersusState): VersusState {
	const queue = s.boostQueue.length ? s.boostQueue : [];
	if (queue.length) return { ...s, phase: 'boosts', boostOptions: rollBoostOptions(s, queue[0].side, queue[0].boost) };
	return { ...s, phase: 'reveal' };
}

/** Called when a new game starts: sort earned boosts into the right buckets */
export function distributeBoosts(s: VersusState, redraft: boolean): VersusState {
	const queue: { side: Side; boost: BoostId }[] = [];
	const honor: [BoostId[], BoostId[]] = [[], []];
	let firstPickBoost: Side | null = null;
	const extraRerolls: [number, number] = [0, 0];
	([0, 1] as Side[]).forEach(side => {
		for (const b of s.earned[side]) {
			if (b === 'firstPick') {
				if (redraft && firstPickBoost === null) firstPickBoost = side;
				else queue.push({ side, boost: 'upgrade' });
			} else if (b === 'reroll') {
				if (redraft) extraRerolls[side]++;
				else queue.push({ side, boost: 'upgrade' });
			} else if (MECHANICAL.includes(b)) {
				queue.push({ side, boost: b });
			} else {
				honor[side].push(b);
			}
		}
	});
	return { ...s, boostQueue: queue, honor, firstPickBoost, extraRerolls, earned: [[], []] };
}

export function rollBoostOptions(s: VersusState, side: Side, boost: BoostId): string[] {
	if (boost === 'steal') {
		// bench players of the opponent (everyone outside their best-fit 5)
		const lu = bestLineup(s.teams[other(side)]);
		return lu.bench.map(p => p.id);
	}
	// upgrade: 3 undrafted players better than your weakest, modest jump
	const mine = players(s.teams[side]).sort((a, b) => a.overall - b.overall);
	const weakest = mine[0];
	const taken = draftedSet(s);
	const pool = getPool(s.settings.pool).filter(p => !taken.has(p.id) && p.overall > weakest.overall && p.overall <= weakest.overall + 8);
	const fallback = getPool(s.settings.pool).filter(p => !taken.has(p.id) && p.overall > weakest.overall);
	return shuffle(pool.length >= 3 ? pool : fallback)
		.slice(0, 3)
		.sort((a, b) => b.overall - a.overall)
		.map(p => p.id);
}

/** Resolve the boost at the head of the queue. `id` null = skip */
export function resolveBoost(s: VersusState, id: string | null): VersusState {
	const [head, ...rest] = s.boostQueue;
	let teams = s.teams;
	if (id && head) {
		teams = [[...s.teams[0]], [...s.teams[1]]];
		const mine = players(teams[head.side]).sort((a, b) => a.overall - b.overall);
		const weakest = mine[0].id;
		if (head.boost === 'upgrade') {
			teams[head.side] = teams[head.side].map(x => (x === weakest ? id : x));
		} else {
			// steal: take their bench player, they get your weakest
			const opp = other(head.side);
			teams[head.side] = teams[head.side].map(x => (x === weakest ? id : x));
			teams[opp] = teams[opp].map(x => (x === id ? weakest : x));
		}
	}
	const next = { ...s, teams, boostQueue: rest };
	if (rest.length) return { ...next, boostOptions: rollBoostOptions(next, rest[0].side, rest[0].boost) };
	return { ...next, phase: 'reveal', boostOptions: null };
}

// ─── series ─────────────────────────────────────────────────────

export function recordGame(s: VersusState, result: Omit<GameResult, 'game' | 'teamOvr' | 'quarter'>): VersusState {
	const earned: [BoostId[], BoostId[]] = [[], []];
	([0, 1] as Side[]).forEach(side => {
		const reward = s.gameday.rewards[side];
		if (result.challenges[side] && reward) earned[side].push(reward);
	});
	const game: GameResult = {
		...result,
		game: s.gameNo,
		quarter: s.gameday.quarter,
		teamOvr: [teamOvr(s.teams[0]), teamOvr(s.teams[1])],
	};
	return { ...s, series: [...s.series, game], earned, phase: 'postgame' };
}

export function nextGame(s: VersusState, redraft: boolean): VersusState {
	const base = distributeBoosts({ ...s, gameNo: s.gameNo + 1, gameday: EMPTY_GAMEDAY }, redraft);
	if (redraft) {
		// loser of the last game gets the coin flip win
		const last = s.series[s.series.length - 1];
		const coinWinner: Side = last ? other(last.winner) : (s.coinWinner ?? 0);
		const started = startDraft({ ...base, coinWinner });
		return started;
	}
	return toBoosts({ ...base, draft: null });
}

export function seriesScore(s: VersusState): [number, number] {
	return [s.series.filter(g => g.winner === 0).length, s.series.filter(g => g.winner === 1).length];
}
