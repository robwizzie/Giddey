import { getPlayerHeadshotUrls } from '@/lib/images';
import { getTeamFor, VersusPlayer } from './pool';
import { bestLineup, fairness, Side, sideColor, teamName, teamOvr, VersusState } from './engine';
import { getTwist } from './wheels';

// ═══════════════════════════════════════════════════════════════
//  SHARE CARD — 1080×1920 story image of both squads, drawn on a canvas
//  so it can go straight into iMessage / Instagram via the share sheet.
// ═══════════════════════════════════════════════════════════════

const W = 1080;
const H = 1920;

function loadImage(url: string, timeout = 3500): Promise<HTMLImageElement | null> {
	return new Promise(resolve => {
		const img = new Image();
		// needed so the canvas can still be exported; hosts without CORS just fail over
		img.crossOrigin = 'anonymous';
		const t = setTimeout(() => resolve(null), timeout);
		img.onload = () => {
			clearTimeout(t);
			resolve(img);
		};
		img.onerror = () => {
			clearTimeout(t);
			resolve(null);
		};
		img.src = url;
	});
}

async function headshot(p: VersusPlayer): Promise<HTMLImageElement | null> {
	for (const url of getPlayerHeadshotUrls(p.id.replace(/^at_/, ''), p.firstName, p.lastName, p.era)) {
		if (url.startsWith('/')) continue; // local overrides are fine but keep it simple
		const img = await loadImage(url);
		if (img) return img;
	}
	return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 900): number {
	let s = size;
	ctx.font = `${weight} ${s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
	while (ctx.measureText(text).width > maxW && s > 14) {
		s -= 2;
		ctx.font = `${weight} ${s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
	}
	return s;
}

const TIER_COLORS: Record<string, string> = {
	'dark-matter': '#8b5cf6',
	'galaxy-opal': '#c084fc',
	'pink-diamond': '#ec4899',
	diamond: '#06b6d4',
	amethyst: '#a855f7',
	ruby: '#ef4444',
	sapphire: '#3b82f6',
	emerald: '#22c55e',
	gold: '#eab308',
};

function drawPlayer(ctx: CanvasRenderingContext2D, p: VersusPlayer, img: HTMLImageElement | null, x: number, y: number, w: number, align: 'left' | 'right', accent: string) {
	const team = getTeamFor(p);
	const R = 52;
	const cx = align === 'left' ? x + R : x + w - R;
	const cy = y + R;
	// avatar
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, R, 0, Math.PI * 2);
	const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
	g.addColorStop(0, team.primaryColor);
	g.addColorStop(1, team.secondaryColor);
	ctx.fillStyle = g;
	ctx.fill();
	ctx.clip();
	if (img) {
		// NBA headshots are landscape; crop to the face
		const scale = (R * 2.4) / img.height;
		const iw = img.width * scale;
		const ih = img.height * scale;
		ctx.drawImage(img, cx - iw / 2, cy - R * 0.95, iw, ih);
	} else {
		ctx.fillStyle = '#fff';
		ctx.font = '900 40px -apple-system, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`${p.firstName[0]}${p.lastName[0]}`, cx, cy + 2);
	}
	ctx.restore();
	ctx.lineWidth = 4;
	ctx.strokeStyle = accent;
	ctx.beginPath();
	ctx.arc(cx, cy, R, 0, Math.PI * 2);
	ctx.stroke();

	// OVR badge
	const bx = align === 'left' ? cx + R - 30 : cx - R - 14;
	ctx.fillStyle = TIER_COLORS[p.tier] ?? '#eab308';
	roundRect(ctx, bx, cy + R - 40, 44, 40, 10);
	ctx.fill();
	ctx.fillStyle = '#fff';
	ctx.font = '900 26px -apple-system, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(String(p.overall), bx + 22, cy + R - 19);

	// name
	const tx = align === 'left' ? cx + R + 22 : cx - R - 22;
	const maxW = w - R * 2 - 34;
	ctx.textAlign = align;
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	fitText(ctx, p.lastName.toUpperCase(), maxW, 40);
	ctx.fillText(p.lastName.toUpperCase(), tx, cy + 4);
	ctx.fillStyle = 'rgba(255,255,255,0.55)';
	ctx.font = '700 24px -apple-system, sans-serif';
	const sub = `${p.position}/${p.secondaryPosition} · ${p.era === 'alltime' ? `${p.eraLabel ?? ''} ${team.abbreviation}`.trim() : team.abbreviation}`;
	ctx.fillText(sub, tx, cy + 38);
}

