import type { RivalryGame } from './rivalry';
import { getVersusPlayer } from './pool';
import { seasons, winsNeeded } from './seasons';
import { belt, hallOfFame, HOF_POTG } from './legacy';

// ═══════════════════════════════════════════════════════════════
//  ACHIEVEMENTS — badges earned from the head-to-head log. Nothing is
//  stored: they're recomputed from the games, so syncing phones brings
//  them along.
// ═══════════════════════════════════════════════════════════════

type Side = 0 | 1;

export interface Achievement {
	id: string;
	icon: string;
	title: string;
	desc: string;
	/** progress toward the goal for this coach: [have, need] */
	progress: (games: RivalryGame[], side: Side) => [number, number];
}

const wins = (games: RivalryGame[], side: Side) => games.filter(g => g.winner === side);
const has = (ok: boolean): [number, number] => [ok ? 1 : 0, 1];

function longestStreak(games: RivalryGame[], side: Side): number {
	let run = 0;
	let best = 0;
	for (const g of games) {
		run = g.winner === side ? run + 1 : 0;
		best = Math.max(best, run);
	}
	return best;
}

const margin = (g: RivalryGame, side: Side) => (g.score[0] !== null && g.score[1] !== null ? g.score[side]! - g.score[side === 0 ? 1 : 0]! : null);

