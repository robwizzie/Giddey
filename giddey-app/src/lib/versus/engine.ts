import { Position } from '@/lib/types';
import { getPool, getVersusPlayer, PoolMode, VersusPlayer } from './pool';
import { BOOSTS, BoostId, builtIns, CUSTOM_KINDS, CustomWheels, EMPTY_CUSTOM } from './wheels';
import type { LeagueTag } from './league';
import { ActiveTheme, getTheme, rollThemeParam, Theme, ThemeId, THEMES, DIVISIONS } from './themes';
import { freshnessWeight, isFreshFor } from './usage';
import { draftGrades } from './grades';
import { history } from './history';
import { currentSeason, nextSeasonTag, seasons as seasonsOf } from './seasons';
import { coveredBy, vegasLine } from './vegas';

// ═══════════════════════════════════════════════════════════════
//  VERSUS DRAFT ENGINE
//  Pure state transitions. Randomness lives here but every function
//  is only ever called from event handlers (never inside render or a
//  reducer), so React strict mode can't double-roll anything.
// ═══════════════════════════════════════════════════════════════

export type Side = 0 | 1;
export type DraftStyle = 'snake' | 'cut' | 'franchise' | 'auction' | 'block';
export type Band = 'superstar' | 'star' | 'starter' | 'rotation' | 'deep';
export type PoolSetting = PoolMode | 'erawars';
export type Phase = 'setup' | 'coin' | 'lottery' | 'dynasty' | 'theme' | 'keepers' | 'favorites' | 'bans' | 'board' | 'draft' | 'equalizer' | 'trade' | 'boosts' | 'reveal' | 'gameday' | 'postgame';

export interface Identity {
	team: string;
	/** team logo: an icon name (see TEAM_ICONS) */
	icon: string;
	color: string;
}

/** Logos a coach can pick for their team */
export const TEAM_ICONS = ['flame', 'snowflake', 'crown', 'zap', 'rocket', 'target', 'shield', 'swords', 'skull', 'ghost', 'star', 'gem', 'bomb', 'trophy', 'heart', 'waves'];

// saves from before icons: map the old emoji to the closest logo
const EMOJI_TO_ICON: Record<string, string> = { '🔥': 'flame', '🧊': 'snowflake', '👑': 'crown', '⚡': 'zap', '🚀': 'rocket', '🎯': 'target', '🏆': 'trophy', '💎': 'gem', '☠️': 'skull', '🌪️': 'waves', '🐍': 'swords', '🦅': 'star', '🐐': 'crown', '🐺': 'ghost', '🦁': 'shield', '🍀': 'heart' };

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
	/** how hard packs lean toward players you haven't been using */
	freshness: 'off' | 'light' | 'strong';
	/** each roster needs this many players that coach has never used */
	freshFaces: 0 | 1 | 2 | 3;
	/** each coach's pinned franchise guys */
	favorites: [string[], string[]];
	/** before the draft, each coach grabs one available franchise guy */
	favoritesRound: boolean;
	/** players who win you a game sit out your next 2 drafts */
	retire: 'off' | 'potg' | 'starters';
	/** theme draft: off, spin a random one each draft, or always this one */
	theme: 'off' | 'spin' | ThemeId;
	/** read every pick aloud with the browser's speech voice */
	announcer: boolean;
	/** spin a second-half twist at halftime */
	halftime: boolean;
	/** set a point spread before tip-off; an underdog who covers earns a Tier Up */
	vegas: boolean;
	/** regular-season length in games (0 = no seasons), then a best-of Finals */
	season: 0 | 3 | 4 | 6 | 10 | 16;
	finals: 1 | 3 | 5 | 7;
	/** every regular-season game uses the next draft style and a theme spin; the Finals go back to yours */
	seasonMix: boolean;
	/** the Finals are drafted only from players either coach used in that regular season */
	finalsPool: 'normal' | 'season';
	/** Season variety: your own style and theme, restored for the Finals */
	mixBase?: { style: DraftStyle; theme: Settings['theme'] } | null;
	/** your own challenges, sabotages, twists and halftime twists */
	custom: CustomWheels;
	/** Dynasty: keep 3 players between seasons, a mid-season trade deadline, and a draft lottery */
	dynasty: boolean;
	/** before each draft, each coach secretly bans this many players (revealed together) */
	bans: 0 | 1 | 2;
	/** each coach is dealt one secret power-up card per draft (pick-style drafts) */
	powerups: boolean;
	/** before the draft, each coach secretly scouts the other (3 reads, scored after) */
	bigBoard: boolean;
	/** mix challenges about your own drafted players into the challenge wheel */
	rosterChallenges: boolean;
	/** agree on stakes before tip-off; the loser spins the punishment wheel */
	stakes: boolean;
	/** full-screen tale of the tape and coach walkouts before tip-off */
	intro: boolean;
	/** main screen: crowd noise, team-color lighting, big-screen superstar moments */
	arena: boolean;
	/** the league match tonight's next game counts for (cleared once it's logged) */
	league?: LeagueTag | null;
}

export const DYNASTY_KEEPS = 3;

export const MAX_FAVORITES = 5;
export const RETIRE_DRAFTS = 2;

export const SIDE_PALETTE = ['#f97316', '#38bdf8', '#22c55e', '#e11d48', '#a855f7', '#facc15', '#14b8a6', '#f472b6'];

export const DEFAULT_SETTINGS: Settings = {
	names: ['', ''],
	identity: [
		{ team: '', icon: 'flame', color: '#f97316' },
		{ team: '', icon: 'snowflake', color: '#38bdf8' },
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
	freshness: 'light',
	freshFaces: 0,
	favorites: [[], []],
	favoritesRound: false,
	retire: 'off',
	theme: 'off',
	announcer: true,
	halftime: true,
	vegas: true,
	season: 6,
	finals: 3,
	custom: EMPTY_CUSTOM,
	dynasty: false,
	seasonMix: false,
	finalsPool: 'normal',
	bans: 1,
	powerups: true,
	bigBoard: false,
	rosterChallenges: true,
	stakes: true,
	intro: true,
	arena: true,
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
	{ id: 'balanced', label: 'Balanced', icon: 'scale', desc: 'A star, some help, real depth', tiers: { superstar: 1, star: 2, starter: 2, rotation: 2, deep: 1 } },
	{ id: 'five', label: 'Starting Five', icon: 'hand', desc: '5 picks, no bench', tiers: { superstar: 1, star: 2, starter: 2, rotation: 0, deep: 0 } },
	{ id: 'bigthree', label: 'Big Three', icon: 'flame', desc: '3 superstars + role players', tiers: { superstar: 3, star: 0, starter: 1, rotation: 2, deep: 2 } },
	{ id: 'super', label: 'Superteams', icon: 'rocket', desc: 'Overpowered. Nothing but stars', tiers: { superstar: 4, star: 4, starter: 0, rotation: 0, deep: 0 } },
	{ id: 'underdogs', label: 'Underdogs', icon: 'shield', desc: 'No stars — pure grit', tiers: { superstar: 0, star: 0, starter: 2, rotation: 3, deep: 3 } },
	{ id: 'deep', label: 'Full Rotation', icon: 'clipboard', desc: '12-man 2K-style roster', tiers: { superstar: 1, star: 2, starter: 3, rotation: 3, deep: 3 } },
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

// ─── theme-aware pools ──────────────────────────────────────────

const poolCache = new Map<string, VersusPlayer[]>();

/** Everyone this coach may draft this time: their pool, narrowed by the theme */
export function poolOf(s: VersusState, side: Side): VersusPlayer[] {
	const base = themedPool(s, side);
	const stars = seasonAllStars(s);
	if (!stars) return base;
	const narrowed = base.filter(p => stars.has(p.id));
	// a short season may not have used enough players — then it's the normal pool
	const need = (rosterTotal(tiersFor(s.settings, 0)) + rosterTotal(tiersFor(s.settings, 1))) * 1.6;
	return narrowed.length >= need ? narrowed : base;
}

const starsCache = { key: '', set: null as Set<string> | null };

/** Finals with Season All-Stars on: everyone either coach used this regular season */
export function seasonAllStars(s: VersusState): Set<string> | null {
	if (s.settings.finalsPool !== 'season' || !s.settings.season || s.settings.league) return null;
	const h = history();
	const tag = nextSeasonTag(h, s.settings);
	if (tag?.stage !== 'finals') return null;
	const key = `${tag.n}|${h.length}|${h[h.length - 1]?.ts ?? 0}`;
	if (starsCache.key !== key) {
		const used = new Set<string>();
		for (const g of h) if (g.season?.n === tag.n && g.season.stage === 'regular') for (const r of g.rosters) for (const id of r) used.add(id);
		starsCache.key = key;
		starsCache.set = used;
	}
	return starsCache.set;
}

function themedPool(s: VersusState, side: Side): VersusPlayer[] {
	const mode = poolFor(s.settings, side);
	const theme = getTheme(s.theme?.id);
	if (!theme?.filter) return getPool(mode);
	const key = `${mode}|${theme.id}|${s.theme?.param ?? ''}|${theme.split ? side : ''}`;
	let hit = poolCache.get(key);
	if (!hit) {
		hit = getPool(mode).filter(p => theme.filter!(p, side, s.theme?.param));
		poolCache.set(key, hit);
	}
	return hit;
}

/** Same pool for both coaches (so they can share packs / an auction board) */
export function sameSlice(s: VersusState): boolean {
	return poolFor(s.settings, 0) === poolFor(s.settings, 1) && !getTheme(s.theme?.id)?.split;
}

/** Union of both coaches' pools, best first */
export function boardPool(s: VersusState): VersusPlayer[] {
	if (sameSlice(s)) return poolOf(s, 0);
	const seen = new Set<string>();
	return [...poolOf(s, 0), ...poolOf(s, 1)].filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true))).sort((a, b) => b.overall - a.overall);
}

