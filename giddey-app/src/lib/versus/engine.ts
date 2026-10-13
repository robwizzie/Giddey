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
export type DraftStyle = 'snake' | 'cut' | 'franchise' | 'auction';
export type Band = 'superstar' | 'star' | 'starter' | 'rotation' | 'deep';
export type PoolSetting = PoolMode | 'erawars';
export type Phase = 'setup' | 'coin' | 'keepers' | 'draft' | 'equalizer' | 'trade' | 'boosts' | 'reveal' | 'gameday' | 'postgame';

export interface Identity {
	team: string;
	emoji: string;
	color: string;
}

export interface Settings {
	names: [string, string];
	identity: [Identity, Identity];
	pool: PoolSetting;
	/** Era Wars: which coach drafts the modern pool (the other drafts All-Time) */
	eraWarsModern: Side;
	style: DraftStyle;
	/** how many players of each tier each coach drafts (one round per player) */
	tiers: Record<Band, number>;
	/** handicap mode: coach 2 drafts these tiers instead of `tiers` */
	handicap: boolean;
	tiers2: Record<Band, number>;
	/** derived: the smaller roster of the two (used for bench-only rules) */
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
	/** redrafts: each coach keeps one player from their last team */
	keepers: boolean;
	/** one round where both coaches pick in secret — collide and nobody gets him */
	blindBid: boolean;
	/** seconds per pick, 0 = off */
	shotClock: 0 | 20 | 30 | 45;
	/** auction budget per coach ($); budget2 is coach 2's in handicap mode */
	budget: number;
	budget2: number;
}

export const SIDE_PALETTE = ['#f97316', '#38bdf8', '#22c55e', '#e11d48', '#a855f7', '#facc15', '#14b8a6', '#f472b6'];

