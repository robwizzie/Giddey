import { achievementsFor } from './achievements';
import { computeElo, eloGameKey } from './elo';
import { sideColor, VersusState } from './engine';
import { history } from './history';
import { getVersusPlayer } from './pool';
import { loadRivalry, RivalryGame } from './rivalry';
import { seasons, winsNeeded } from './seasons';
import { fitText, roundRect } from './shareCard';
import { getTwist } from './wheels';

// ═══════════════════════════════════════════════════════════════
//  NIGHT RECAP — one 1080×1920 image for the whole night: every game,
//  Players of the Game, badges unlocked tonight, the season table and
//  how the power ratings moved.
// ═══════════════════════════════════════════════════════════════

const W = 1080;
const H = 1920;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const dayOf = (ts: number) => new Date(ts).toDateString();

/** Tonight = every game these two played on the same day as their latest one */
export function tonightGames(): RivalryGame[] {
	const all = history();
	const last = all[all.length - 1];
	if (!last) return [];
	return all.filter(g => dayOf(g.ts) === dayOf(last.ts));
}

export interface Recap {
	games: RivalryGame[];
	wins: [number, number];
	badges: [string[], string[]];
	elo: [{ from: number; to: number }, { from: number; to: number }] | null;
	season: string | null;
}

export function buildRecap(s: VersusState): Recap | null {
	const games = tonightGames();
	if (!games.length) return null;
	const all = history();
	const before = all.filter(g => g.ts < games[0].ts);
	const badges = ([0, 1] as const).map(side => {
		const had = new Set(achievementsFor(before, side).filter(x => x.done).map(x => x.a.id));
		return achievementsFor(all, side)
			.filter(x => x.done && !had.has(x.a.id))
			.map(x => x.a.title);
	}) as [string[], string[]];
	// power ratings: before tonight's first game → after its last
	const raw = loadRivalry();
	const { moves } = computeElo(raw);
	// moves are in each logged game's own seat order — line them up with tonight's coaches
	const seated = (g: RivalryGame, pick: 'before' | 'after'): [number, number] | null => {
		const k = eloGameKey(g);
		const m = moves.get(k);
		const src = raw.find(x => eloGameKey(x) === k);
		if (!m || !src) return null;
		const flip = src.names[0].trim().toLowerCase() !== s.settings.names[0].trim().toLowerCase();
		return flip ? [m[pick][1], m[pick][0]] : m[pick];
	};
	const from = seated(games[0], 'before');
	const to = seated(games[games.length - 1], 'after');
	const elo = from && to ? ([0, 1] as const).map(i => ({ from: from[i], to: to[i] })) : null;
	const tag = games[games.length - 1].season;
	const sum = tag ? seasons(all).find(x => x.n === tag.n) : undefined;
	const n = s.settings.names;
	const season = !sum
		? null
		: sum.champion !== null
			? `${n[sum.champion]} won Season ${sum.n} (${sum.finalsWins[sum.champion]}–${sum.finalsWins[sum.champion === 0 ? 1 : 0]})`
			: sum.regular[0] + sum.regular[1] >= sum.len
				? `Season ${sum.n} Finals: ${n[0]} ${sum.finalsWins[0]}–${sum.finalsWins[1]} ${n[1]} · first to ${winsNeeded(sum.finals)}`
				: `Season ${sum.n}: ${n[0]} ${sum.regular[0]}–${sum.regular[1]} ${n[1]} · ${sum.len - sum.regular[0] - sum.regular[1]} to play`;
	return {
		games,
		wins: [games.filter(g => g.winner === 0).length, games.filter(g => g.winner === 1).length],
		badges,
		elo: elo as Recap['elo'],
		season,
	};
}

