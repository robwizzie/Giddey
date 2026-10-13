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

export type BoostId = 'upgrade' | 'steal' | 'firstPick' | 'reroll' | 'quarterControl' | 'starSit' | 'homeCourt';

export interface Boost {
	id: BoostId;
	label: string;
	icon: string;
	desc: string;
	/** applied by the app vs. honor system during the game */
	kind: 'roster' | 'draft' | 'game';
}

export const BOOSTS: Record<BoostId, Boost> = {
	upgrade: { id: 'upgrade', label: 'Upgrade Pack', icon: '⬆️', kind: 'roster', desc: 'Swap your weakest player for one of 3 better free agents.' },
	steal: { id: 'steal', label: 'Bench Heist', icon: '🦹', kind: 'roster', desc: 'Take one of their bench players — they get your weakest guy.' },
	firstPick: { id: 'firstPick', label: 'Draft Priority', icon: '🥇', kind: 'draft', desc: 'First pick of the next draft. Running it back? Becomes an Upgrade Pack.' },
	reroll: { id: 'reroll', label: 'Extra Reroll', icon: '🎲', kind: 'draft', desc: '+1 pack reroll next draft. Running it back? Becomes an Upgrade Pack.' },
	quarterControl: { id: 'quarterControl', label: 'Clock Control', icon: '⏱️', kind: 'game', desc: 'You pick the quarter length next game (2–5 min). No wheel.' },
	starSit: { id: 'starSit', label: 'Late Scratch', icon: '🪑', kind: 'game', desc: 'Their highest-rated player sits the entire 1st quarter.' },
	homeCourt: { id: 'homeCourt', label: 'Home Court', icon: '🏟️', kind: 'game', desc: 'You pick the arena, uniforms and who takes the opening tip.' },
};

const REWARDS_BY_DIFFICULTY: Record<Difficulty, BoostId[]> = {
	easy: ['homeCourt', 'reroll', 'quarterControl'],
	medium: ['firstPick', 'quarterControl', 'steal', 'reroll'],
	hard: ['upgrade', 'starSit', 'steal'],
};

export function rollReward(difficulty: Difficulty, rosterSize: number): BoostId {
	const options = REWARDS_BY_DIFFICULTY[difficulty].filter(b => !(b === 'steal' && rosterSize <= 5));
	return options[Math.floor(Math.random() * options.length)];
}

export function challengeSegments(rosterSize: number): (WheelSegment & { challenge: Challenge })[] {
	return CHALLENGES.filter(c => !(c.needsBench && rosterSize <= 5)).map(c => ({
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
