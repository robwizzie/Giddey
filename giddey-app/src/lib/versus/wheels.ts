// ═══════════════════════════════════════════════════════════════
//  GAME DAY WHEELS — quarter length, rule twists, challenges, boosts
// ═══════════════════════════════════════════════════════════════

export interface WheelSegment {
	id: string;
	label: string;
	sub?: string;
	color: string;
	weight: number;
}

/** Pick a segment index by weight. Done before the wheel animates. */
export function weightedIndex(segments: { weight: number }[]): number {
	const total = segments.reduce((s, x) => s + x.weight, 0);
	let r = Math.random() * total;
	for (let i = 0; i < segments.length; i++) {
		r -= segments[i].weight;
		if (r <= 0) return i;
	}
	return segments.length - 1;
}

// Short enough to run back, long enough for a comeback.
export const QUARTER_SEGMENTS: WheelSegment[] = [
	{ id: '2', label: '2 MIN', sub: 'Sprint', color: '#f97316', weight: 2 },
	{ id: '3', label: '3 MIN', sub: 'Quick', color: '#3b82f6', weight: 3 },
	{ id: '4', label: '4 MIN', sub: 'Standard', color: '#a855f7', weight: 3 },
	{ id: '5', label: '5 MIN', sub: 'Long', color: '#ef4444', weight: 2 },
	{ id: '3b', label: '3 MIN', sub: 'Quick', color: '#06b6d4', weight: 3 },
	{ id: '4b', label: '4 MIN', sub: 'Standard', color: '#22c55e', weight: 3 },
];

export function quarterMinutes(segId: string): number {
	return parseInt(segId, 10);
}

export interface Twist {
	id: string;
	label: string;
	desc: string;
	color: string;
	weight: number;
}

export const TWISTS: Twist[] = [
	{ id: 'straight', label: 'Straight Up', desc: 'Default rules. No excuses.', color: '#64748b', weight: 4 },
	{ id: 'hof', label: 'Hall of Fame', desc: 'Set difficulty to Hall of Fame for both sides.', color: '#eab308', weight: 2 },
	{ id: 'nofatigue', label: 'Fatigue Off', desc: 'Turn fatigue off — ride your stars all game.', color: '#22c55e', weight: 2 },
	{ id: 'notimeouts', label: 'No Timeouts', desc: 'Neither coach may call a timeout. Play through it.', color: '#ef4444', weight: 2 },
	{ id: 'benchmob', label: 'Bench Mob Q2', desc: 'Both teams play the 2nd quarter with bench-only lineups (5-man rosters: lowest-rated 3 must be on the floor).', color: '#3b82f6', weight: 1 },
	{ id: 'starsit', label: 'Late Arrivals', desc: 'Both teams’ highest-rated player sits the 1st quarter.', color: '#a855f7', weight: 1 },
	{ id: 'clutch', label: 'Clutch Rule', desc: 'Every made shot in the final minute of Q4 must come from your lowest-rated starter or it doesn’t count.', color: '#ec4899', weight: 1 },
];

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Challenge {
	id: string;
	title: string;
	desc: string;
	difficulty: Difficulty;
	/** needs a bench (roster > 5) */
	needsBench?: boolean;
}

