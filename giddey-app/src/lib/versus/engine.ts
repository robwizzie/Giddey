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
	rosterSize: 5 | 8 | 10;
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
	rosterSize: 8,
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

export const BLUEPRINTS: Record<Settings['rosterSize'], Band[]> = {
	5: ['superstar', 'star', 'star', 'starter', 'rotation'],
	8: ['superstar', 'star', 'star', 'starter', 'starter', 'rotation', 'rotation', 'deep'],
	10: ['superstar', 'star', 'star', 'starter', 'starter', 'starter', 'rotation', 'rotation', 'deep', 'deep'],
};

export interface DraftState {
	round: number;
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

/** Starting positions nobody on the roster can play yet */
export function missingPositions(ids: string[]): Position[] {
	const ps = players(ids);
	return SLOTS.filter(slot => !ps.some(p => p.position === slot || p.secondaryPosition === slot));
}

// ─── pack generation ────────────────────────────────────────────

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
		candidates = ranked.sort((a, b) => Math.abs(rankOf.get(a.id)! - mid) - Math.abs(rankOf.get(b.id)! - mid)).slice(0, size + 2);
	} else {
		for (let widen = 0; widen <= 1 && candidates.length < size * 2; widen += 0.05) {
			candidates = bandSlice(pool, band, widen).filter(p => !taken.has(p.id));
		}
	}
	if (candidates.length <= size) return shuffle(candidates).map(p => p.id);

	const needs = [...new Set([...missingPositions(s.teams[0]), ...missingPositions(s.teams[1])])];
	let best: VersusPlayer[] = [];
	let bestScore = -1;
	for (let i = 0; i < 24; i++) {
		const pack = shuffle(candidates).slice(0, size);
		const covered = needs.filter(pos => pack.some(p => p.position === pos || p.secondaryPosition === pos)).length;
		const variety = new Set(pack.map(p => p.position)).size;
		const score = covered * 10 + variety;
		if (score > bestScore) {
			bestScore = score;
			best = pack;
		}
	}
	return best.sort((a, b) => b.overall - a.overall).map(p => p.id);
}

/** Franchises that still have at least 2 undrafted players in the pool */
export function franchiseOptions(s: VersusState): string[] {
	const taken = draftedSet(s);
	const counts = new Map<string, number>();
	for (const p of getPool(s.settings.pool)) {
		if (!taken.has(p.id)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
	}
	return [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t);
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
	return BLUEPRINTS[s.settings.rosterSize][s.draft!.round];
}

export function actingSide(d: DraftState): Side {
	return d.order[d.turn];
}

export function startRound(s: VersusState, round: number): VersusState {
	const prev = s.draft;
	const order = roundOrder(s, round, prev);
	const base: DraftState = {
		round,
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
	const band = BLUEPRINTS[s.settings.rosterSize][round];

	if (s.settings.style === 'franchise') return { ...next, draft: { ...base, stage: 'spin' } };

	if (s.settings.style === 'cut') {
		// Chooser acts first (order[0]); the cutter (order[1]) builds the offer.
		const pack = makePack(next, band, Math.max(3, s.settings.packSize));
		return { ...next, draft: { ...base, pack, stage: 'cut', turn: 1 } };
	}
	return { ...next, draft: { ...base, pack: makePack(next, band, s.settings.packSize) } };
}

export function startDraft(s: VersusState): VersusState {
	return startRound({ ...s, teams: [[], []], draft: null, equalizer: null, trade: null }, 0);
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
	if (d.round + 1 < s.settings.rosterSize) return startRound(s, d.round + 1);
	return endDraft(s);
}

/** After the last pick: equalizer if lopsided, then trades / boosts / reveal */
export function endDraft(s: VersusState): VersusState {
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	if (Math.abs(a - b) >= EQUALIZER_GAP) {
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