/**
 * Why a coach can't take a player right now (null = fine):
 * retired from their side, a franchise they already have in One Per
 * Franchise, or a used player when they still owe Fresh Faces.
 */
export function ineligibleReason(s: VersusState, side: Side, id: string): string | null {
	const r = s.retired?.find(x => x.id === id && x.side === side && x.left > 0);
	if (r) return `Retired for you · ${r.left} draft${r.left === 1 ? '' : 's'}`;
	if (getTheme(s.theme?.id)?.onePerFranchise) {
		const p = getVersusPlayer(id);
		if (p && players(s.teams[side]).some(x => x.teamId === p.teamId && x.id !== id)) return 'Already have this franchise';
	}
	if (mustFresh(s, side) && !isFreshFor(side, id)) return 'Need a fresh face';
	return null;
}

export const canTake = (s: VersusState, side: Side, id: string) => ineligibleReason(s, side, id) === null;

/** Fresh Faces still owed by this coach */
export function freshNeeded(s: VersusState, side: Side): number {
	const need = s.settings.freshFaces ?? 0;
	if (!need) return 0;
	const have = s.teams[side].filter(id => isFreshFor(side, id)).length;
	return Math.max(0, need - have);
}

/** Every remaining pick has to be a fresh face */
export function mustFresh(s: VersusState, side: Side): boolean {
	const owed = freshNeeded(s, side);
	if (!owed || !s.draft) return false;
	return rosterTarget(s, side) - s.teams[side].length <= owed;
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
	const identity = ([0, 1] as Side[]).map(i => {
		const old = raw.identity?.[i] as (Partial<Identity> & { emoji?: string }) | undefined;
		const icon = old?.icon && TEAM_ICONS.includes(old.icon) ? old.icon : (old?.emoji && EMOJI_TO_ICON[old.emoji]) || DEFAULT_SETTINGS.identity[i].icon;
		return { team: old?.team ?? '', color: old?.color ?? DEFAULT_SETTINGS.identity[i].color, icon };
	}) as [Identity, Identity];
	const favorites: [string[], string[]] = [[...(raw.favorites?.[0] ?? [])], [...(raw.favorites?.[1] ?? [])]];
	let custom: CustomWheels = { ...EMPTY_CUSTOM, ...(raw.custom ?? {}) };
	// "Only mine" from older builds → those wheels' built-ins switched off
	if (custom.mode === 'only') {
		const off = new Set(custom.off ?? []);
		for (const k of CUSTOM_KINDS) if ((custom[k] ?? []).length >= 2) builtIns(k).forEach(x => off.add(x.id));
		custom = { ...custom, mode: 'mix', off: [...off] };
	}
	const s: Settings = { ...DEFAULT_SETTINGS, ...raw, tiers, tiers2, identity, favorites, custom, rosterSize: 0 };
	// one shared auction board can't split eras
	if ((s.style === 'auction' || s.style === 'block') && s.pool === 'erawars') s.pool = 'mixed';
	return { ...s, rosterSize: Math.min(rosterTotal(tiers), s.handicap ? rosterTotal(tiers2) : rosterTotal(tiers)) };
}

export function sideColor(settings: Settings, side: Side): string {
	return settings.identity?.[side]?.color ?? DEFAULT_SETTINGS.identity[side].color;
}

/** "Mamba Mentality", or just the coach's name */
export function teamName(settings: Settings, side: Side): string {
	return settings.identity?.[side]?.team?.trim() || settings.names[side];
}

export function teamIcon(settings: Settings, side: Side): string {
	return settings.identity?.[side]?.icon ?? DEFAULT_SETTINGS.identity[side].icon;
}

/**
 * Tier counts a coach drafts next time, after challenge rewards:
 * guarantees turn the lowest pick into that tier, tier-ups bump the
 * lowest pick up one tier, extras add a pick.
 */
export function effectiveTiers(settings: Settings, side: Side, rewards: BoostId[]): Record<Band, number> {
	const t = { ...tiersFor(settings, side) };
	const lowest = (below: number) => {
		for (let i = BANDS.length - 1; i > below; i--) if (t[BANDS[i]] > 0) return BANDS[i];
		return null;
	};
	for (const r of rewards) {
		const mod = BOOSTS[r]?.mod;
		if (!mod) continue;
		if (mod.guarantee) {
			const g = BANDS.indexOf(mod.guarantee);
			const low = lowest(g);
			if (low) t[low]--;
			t[mod.guarantee]++;
		}
		for (let i = 0; i < (mod.tierUps ?? 0); i++) {
			const low = lowest(0);
			if (!low) break;
			t[low]--;
			t[BANDS[BANDS.indexOf(low) - 1]]++;
		}
		if (mod.extra) t[mod.extra]++;
	}
	return t;
}

export function hasKeeperRight(s: VersusState, side: Side): boolean {
	return s.settings.keepers || (s.draftMods?.[side]?.rewards ?? []).some(r => BOOSTS[r]?.mod.keeper);
}

/** One band per round, stars first unless shuffled */
export function buildBlueprint(settings: Settings, side: Side = 0, tiers?: Record<Band, number>): Band[] {
	const t = tiers ?? tiersFor(settings, side);
	const rounds = BANDS.flatMap(b => Array.from({ length: t[b] ?? 0 }, () => b));
	return settings.shuffleRounds ? shuffle(rounds) : rounds;
}

export interface AuctionLot {
	id: string;
	bid: number;
	/** current high bidder (null = nobody has bid yet on a random lot) */
	high: Side | null;
	/** who has to raise or pass */
	turn: Side;
	/** random lots: passes in a row with no bid */
	passes?: number;
	/** face-down until sold */
	mystery?: boolean;
	/** random lots: nobody bids → it's assigned so both rosters can fill */
	mustSell?: boolean;
	/** random lots: the tier slot this lot fills */
	band?: Band;
}

/** Auction Block: players come up on their own from a tier deck */
export interface BlockState {
	/** tiers of the lots still to come (stars first) */
	deck: Band[];
	/** the next lots, already drawn so coaches can plan */
	queue: { id: string; mystery: boolean; band: Band }[];
	/** open tier slots per coach — you can only win a Superstar if you have a Superstar slot */
	slots: [Record<Band, number>, Record<Band, number>];
	lotNo: number;
	opener: Side;
	lastResult: { id: string; side: Side | null; price: number } | null;
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
	auction: { budgets: [number, number]; nominator: Side; lot: AuctionLot | null; block?: BlockState } | null;
	keepers: [string | null, string | null];
	/** franchise guys grabbed in the Favorites round */
	favorites?: [string | null, string | null];
	/** tier counts each coach drafts this time (settings + challenge rewards) */
	tiers?: [Record<Band, number>, Record<Band, number>];
	/** challenge rewards in effect this draft, for the banner */
	rewards?: [BoostId[], BoostId[]];
	/** power-up cards: dealt at the start, played once, revealed to everyone when played */
	powers?: PowerState;
}

export type PowerId = 'double' | 'jump' | 'scout' | 'lockdown' | 'veto';

export interface PowerState {
	/** each coach's card (secret until played) */
	hand: [PowerId | null, PowerId | null];
	/** the card each coach has played, if any */
	used: [PowerId | null, PowerId | null];
	/** most recent play, for the reveal on every screen */
	last: { side: Side; id: PowerId; n: number; player?: string } | null;
	/** this round: Double Pick in progress for this coach */
	extra: Side | null;
	/** this round: Tier Jump / Scout dealt a private pack, so nobody shares leftovers */
	split: boolean;
	/** this round: after this coach's pick, the best player left is banned */
	lockdown: Side | null;
}

export const POWERS: Record<PowerId, { id: PowerId; label: string; icon: string; color: string; desc: string; when: string }> = {
	double: { id: 'double', label: 'Double Pick', icon: 'layers', color: '#f97316', desc: 'Take two players from this pack. You give up your last round.', when: 'On your pick' },
	jump: { id: 'jump', label: 'Tier Jump', icon: 'chevronsUp', color: '#a855f7', desc: 'Redeal your pack from one tier higher for this pick.', when: 'On your pick, below Superstar' },
	scout: { id: 'scout', label: 'Scout', icon: 'search', color: '#22c55e', desc: 'Your pack gets 3 extra cards this pick. Your rival gets a pack of their own.', when: 'On your pick' },
	lockdown: { id: 'lockdown', label: 'Lockdown', icon: 'lock', color: '#38bdf8', desc: 'After you pick, the best player left in the pack is banned for this draft.', when: 'When you pick first from a shared pack' },
	veto: { id: 'veto', label: 'Veto', icon: 'ban', color: '#ef4444', desc: 'Cancel your rival’s last pick. He’s banned for this draft and they pick again in an extra round at the end.', when: 'Right after your rival picks' },
};

export const POWER_IDS = Object.keys(POWERS) as PowerId[];

/** Scouting report: three secret reads on the OTHER coach's draft */
export interface Reads {
	/** primary position of their first pick */
	pos: Position;
	/** who finishes the draft with the higher team OVR */
	higher: Side;
	/** how many guards (PG/SG) they end with */
	guards: '0-1' | '2' | '3+';
}

/** Challenge rewards waiting to shape a coach's next draft */
export interface DraftMods {
	rewards: BoostId[];
}