export const CHALLENGES: Challenge[] = [
	{ id: 'poster', title: 'Posterized', desc: 'Throw down a contact dunk on a defender.', difficulty: 'easy' },
	{ id: 'oop', title: 'Lob City', desc: 'Finish 2 alley-oops.', difficulty: 'easy' },
	{ id: 'glass', title: 'Glass Cleaner', desc: 'Win the rebounding battle.', difficulty: 'easy' },
	{ id: 'firstq', title: 'Fast Start', desc: 'Lead after the 1st quarter.', difficulty: 'easy' },
	{ id: 'dimes', title: 'Ball Movement', desc: 'Finish with more assists than your opponent.', difficulty: 'easy' },
	{ id: 'fastbreak', title: 'Run and Gun', desc: 'Score 2 fast-break buckets.', difficulty: 'easy' },
	{ id: 'splash', title: 'Heat Check', desc: 'Hit 3 three-pointers in a row (no misses from three in between).', difficulty: 'medium' },
	{ id: 'pickpocket', title: 'Pickpocket', desc: 'Record 4+ steals.', difficulty: 'medium' },
	{ id: 'block', title: 'Block Party', desc: 'Record 3+ blocks.', difficulty: 'medium' },
	{ id: 'clean', title: 'Clean Hands', desc: 'Commit fewer turnovers than your opponent.', difficulty: 'medium' },
	{ id: 'bigrange', title: 'Stretch Big', desc: 'Your starting center hits a three.', difficulty: 'medium' },
	{ id: 'star', title: 'Star Power', desc: 'Your highest-rated player is the game’s top scorer.', difficulty: 'medium' },
	{ id: 'andone', title: 'And-One', desc: 'Convert 2 and-ones (make the bucket and the free throw).', difficulty: 'medium' },
	{ id: 'bench', title: 'Bench Mob', desc: 'Your bench outscores their bench.', difficulty: 'medium', needsBench: true },
	{ id: 'freeze', title: 'Ice Water', desc: 'Go perfect from the line (minimum 3 attempts).', difficulty: 'medium' },
	{ id: 'quarter10', title: 'Statement Quarter', desc: 'Win any single quarter by 6+.', difficulty: 'medium' },
	{ id: 'underdog', title: 'Underdog Hero', desc: 'Your lowest-rated player scores 6+.', difficulty: 'hard' },
	{ id: 'wire', title: 'Wire to Wire', desc: 'Lead at the end of every quarter.', difficulty: 'hard' },
	{ id: 'buzzer', title: 'Buzzer Beater', desc: 'Score as the clock hits 0:00 in any quarter.', difficulty: 'hard' },
	{ id: 'blowout', title: 'No Mercy', desc: 'Lead by 12+ at any point.', difficulty: 'hard' },
	{ id: 'comeback', title: 'Comeback Kid', desc: 'Win after trailing by 6+.', difficulty: 'hard' },
	{ id: 'ankles', title: 'Ankle Breaker', desc: 'Drop a defender with a dribble move.', difficulty: 'hard' },
];

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; color: string; weight: number }> = {
	easy: { label: 'Easy', color: '#22c55e', weight: 3 },
	medium: { label: 'Medium', color: '#eab308', weight: 5 },
	hard: { label: 'Hard', color: '#ef4444', weight: 2 },
};

// ─── challenge rewards — they shape your NEXT draft ─────────────

export type BoostId = 'keeper' | 'tierUp' | 'tierUp2' | 'guarStar' | 'guarSuperstar' | 'extraRotation' | 'extraStarter' | 'extraStar' | 'extraSuperstar';
type BandName = 'superstar' | 'star' | 'starter' | 'rotation' | 'deep';

export interface Boost {
	id: BoostId;
	label: string;
	icon: string;
	desc: string;
	/** what it turns into if you run it back with the same squads */
	runBack: string;
	mod: { keeper?: boolean; tierUps?: number; guarantee?: BandName; extra?: BandName };
}

export const BOOSTS: Record<BoostId, Boost> = {
	keeper: { id: 'keeper', label: 'Keeper', icon: '🔒', desc: 'Keep one player from this team for the next draft.', runBack: 'Upgrade your weakest player', mod: { keeper: true } },
	tierUp: { id: 'tierUp', label: 'Tier Up', icon: '⬆️', desc: 'Your lowest-tier pick next draft moves up one tier.', runBack: 'Upgrade your weakest player', mod: { tierUps: 1 } },
	tierUp2: { id: 'tierUp2', label: 'Double Tier Up', icon: '⏫', desc: 'Two of your lowest-tier picks next draft move up a tier.', runBack: 'Upgrade your weakest player', mod: { tierUps: 2 } },
	guarStar: { id: 'guarStar', label: 'Guaranteed All-Star', icon: '🎯', desc: 'Your lowest pick next draft becomes an All-Star pick.', runBack: 'Upgrade your weakest player', mod: { guarantee: 'star' } },
	guarSuperstar: { id: 'guarSuperstar', label: 'Guaranteed Superstar', icon: '💎', desc: 'Your lowest pick next draft becomes a Superstar pick.', runBack: 'Upgrade your weakest player', mod: { guarantee: 'superstar' } },
	extraRotation: { id: 'extraRotation', label: '+1 Rotation Player', icon: '➕', desc: 'An extra Rotation-tier pick next draft.', runBack: 'Sign a Rotation-tier free agent', mod: { extra: 'rotation' } },
	extraStarter: { id: 'extraStarter', label: '+1 Starter', icon: '➕', desc: 'An extra Starter-tier pick next draft.', runBack: 'Sign a Starter-tier free agent', mod: { extra: 'starter' } },
	extraStar: { id: 'extraStar', label: '+1 All-Star', icon: '🌟', desc: 'An extra All-Star pick next draft.', runBack: 'Sign an All-Star free agent', mod: { extra: 'star' } },
	extraSuperstar: { id: 'extraSuperstar', label: '+1 Superstar', icon: '👑', desc: 'An extra Superstar pick next draft.', runBack: 'Sign a Superstar free agent', mod: { extra: 'superstar' } },
};

