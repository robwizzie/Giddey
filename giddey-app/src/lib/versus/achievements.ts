import type { RivalryGame } from './rivalry';
import { getVersusPlayer } from './pool';
import { seasons, winsNeeded } from './seasons';

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
	{ id: 'first', icon: '🏀', title: 'On the Board', desc: 'Win your first game.', progress: (g, s) => [Math.min(1, wins(g, s).length), 1] },
	{ id: 'ten', icon: '🔟', title: 'Double Digits', desc: 'Win 10 games.', progress: (g, s) => [Math.min(10, wins(g, s).length), 10] },
	{ id: 'heater', icon: '🔥', title: 'Heater', desc: 'Win 5 in a row.', progress: (g, s) => [Math.min(5, longestStreak(g, s)), 5] },
	{
		id: 'nostars',
		icon: '🚫',
		title: 'No Stars Needed',
		desc: 'Win without a single 95+ OVR player.',
		progress: (g, s) => has(wins(g, s).some(x => x.rosters[s].length > 0 && x.rosters[s].every(id => (getVersusPlayer(id)?.overall ?? 0) < 95))),
	},
	{ id: 'giant', icon: '🐶', title: 'Giant Killer', desc: 'Win as a 2+ OVR underdog.', progress: (g, s) => has(wins(g, s).some(x => x.teamOvr[s === 0 ? 1 : 0] - x.teamOvr[s] >= 2)) },
	{ id: 'blowout', icon: '💥', title: 'Statement Game', desc: 'Win by 20 or more.', progress: (g, s) => has(g.some(x => (margin(x, s) ?? 0) >= 20)) },
	{ id: 'clutch', icon: '🧊', title: 'Ice in the Veins', desc: 'Win by 1 or 2 points.', progress: (g, s) => has(g.some(x => { const m = margin(x, s); return m !== null && m > 0 && m <= 2; })) },
	{ id: 'century', icon: '💯', title: 'Century', desc: 'Score 100+ in a game.', progress: (g, s) => has(g.some(x => (x.score[s] ?? 0) >= 100)) },
	{ id: 'cover', icon: '📈', title: 'Cover Kings', desc: 'Cover the spread as the underdog 3 times.', progress: (g, s) => [Math.min(3, g.filter(x => x.covered === s).length), 3] },
	{ id: 'challenges', icon: '🎯', title: 'Challenge Accepted', desc: 'Complete 10 challenges.', progress: (g, s) => [Math.min(10, g.filter(x => x.challenges[s] === true).length), 10] },
	{ id: 'survivor', icon: '😈', title: 'Survivor', desc: 'Win while sabotaged.', progress: (g, s) => has(wins(g, s).some(x => x.sabotageOn === s)) },
	{
		id: 'variety',
		icon: '🎨',
		title: 'Kaleidoscope',
		desc: 'Play with 50 different players.',
		progress: (g, s) => [Math.min(50, new Set(g.flatMap(x => x.rosters[s] ?? [])).size), 50],
	},
	{ id: 'styles', icon: '🎴', title: 'Every Style', desc: 'Win in all 5 draft styles.', progress: (g, s) => [new Set(wins(g, s).map(x => x.style)).size, 5] },
	{ id: 'themes', icon: '🎡', title: 'Theme Park', desc: 'Win 4 different theme drafts.', progress: (g, s) => [Math.min(4, new Set(wins(g, s).map(x => x.theme).filter(Boolean)).size), 4] },
	{
		id: 'mvp',
		icon: '⭐',
		title: 'MVP Machine',
		desc: 'Your players win Player of the Game 5 times.',
		progress: (g, s) => [Math.min(5, g.reduce((n, x) => n + (x.potg ?? []).filter(id => x.rosters[s]?.includes(id)).length, 0)), 5],
	},
	{ id: 'gradeA', icon: '🅰️', title: 'Front Office', desc: 'Get an A+ draft grade.', progress: (g, s) => has(g.some(x => x.grades?.[s]?.letter === 'A+')) },
	{ id: 'champ', icon: '🏆', title: 'Champion', desc: 'Win a season title.', progress: (g, s) => [Math.min(1, seasons(g).filter(x => x.champion === s).length), 1] },
	{ id: 'dynasty', icon: '👑', title: 'Dynasty', desc: 'Win 3 titles.', progress: (g, s) => [Math.min(3, seasons(g).filter(x => x.champion === s).length), 3] },
	{
		id: 'sweep',
		icon: '🧹',
		title: 'Sweep',
		desc: 'Win the Finals without losing a game.',
		progress: (g, s) => has(seasons(g).some(x => x.champion === s && x.finalsWins[s === 0 ? 1 : 0] === 0)),
	},
	{
		id: 'comeback',
		icon: '🔄',
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
