import { teamOvr } from './engine';
import { getVersusPlayer, VersusPlayer } from './pool';

// ═══════════════════════════════════════════════════════════════
//  DRAFT REPLAY CLIP — the draft-day rewind drawn on a <canvas> and
//  recorded to a video file you can drop in the group chat. Simple
//  shapes and text only (no images, no emoji) so the canvas never gets
//  tainted and every phone draws it the same.
// ═══════════════════════════════════════════════════════════════

type Side = 0 | 1;

export interface ReplayPick {
	side: Side;
	id: string;
	player: VersusPlayer | undefined;
	/** overall pick number, 1-based */
	n: number;
	/** this coach's roster spot, 0-based */
	slot: number;
	superstar: boolean;
}

/** Pick list → what the replay shows for each pick */
export function replayPicks(picks: [Side, string][]): ReplayPick[] {
	const count: [number, number] = [0, 0];
	return picks.map(([side, id], i) => {
		const player = getVersusPlayer(id);
		return { side, id, player, n: i + 1, slot: count[side]++, superstar: (player?.overall ?? 0) >= 95 };
	});
}

/** Card colours per tier, [dark, bright] — mirrors the .tier-* classes */
export const TIER_COLORS: Record<string, [string, string]> = {
	'dark-matter': ['#1a0533', '#8a2be2'],
	'galaxy-opal': ['#4a1a6b', '#db2777'],
	'pink-diamond': ['#8b1a5a', '#ff69b4'],
	diamond: ['#006090', '#00bfff'],
	amethyst: ['#5c2d82', '#9b59b6'],
	ruby: ['#7a2020', '#e74c3c'],
	sapphire: ['#1e3a7a', '#3b82f6'],
	emerald: ['#15532e', '#22c55e'],
	gold: ['#6b5010', '#eab308'],
};

const PREFERRED = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

function pickMime(): string | null {
	if (typeof MediaRecorder === 'undefined') return null;
	for (const m of PREFERRED) {
		try {
			if (MediaRecorder.isTypeSupported(m)) return m;
		} catch {
			/* old Safari throws on unknown types */
		}
	}
	return null;
}

/** This browser can record a clip (MediaRecorder + canvas.captureStream) */
export function canRecordClip(): boolean {
	if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') return false;
	const c = document.createElement('canvas') as HTMLCanvasElement & { captureStream?: unknown };
	return typeof c.captureStream === 'function' && pickMime() !== null;
}

export interface ClipOptions {
	names: [string, string];
	picks: [Side, string][];
	colors: [string, string];
	title?: string;
	/** 1080×1350 (feed) or 1080×1920 (story) */
	format?: 'feed' | 'story';
	/** ms per pick in the clip */
	perPick?: number;
	/** 0–1 while recording */
	onProgress?: (p: number) => void;
}

const INTRO = 1400;
const OUTRO = 2600;
const FLY = 420;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/** Shrinks the font until the text fits */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight = 900) {
	let s = size;
	ctx.font = `${weight} ${s}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
	while (s > 12 && ctx.measureText(text).width > maxW) {
		s -= 2;
		ctx.font = `${weight} ${s}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
	}
	ctx.fillText(text, x, y);
}