export async function renderRecap(s: VersusState): Promise<Blob | null> {
	const r = buildRecap(s);
	if (!r) return null;
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d')!;
	const c = [sideColor(s.settings, 0), sideColor(s.settings, 1)];
	const n = s.settings.names;

	// background
	const bg = ctx.createLinearGradient(0, 0, W, H);
	bg.addColorStop(0, '#0a0e17');
	bg.addColorStop(1, '#111827');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);
	for (const [x, y, col] of [
		[0, 0, c[0]],
		[W, H, c[1]],
	] as [number, number, string][]) {
		const g = ctx.createRadialGradient(x, y, 0, x, y, 900);
		g.addColorStop(0, `${col}55`);
		g.addColorStop(1, 'transparent');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	}

	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.55)';
	ctx.font = `800 34px ${FONT}`;
	ctx.fillText(`NIGHT RECAP · ${new Date(r.games[0].ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}`, W / 2, 130);

	// big score
	ctx.font = `900 64px ${FONT}`;
	ctx.fillStyle = c[0];
	ctx.textAlign = 'right';
	ctx.fillText(n[0], W / 2 - 40, 250);
	ctx.fillStyle = c[1];
	ctx.textAlign = 'left';
	ctx.fillText(n[1], W / 2 + 40, 250);
	ctx.textAlign = 'center';
	ctx.fillStyle = '#ffffff';
	ctx.font = `900 200px ${FONT}`;
	ctx.fillText(`${r.wins[0]}–${r.wins[1]}`, W / 2, 450);
	const leader = r.wins[0] === r.wins[1] ? null : r.wins[0] > r.wins[1] ? 0 : 1;
	ctx.font = `800 36px ${FONT}`;
	ctx.fillStyle = leader === null ? 'rgba(255,255,255,0.6)' : c[leader];
	ctx.fillText(leader === null ? 'Split the night' : `${n[leader]} takes the night`, W / 2, 520);

	// games
	let y = 600;
	ctx.textAlign = 'left';
	for (const g of r.games.slice(-7)) {
		roundRect(ctx, 70, y, W - 140, 120, 28);
		ctx.fillStyle = 'rgba(255,255,255,0.06)';
		ctx.fill();
		ctx.fillStyle = c[g.winner];
		roundRect(ctx, 70, y, 14, 120, 7);
		ctx.fill();
		const scored = g.score[0] !== null && g.score[1] !== null;
		ctx.fillStyle = '#ffffff';
		fitText(ctx, `${n[g.winner]} wins${scored ? ` ${g.score[g.winner]}–${g.score[g.winner === 0 ? 1 : 0]}` : ''}`, 560, 44);
		ctx.fillText(`${n[g.winner]} wins${scored ? ` ${g.score[g.winner]}–${g.score[g.winner === 0 ? 1 : 0]}` : ''}`, 110, y + 58);
		const potg = (g.potg ?? []).map(id => getVersusPlayer(id)?.lastName).filter(Boolean).join(' & ');
		const twist = getTwist(g.twist ?? null)?.label;
		ctx.fillStyle = 'rgba(255,255,255,0.6)';
		ctx.font = `600 28px ${FONT}`;
		ctx.fillText([potg && `POTG ${potg}`, twist && `Twist: ${twist}`, g.season?.stage === 'finals' && 'Finals'].filter(Boolean).join('   ') || ' ', 110, y + 96);
		ctx.textAlign = 'right';
		ctx.fillStyle = 'rgba(255,255,255,0.35)';
		ctx.font = `800 30px ${FONT}`;
		ctx.fillText(new Date(g.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), W - 110, y + 58);
		ctx.textAlign = 'left';
		y += 140;
	}

	// ratings + badges
	y += 20;
	if (r.elo) {
		ctx.fillStyle = 'rgba(255,255,255,0.45)';
		ctx.font = `800 28px ${FONT}`;
		ctx.textAlign = 'center';
		ctx.fillText('POWER RATING', W / 2, y);
		ctx.font = `900 46px ${FONT}`;
		([0, 1] as const).forEach(i => {
			const d = r.elo![i].to - r.elo![i].from;
			ctx.fillStyle = c[i];
			ctx.fillText(`${n[i]} ${r.elo![i].to} (${d >= 0 ? '+' : ''}${d})`, W / 2 + (i ? 250 : -250), y + 60);
		});
		y += 120;
	}
	const allBadges = [...r.badges[0].map(b => ({ b, i: 0 })), ...r.badges[1].map(b => ({ b, i: 1 }))].slice(0, 4);
	if (allBadges.length) {
		ctx.textAlign = 'center';
		ctx.fillStyle = 'rgba(255,255,255,0.45)';
		ctx.font = `800 28px ${FONT}`;
		ctx.fillText('BADGES UNLOCKED', W / 2, y);
		y += 50;
		for (const { b, i } of allBadges) {
			ctx.fillStyle = c[i];
			ctx.font = `800 36px ${FONT}`;
			ctx.fillText(`${n[i]} · ${b}`, W / 2, y);
			y += 52;
		}
		y += 10;
	}
	if (r.season) {
		ctx.textAlign = 'center';
		ctx.fillStyle = '#facc15';
		fitText(ctx, r.season, W - 160, 38, 800);
		ctx.fillText(r.season, W / 2, Math.min(y + 30, H - 140));
	}

	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.4)';
	ctx.font = `700 30px ${FONT}`;
	ctx.fillText('playgiddey.com/versus', W / 2, H - 60);

	return new Promise(resolve => {
		try {
			canvas.toBlob(b => resolve(b), 'image/png');
		} catch {
			resolve(null);
		}
	});
}