export const DEFAULT_SETTINGS: Settings = {
	names: ['Rob', 'Dave'],
	identity: [
		{ team: '', emoji: '🔥', color: '#f97316' },
		{ team: '', emoji: '🧊', color: '#38bdf8' },
	],
	pool: 'mixed',
	eraWarsModern: 0,
	style: 'snake',
	tiers: { superstar: 1, star: 2, starter: 2, rotation: 2, deep: 1 },
	handicap: false,
	tiers2: { superstar: 1, star: 2, starter: 2, rotation: 2, deep: 1 },
	rosterSize: 8,
	shuffleRounds: false,
	equalizer: true,
	packSize: 4,
	rerolls: 1,
	underdogFirst: true,
	blind: false,
	trades: true,
	keepers: false,
	blindBid: false,
	shotClock: 30,
	budget: 200,
	budget2: 200,
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

export function tiersFor(settings: Settings, side: Side): Record<Band, number> {
	return settings.handicap && side === 1 ? settings.tiers2 : settings.tiers;
}

export function rosterSizeFor(settings: Settings, side: Side): number {
	return rosterTotal(tiersFor(settings, side));
}

export function budgetFor(settings: Settings, side: Side): number {
	return settings.handicap && side === 1 ? settings.budget2 : settings.budget;
}

/** The pool a coach drafts from (Era Wars splits modern vs All-Time) */
export function poolFor(settings: Settings, side: Side): PoolMode {
	if (settings.pool !== 'erawars') return settings.pool;
	return side === settings.eraWarsModern ? 'modern' : 'alltime';
}

/** Everyone either coach could ever draft */
export function unionPool(settings: Settings): PoolMode {
	return settings.pool === 'erawars' ? 'mixed' : settings.pool;
}

/** Fill gaps from older saved settings and recompute derived fields */
export function normalizeSettings(raw: Partial<Settings> & { rosterSize?: number }): Settings {
	const legacy: Record<number, Record<Band, number>> = {
		5: { superstar: 1, star: 2, starter: 1, rotation: 1, deep: 0 },
		8: DEFAULT_SETTINGS.tiers,
		10: { superstar: 1, star: 2, starter: 3, rotation: 2, deep: 2 },
	};
	const tiers = { ...(raw.tiers ?? legacy[raw.rosterSize ?? 8] ?? DEFAULT_SETTINGS.tiers) };
	const tiers2 = { ...(raw.tiers2 ?? tiers) };
	const identity: [Identity, Identity] = [
		{ ...DEFAULT_SETTINGS.identity[0], ...(raw.identity?.[0] ?? {}) },
		{ ...DEFAULT_SETTINGS.identity[1], ...(raw.identity?.[1] ?? {}) },
	];
	const s: Settings = { ...DEFAULT_SETTINGS, ...raw, tiers, tiers2, identity, rosterSize: 0 };
	// one shared auction board can't split eras
	if (s.style === 'auction' && s.pool === 'erawars') s.pool = 'mixed';
	return { ...s, rosterSize: Math.min(rosterTotal(tiers), s.handicap ? rosterTotal(tiers2) : rosterTotal(tiers)) };
}

export function sideColor(settings: Settings, side: Side): string {
	return settings.identity?.[side]?.color ?? DEFAULT_SETTINGS.identity[side].color;
}

/** "🔥 Mamba Mentality" or just the coach's name */
export function teamName(settings: Settings, side: Side): string {
	const id = settings.identity?.[side];
	const name = id?.team?.trim() || settings.names[side];
	return id?.emoji ? `${id.emoji} ${name}` : name;
}

/** One band per round, stars first unless shuffled */
export function buildBlueprint(settings: Settings, side: Side = 0): Band[] {
	const t = tiersFor(settings, side);
	const rounds = BANDS.flatMap(b => Array.from({ length: t[b] ?? 0 }, () => b));
	return settings.shuffleRounds ? shuffle(rounds) : rounds;
}

export interface AuctionLot {
	id: string;
	bid: number;
	/** current high bidder */
	high: Side;
	/** who has to raise or pass */
	turn: Side;
}

export interface DraftState {
	round: number;
	/** each coach's tier per round, fixed when the draft starts */
	blueprints: [Band[], Band[]];
	/** final roster size per coach (keepers included) */
	targets: [number, number];
	/** order[0] acts first this round (picks first, or chooses in cut mode) */
	order: [Side, Side];
	/** index into order of who is acting now */
	turn: 0 | 1;
	/** only order[0] picks this round (the other coach's rounds ran out) */
	solo: boolean;
	stage: 'spin' | 'cut' | 'pick' | 'secret' | 'nominate' | 'bid';
	pack: string[];
	/** cut mode: the two cards the cutter put on the table */
	offered: string[];
	franchise: string | null;
	rerolls: [number, number];
	/** most recent pick, used for the reveal animation */
	lastPick: LogEntry | null;
	log: LogEntry[];
	/** blind-bid round index, if any */
	blindRound: number | null;
	secret: [string | null, string | null];
	collisions: number;
	lastCollision: string | null;
	auction: { budgets: [number, number]; nominator: Side; lot: AuctionLot | null } | null;
	keepers: [string | null, string | null];
}

export interface LogEntry {
	side: Side;
	id: string;
	round: number;
	price?: number;
	blind?: boolean;
}

export interface GameResult {
	game: number;
	winner: Side;
	score: [number | null, number | null];
	challenges: [boolean | null, boolean | null];
	quarter: number | null;
	teamOvr: [number, number];
	/** filled in for the rivalry log */
	rosters?: [string[], string[]];
	sabotage?: string | null;
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

export interface Sabotage {
	by: Side;
	on: Side;
	id: string;
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
	/** keeper selection before a redraft */
	keeperPicks: [string | null, string | null];
	keeperTurn: Side;
	/** sabotage in effect this game, and one spun after the last game */
	sabotage: Sabotage | null;
	pendingSabotage: Sabotage | null;
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
		keeperPicks: [null, null],
		keeperTurn: 0,
		sabotage: null,
		pendingSabotage: null,
	};
}

/** Bring a saved state from an older build up to date */
export function migrateState(raw: VersusState & { draft: (DraftState & { blueprint?: Band[] }) | null }): VersusState {
	const settings = normalizeSettings(raw.settings);
	let draft = raw.draft;
	if (draft && !draft.blueprints) {
		const bp = draft.blueprint ?? buildBlueprint({ ...settings, shuffleRounds: false });
		draft = {
			...draft,
			blueprints: [bp, bp],
			targets: [bp.length, bp.length],
			solo: false,
			blindRound: null,
			secret: [null, null],
			collisions: 0,
			lastCollision: null,
			auction: null,
			keepers: [null, null],
		};
	}
	return { ...initialState(settings), ...raw, settings, draft };
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

export function rosterTarget(s: VersusState, side: Side): number {
	return s.draft?.targets[side] ?? rosterSizeFor(s.settings, side);
}

export function sideNeeds(s: VersusState, side: Side): SideNeeds {
	const needs = missingPositions(s.teams[side]);
	const picksLeft = rosterTarget(s, side) - s.teams[side].length;
	if (picksLeft <= 0) return { needs: [], urgent: false, must: false };
	return { needs, urgent: needs.length > 0 && picksLeft <= needs.length + 1, must: needs.length > 0 && picksLeft <= needs.length };
}

function bandSlice(pool: VersusPlayer[], band: Band, widen = 0): VersusPlayer[] {
	const [lo, hi] = BAND_INFO[band].range;
	const n = pool.length;
	const start = Math.max(0, Math.floor((lo - widen) * n));
	const end = Math.min(n, Math.ceil((hi + widen) * n));
	return pool.slice(start, end);
}

/** OVR range a band covers in a pool */
export function bandOvrRange(mode: PoolMode, band: Band): [number, number] {
	const slice = bandSlice(getPool(mode), band);
	return [slice[slice.length - 1]?.overall ?? 0, slice[0]?.overall ?? 0];
}

/**
 * Era Wars: legends are rated higher across the board, so both coaches'
 * tiers use the modern pool's OVR ranges. The All-Time coach draws the
 * legends whose OVR is closest to that range.
 */
function eraMatchedSlice(pool: VersusPlayer[], band: Band, widen: number): VersusPlayer[] {
	const [lo, hi] = bandOvrRange('modern', band);
	const slack = Math.round(widen * 20);
	const inRange = pool.filter(p => p.overall >= lo - slack && p.overall <= hi + slack);
	if (inRange.length) return inRange;
	// nobody that low (deep bench) — take the lowest-rated legends left
	return pool.slice(-Math.max(4, Math.ceil(pool.length * 0.15)));
}

/** Which tier a player sits in for a coach's pool */
export function bandOf(settings: Settings, side: Side, id: string): Band {
	let pool = getPool(poolFor(settings, side));
	let idx = pool.findIndex(p => p.id === id);
	if (idx < 0) {
		pool = getPool('mixed');
		idx = pool.findIndex(p => p.id === id);
	}
	const pct = idx / pool.length;
	return BANDS.find(b => pct < BAND_INFO[b].range[1]) ?? 'deep';
}

/**
 * Draw `size` undrafted cards from a band. Samples a handful of candidate
 * packs and keeps the one that best covers the positions the coach(es)
 * still need. `forSide` builds a pack for one coach only (their own pool,
 * their own needs); otherwise it's a shared pack for both.
 */
export function makePack(s: VersusState, band: Band, size: number, exclude: string[] = [], franchise: string | null = null, forSide?: Side): string[] {
	const pool = getPool(forSide !== undefined ? poolFor(s.settings, forSide) : poolFor(s.settings, 0));
	const taken = draftedSet(s);
	exclude.forEach(id => taken.add(id));
	const scoredSides = (forSide !== undefined ? [forSide] : ([0, 1] as Side[])).map(side => sideNeeds(s, side));

	const rankOf = new Map(pool.map((p, i) => [p.id, i]));
	const [lo, hi] = BAND_INFO[band].range;
	const mid = ((lo + hi) / 2) * pool.length;
	const eraMatch = s.settings.pool === 'erawars' && forSide !== undefined && poolFor(s.settings, forSide) === 'alltime';
	const [ovrLo, ovrHi] = bandOvrRange('modern', band);
	const midOvr = (ovrLo + ovrHi) / 2;
	const byBandDistance = eraMatch
		? (a: VersusPlayer, b: VersusPlayer) => Math.abs(a.overall - midOvr) - Math.abs(b.overall - midOvr)
		: (a: VersusPlayer, b: VersusPlayer) => Math.abs(rankOf.get(a.id)! - mid) - Math.abs(rankOf.get(b.id)! - mid);

	let candidates: VersusPlayer[] = [];
	if (franchise) {
		// Franchise wheel: that team's players, closest to the round's band first
		const sorted = pool
			.filter(p => p.teamId === franchise && !taken.has(p.id))
			// Era Wars: a franchise's legends only count if they're near this tier's OVR
			.filter(p => !eraMatch || Math.abs(p.overall - midOvr) <= (ovrHi - ovrLo) / 2 + 3)
			.sort(byBandDistance);
		candidates = sorted.slice(0, size + 2);
		// keep that team's players who fill a must-have hole in the mix
		for (const n of scoredSides) {
			if (n.must) candidates.push(...sorted.filter(p => fitsNeed(p, n.needs) && !candidates.includes(p)).slice(0, 2));
		}
	} else {
		for (let widen = 0; widen <= 1 && candidates.length < size * 2; widen += 0.05) {
			const avail = eraMatch ? pool.filter(p => !taken.has(p.id)) : pool;
			candidates = (eraMatch ? eraMatchedSlice(avail, band, widen) : bandSlice(pool, band, widen)).filter(p => !taken.has(p.id));
		}
		// A coach running out of picks must see someone who fits — pull the closest-ranked fit in if the band has none
		for (const n of scoredSides) {
			if (!n.must || candidates.some(p => fitsNeed(p, n.needs))) continue;
			const fit = pool
				.filter(p => !taken.has(p.id) && fitsNeed(p, n.needs) && !candidates.includes(p))
				.sort(byBandDistance)
				.slice(0, 2);
			candidates = [...candidates, ...fit];
		}
	}
	if (candidates.length <= size) return [...candidates].sort((a, b) => b.overall - a.overall).map(p => p.id);

	const scorePack = (pack: VersusPlayer[]) => {
		let score = 0;
		for (const n of scoredSides) {
			if (!n.needs.length) continue;
			const fits = pack.filter(p => fitsNeed(p, n.needs));
			const distinct = new Set(fits.map(p => fitsNeed(p, n.needs))).size;
			// two fits per coach so the second picker isn't left with nothing
			score += Math.min(fits.length, 2) * (n.urgent ? 30 : 12) + distinct * 4;
			if (n.must && fits.length === 0) score -= 1000;
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
 * Franchises that still have at least 2 undrafted players. When a coach is
 * down to must-fill picks, only teams that can fill that hole make the wheel.
 * In Era Wars every coach on the clock this round needs someone from it.
 */
export function franchiseOptions(s: VersusState): string[] {
	const taken = draftedSet(s);
	const d = s.draft;
	const acting = d ? (d.solo ? [d.order[0]] : d.order) : ([0, 1] as Side[]);
	const left = (side: Side) => getPool(poolFor(s.settings, side)).filter(p => !taken.has(p.id));
	const counts = new Map<string, number>();
	for (const p of getPool(unionPool(s.settings))) if (!taken.has(p.id)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
	let all = [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t);
	if (s.settings.pool === 'erawars') {
		const both = all.filter(t => acting.every(side => left(side).some(p => p.teamId === t)));
		if (both.length >= 2) all = both;
	}
	const musts = acting.map(side => ({ side, n: sideNeeds(s, side) })).filter(x => x.n.must);
	if (!musts.length) return all;
	const ok = all.filter(t => musts.every(({ side, n }) => left(side).some(p => p.teamId === t && fitsNeed(p, n.needs))));
	return ok.length >= 2 ? ok : all;
}

// ─── draft flow ─────────────────────────────────────────────────

function roundOrder(s: VersusState, round: number, prev: DraftState | null): [Side, Side] {
	if (round === 0 || !prev) {
		const first = s.firstPickBoost ?? s.coinWinner ?? 0;
		return [first, other(first)];
	}
	const prevFirst = prev.order[0];
	const snake: [Side, Side] = [other(prevFirst), prevFirst];
	// handicaps are deliberate — don't hand the weaker side first pick on top
	if (!s.settings.underdogFirst || s.settings.handicap) return snake;
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	if (Math.abs(a - b) < 0.05) return snake;
	return a < b ? [0, 1] : [1, 0];
}

export function roundsTotal(d: DraftState): number {
	return Math.max(d.blueprints[0].length, d.blueprints[1].length);
}

export function bandFor(d: DraftState, side: Side): Band | undefined {
	return d.blueprints[side][d.round];
}

/** Both coaches pick from one shared pack this round */
export function isSharedRound(s: VersusState, d: DraftState = s.draft!): boolean {
	const b0 = bandFor(d, 0);
	const b1 = bandFor(d, 1);
	return !d.solo && !!b0 && b0 === b1 && poolFor(s.settings, 0) === poolFor(s.settings, 1);
}

export function currentBand(s: VersusState): Band {
	const d = s.draft!;
	return bandFor(d, actingSide(d)) ?? bandFor(d, d.order[0]) ?? 'deep';
}

export function actingSide(d: DraftState): Side {
	return d.order[d.turn];
}

function packFor(s: VersusState, side: Side, size: number, exclude: string[] = []): string[] {
	const d = s.draft!;
	const band = bandFor(d, side) ?? 'deep';
	const shared = isSharedRound(s);
	let pack = makePack(s, band, size, exclude, d.franchise, shared ? undefined : side);
	// franchise ran dry for this coach — fall back to the band
	if (d.franchise && pack.length < (shared ? 2 : 1)) pack = makePack(s, band, size, exclude, null, shared ? undefined : side);
	return pack;
}

export function startRound(s: VersusState, round: number): VersusState {
	const prev = s.draft!;
	let order = roundOrder(s, round, round === 0 ? null : prev);
	const has0 = !!prev.blueprints[0][round];
	const has1 = !!prev.blueprints[1][round];
	const solo = !(has0 && has1);
	if (solo) order = has0 ? [0, 1] : [1, 0];
	const base: DraftState = {
		...prev,
		round,
		order,
		turn: 0,
		solo,
		stage: 'pick',
		pack: [],
		offered: [],
		franchise: null,
		secret: [null, null],
		collisions: 0,
		lastCollision: null,
	};
	const next: VersusState = { ...s, phase: 'draft', draft: base };
	const shared = isSharedRound(next, base);

	if (s.settings.style === 'franchise') return { ...next, draft: { ...base, stage: 'spin' } };

	if (shared && round === base.blindRound) {
		return { ...next, draft: { ...base, stage: 'secret', pack: packFor(next, order[0], Math.max(3, s.settings.packSize)) } };
	}
	if (s.settings.style === 'cut' && shared) {
		// Chooser acts first (order[0]); the cutter (order[1]) builds the offer.
		return { ...next, draft: { ...base, pack: packFor(next, order[0], Math.max(3, s.settings.packSize)), stage: 'cut', turn: 1 } };
	}
	return { ...next, draft: { ...base, pack: packFor(next, order[0], s.settings.packSize) } };
}

/**
 * Start a fresh draft. `keep` seeds each roster with a keeper; that keeper
 * uses up one of the coach's rounds in their tier (or the closest one).
 */
export function startDraft(s: VersusState, keep: [string | null, string | null] = [null, null]): VersusState {
	const teams: [string[], string[]] = [keep[0] ? [keep[0]] : [], keep[1] ? [keep[1]] : []];
	const blueprints = ([0, 1] as Side[]).map(side => {
		const bp = buildBlueprint(s.settings, side);
		const k = keep[side];
		if (!k || !bp.length) return bp;
		const band = bandOf(s.settings, side, k);
		const target = BANDS.indexOf(band);
		// drop the round whose tier is closest to the keeper's
		let bestIdx = 0;
		bp.forEach((b, i) => {
			if (Math.abs(BANDS.indexOf(b) - target) < Math.abs(BANDS.indexOf(bp[bestIdx]) - target)) bestIdx = i;
		});
		return bp.filter((_, i) => i !== bestIdx);
	}) as [Band[], Band[]];
	const targets: [number, number] = [rosterSizeFor(s.settings, 0), rosterSizeFor(s.settings, 1)];

	// blind-bid round: a shared round after the first
	let blindRound: number | null = null;
	if (s.settings.blindBid && s.settings.style !== 'auction' && poolFor(s.settings, 0) === poolFor(s.settings, 1)) {
		const eligible = blueprints[0].map((b, i) => i).filter(i => i > 0 && blueprints[0][i] && blueprints[0][i] === blueprints[1][i]);
		if (eligible.length) blindRound = eligible[Math.floor(Math.random() * eligible.length)];
	}

	const draft: DraftState = {
		round: 0,
		blueprints,
		targets,
		order: [0, 1],
		turn: 0,
		solo: false,
		stage: 'pick',
		pack: [],
		offered: [],
		franchise: null,
		rerolls: [s.settings.rerolls + s.extraRerolls[0], s.settings.rerolls + s.extraRerolls[1]],
		lastPick: null,
		log: [],
		blindRound,
		secret: [null, null],
		collisions: 0,
		lastCollision: null,
		auction: null,
		keepers: keep,
	};
	const base: VersusState = { ...s, phase: 'draft', teams, draft, equalizer: null, trade: null, keeperPicks: [null, null] };
	if (s.settings.style === 'auction') return startAuction(base);
	if (!roundsTotal(draft)) return endDraft(base);
	return startRound(base, 0);
}

export function landFranchise(s: VersusState, franchise: string): VersusState {
	const d = { ...s.draft!, franchise };
	const next = { ...s, draft: d };
	const shared = isSharedRound(next, d);
	const blind = shared && d.round === d.blindRound;
	const pack = packFor(next, d.order[0], blind ? Math.max(3, s.settings.packSize) : s.settings.packSize);
	return { ...next, draft: { ...d, pack, stage: blind ? 'secret' : 'pick' } };
}

export function reroll(s: VersusState): VersusState {
	const d = s.draft!;
	const side = actingSide(d);
	if (d.rerolls[side] <= 0) return s;
	const rerolls: [number, number] = [...d.rerolls];
	rerolls[side]--;
	const pack = packFor(s, side, d.pack.length, d.pack);
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

function addToTeam(s: VersusState, side: Side, id: string, extra: Partial<LogEntry> = {}): VersusState {
	const teams: [string[], string[]] = [[...s.teams[0]], [...s.teams[1]]];
	teams[side].push(id);
	const d = s.draft!;
	const entry: LogEntry = { side, id, round: d.round, ...extra };
	return { ...s, teams, draft: { ...d, lastPick: entry, log: [...d.log, entry] } };
}

export function pick(s: VersusState, id: string): VersusState {
	const d = s.draft!;
	const side = actingSide(d);
	let next = addToTeam(s, side, id);

	if (d.offered.length) {
		// Cut mode: the cutter gets whatever is left on the table.
		const leftover = d.offered.find(x => x !== id)!;
		next = addToTeam(next, other(side), leftover);
		return finishRound(next);
	}

	if (d.turn === 0 && !d.solo) {
		const nd = next.draft!;
		if (isSharedRound(next, nd)) return { ...next, draft: { ...nd, turn: 1, pack: d.pack.filter(x => x !== id) } };
		// split round (handicap / Era Wars): the other coach gets their own pack
		const after = { ...next, draft: { ...nd, turn: 1 as const } };
		return { ...after, draft: { ...after.draft, pack: packFor(after, d.order[1], s.settings.packSize) } };
	}
	return finishRound(next);
}

/** Blind-bid round: each coach locks a pick in secret. Same player = nobody gets him. */
export function secretPick(s: VersusState, id: string): VersusState {
	const d = s.draft!;
	const side = actingSide(d);
	const secret: [string | null, string | null] = [...d.secret];
	secret[side] = id;
	if (d.turn === 0) return { ...s, draft: { ...d, secret, turn: 1 } };

	const a = secret[d.order[0]]!;
	const b = secret[d.order[1]]!;
	if (a === b) {
		const collisions = d.collisions + 1;
		const nd: DraftState = { ...d, secret: [null, null], turn: 0, collisions, lastCollision: a };
		const after = { ...s, draft: nd };
		const pack = packFor(after, d.order[0], Math.max(3, s.settings.packSize), [a]);
		// three collisions in a row: open it back up as a normal round
		return { ...after, draft: { ...nd, pack, stage: collisions >= 3 ? 'pick' : 'secret' } };
	}
	let next = addToTeam({ ...s, draft: { ...d, secret } }, d.order[0], a, { blind: true });
	next = addToTeam(next, d.order[1], b, { blind: true });
	return finishRound(next);
}

function finishRound(s: VersusState): VersusState {
	const d = s.draft!;
	if (d.round + 1 < roundsTotal(d)) return startRound(s, d.round + 1);
	return endDraft(s);
}

/** After the last pick: equalizer if lopsided, then trades / boosts / reveal */
export function endDraft(s: VersusState): VersusState {
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	if (s.settings.equalizer && !s.settings.handicap && Math.abs(a - b) >= EQUALIZER_GAP) {
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
	const scored = getPool(poolFor(s.settings, side))
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

// ─── auction ────────────────────────────────────────────────────

const valueCache = new Map<string, Map<string, number>>();

/**
 * Rough auction price for each player: top players soak up most of the
 * money, the last useful pick costs $1. Scaled so drafting both full
 * rosters at "value" roughly spends both budgets.
 */
export function auctionValues(s: VersusState, side: Side): Map<string, number> {
	const mode = poolFor(s.settings, side);
	const slots = rosterSizeFor(s.settings, 0) + rosterSizeFor(s.settings, 1);
	const money = budgetFor(s.settings, 0) + budgetFor(s.settings, 1);
	const key = `${mode}|${slots}|${money}`;
	const hit = valueCache.get(key);
	if (hit) return hit;
	const pool = getPool(mode);
	const n = Math.min(pool.length, Math.round(slots * 1.6));
	const floor = pool[Math.min(pool.length - 1, n)].overall - 1;
	const weights = pool.slice(0, slots).map(p => Math.pow(Math.max(0, p.overall - floor), 2.2));
	const wsum = weights.reduce((a, b) => a + b, 0) || 1;
	const spend = Math.max(0, money - slots);
	const map = new Map<string, number>();
	for (const p of pool) map.set(p.id, Math.max(1, Math.round(1 + (Math.pow(Math.max(0, p.overall - floor), 2.2) / wsum) * spend)));
	valueCache.set(key, map);
	return map;
}

function startAuction(s: VersusState): VersusState {
	const d = s.draft!;
	const first = s.firstPickBoost ?? s.coinWinner ?? 0;
	const budgets: [number, number] = [budgetFor(s.settings, 0), budgetFor(s.settings, 1)];
	// keepers cost their value, but always leave $1 per open slot
	([0, 1] as Side[]).forEach(side => {
		const k = d.keepers[side];
		if (!k) return;
		const price = auctionValues(s, side).get(k) ?? 1;
		const open = d.targets[side] - s.teams[side].length;
		budgets[side] = Math.max(open, budgets[side] - price);
	});
	return { ...s, draft: { ...d, stage: 'nominate', order: [first, other(first)], auction: { budgets, nominator: first, lot: null } } };
}

export function slotsLeft(s: VersusState, side: Side): number {
	return rosterTarget(s, side) - s.teams[side].length;
}

/** Most a coach can bid and still afford $1 for every other open slot */
export function maxBid(s: VersusState, side: Side): number {
	const a = s.draft!.auction!;
	return a.budgets[side] - Math.max(0, slotsLeft(s, side) - 1);
}

/** Players a coach may nominate (or bid on): undrafted and in a pool both can draft from */
export function auctionBoard(s: VersusState): VersusPlayer[] {
	const taken = draftedSet(s);
	return getPool(unionPool(s.settings)).filter(p => !taken.has(p.id));
}

export function nominate(s: VersusState, id: string, bid: number): VersusState {
	const d = s.draft!;
	const a = d.auction!;
	const by = a.nominator;
	const opp = other(by);
	const opening = Math.max(1, Math.min(bid, maxBid(s, by)));
	// the other coach is full (or broke) — it's theirs at the opening price
	if (slotsLeft(s, opp) <= 0 || maxBid(s, opp) <= opening) return award(s, by, id, opening);
	return { ...s, draft: { ...d, stage: 'bid', auction: { ...a, lot: { id, bid: opening, high: by, turn: opp } } } };
}

export function raise(s: VersusState, amount: number): VersusState {
	const d = s.draft!;
	const a = d.auction!;
	const lot = a.lot!;
	const bidder = lot.turn;
	const amt = Math.min(amount, maxBid(s, bidder));
	if (amt <= lot.bid) return s;
	const opp = other(bidder);
	// opponent can't go higher — sold
	if (maxBid(s, opp) <= amt) return award(s, bidder, lot.id, amt);
	return { ...s, draft: { ...d, auction: { ...a, lot: { ...lot, bid: amt, high: bidder, turn: opp } } } };
}

/** The coach on the turn passes: high bidder wins the lot */
export function passBid(s: VersusState): VersusState {
	const lot = s.draft!.auction!.lot!;
	return award(s, lot.high, lot.id, lot.bid);
}

function award(s: VersusState, side: Side, id: string, price: number): VersusState {
	let next = addToTeam(s, side, id, { price });
	const d = next.draft!;
	const a = d.auction!;
	const budgets: [number, number] = [...a.budgets];
	budgets[side] -= price;
	next = { ...next, draft: { ...d, auction: { ...a, budgets, lot: null } } };
	const left0 = slotsLeft(next, 0);
	const left1 = slotsLeft(next, 1);
	if (left0 <= 0 && left1 <= 0) return endDraft(next);
	// alternate nominations; a full roster sits out
	let nominator = other(a.nominator);
	if (slotsLeft(next, nominator) <= 0) nominator = other(nominator);
	return { ...next, draft: { ...next.draft!, stage: 'nominate', order: [nominator, other(nominator)], turn: 0, auction: { ...next.draft!.auction!, nominator } } };
}

// ─── keepers ────────────────────────────────────────────────────

export function chooseKeeper(s: VersusState, id: string | null): VersusState {
	const picks: [string | null, string | null] = [...s.keeperPicks];
	picks[s.keeperTurn] = id;
	const first = s.coinWinner ?? 0;
	if (s.keeperTurn === first) return { ...s, keeperPicks: picks, keeperTurn: other(first) };
	return startDraft({ ...s, keeperPicks: picks }, picks);
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
	if (!weakest) return [];
	const taken = draftedSet(s);
	const all = getPool(poolFor(s.settings, side)).filter(p => !taken.has(p.id) && p.overall > weakest.overall);
	const close = all.filter(p => p.overall <= weakest.overall + 8);
	return shuffle(close.length >= 3 ? close : all)
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
		rosters: [[...s.teams[0]], [...s.teams[1]]],
		sabotage: s.sabotage?.id ?? null,
	};
	return { ...s, series: [...s.series, game], earned, phase: 'postgame', pendingSabotage: null };
}

export function setSabotage(s: VersusState, id: string): VersusState {
	const last = s.series[s.series.length - 1];
	if (!last) return s;
	return { ...s, pendingSabotage: { by: other(last.winner), on: last.winner, id } };
}

export function nextGame(s: VersusState, redraft: boolean): VersusState {
	const base = distributeBoosts({ ...s, gameNo: s.gameNo + 1, gameday: EMPTY_GAMEDAY, sabotage: s.pendingSabotage, pendingSabotage: null }, redraft);
	if (redraft) {
		// loser of the last game gets the coin flip win
		const last = s.series[s.series.length - 1];
		const coinWinner: Side = last ? other(last.winner) : (s.coinWinner ?? 0);
		if (s.settings.keepers && s.teams[0].length && s.teams[1].length) {
			return { ...base, coinWinner, phase: 'keepers', keeperPicks: [null, null], keeperTurn: coinWinner, draft: null };
		}
		return startDraft({ ...base, coinWinner });
	}
	return toBoosts({ ...base, draft: null });
}

export function seriesScore(s: VersusState): [number, number] {
	return [s.series.filter(g => g.winner === 0).length, s.series.filter(g => g.winner === 1).length];
}