/** `#rrggbb` + alpha; other colour formats fall back to transparent white */
function tint(c: string, a: number): string {
	const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
	if (!m) return `rgba(255,255,255,${a * 0.3})`;
	const n = parseInt(m[1], 16);
	return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** One frame of the replay at time `t` (ms). Exported for tests / previews. */
export function drawReplayFrame(ctx: CanvasRenderingContext2D, W: number, H: number, opts: ClipOptions, list: ReplayPick[], t: number) {
	const { names, colors } = opts;
	const per = opts.perPick ?? 650;
	const font = (s: number, w = 900) => `${w} ${s}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
	// background
	ctx.fillStyle = '#0a0e17';
	ctx.fillRect(0, 0, W, H);
	for (const side of [0, 1] as Side[]) {
		const g = ctx.createRadialGradient(side ? W : 0, 0, 0, side ? W : 0, 0, W * 0.9);
		g.addColorStop(0, tint(colors[side], 0.25));
		g.addColorStop(1, tint(colors[side], 0));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	}

	// header
	const top = H > 1500 ? 200 : 70;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.font = font(30, 800);
	ctx.fillText((opts.title || 'Draft night').toUpperCase(), W / 2, top + 30);
	const introIn = ease(t / 500);
	ctx.globalAlpha = introIn;
	for (const side of [0, 1] as Side[]) {
		ctx.fillStyle = colors[side];
		ctx.textAlign = side ? 'left' : 'right';
		fitText(ctx, names[side].toUpperCase(), side ? W / 2 + 50 : W / 2 - 50, top + 110, W / 2 - 110, 64);
	}
	ctx.fillStyle = 'rgba(255,255,255,0.6)';
	ctx.textAlign = 'center';
	ctx.font = font(36, 900);
	ctx.fillText('VS', W / 2, top + 104);
	ctx.globalAlpha = 1;

	// columns
	const colTop = top + 160;
	const footer = H > 1500 ? 340 : 210;
	const rows = Math.max(1, ...[0, 1].map(s => list.filter(p => p.side === s).length));
	const gap = 12;
	const rowH = Math.min(110, (H - colTop - footer - gap * (rows - 1)) / rows);
	const pad = 40;
	const colW = (W - pad * 3) / 2;
	const colX = (side: Side) => pad + side * (colW + pad);
	const slotY = (slot: number) => colTop + slot * (rowH + gap);

	const elapsed = t - INTRO;
	const shown = elapsed < 0 ? 0 : Math.min(list.length, Math.floor(elapsed / per) + 1);

	const card = (p: ReplayPick, x: number, y: number, w: number, h: number, alpha: number, glow: boolean) => {
		const tier = TIER_COLORS[p.player?.tier ?? 'gold'] ?? TIER_COLORS.gold;
		ctx.save();
		ctx.globalAlpha = alpha;
		if (glow) {
			ctx.shadowColor = tier[1];
			ctx.shadowBlur = 40;
		}
		const g = ctx.createLinearGradient(x, y, x + w, y + h);
		g.addColorStop(0, tier[0]);
		g.addColorStop(1, '#0d1220');
		ctx.fillStyle = g;
		roundRect(ctx, x, y, w, h, 18);
		ctx.fill();
		ctx.shadowBlur = 0;
		ctx.lineWidth = 3;
		ctx.strokeStyle = tier[1];
		ctx.stroke();
		// side stripe
		ctx.fillStyle = colors[p.side];
		roundRect(ctx, x + 10, y + 12, 8, h - 24, 4);
		ctx.fill();
		// OVR badge
		const bw = Math.min(h - 20, 92);
		ctx.fillStyle = tier[1];
		roundRect(ctx, x + w - bw - 12, y + (h - bw) / 2, bw, bw, 14);
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = font(Math.round(bw * 0.5));
		ctx.fillText(String(p.player?.overall ?? '?'), x + w - bw / 2 - 12, y + h / 2 + 2);
		// name + pick line
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#ffffff';
		const nameSize = Math.round(Math.min(44, h * 0.42));
		fitText(ctx, p.player ? `${p.player.firstName[0]}. ${p.player.lastName}` : p.id, x + 32, y + h * 0.52, w - bw - 60, nameSize);
		ctx.fillStyle = 'rgba(255,255,255,0.6)';
		ctx.font = font(Math.round(Math.min(24, h * 0.24)), 800);
		ctx.fillText(`PICK ${p.n} · ${p.player?.position ?? ''}`, x + 32, y + h * 0.84);
		ctx.restore();
	};

	for (let i = 0; i < shown; i++) {
		const p = list[i];
		const into = elapsed - i * per;
		const k = ease(into / FLY);
		const tx = colX(p.side);
		const ty = slotY(p.slot);
		// fly in from the middle, a little bigger, and settle into the slot
		const sx = W / 2 - colW / 2;
		const sy = H * 0.45;
		const x = sx + (tx - sx) * k;
		const y = sy + (ty - sy) * k;
		const sc = 1.25 - 0.25 * k;
		const w = colW * sc;
		const h = rowH * sc;
		card(p, x - (w - colW) / 2, y - (h - rowH) / 2, w, h, Math.min(1, into / 150), i === shown - 1 && into < per);
	}

	// superstar flash
	const last = shown ? list[shown - 1] : null;
	if (last?.superstar) {
		const into = elapsed - (shown - 1) * per;
		if (into < 400) {
			ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - into / 400)})`;
			ctx.fillRect(0, 0, W, H);
			ctx.save();
			ctx.globalAlpha = 1 - into / 400;
			ctx.fillStyle = '#facc15';
			ctx.textAlign = 'center';
			ctx.font = font(110);
			ctx.fillText('SUPERSTAR', W / 2, H * 0.4);
			ctx.restore();
		}
	}

	// footer: team OVR so far, then a final verdict
	const ids: [string[], string[]] = [[], []];
	for (const p of list.slice(0, shown)) ids[p.side].push(p.id);
	const done = elapsed >= list.length * per;
	const fy = H - footer + (H > 1500 ? 200 : 165);
	for (const side of [0, 1] as Side[]) {
		const ovr = teamOvr(ids[side]);
		ctx.textAlign = 'center';
		ctx.fillStyle = 'rgba(255,255,255,0.5)';
		ctx.font = font(24, 800);
		ctx.fillText('TEAM OVR', colX(side) + colW / 2, fy - 62);
		ctx.fillStyle = colors[side];
		ctx.font = font(64);
		ctx.fillText(ovr ? ovr.toFixed(1) : '—', colX(side) + colW / 2, fy + 20);
	}
	if (done) {
		const k = ease((elapsed - list.length * per) / 500);
		const o: [number, number] = [teamOvr(ids[0]), teamOvr(ids[1])];
		const lead: Side | null = Math.abs(o[0] - o[1]) < 0.05 ? null : o[0] > o[1] ? 0 : 1;
		ctx.save();
		ctx.globalAlpha = k;
		ctx.textAlign = 'center';
		ctx.fillStyle = lead === null ? '#ffffff' : colors[lead];
		ctx.font = font(34);
		ctx.fillText(lead === null ? 'DEAD EVEN ON PAPER' : `${names[lead].toUpperCase()} WINS THE DRAFT`, W / 2, fy - 112);
		ctx.restore();
	}
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.35)';
	ctx.font = font(22, 800);
	ctx.fillText('GIDDEY VERSUS', W / 2, H - 30);
}