export const NO_MODS: [DraftMods, DraftMods] = [{ rewards: [] }, { rewards: [] }];

export interface LogEntry {
	side: Side;
	id: string;
	round: number;
	price?: number;
	blind?: boolean;
	/** best OVR this coach could have taken instead (for steal / reach callouts) */
	best?: number;
	/** what the auction thought he was worth */
	value?: number;
	/** cancelled by a Veto card (he's off the roster) */
	vetoed?: boolean;
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
	/** Player of the Game (two ids when the coaches' votes split) */
	potg?: string[];
	theme?: ActiveTheme | null;
	twist?: string | null;
	halftime?: Halftime | null;
	line?: Line | null;
	/** the underdog who covered the spread, if one did */
	covered?: Side | null;
	grades?: [Grade, Grade] | null;
	season?: SeasonTag | null;
	sabotageOn?: Side | null;
	predictions?: [Prediction | null, Prediction | null] | null;
	/** coach whose prediction was closer (earned the bonus) */
	oracle?: Side | null;
	league?: LeagueTag | null;
	/** when the result was entered — the same on every phone in a live room */
	playedAt?: number;
	/** the draft, pick by pick ([side, player id]) — for the replay */
	draft?: [Side, string][] | null;
	/** scouting-report points each coach scored this draft */
	reads?: [number, number] | null;
	/** punishments that were on the loser's wheel */
	stakes?: string[] | null;
	/** power-ups played this draft */
	powers?: [PowerId | null, PowerId | null] | null;
}

/** Point spread: `fav` is expected to win by `spread` */
export interface Line {
	fav: Side;
	spread: number;
}

export interface Halftime {
	id: string;
	/** coach leading at the half (the twist targets them or helps the other) */
	leader: Side;
	tied: boolean;
}

export interface Grade {
	letter: string;
	score: number;
	take: string;
}

export interface SeasonTag {
	n: number;
	stage: 'regular' | 'finals';
	/** game number within the stage */
	g: number;
	len: number;
	finals: number;
}

export interface GameDay {
	quarter: number | null;
	modifier: string | null;
	challenges: [string | null, string | null];
	rewards: [BoostId | null, BoostId | null];
	halftime?: Halftime | null;
	/** each coach's secret pick before tip-off */
	predictions?: [Prediction | null, Prediction | null];
	/** each coach's Player of the Game vote (secret until the result is in) */
	votes?: [string | null, string | null];
	/** punishments on the loser's wheel tonight (agreed before tip-off); null = not set */
	stakes?: string[] | null;
}

export interface Prediction {
	winner: Side;
	margin: number;
}

export interface TradeState {
	turn: Side;
	done: [boolean, boolean];
	proposal: { from: Side; give: string; get: string } | null;
	history: { from: Side; give: string; get: string; accepted: boolean }[];
}

/** Roster-changing step resolved before a game: upgrade a slot, or sign an extra player of a tier */
export interface QueuedBoost {
	side: Side;
	boost: 'upgrade' | 'sign';
	band?: Band;
	/** the challenge reward this came from */
	from?: BoostId;
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
	boostQueue: QueuedBoost[];
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
	/** challenge rewards that apply to the next draft */
	draftMods: [DraftMods, DraftMods];
	/** theme for the current / upcoming draft */
	theme: ActiveTheme | null;
	/** pre-draft steps already done for the upcoming draft */
	pre: { theme: boolean; keepers: boolean; favorites: boolean; bans?: boolean; board?: boolean };
	favoritePicks: [string | null, string | null];
	favoriteTurn: Side;
	/** players a coach can't draft for a while (Retire rule) */
	retired: Retired[];
	/** grades for the most recent draft */
	grades: [Grade, Grade] | null;
	dynasty?: DynastyState;
	/** ban phase for the upcoming draft: each coach's secret bans, then the revealed list */
	bans?: BanState;
	/** scouting reports for the upcoming / current draft */
	board?: BoardState;
	/** the loser's punishment from the last game, once spun */
	punishment?: { side: Side; id: string; game: number } | null;
}

export interface BanState {
	picks: [string[] | null, string[] | null];
	turn: Side;
	/** banned for this draft (both coaches' bans, plus Lockdown / Veto victims) */
	list: string[];
	/** the bans are on the table (shown to everyone) */
	revealed: boolean;
}

export interface BoardState {
	picks: [Reads | null, Reads | null];
	turn: Side;
}

export interface DynastyState {
	/** players each coach carries into the season-opening draft */
	keeps: [string[], string[]];
	turn: Side;
	/** season-opening lottery: balls per coach and who won it */
	lottery: { balls: [number, number]; winner: Side; season: number } | null;
	/** season whose trade deadline has been used */
	deadline: number;
}

const NO_DYNASTY: DynastyState = { keeps: [[], []], turn: 0, lottery: null, deadline: 0 };

export interface Retired {
	id: string;
	side: Side;
	/** drafts left on the bench */
	left: number;
}

export const PRE_NONE = { theme: false, keepers: false, favorites: false, bans: false, board: false };

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
		draftMods: NO_MODS,
		theme: null,
		pre: PRE_NONE,
		favoritePicks: [null, null],
		favoriteTurn: 0,
		retired: [],
		grades: null,
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

/** k distinct items, each draw proportional to its weight */
export function weightedSample<T>(items: T[], weights: number[], k: number): T[] {
	const pool = items.map((it, i) => ({ it, w: Math.max(0.0001, weights[i] ?? 1) }));
	const out: T[] = [];
	while (out.length < k && pool.length) {
		const total = pool.reduce((n, x) => n + x.w, 0);
		let r = Math.random() * total;
		let idx = 0;
		for (; idx < pool.length - 1; idx++) {
			r -= pool[idx].w;
			if (r <= 0) break;
		}
		out.push(pool[idx].it);
		pool.splice(idx, 1);
	}
	return out;
}

export function players(ids: string[]): VersusPlayer[] {
	return ids.map(getVersusPlayer).filter((p): p is VersusPlayer => !!p);
}