export const ACHIEVEMENTS: Achievement[] = [
	{ id: 'first', icon: 'ball', title: 'On the Board', desc: 'Win your first game.', progress: (g, s) => [Math.min(1, wins(g, s).length), 1] },
	{ id: 'ten', icon: 'medal', title: 'Double Digits', desc: 'Win 10 games.', progress: (g, s) => [Math.min(10, wins(g, s).length), 10] },
	{ id: 'heater', icon: 'flame', title: 'Heater', desc: 'Win 5 in a row.', progress: (g, s) => [Math.min(5, longestStreak(g, s)), 5] },
	{
		id: 'nostars',
		icon: 'ban',
		title: 'No Stars Needed',
		desc: 'Win without a single 95+ OVR player.',
		progress: (g, s) => has(wins(g, s).some(x => x.rosters[s].length > 0 && x.rosters[s].every(id => (getVersusPlayer(id)?.overall ?? 0) < 95))),
	},
	{ id: 'giant', icon: 'shield', title: 'Giant Killer', desc: 'Win as a 2+ OVR underdog.', progress: (g, s) => has(wins(g, s).some(x => x.teamOvr[s === 0 ? 1 : 0] - x.teamOvr[s] >= 2)) },
	{ id: 'blowout', icon: 'bomb', title: 'Statement Game', desc: 'Win by 20 or more.', progress: (g, s) => has(g.some(x => (margin(x, s) ?? 0) >= 20)) },
	{ id: 'clutch', icon: 'snowflake', title: 'Ice in the Veins', desc: 'Win by 1 or 2 points.', progress: (g, s) => has(g.some(x => { const m = margin(x, s); return m !== null && m > 0 && m <= 2; })) },
	{ id: 'century', icon: 'gauge', title: 'Century', desc: 'Score 100+ in a game.', progress: (g, s) => has(g.some(x => (x.score[s] ?? 0) >= 100)) },
	{ id: 'cover', icon: 'trendUp', title: 'Cover Kings', desc: 'Cover the spread as the underdog 3 times.', progress: (g, s) => [Math.min(3, g.filter(x => x.covered === s).length), 3] },
	{ id: 'challenges', icon: 'target', title: 'Challenge Accepted', desc: 'Complete 10 challenges.', progress: (g, s) => [Math.min(10, g.filter(x => x.challenges[s] === true).length), 10] },
	{ id: 'survivor', icon: 'skull', title: 'Survivor', desc: 'Win while sabotaged.', progress: (g, s) => has(wins(g, s).some(x => x.sabotageOn === s)) },
	{
		id: 'variety',
		icon: 'palette',
		title: 'Kaleidoscope',
		desc: 'Play with 50 different players.',
		progress: (g, s) => [Math.min(50, new Set(g.flatMap(x => x.rosters[s] ?? [])).size), 50],
	},
	{ id: 'styles', icon: 'layers', title: 'Every Style', desc: 'Win in all 5 draft styles.', progress: (g, s) => [new Set(wins(g, s).map(x => x.style)).size, 5] },
	{ id: 'themes', icon: 'compass', title: 'Theme Park', desc: 'Win 4 different theme drafts.', progress: (g, s) => [Math.min(4, new Set(wins(g, s).map(x => x.theme).filter(Boolean)).size), 4] },
	{
		id: 'mvp',
		icon: 'star',
		title: 'MVP Machine',
		desc: 'Your players win Player of the Game 5 times.',
		progress: (g, s) => [Math.min(5, g.reduce((n, x) => n + (x.potg ?? []).filter(id => x.rosters[s]?.includes(id)).length, 0)), 5],
	},
	{ id: 'oracle', icon: 'eye', title: 'Oracle', desc: 'Win 5 prediction duels.', progress: (g, s) => [Math.min(5, g.filter(x => x.oracle === s).length), 5] },
	{ id: 'gradeA', icon: 'award', title: 'Front Office', desc: 'Get an A+ draft grade.', progress: (g, s) => has(g.some(x => x.grades?.[s]?.letter === 'A+')) },
	{ id: 'champ', icon: 'trophy', title: 'Champion', desc: 'Win a season title.', progress: (g, s) => [Math.min(1, seasons(g).filter(x => x.champion === s).length), 1] },
	{ id: 'dynasty', icon: 'crown', title: 'Dynasty', desc: 'Win 3 titles.', progress: (g, s) => [Math.min(3, seasons(g).filter(x => x.champion === s).length), 3] },
	{
		id: 'sweep',
		icon: 'zap',
		title: 'Sweep',
		desc: 'Win the Finals without losing a game.',
		progress: (g, s) => has(seasons(g).some(x => x.champion === s && x.finalsWins[s === 0 ? 1 : 0] === 0)),
	},
	{
		id: 'comeback',
		icon: 'repeat',
		title: 'Comeback',
		desc: 'Win the Finals after trailing 0–2.',
		progress: (g, s) =>
			has(
				seasons(g).some(x => {
					if (x.champion !== s) return false;
					const fin = x.games.filter(y => y.season?.stage === 'finals');
					return fin.length >= 2 && fin[0].winner !== s && fin[1].winner !== s && winsNeeded(x.finals) >= 2;
				}),
			),
	},
	{
		id: 'beltDefense',
		icon: 'swords',
		title: 'Title Defense',
		desc: 'Defend the belt 5 times in a row.',
		progress: (g, s) => [Math.min(5, belt(g)?.best[s] ?? 0), 5],
	},
	{ id: 'mindReader', icon: 'brain', title: 'Mind Reader', desc: 'Go 3 for 3 on a scouting report.', progress: (g, s) => has(g.some(x => x.reads?.[s] === 3)) },
	{ id: 'cardShark', icon: 'sparkle', title: 'Card Shark', desc: 'Win 5 games where you played a power-up.', progress: (g, s) => [Math.min(5, wins(g, s).filter(x => !!x.powers?.[s]).length), 5] },
	{
		id: 'hof',
		icon: 'shirt',
		title: 'Hall of Famer',
		desc: `Retire a jersey: win a title with a player, or he wins Player of the Game ${HOF_POTG} times.`,
		progress: (g, s) => has(hallOfFame(g)[s].length > 0),
	},
];

export interface Earned {
	a: Achievement;
	have: number;
	need: number;
	done: boolean;
}

export function achievementsFor(games: RivalryGame[], side: Side): Earned[] {
	return ACHIEVEMENTS.map(a => {
		const [have, need] = a.progress(games, side);
		return { a, have, need, done: have >= need };
	});
}

export function unlockedIds(games: RivalryGame[], side: Side): Set<string> {
	return new Set(achievementsFor(games, side).filter(x => x.done).map(x => x.a.id));
}