export const REWARDS_BY_DIFFICULTY: Record<Difficulty, BoostId[]> = {
	easy: ['keeper', 'tierUp', 'extraRotation'],
	medium: ['tierUp2', 'guarStar', 'extraStarter'],
	hard: ['guarSuperstar', 'extraStar', 'extraSuperstar'],
};

export function getBoost(id: string | null | undefined): Boost | undefined {
	return id ? BOOSTS[id as BoostId] : undefined;
}

export function rollReward(difficulty: Difficulty): BoostId {
	const options = REWARDS_BY_DIFFICULTY[difficulty];
	return options[Math.floor(Math.random() * options.length)];
}

export function challengeSegments(rosterSize: number, difficulty?: Difficulty): (WheelSegment & { challenge: Challenge })[] {
	return CHALLENGES.filter(c => !(c.needsBench && rosterSize <= 5) && (!difficulty || c.difficulty === difficulty)).map(c => ({
		id: c.id,
		label: c.title,
		color: DIFFICULTY_INFO[c.difficulty].color,
		weight: DIFFICULTY_INFO[c.difficulty].weight,
		challenge: c,
	}));
}

export function getChallenge(id: string | null): Challenge | undefined {
	return CHALLENGES.find(c => c.id === id);
}

export function getTwist(id: string | null): Twist | undefined {
	return TWISTS.find(t => t.id === id);
}

// ─── sabotage (the loser spins, the winner suffers next game) ───

export interface SabotageItem {
	id: string;
	label: string;
	desc: string;
	color: string;
	weight: number;
}

export const SABOTAGES: SabotageItem[] = [
	{ id: 'benchbest', label: 'Sixth Man', desc: 'Your highest-rated player comes off the bench — he can’t check in until the 2nd quarter.', color: '#ef4444', weight: 3 },
	{ id: 'nothrees', label: 'No Threes Q1', desc: 'You can’t attempt a three-pointer in the 1st quarter.', color: '#f97316', weight: 3 },
	{ id: 'wrongpg', label: 'Point Forward', desc: 'Your second-lowest rated player starts at PG and runs the offense all 1st half.', color: '#a855f7', weight: 2 },
	{ id: 'notimeouts', label: 'No Timeouts', desc: 'You can’t call a timeout all game. They can.', color: '#3b82f6', weight: 3 },
	{ id: 'paint', label: 'Paint Ban', desc: 'No dunks or layups in the 1st quarter — jumpers only.', color: '#eab308', weight: 2 },
	{ id: 'jersey', label: 'Dress Code', desc: 'They pick your jerseys, court and camera angle.', color: '#14b8a6', weight: 2 },
	{ id: 'iso', label: 'Ball Movement', desc: 'Every possession in the 1st half needs at least 2 passes before a shot.', color: '#22c55e', weight: 2 },
	{ id: 'freethrow', label: 'Free Throw Pick', desc: 'They choose who shoots every one of your free throws.', color: '#ec4899', weight: 2 },
	{ id: 'mercy', label: 'Mercy', desc: 'Nothing. The winner walks free this time.', color: '#64748b', weight: 1 },
];

export function getSabotage(id: string | null | undefined): SabotageItem | undefined {
	return SABOTAGES.find(x => x.id === id);
}