/** Total length of the clip in ms */
export function clipLength(picks: number, perPick = 650): number {
	return INTRO + picks * perPick + OUTRO;
}

/** Draws the replay on a canvas and records it to a video */
export async function recordReplayClip(opts: ClipOptions): Promise<Blob> {
	const mime = pickMime();
	if (!mime) throw new Error('This browser can’t record video');
	const W = 1080;
	const H = opts.format === 'story' ? 1920 : 1350;
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas unavailable');
	const list = replayPicks(opts.picks);
	const total = clipLength(list.length, opts.perPick);
	drawReplayFrame(ctx, W, H, opts, list, 0);
	const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(30);
	const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
	const chunks: Blob[] = [];
	rec.ondataavailable = e => {
		if (e.data.size) chunks.push(e.data);
	};
	const stopped = new Promise<void>((resolve, reject) => {
		rec.onstop = () => resolve();
		rec.onerror = e => reject((e as unknown as { error?: Error }).error ?? new Error('Recording failed'));
	});
	rec.start(250);
	const start = performance.now();
	// setTimeout, not rAF: keeps drawing even if the tab loses focus
	await new Promise<void>(resolve => {
		const tick = () => {
			const t = performance.now() - start;
			drawReplayFrame(ctx, W, H, opts, list, Math.min(t, total));
			opts.onProgress?.(Math.min(1, t / total));
			if (t >= total) resolve();
			else setTimeout(tick, 1000 / 30);
		};
		tick();
	});
	rec.stop();
	await stopped;
	stream.getTracks().forEach(tr => tr.stop());
	return new Blob(chunks, { type: mime.split(';')[0] });
}

/** Share sheet with the file when the phone supports it, otherwise a download */
export async function shareClip(blob: Blob, name: string, title?: string): Promise<'shared' | 'downloaded'> {
	const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
	const filename = `${name.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'draft'}.${ext}`;
	const file = new File([blob], filename, { type: blob.type });
	try {
		if (navigator.canShare?.({ files: [file] })) {
			await navigator.share({ files: [file], title });
			return 'shared';
		}
	} catch (e) {
		if ((e as Error).name === 'AbortError') return 'shared';
		/* fall through to download */
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return 'downloaded';
}