function draftedSet(s: VersusState): Set<string> {
	return new Set([...s.teams[0], ...s.teams[1], ...(s.bans?.list ?? [])]);
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
	const pool = poolOf(s, forSide ?? 0);
	const taken = draftedSet(s);
	exclude.forEach(id => taken.add(id));
	const sidesInPlay = forSide !== undefined ? [forSide] : ([0, 1] as Side[]).filter(side => rosterTarget(s, side) - s.teams[side].length > 0);
	const scoredSides = sidesInPlay.map(side => ({ side, ...sideNeeds(s, side) }));
	// a side-only pack never shows players that coach can't take
	if (forSide !== undefined) [...pool].forEach(p => !canTake(s, forSide, p.id) && taken.add(p.id));

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
			if (!n.must || candidates.some(p => fitsNeed(p, n.needs) && canTake(s, n.side, p.id))) continue;
			const fit = pool
				.filter(p => !taken.has(p.id) && fitsNeed(p, n.needs) && canTake(s, n.side, p.id) && !candidates.includes(p))
				.sort(byBandDistance)
				.slice(0, 2);
			candidates = [...candidates, ...fit];
		}
	}
	// Fresh Faces / retirements / one-per-franchise: every coach needs players they're allowed to take
	for (const n of scoredSides) {
		if (candidates.filter(p => canTake(s, n.side, p.id)).length >= 2) continue;
		const ok = pool
			.filter(p => !taken.has(p.id) && canTake(s, n.side, p.id) && !candidates.includes(p))
			.sort(byBandDistance)
			.slice(0, 2);
		candidates = [...candidates, ...ok];
	}
	if (candidates.length <= size) return [...candidates].sort((a, b) => b.overall - a.overall).map(p => p.id);

	const scorePack = (pack: VersusPlayer[]) => {
		let score = 0;
		for (const n of scoredSides) {
			const allowed = pack.filter(p => canTake(s, n.side, p.id)).length;
			if (allowed === 0) score -= 2000;
			else if (allowed === 1 && pack.length > 1 && forSide === undefined) score -= 200;
			if (!n.needs.length) continue;
			const fits = pack.filter(p => fitsNeed(p, n.needs) && canTake(s, n.side, p.id));
			const distinct = new Set(fits.map(p => fitsNeed(p, n.needs))).size;
			// two fits per coach so the second picker isn't left with nothing
			score += Math.min(fits.length, 2) * (n.urgent ? 30 : 12) + distinct * 4;
			if (n.must && fits.length === 0) score -= 1000;
		}
		score += new Set(pack.map(p => p.position)).size * 2;
		return score;
	};

	// freshness boost: never-used players come up more, overused ones less
	const weights = candidates.map(p => freshnessWeight(p.id, s.settings.freshness ?? 'off'));
	let best: VersusPlayer[] = [];
	let bestScore = -Infinity;
	for (let i = 0; i < 40; i++) {
		const pack = weightedSample(candidates, weights, size);
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
	const left = (side: Side) => poolOf(s, side).filter(p => !taken.has(p.id) && canTake(s, side, p.id));
	const counts = new Map<string, number>();
	for (const p of boardPool(s)) if (!taken.has(p.id)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
	let all = [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t);
	if (!sameSlice(s)) {
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
	return !d.solo && !d.powers?.split && !!b0 && b0 === b1 && sameSlice(s);
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
	const acting: Side[] = shared ? [0, 1] : [side];
	const playable = (ids: string[]) => acting.every(x => ids.some(id => canTake(s, x, id)));
	// franchise ran dry (or has nobody this coach may take) — fall back to the band
	if (d.franchise && (pack.length < (shared ? 2 : 1) || !playable(pack))) pack = makePack(s, band, size, exclude, null, shared ? undefined : side);
	return pack;
}

export function startRound(s: VersusState, round: number): VersusState {
	const prev = s.draft!;
	let order = roundOrder(s, round, round === 0 ? null : prev);
	const has0 = !!prev.blueprints[0][round];
	const has1 = !!prev.blueprints[1][round];
	// a round nobody has left (a Double Pick gave it up)
	if (!has0 && !has1) return round + 1 < roundsTotal(prev) ? startRound(s, round + 1) : endDraft(s);
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
		powers: prev.powers ? { ...prev.powers, extra: null, split: false, lockdown: null } : prev.powers,
	};
	const next: VersusState = { ...s, phase: 'draft', draft: base };
	const shared = isSharedRound(next, base);

	if (s.settings.style === 'franchise') return { ...next, draft: { ...base, stage: 'spin' } };

	if (shared && round === base.blindRound) {
		return { ...next, draft: { ...base, stage: 'secret', pack: packFor(next, order[0], Math.max(3, s.settings.packSize)) } };
	}
	if (s.settings.style === 'cut' && shared) {
		// Chooser acts first (order[0]); the cutter (order[1]) builds the offer.
		const cut: VersusState = { ...next, draft: { ...base, pack: packFor(next, order[0], Math.max(3, s.settings.packSize)), stage: 'cut', turn: 1 } };
		// no fair split possible (rules leave too few takeable cards) → play the round as a normal pick
		if (hasValidCut(cut)) return cut;
	}
	return { ...next, draft: { ...base, pack: packFor(next, order[0], s.settings.packSize) } };
}

/**
 * Start a fresh draft. `keep` seeds each roster with a keeper; that keeper
 * uses up one of the coach's rounds in their tier (or the closest one).
 */
/** Players a coach starts the draft with (keeper, franchise guy) */
function seedsOf(keep: [string | null, string | null], favs: [string | null, string | null], side: Side, dynasty: string[] = []): string[] {
	return [...new Set([...dynasty, keep[side], favs[side]].filter((x): x is string => !!x))];
}

/**
 * Start a fresh draft. Keepers and franchise guys are already on the
 * roster; each one uses up the coach's round in their tier (or the closest).
 */
export function startDraft(s: VersusState, keep: [string | null, string | null] = [null, null], favs: [string | null, string | null] = [null, null]): VersusState {
	const dk = s.dynasty?.keeps ?? [[], []];
	const teams: [string[], string[]] = [seedsOf(keep, favs, 0, dk[0]), seedsOf(keep, favs, 1, dk[1])];
	const mods = s.draftMods ?? NO_MODS;
	const tiers = ([0, 1] as Side[]).map(side => effectiveTiers(s.settings, side, mods[side].rewards)) as [Record<Band, number>, Record<Band, number>];
	const blueprints = ([0, 1] as Side[]).map(side => {
		let bp = buildBlueprint(s.settings, side, tiers[side]);
		for (const seed of teams[side]) {
			if (!bp.length) break;
			const target = BANDS.indexOf(bandOf(s.settings, side, seed));
			// drop the round whose tier is closest to the seeded player's
			let bestIdx = 0;
			bp.forEach((b, i) => {
				if (Math.abs(BANDS.indexOf(b) - target) < Math.abs(BANDS.indexOf(bp[bestIdx]) - target)) bestIdx = i;
			});
			bp = bp.filter((_, i) => i !== bestIdx);
		}
		return bp;
	}) as [Band[], Band[]];
	const targets: [number, number] = [rosterTotal(tiers[0]), rosterTotal(tiers[1])];

	// blind-bid round: a shared round after the first
	let blindRound: number | null = null;
	if (s.settings.blindBid && s.settings.style !== 'auction' && s.settings.style !== 'block' && sameSlice(s)) {
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
		favorites: favs,
		tiers,
		rewards: [mods[0].rewards, mods[1].rewards],
		powers: s.settings.powerups && s.settings.style !== 'auction' && s.settings.style !== 'block' ? dealPowers() : undefined,
	};
	// rewards are spent once the draft starts
	const base: VersusState = {
		...s,
		phase: 'draft',
		teams,
		draft,
		equalizer: null,
		trade: null,
		keeperPicks: [null, null],
		favoritePicks: [null, null],
		draftMods: NO_MODS,
		dynasty: s.dynasty ? { ...s.dynasty, keeps: [[], []] } : s.dynasty,
	};
	if (s.settings.style === 'auction' || s.settings.style === 'block') return startAuction(base);
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
	// the cutter keeps whichever card is left, so both must be ones they can take
	if (!canTake(s, cutter, a.id) || !canTake(s, cutter, b.id)) return `You can't take ${!canTake(s, cutter, a.id) ? a.lastName : b.lastName} (${ineligibleReason(s, cutter, !canTake(s, cutter, a.id) ? a.id : b.id)}) — you'd get him if he's left over.`;
	if (!canTake(s, chooser, a.id) && !canTake(s, chooser, b.id)) return `${name(chooser)} can't take either of these.`;
	const fitsC = (p: VersusPlayer) => !!fitsNeed(p, c.needs);
	const fitsK = (p: VersusPlayer) => !!fitsNeed(p, k.needs);
	if (c.must && !fitsC(a) && !fitsC(b)) return `${name(chooser)} still needs ${c.needs.join('/')} — offer at least one.`;
	// the cutter gets the leftover, so either card might come back to them
	if (k.must && !(fitsK(a) && fitsK(b))) return `You still need ${k.needs.join('/')} — both cards must fill it, since you get whichever is left.`;
	return null;
}

export function hasValidCut(s: VersusState): boolean {
	const pack = s.draft!.pack;
	for (let i = 0; i < pack.length; i++) for (let j = i + 1; j < pack.length; j++) if (!rawCutProblem(s, [pack[i], pack[j]])) return true;
	return false;
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

/** Best OVR this coach could have taken from these options */
function bestOption(s: VersusState, side: Side, options: string[]): number | undefined {
	const ovrs = options.filter(x => canTake(s, side, x)).map(x => getVersusPlayer(x)?.overall ?? 0);
	return ovrs.length ? Math.max(...ovrs) : undefined;
}

export function pick(s: VersusState, id: string): VersusState {
	const d = s.draft!;
	const side = actingSide(d);
	// Double Pick: the first of two — same coach, same pack, one fewer card
	if (d.powers?.extra === side && !d.offered.length) {
		const after = addToTeam(s, side, id, { best: bestOption(s, side, d.pack) });
		const nd = after.draft!;
		return { ...after, draft: { ...nd, pack: d.pack.filter(x => x !== id), blueprints: dropLastRound(nd.blueprints, side, d.round), powers: { ...nd.powers!, extra: null } } };
	}
	let next = addToTeam(s, side, id, { best: bestOption(s, side, d.offered.length ? d.offered : d.pack) });
	// Lockdown: the best player left in the pack is banned for this draft
	if (d.powers?.lockdown === side && d.turn === 0 && !d.solo && !d.offered.length) {
		const left = players(d.pack.filter(x => x !== id)).sort((a, b) => b.overall - a.overall)[0];
		if (left) {
			next = { ...next, bans: banOne(next, left.id), draft: { ...next.draft!, pack: next.draft!.pack.filter(x => x !== left.id), powers: { ...next.draft!.powers!, lockdown: null, last: { ...next.draft!.powers!.last!, player: left.id } } } };
			// d.pack is what the second coach sees below — keep it in step
			return pick2(next, { ...d, pack: d.pack.filter(x => x !== left.id) }, id, s);
		}
	}
	return pick2(next, d, id, s);
}

function pick2(next: VersusState, d: DraftState, id: string, s: VersusState): VersusState {
	const side = actingSide(d);

	if (d.offered.length) {
		// Cut mode: the cutter gets whatever is left on the table.
		const leftover = d.offered.find(x => x !== id)!;
		next = addToTeam(next, other(side), leftover);
		return finishRound(next);
	}

	if (d.turn === 0 && !d.solo) {
		const nd = next.draft!;
		if (isSharedRound(next, nd)) {
			const rest = d.pack.filter(x => x !== id);
			const after: VersusState = { ...next, draft: { ...nd, turn: 1, pack: rest } };
			// nothing left they're allowed to take — deal the second coach their own pack
			if (rest.some(x => canTake(after, d.order[1], x))) return after;
			return { ...after, draft: { ...after.draft!, pack: makePack(after, bandFor(nd, d.order[1]) ?? 'deep', s.settings.packSize, rest, null, d.order[1]) } };
		}
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
	let next = addToTeam({ ...s, draft: { ...d, secret } }, d.order[0], a, { blind: true, best: bestOption(s, d.order[0], d.pack) });
	next = addToTeam(next, d.order[1], b, { blind: true, best: bestOption(s, d.order[1], d.pack) });
	return finishRound(next);
}

function finishRound(s: VersusState): VersusState {
	const d = s.draft!;
	if (d.round + 1 < roundsTotal(d)) return startRound(s, d.round + 1);
	return endDraft(s);
}

/** After the last pick: equalizer if lopsided, then trades / boosts / reveal */
export function endDraft(input: VersusState): VersusState {
	// a finished draft counts down every retirement
	const s: VersusState = { ...input, retired: (input.retired ?? []).map(r => ({ ...r, left: r.left - 1 })).filter(r => r.left > 0) };
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	// a coach who earned a reward keeps the edge — no Equalizer to cancel it out
	const rewarded = !!s.draft?.rewards && (s.draft.rewards[0].length > 0 || s.draft.rewards[1].length > 0);
	if (s.settings.equalizer && !s.settings.handicap && !rewarded && Math.abs(a - b) >= EQUALIZER_GAP) {
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
	const scored = poolOf(s, side)
		.filter(p => !taken.has(p.id) && p.overall > weakest.overall && canTake(s, side, p.id))
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
	const key = `${mode}|${slots}|${money}|${s.theme?.id ?? ''}|${s.theme?.param ?? ''}|${side}`;
	const hit = valueCache.get(key);
	if (hit) return hit;
	const pool = poolOf(s, side);
	if (!pool.length) return new Map();
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
	// keepers and franchise guys cost their value, but always leave $1 per open slot
	([0, 1] as Side[]).forEach(side => {
		for (const k of s.teams[side]) {
			const price = auctionValues(s, side).get(k) ?? 1;
			const open = d.targets[side] - s.teams[side].length;
			budgets[side] = Math.max(open, budgets[side] - price);
		}
	});
	const started: VersusState = { ...s, draft: { ...d, stage: 'nominate', order: [first, other(first)], auction: { budgets, nominator: first, lot: null } } };
	if (s.settings.style !== 'block') return started;

	// Auction Block deck: one lot per roster spot in each tier, plus a few
	// spares per tier so passing is a real option. Stars come first.
	// each coach's tier slots, minus the round a keeper already used
	const slots = ([0, 1] as Side[]).map(side => {
		const t = { ...(d.tiers?.[side] ?? tiersFor(s.settings, side)) };
		for (const k of s.teams[side]) {
			const target = BANDS.indexOf(bandOf(s.settings, side, k));
			// same rule as the snake draft: drop the closest tier that has a slot
			const b = BANDS.filter(x => t[x] > 0).sort((x, y) => Math.abs(BANDS.indexOf(x) - target) - Math.abs(BANDS.indexOf(y) - target))[0];
			if (b) t[b]--;
		}
		return t;
	}) as [Record<Band, number>, Record<Band, number>];
	const deck: Band[] = [];
	for (const b of BANDS) {
		const need = slots[0][b] + slots[1][b];
		// a few spare lots per tier so passing is a real option
		const spare = need ? Math.max(1, Math.round(need * 0.35)) : 0;
		deck.push(...Array.from({ length: need + spare }, () => b));
	}
	const block: BlockState = { deck: s.settings.shuffleRounds ? shuffle(deck) : deck, queue: [], slots, lotNo: 0, opener: first, lastResult: null };
	let next: VersusState = { ...started, draft: { ...started.draft!, auction: { ...started.draft!.auction!, block } } };
	for (let i = 0; i < 4; i++) next = drawLot(next);
	return openNextLot(next);
}

// ─── auction block (random lots) ────────────────────────────────

function blockOf(s: VersusState): BlockState {
	return s.draft!.auction!.block!;
}

/** Draw one more lot onto the end of the queue */
function drawLot(s: VersusState): VersusState {
	const d = s.draft!;
	const a = d.auction!;
	const b = a.block!;
	const deck = [...b.deck];
	const band = deck.shift() ?? 'rotation';
	const exclude = [...b.queue.map(q => q.id), ...(a.lot ? [a.lot.id] : [])];
	const id = makePack(s, band, 1, exclude)[0];
	if (!id) return s;
	const lotNo = b.lotNo + b.queue.length + 1;
	// Mystery packs setting: every 4th lot goes under a sheet
	const mystery = s.settings.blind && lotNo % 4 === 0;
	return { ...s, draft: { ...d, auction: { ...a, block: { ...b, deck, queue: [...b.queue, { id, mystery, band }] } } } };
}

/** Can this coach bid on the lot on the block? (roster room + an open slot in its tier) */
export function canBid(s: VersusState, side: Side): boolean {
	const a = s.draft!.auction!;
	if (slotsLeft(s, side) <= 0) return false;
	if (a.lot && !canTake(s, side, a.lot.id)) return false;
	const band = a.lot?.band;
	if (!a.block || !band) return true;
	return a.block.slots[side][band] > 0;
}

/** Lots still coming after the one on the block */
export function lotsRemaining(s: VersusState): number {
	const b = blockOf(s);
	return b.deck.length + b.queue.length;
}

function openNextLot(s: VersusState): VersusState {
	if (slotsLeft(s, 0) <= 0 && slotsLeft(s, 1) <= 0) return endDraft(s);
	let next = s;
	for (let guard = 0; guard < 60; guard++) {
		if (blockOf(next).queue.length < 4) next = drawLot(next);
		const d = next.draft!;
		const a = d.auction!;
		const b = a.block!;
		const [head, ...rest] = b.queue;
		if (!head) return endDraft(next);
		const open: [number, number] = [b.slots[0][head.band], b.slots[1][head.band]];
		// spare lot for a tier both coaches already filled — skip it
		if (open[0] + open[1] <= 0) {
			next = { ...next, draft: { ...d, auction: { ...a, block: { ...b, queue: rest } } } };
			continue;
		}
		// openers alternate; a coach with no room in this tier sits out
		let opener = b.lotNo === 0 ? b.opener : other(b.opener);
		if (open[opener] <= 0 || slotsLeft(next, opener) <= 0) opener = other(opener);
		const lotsLeftInTier = [...b.deck, ...rest.map(q => q.band)].filter(x => x === head.band).length;
		const mustSell = open[0] + open[1] > lotsLeftInTier;
		const lot: AuctionLot = { id: head.id, bid: 0, high: null, turn: opener, passes: 0, mystery: head.mystery, mustSell, band: head.band };
		next = { ...next, draft: { ...d, stage: 'bid', order: [opener, other(opener)], turn: 0, auction: { ...a, lot, nominator: opener, block: { ...b, queue: rest, lotNo: b.lotNo + 1, opener } } } };
		return drawLot(next);
	}
	return endDraft(next);
}

/** Nobody wanted him: either he goes unsold or, if he must sell, to the coach who needs bodies most */
function noSale(s: VersusState): VersusState {
	const a = s.draft!.auction!;
	const lot = a.lot!;
	if (lot.mustSell) {
		// goes for $1 to a coach with room in this tier — the needier one first
		const b = a.block!;
		const band = lot.band!;
		const eligible = ([0, 1] as Side[]).filter(x => b.slots[x][band] > 0 && slotsLeft(s, x) > 0);
		const to: Side =
			eligible.length === 1
				? eligible[0]
				: slotsLeft(s, 0) !== slotsLeft(s, 1)
					? slotsLeft(s, 0) > slotsLeft(s, 1)
						? 0
						: 1
					: teamOvr(s.teams[0]) <= teamOvr(s.teams[1])
						? 0
						: 1;
		return award(s, to, lot.id, 1);
	}
	const b = a.block!;
	const next: VersusState = { ...s, draft: { ...s.draft!, auction: { ...a, lot: null, block: { ...b, lastResult: { id: lot.id, side: null, price: 0 } } } } };
	return openNextLot(next);
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
	return boardPool(s).filter(p => !taken.has(p.id));
}

export function nominate(s: VersusState, id: string, bid: number): VersusState {
	const d = s.draft!;
	const a = d.auction!;
	const by = a.nominator;
	const opp = other(by);
	if (!canTake(s, by, id)) return s;
	const opening = Math.max(1, Math.min(bid, maxBid(s, by)));
	// the other coach is full, broke or not allowed him — it's theirs at the opening price
	if (slotsLeft(s, opp) <= 0 || maxBid(s, opp) <= opening || !canTake(s, opp, id)) return award(s, by, id, opening);
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
	// opponent has no room (roster or tier slot) or can't go higher — sold
	if (!canBid(s, opp) || maxBid(s, opp) <= amt) return award(s, bidder, lot.id, amt);
	return { ...s, draft: { ...d, auction: { ...a, lot: { ...lot, bid: amt, high: bidder, turn: opp } } } };
}

/** The coach on the turn passes: high bidder wins the lot */
export function passBid(s: VersusState): VersusState {
	const d = s.draft!;
	const a = d.auction!;
	const lot = a.lot!;
	if (lot.high !== null) return award(s, lot.high, lot.id, lot.bid);
	// random lot with no bids yet: the other coach gets a shot, then no sale
	const opp = other(lot.turn);
	const passes = (lot.passes ?? 0) + 1;
	if (passes >= 2 || !canBid(s, opp)) return noSale(s);
	return { ...s, draft: { ...d, auction: { ...a, lot: { ...lot, turn: opp, passes } } } };
}

function award(s: VersusState, side: Side, id: string, price: number): VersusState {
	let next = addToTeam(s, side, id, { price, value: auctionValues(s, side).get(id) });
	const d = next.draft!;
	const a = d.auction!;
	const budgets: [number, number] = [...a.budgets];
	budgets[side] -= price;
	next = { ...next, draft: { ...d, auction: { ...a, budgets, lot: null } } };
	const left0 = slotsLeft(next, 0);
	const left1 = slotsLeft(next, 1);
	if (left0 <= 0 && left1 <= 0) return endDraft(next);
	if (a.block) {
		const b = a.block;
		const slots: BlockState['slots'] = [{ ...b.slots[0] }, { ...b.slots[1] }];
		const band = a.lot?.band;
		if (band) slots[side][band] = Math.max(0, slots[side][band] - 1);
		return openNextLot({ ...next, draft: { ...next.draft!, auction: { ...next.draft!.auction!, block: { ...b, slots, lastResult: { id, side, price } } } } });
	}
	// alternate nominations; a full roster sits out
	let nominator = other(a.nominator);
	if (slotsLeft(next, nominator) <= 0) nominator = other(nominator);
	return { ...next, draft: { ...next.draft!, stage: 'nominate', order: [nominator, other(nominator)], turn: 0, auction: { ...next.draft!.auction!, nominator } } };
}

// ─── keepers ────────────────────────────────────────────────────

/** Coaches who get to keep a player, in pick order (coin winner first) */
function keeperOrder(s: VersusState): Side[] {
	const first = s.coinWinner ?? 0;
	return ([first, other(first)] as Side[]).filter(side => hasKeeperRight(s, side) && s.teams[side].length > 0);
}

export function chooseKeeper(s: VersusState, id: string | null): VersusState {
	const picks: [string | null, string | null] = [...s.keeperPicks];
	picks[s.keeperTurn] = id;
	const order = keeperOrder(s);
	const next = order[order.indexOf(s.keeperTurn) + 1];
	if (next !== undefined) return { ...s, keeperPicks: picks, keeperTurn: next };
	return beginDraft({ ...s, keeperPicks: picks, pre: { ...s.pre, keepers: true } });
}

// ─── pre-draft: theme → keepers → favorites ─────────────────────

/** Players a coach could grab in the Favorites round right now */
export function availableFavorites(s: VersusState, side: Side): string[] {
	const pool = new Set(poolOf(s, side).map(p => p.id));
	const blocked = new Set([...s.keeperPicks, ...s.favoritePicks].filter(Boolean) as string[]);
	return (s.settings.favorites?.[side] ?? []).filter(id => pool.has(id) && !blocked.has(id) && !s.retired?.some(r => r.id === id && r.side === side && r.left > 0));
}

function favoriteOrder(s: VersusState): Side[] {
	if (!s.settings.favoritesRound) return [];
	const first = s.coinWinner ?? 0;
	return ([first, other(first)] as Side[]).filter(side => availableFavorites(s, side).length > 0);
}

export function chooseFavorite(s: VersusState, id: string | null): VersusState {
	const picks: [string | null, string | null] = [...s.favoritePicks];
	picks[s.favoriteTurn] = id;
	const next = { ...s, favoritePicks: picks };
	// the second coach goes only if they still have someone available
	const later = favoriteOrder(next).filter(side => side !== s.favoriteTurn && next.favoritePicks[side] === null);
	const first = s.coinWinner ?? 0;
	if (s.favoriteTurn === first && later.length) return { ...next, favoriteTurn: later[0] };
	return beginDraft({ ...next, pre: { ...next.pre, favorites: true } });
}

/** Rough roster size per coach for the upcoming draft (rewards included) */
function upcomingSize(s: VersusState, side: Side): number {
	return rosterTotal(effectiveTiers(s.settings, side, (s.draftMods ?? NO_MODS)[side].rewards));
}

/** Can this theme fill both rosters with this pool, style and roster size? */
export function themeFits(s: VersusState, theme: Theme, param?: string): boolean {
	if (theme.split && (s.settings.style === 'auction' || s.settings.style === 'block' || s.settings.pool === 'erawars')) return false;
	// every pack comes from one franchise — the rule would lock you out after round 1
	if (theme.onePerFranchise && s.settings.style === 'franchise') return false;
	const t: VersusState = { ...s, theme: { id: theme.id, param } };
	const sizes: [number, number] = [upcomingSize(s, 0), upcomingSize(s, 1)];
	if (sameSlice(t)) return poolOf(t, 0).length >= (sizes[0] + sizes[1]) * 1.6;
	return ([0, 1] as Side[]).every(side => poolOf(t, side).length >= sizes[side] * 2);
}

/** Division Night can run if any one division has enough players */
export function divisionThemeFits(s: VersusState): boolean {
	const theme = getTheme('division');
	return !!theme && DIVISIONS.some(d => themeFits(s, theme, d));
}

/** Themes that can land on the wheel right now */
export function themeOptions(s: VersusState): Theme[] {
	return THEMES.filter(theme => {
		if (theme.id === 'division') return DIVISIONS.some(d => themeFits(s, theme, d));
		if (theme.id === 'eastWest') return themeFits(s, theme, 'Eastern');
		return themeFits(s, theme);
	});
}

/** Roll the theme's detail (which division / which conference) — only ones that fit */
export function pickThemeParam(s: VersusState, id: ThemeId): string | undefined {
	const theme = getTheme(id);
	if (theme?.id === 'division') {
		const ok = DIVISIONS.filter(d => themeFits(s, theme, d));
		return ok[Math.floor(Math.random() * ok.length)];
	}
	return rollThemeParam(id);
}

/** Lock in the theme for this draft and continue the pre-draft steps */
export function setTheme(s: VersusState, id: ThemeId | null, param?: string): VersusState {
	let active: ActiveTheme | null = null;
	const theme = getTheme(id);
	if (theme) active = { id: theme.id, param: param ?? pickThemeParam(s, theme.id) };
	return beginDraft({ ...s, theme: active, pre: { ...s.pre, theme: true } });
}

/**
 * Walk the pre-draft steps that apply — theme wheel, keepers, favorites —
 * then start the draft. Every step calls back in here when it's done.
 */
export function beginDraft(input: VersusState): VersusState {
	let s: VersusState = { ...input, pre: input.pre ?? PRE_NONE, draft: null };
	if (!s.pre.theme) s = { ...s, settings: seasonMixSettings(s.settings) };
	if (!s.pre.theme) {
		const mode = s.settings.theme ?? 'off';
		if (mode === 'spin' && themeOptions(s).length) return { ...s, phase: 'theme' };
		const fixed = mode !== 'off' && mode !== 'spin' ? getTheme(mode) : undefined;
		if (fixed && themeOptions(s).some(t => t.id === fixed.id)) return setTheme(s, fixed.id);
		s = { ...s, theme: null, pre: { ...s.pre, theme: true } };
	}
	if (!s.pre.keepers) {
		const order = keeperOrder(s);
		if (order.length) return { ...s, phase: 'keepers', keeperPicks: [null, null], keeperTurn: order[0] };
		s = { ...s, keeperPicks: [null, null], pre: { ...s.pre, keepers: true } };
	}
	if (!s.pre.favorites) {
		const order = favoriteOrder(s);
		if (order.length) return { ...s, phase: 'favorites', favoritePicks: [null, null], favoriteTurn: order[0] };
		s = { ...s, favoritePicks: [null, null], pre: { ...s.pre, favorites: true } };
	}
	if (!s.pre.bans) {
		if (s.settings.bans > 0 && boardPool(s).length > 30) {
			const first = s.coinWinner ?? 0;
			return { ...s, phase: 'bans', bans: { picks: [null, null], turn: first, list: [], revealed: false } };
		}
		s = { ...s, bans: undefined, pre: { ...s.pre, bans: true } };
	}
	if (!s.pre.board) {
		if (s.settings.bigBoard) return { ...s, phase: 'board', board: { picks: [null, null], turn: s.coinWinner ?? 0 } };
		s = { ...s, board: undefined, pre: { ...s.pre, board: true } };
	}
	return startDraft(s, s.keeperPicks, s.favoritePicks);
}

/** Draft styles a season rotates through (Auction Block needs one shared pool) */
export const MIX_STYLES: DraftStyle[] = ['snake', 'franchise', 'cut', 'block'];

/** This draft's style under Season variety (null = the coaches' own style) */
export function mixStyleFor(settings: Settings, g: number): DraftStyle {
	const styles = MIX_STYLES.filter(x => !(x === 'block' && settings.pool === 'erawars'));
	return styles[(g - 1) % styles.length];
}

/**
 * Season variety: regular-season games walk through the draft styles and
 * spin a theme; the Finals (and seasons off) restore the coaches' own picks.
 */
export function seasonMixSettings(settings: Settings): Settings {
	const base = settings.mixBase ?? { style: settings.style, theme: settings.theme };
	const tag = settings.seasonMix && settings.season && !settings.league ? nextSeasonTag(history(), settings) : null;
	if (tag?.stage === 'regular') return { ...settings, mixBase: base, style: mixStyleFor(settings, tag.g), theme: base.theme === 'off' ? 'spin' : base.theme };
	if (!settings.mixBase) return settings;
	return { ...settings, style: base.style, theme: base.theme, mixBase: null };
}

/** Fresh pre-draft state — call before beginDraft for every new draft */
export function freshPreDraft(s: VersusState): VersusState {
	return { ...s, pre: PRE_NONE, keeperPicks: [null, null], favoritePicks: [null, null], theme: null, bans: undefined, board: undefined };
}

// ─── ban phase ──────────────────────────────────────────────────

/** Players a coach may ban right now: anyone draftable who isn't already on a roster */
export function banCandidates(s: VersusState): VersusPlayer[] {
	const taken = new Set([...s.teams[0], ...s.teams[1], ...s.keeperPicks, ...s.favoritePicks].filter(Boolean) as string[]);
	return boardPool(s).filter(p => !taken.has(p.id));
}

/** A coach locks in their bans. Once both have, they're revealed together. */
export function submitBans(s: VersusState, side: Side, ids: string[]): VersusState {
	const b = s.bans ?? { picks: [null, null], turn: side, list: [], revealed: false };
	const picks: [string[] | null, string[] | null] = [...b.picks];
	picks[side] = ids.slice(0, s.settings.bans);
	if (picks[0] && picks[1]) return { ...s, bans: { ...b, picks, list: [...new Set([...picks[0], ...picks[1]])], revealed: true } };
	return { ...s, bans: { ...b, picks, turn: other(side) } };
}

/** After the reveal: on with the pre-draft */
export function afterBans(s: VersusState): VersusState {
	return beginDraft({ ...s, pre: { ...s.pre, bans: true } });
}

function banOne(s: VersusState, id: string): BanState {
	const b = s.bans ?? { picks: [[], []], turn: 0, list: [], revealed: true };
	return { ...b, list: [...new Set([...b.list, id])] };
}

// ─── scouting report (secret big board) ─────────────────────────

export function submitReads(s: VersusState, side: Side, reads: Reads): VersusState {
	const b = s.board ?? { picks: [null, null], turn: side };
	const picks: [Reads | null, Reads | null] = [...b.picks];
	picks[side] = reads;
	if (picks[0] && picks[1]) return beginDraft({ ...s, board: { ...b, picks }, pre: { ...s.pre, board: true } });
	return { ...s, board: { picks, turn: other(side) } };
}

/** What actually happened, for each coach's reads about the OTHER coach */
export function readTruth(s: VersusState, about: Side): Reads | null {
	const d = s.draft;
	const first = d?.log.find(e => e.side === about && !e.vetoed);
	const p = first ? getVersusPlayer(first.id) : null;
	if (!p) return null;
	const a = teamOvr(s.teams[0]);
	const b = teamOvr(s.teams[1]);
	const guards = players(s.teams[about]).filter(x => x.position === 'PG' || x.position === 'SG').length;
	return { pos: p.position, higher: a === b ? about : a > b ? 0 : 1, guards: guards <= 1 ? '0-1' : guards === 2 ? '2' : '3+' };
}

/** Points each coach scored reading the other (0–3), or null if the board wasn't used */
export function scoreReads(s: VersusState): [number, number] | null {
	const picks = s.board?.picks;
	if (!picks?.[0] || !picks[1] || !s.draft) return null;
	const score = (side: Side): number => {
		const r = picks[side]!;
		const t = readTruth(s, other(side));
		if (!t) return 0;
		return (r.pos === t.pos ? 1 : 0) + (r.higher === t.higher ? 1 : 0) + (r.guards === t.guards ? 1 : 0);
	};
	return [score(0), score(1)];
}

// ─── power-up cards ─────────────────────────────────────────────

function dealPowers(): PowerState {
	const deal = () => POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)];
	return { hand: [deal(), deal()], used: [null, null], last: null, extra: null, split: false, lockdown: null };
}

/** Give up this coach's last remaining round after the current one (Double Pick) */
function dropLastRound(bps: [Band[], Band[]], side: Side, round: number): [Band[], Band[]] {
	const next: [Band[], Band[]] = [[...bps[0]], [...bps[1]]];
	const mine = next[side];
	for (let j = mine.length - 1; j > round; j--) {
		if (mine[j]) {
			mine[j] = undefined as unknown as Band;
			break;
		}
	}
	while (mine.length && !mine[mine.length - 1]) mine.pop();
	return next;
}

/** Why this coach can't play their card right now (null = they can) */
export function powerBlocked(s: VersusState, side: Side): string | null {
	const d = s.draft;
	const pw = d?.powers;
	const id = pw?.hand[side];
	if (!d || !pw || !id || s.phase !== 'draft') return 'No card';
	if (pw.used[side]) return 'Already played';
	if (d.stage !== 'pick' || actingSide(d) !== side || pw.extra !== null) return 'Play it on your pick';
	if (d.offered.length && id !== 'veto') return 'Not on a cut pick';
	if (id === 'double') {
		if (d.pack.filter(x => canTake(s, side, x)).length < 2) return 'Needs two players you can take';
		if (!d.blueprints[side].some((b, j) => j > d.round && !!b)) return 'No later round to give up';
	}
	if (id === 'jump' && bandFor(d, side) === 'superstar') return 'Already the top tier';
	if (id === 'lockdown' && !(d.turn === 0 && isSharedRound(s, d))) return 'Only when you pick first from a shared pack';
	if (id === 'veto') {
		const lp = d.lastPick;
		if (!lp || lp.side === side || lp.blind || lp.vetoed || !s.teams[lp.side].includes(lp.id)) return 'Only right after your rival picks';
		if (d.log[d.log.length - 1] !== lp) return 'Only right after your rival picks';
	}
	return null;
}

/** Play the acting coach's card. Everyone sees the reveal. */
export function playPower(s: VersusState, side: Side): VersusState {
	if (powerBlocked(s, side)) return s;
	const d = s.draft!;
	const pw = d.powers!;
	const id = pw.hand[side]!;
	const used: [PowerId | null, PowerId | null] = [...pw.used];
	used[side] = id;
	let powers: PowerState = { ...pw, used, last: { side, id, n: (pw.last?.n ?? 0) + 1 } };
	let next: VersusState = { ...s, draft: { ...d, powers } };
	const band = bandFor(d, side) ?? 'deep';
	if (id === 'double') powers = { ...powers, extra: side };
	if (id === 'lockdown') powers = { ...powers, lockdown: side };
	if (id === 'jump' || id === 'scout') {
		powers = { ...powers, split: true };
		next = { ...next, draft: { ...next.draft!, powers } };
		const up = BANDS[Math.max(0, BANDS.indexOf(band) - 1)];
		const pack =
			id === 'jump'
				? // the higher tier's pack, never worse than the one it replaces
					players([...new Set([...makePack(next, up, s.settings.packSize, [], null, side), ...d.pack])])
						.filter(p => canTake(next, side, p.id))
						.sort((x, y) => y.overall - x.overall)
						.slice(0, s.settings.packSize)
						.map(p => p.id)
				: [...d.pack, ...makePack(next, band, 3, d.pack, d.franchise, side)].filter((x, i, a) => a.indexOf(x) === i);
		return { ...next, draft: { ...next.draft!, pack, powers } };
	}
	if (id === 'veto') {
		const lp = d.lastPick!;
		const opp = lp.side;
		const teams: [string[], string[]] = [[...s.teams[0]], [...s.teams[1]]];
		teams[opp] = teams[opp].filter(x => x !== lp.id);
		const vetoed: LogEntry = { ...lp, vetoed: true };
		const log = d.log.map(e => (e === lp ? vetoed : e));
		const blueprints: [Band[], Band[]] = [[...d.blueprints[0]], [...d.blueprints[1]]];
		// the make-up pick comes in a round after this one
		while (blueprints[opp].length <= d.round) blueprints[opp].push(undefined as unknown as Band);
		blueprints[opp].push(d.blueprints[opp][lp.round] ?? band);
		powers = { ...powers, last: { ...powers.last!, player: lp.id } };
		return { ...next, teams, bans: banOne(next, lp.id), draft: { ...d, log, lastPick: vetoed, blueprints, powers } };
	}
	return { ...next, draft: { ...next.draft!, powers } };
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

export function toBoosts(input: VersusState): VersusState {
	// a fresh draft gets graded once its rosters are final (after trades)
	const s = input.draft ? { ...input, grades: draftGrades(input) } : input;
	const queue = s.boostQueue.length ? s.boostQueue : [];
	if (queue.length) return { ...s, phase: 'boosts', boostOptions: rollBoostOptions(s, queue[0]) };
	return { ...s, phase: 'reveal' };
}

/**
 * Called when a new game starts. Redraft: rewards shape the next draft.
 * Running it back: extra-player rewards sign a free agent of that tier,
 * everything else upgrades your weakest player.
 */
export function distributeBoosts(s: VersusState, redraft: boolean): VersusState {
	const queue: QueuedBoost[] = [];
	const mods: [DraftMods, DraftMods] = [{ rewards: [] }, { rewards: [] }];
	([0, 1] as Side[]).forEach(side => {
		for (const b of s.earned[side]) {
			const boost = BOOSTS[b];
			if (!boost) continue; // reward from an older version
			if (redraft) mods[side].rewards.push(b);
			else if (boost.mod.extra) queue.push({ side, boost: 'sign', band: boost.mod.extra, from: b });
			else queue.push({ side, boost: 'upgrade', from: b });
		}
	});
	return { ...s, boostQueue: queue, honor: [[], []], firstPickBoost: null, extraRerolls: [0, 0], earned: [[], []], draftMods: mods };
}

export function rollBoostOptions(s: VersusState, q: QueuedBoost): string[] {
	const taken = draftedSet(s);
	const pool = poolOf(s, q.side).filter(p => !taken.has(p.id) && canTake(s, q.side, p.id));
	if (q.boost === 'sign') {
		// 3 free agents from that tier
		const band = q.band ?? 'rotation';
		const ids = new Set(bandSlice(poolOf(s, q.side), band).map(p => p.id));
		const inBand = pool.filter(p => ids.has(p.id));
		return shuffle(inBand.length >= 3 ? inBand : pool.slice(0, 12))
			.slice(0, 3)
			.sort((a, b) => b.overall - a.overall)
			.map(p => p.id);
	}
	// upgrade: 3 undrafted players better than your weakest, modest jump
	const weakest = players(s.teams[q.side]).sort((a, b) => a.overall - b.overall)[0];
	if (!weakest) return [];
	const better = pool.filter(p => p.overall > weakest.overall);
	const close = better.filter(p => p.overall <= weakest.overall + 8);
	return shuffle(close.length >= 3 ? close : better)
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
		if (head.boost === 'sign') {
			teams[head.side].push(id);
		} else {
			const weakest = players(teams[head.side]).sort((a, b) => a.overall - b.overall)[0].id;
			teams[head.side] = teams[head.side].map(x => (x === weakest ? id : x));
		}
	}
	const next = { ...s, teams, boostQueue: rest };
	if (rest.length) return { ...next, boostOptions: rollBoostOptions(next, rest[0]) };
	return { ...next, phase: 'reveal', boostOptions: null };
}

// ─── series ─────────────────────────────────────────────────────

export function recordGame(s: VersusState, result: Omit<GameResult, 'game' | 'teamOvr' | 'quarter'>): VersusState {
	const earned: [BoostId[], BoostId[]] = [[], []];
	([0, 1] as Side[]).forEach(side => {
		const reward = s.gameday.rewards[side];
		if (result.challenges[side] && reward) earned[side].push(reward);
	});
	// Vegas: an underdog who covers the spread earns a Tier Up for the next draft
	const line = s.settings.vegas ? vegasLine(s, history()) : null;
	const covered = coveredBy(line, result.score);
	if (covered !== null) earned[covered].push('tierUp');
	// Predictions: the closer guess earns +1 Rotation player
	const preds = s.gameday.predictions ?? null;
	const oracle = predictionWinner(preds, result.winner, result.score);
	if (oracle !== null) earned[oracle].push('extraRotation');
	const game: GameResult = {
		...result,
		game: s.gameNo,
		quarter: s.gameday.quarter,
		teamOvr: [teamOvr(s.teams[0]), teamOvr(s.teams[1])],
		rosters: [[...s.teams[0]], [...s.teams[1]]],
		sabotage: s.sabotage?.id ?? null,
		sabotageOn: s.sabotage && s.sabotage.id !== 'mercy' ? s.sabotage.on : null,
		potg: result.potg ?? [],
		theme: s.theme,
		twist: s.gameday.modifier,
		halftime: s.gameday.halftime ?? null,
		line,
		covered,
		grades: s.grades,
		// league games count for the league, not the head-to-head season
		season: s.settings.league ? null : nextSeasonTag(history(), s.settings),
		predictions: preds,
		oracle,
		league: s.settings.league ?? null,
		playedAt: Date.now(),
		draft: s.draft ? s.draft.log.filter(e => !e.vetoed).map(e => [e.side, e.id] as [Side, string]) : null,
		reads: scoreReads(s),
		stakes: s.gameday.stakes ?? null,
		powers: s.draft?.powers ? s.draft.powers.used : null,
	};
	// Retire rule: players who just won you a game sit out your next drafts
	const retired = [...(s.retired ?? [])];
	const w = result.winner;
	const toRetire =
		s.settings.retire === 'potg'
			? (result.potg ?? []).filter(id => s.teams[w].includes(id))
			: s.settings.retire === 'starters'
				? bestLineup(s.teams[w]).starters.map(x => x.player?.id).filter((x): x is string => !!x)
				: [];
	for (const id of toRetire) {
		const i = retired.findIndex(r => r.id === id && r.side === w);
		if (i >= 0) retired[i] = { ...retired[i], left: RETIRE_DRAFTS };
		else retired.push({ id, side: w, left: RETIRE_DRAFTS });
	}
	return { ...s, series: [...s.series, game], earned, retired, phase: 'postgame', pendingSabotage: null, punishment: null };
}

/** The loser's punishment, once their wheel lands */
export function setPunishment(s: VersusState, id: string): VersusState {
	const last = s.series[s.series.length - 1];
	if (!last) return s;
	return { ...s, punishment: { side: other(last.winner), id, game: last.game } };
}

export function setSabotage(s: VersusState, id: string): VersusState {
	const last = s.series[s.series.length - 1];
	if (!last) return s;
	return { ...s, pendingSabotage: { by: other(last.winner), on: last.winner, id } };
}

export function nextGame(s: VersusState, redraft: boolean): VersusState {
	// Dynasty: a new season always opens with the lottery and a fresh draft
	if (dynastyOpener(s)) {
		const opener = distributeBoosts({ ...s, gameNo: s.gameNo + 1, gameday: EMPTY_GAMEDAY, sabotage: s.pendingSabotage, pendingSabotage: null }, true);
		return { ...opener, phase: 'lottery', draft: null };
	}
	const base = distributeBoosts({ ...s, gameNo: s.gameNo + 1, gameday: EMPTY_GAMEDAY, sabotage: s.pendingSabotage, pendingSabotage: null }, redraft);
	if (redraft) {
		// loser of the last game gets the coin flip win
		const last = s.series[s.series.length - 1];
		let coinWinner: Side = last ? other(last.winner) : (s.coinWinner ?? 0);
		// Finals: the higher seed has home court and picks first
		const seed = homeCourt(s);
		if (seed !== null) coinWinner = seed;
		return beginDraft(freshPreDraft({ ...base, coinWinner }));
	}
	return toBoosts({ ...base, draft: null });
}

/**
 * Whose prediction was closer. Both scores entered: distance between the
 * predicted and actual margin (calling the wrong winner counts as the
 * gap across zero). No scores: whoever alone called the winner.
 */
export function predictionWinner(preds: [Prediction | null, Prediction | null] | null | undefined, winner: Side, score: [number | null, number | null]): Side | null {
	if (!preds?.[0] || !preds[1]) return null;
	const signed = (p: Prediction) => (p.winner === 0 ? p.margin : -p.margin);
	if (score[0] !== null && score[1] !== null) {
		const actual = score[0] - score[1];
		const e0 = Math.abs(signed(preds[0]) - actual);
		const e1 = Math.abs(signed(preds[1]) - actual);
		return e0 === e1 ? null : e0 < e1 ? 0 : 1;
	}
	const ok0 = preds[0].winner === winner;
	const ok1 = preds[1].winner === winner;
	return ok0 === ok1 ? null : ok0 ? 0 : 1;
}

// ─── dynasty ────────────────────────────────────────────────────

/** Dynasty and the next game opens a new season (after a finished one) */
export function dynastyOpener(s: VersusState): boolean {
	if (!s.settings.dynasty || !s.settings.season) return false;
	const tag = nextSeasonTag(history(), s.settings);
	return !!tag && tag.stage === 'regular' && tag.g === 1 && tag.n > 1 && s.dynasty?.lottery?.season !== tag.n;
}

/** Last season's regular-season record decides the lottery balls: worse record 3, better 1 */
export function lotteryBalls(s: VersusState): [number, number] {
	const tag = nextSeasonTag(history(), s.settings);
	const prev = tag ? seasonsOf(history()).find(x => x.n === tag.n - 1) : undefined;
	if (!prev || prev.regular[0] === prev.regular[1]) return [2, 2];
	return prev.regular[0] < prev.regular[1] ? [3, 1] : [1, 3];
}

/** Draw the lottery (call from an event handler): the winner picks first all draft */
export function runLottery(s: VersusState): VersusState {
	const balls = lotteryBalls(s);
	const winner: Side = Math.random() * (balls[0] + balls[1]) < balls[0] ? 0 : 1;
	const season = nextSeasonTag(history(), s.settings)?.n ?? 0;
	const dynasty: DynastyState = { ...(s.dynasty ?? NO_DYNASTY), lottery: { balls, winner, season }, keeps: [[], []], turn: winner };
	return { ...s, coinWinner: winner, dynasty };
}

/** After the lottery: keepers if there's a roster to keep from, else straight to the draft */
export function afterLottery(s: VersusState): VersusState {
	if (s.teams[0].length || s.teams[1].length) return { ...s, phase: 'dynasty', dynasty: { ...(s.dynasty ?? NO_DYNASTY), turn: s.coinWinner ?? 0 } };
	return beginDraft(freshPreDraft(s));
}

/** One coach's keepers (up to DYNASTY_KEEPS from their last roster) */
export function chooseDynastyKeeps(s: VersusState, ids: string[]): VersusState {
	const d = s.dynasty ?? NO_DYNASTY;
	const keeps: [string[], string[]] = [[...d.keeps[0]], [...d.keeps[1]]];
	keeps[d.turn] = ids.filter(id => s.teams[d.turn].includes(id)).slice(0, DYNASTY_KEEPS);
	const first = s.coinWinner ?? 0;
	if (d.turn === first) return { ...s, dynasty: { ...d, keeps, turn: other(first) } };
	return beginDraft(freshPreDraft({ ...s, dynasty: { ...d, keeps } }));
}

/** The mid-season trade deadline is open after this game */
export function deadlineOpen(s: VersusState): boolean {
	if (!s.settings.dynasty) return false;
	const last = s.series[s.series.length - 1]?.season;
	return !!last && last.stage === 'regular' && last.g === Math.floor(last.len / 2) && (s.dynasty?.deadline ?? 0) !== last.n;
}

/** Run it back, but open a trade window first (one per season) */
export function tradeDeadline(s: VersusState): VersusState {
	const season = s.series[s.series.length - 1]?.season?.n ?? 0;
	const base = nextGame(s, false);
	const t: TradeState = { turn: other(s.series[s.series.length - 1]?.winner ?? 0), done: [false, false], proposal: null, history: [] };
	return { ...base, phase: 'trade', trade: t, dynasty: { ...(s.dynasty ?? NO_DYNASTY), deadline: season } };
}

/** In the Finals, the higher seed — otherwise null */
export function homeCourt(s: VersusState): Side | null {
	const tag = nextSeasonTag(history(), s.settings);
	if (tag?.stage !== 'finals') return null;
	return currentSeason(history(), tag)?.seed ?? null;
}

export function seriesScore(s: VersusState): [number, number] {
	return [s.series.filter(g => g.winner === 0).length, s.series.filter(g => g.winner === 1).length];
}