export async function renderShareCard(s: VersusState): Promise<Blob | null> {
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	const colors: [string, string] = [sideColor(s.settings, 0), sideColor(s.settings, 1)];
	const lus = [bestLineup(s.teams[0]), bestLineup(s.teams[1])];

	// background
	ctx.fillStyle = '#0a0e17';
	ctx.fillRect(0, 0, W, H);
	([0, 1] as Side[]).forEach(side => {
		const g = ctx.createRadialGradient(side ? W : 0, 0, 0, side ? W : 0, 0, 900);
		g.addColorStop(0, `${colors[side]}55`);
		g.addColorStop(1, 'transparent');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	});

	// header
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.font = '900 30px -apple-system, sans-serif';
	ctx.fillText(`GIDDEY VERSUS  ·  GAME ${s.gameNo}`, W / 2, 110);

	// team names + OVR
	([0, 1] as Side[]).forEach(side => {
		const x = side ? W * 0.75 : W * 0.25;
		ctx.textAlign = 'center';
		ctx.fillStyle = colors[side];
		fitText(ctx, teamName(s.settings, side), W * 0.42, 46);
		ctx.fillText(teamName(s.settings, side), x, 210);
		ctx.fillStyle = '#fff';
		ctx.font = '900 130px -apple-system, sans-serif';
		ctx.fillText(teamOvr(s.teams[side]).toFixed(1), x, 350);
		ctx.fillStyle = 'rgba(255,255,255,0.4)';
		ctx.font = '800 24px -apple-system, sans-serif';
		ctx.fillText('TEAM OVR', x, 392);
	});
	ctx.fillStyle = 'rgba(255,255,255,0.3)';
	ctx.font = '900 54px -apple-system, sans-serif';
	ctx.fillText('VS', W / 2, 300);

	// fairness bar
	const f = fairness(s.teams[0], s.teams[1]);
	ctx.fillStyle = 'rgba(255,255,255,0.1)';
	roundRect(ctx, 140, 430, W - 280, 14, 7);
	ctx.fill();
	const diff = Math.max(-4, Math.min(4, teamOvr(s.teams[1]) - teamOvr(s.teams[0])));
	const nx = 140 + (W - 280) * (0.5 + diff / 8);
	ctx.fillStyle = '#fff';
	roundRect(ctx, nx - 5, 420, 10, 34, 5);
	ctx.fill();
	ctx.fillStyle = f >= 90 ? '#22c55e' : f >= 75 ? '#eab308' : '#ef4444';
	ctx.font = '900 26px -apple-system, sans-serif';
	ctx.fillText(`${f}% BALANCED`, W / 2, 500);

	// load headshots in parallel
	const everyone = [...lus[0].starters.map(x => x.player), ...lus[1].starters.map(x => x.player), ...lus[0].bench, ...lus[1].bench].filter((p): p is VersusPlayer => !!p);
	const imgs = new Map<string, HTMLImageElement | null>();
	await Promise.all(everyone.map(async p => imgs.set(p.id, await headshot(p))));

	// starters
	const top = 560;
	const rowH = 150;
	lus[0].starters.forEach((st, i) => {
		const y = top + i * rowH;
		ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
		roundRect(ctx, 30, y - 10, W - 60, rowH - 14, 24);
		ctx.fill();
		const a = st.player;
		const b = lus[1].starters[i].player;
		if (a) drawPlayer(ctx, a, imgs.get(a.id) ?? null, 50, y + 6, W / 2 - 110, 'left', colors[0]);
		if (b) drawPlayer(ctx, b, imgs.get(b.id) ?? null, W / 2 + 60, y + 6, W / 2 - 110, 'right', colors[1]);
		ctx.textAlign = 'center';
		ctx.fillStyle = 'rgba(255,255,255,0.75)';
		ctx.font = '900 30px -apple-system, sans-serif';
		ctx.fillText(st.slot, W / 2, y + 62);
		if (a && b && a.overall !== b.overall) {
			ctx.fillStyle = a.overall > b.overall ? colors[0] : colors[1];
			ctx.font = '900 24px -apple-system, sans-serif';
			ctx.fillText(`${a.overall > b.overall ? '◀' : '▶'} ${Math.abs(a.overall - b.overall)}`, W / 2, y + 98);
		}
	});

	// bench
	let y = top + 5 * rowH + 20;
	const benchMax = Math.max(lus[0].bench.length, lus[1].bench.length);
	if (benchMax) {
		ctx.textAlign = 'center';
		ctx.fillStyle = 'rgba(255,255,255,0.4)';
		ctx.font = '900 26px -apple-system, sans-serif';
		ctx.fillText('BENCH', W / 2, y);
		y += 24;
		const rows = Math.min(benchMax, 7);
		for (let i = 0; i < rows; i++) {
			([0, 1] as Side[]).forEach(side => {
				const p = lus[side].bench[i];
				if (!p) return;
				const x = side ? W - 60 : 60;
				ctx.textAlign = side ? 'right' : 'left';
				ctx.fillStyle = '#fff';
				ctx.font = '800 30px -apple-system, sans-serif';
				const label = side ? `${p.lastName}  ${p.overall}` : `${p.overall}  ${p.lastName}`;
				ctx.fillText(label, x, y + 36 + i * 46);
			});
		}
		y += 36 + rows * 46;
	}

	// footer: game day rules
	const facts: string[] = [];
	if (s.gameday.quarter) facts.push(`${s.gameday.quarter}-MIN QUARTERS`);
	const twist = getTwist(s.gameday.modifier);
	if (twist && twist.id !== 'straight') facts.push(twist.label.toUpperCase());
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.6)';
	ctx.font = '900 28px -apple-system, sans-serif';
	if (facts.length) ctx.fillText(facts.join('  ·  '), W / 2, Math.min(H - 110, y + 60));
	ctx.fillStyle = 'rgba(255,255,255,0.35)';
	ctx.font = '800 26px -apple-system, sans-serif';
	ctx.fillText('playgiddey.com/versus', W / 2, H - 60);

	return new Promise(resolve => {
		try {
			canvas.toBlob(b => resolve(b), 'image/png');
		} catch {
			// a host without CORS slipped through and tainted the canvas
			resolve(null);
		}
	});
}

/** Share via the OS sheet when possible, otherwise download */
export async function shareSquads(s: VersusState): Promise<'shared' | 'downloaded' | 'failed'> {
	const blob = await renderShareCard(s);
	if (!blob) return 'failed';
	const file = new File([blob], `giddey-versus-game-${s.gameNo}.png`, { type: 'image/png' });
	const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
	if (nav.canShare?.({ files: [file] })) {
		try {
			await nav.share({ files: [file], title: 'Giddey Versus', text: `${teamName(s.settings, 0)} vs ${teamName(s.settings, 1)}` });
			return 'shared';
		} catch {
			/* cancelled — fall through to download */
		}
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = file.name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 4000);
	return 'downloaded';
}
