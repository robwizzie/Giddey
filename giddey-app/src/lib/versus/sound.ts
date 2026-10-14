// ═══════════════════════════════════════════════════════════════
//  DRAFT-NIGHT SOUND EFFECTS
//  Synthesized with WebAudio — no audio files to ship. Everything is a
//  no-op until the first user gesture unlocks the AudioContext, and
//  while muted.
// ═══════════════════════════════════════════════════════════════

export type SoundName = 'tick' | 'flip' | 'reveal' | 'boom' | 'buzzer' | 'beep' | 'whoosh' | 'gavel' | 'crowd' | 'collision' | 'coin' | 'power';

const MUTE_KEY = 'giddey-versus-muted';
let ctx: AudioContext | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

try {
	muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
} catch {
	/* storage blocked */
}

export function isMuted(): boolean {
	return muted;
}

export function setMuted(m: boolean): void {
	muted = m;
	try {
		localStorage.setItem(MUTE_KEY, m ? '1' : '0');
	} catch {
		/* ignore */
	}
	listeners.forEach(fn => fn(m));
}

export function onMuteChange(fn: (m: boolean) => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function audio(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return null;
		ctx = new AC();
	}
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

function tone(c: AudioContext, opts: { type?: OscillatorType; freq: number; to?: number; start?: number; dur: number; gain?: number; attack?: number }) {
	const t0 = c.currentTime + (opts.start ?? 0);
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = opts.type ?? 'sine';
	osc.frequency.setValueAtTime(opts.freq, t0);
	if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
	const peak = opts.gain ?? 0.2;
	g.gain.setValueAtTime(0.0001, t0);
	g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.005));
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
	osc.connect(g).connect(c.destination);
	osc.start(t0);
	osc.stop(t0 + opts.dur + 0.05);
}

function noise(c: AudioContext, opts: { start?: number; dur: number; gain?: number; from?: number; to?: number; type?: BiquadFilterType }) {
	const t0 = c.currentTime + (opts.start ?? 0);
	const len = Math.ceil(c.sampleRate * opts.dur);
	const buf = c.createBuffer(1, len, c.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buf;
	const f = c.createBiquadFilter();
	f.type = opts.type ?? 'bandpass';
	f.frequency.setValueAtTime(opts.from ?? 1200, t0);
	if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
	const g = c.createGain();
	g.gain.setValueAtTime(opts.gain ?? 0.2, t0);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
	src.connect(f).connect(g).connect(c.destination);
	src.start(t0);
}

export function play(name: SoundName): void {
	if (muted) return;
	const c = audio();
	if (!c) return;
	try {
		switch (name) {
			case 'tick':
				tone(c, { type: 'square', freq: 1800, dur: 0.025, gain: 0.05 });
				break;
			case 'beep':
				tone(c, { type: 'sine', freq: 880, dur: 0.12, gain: 0.15 });
				break;
			case 'flip':
				noise(c, { dur: 0.18, gain: 0.25, from: 3000, to: 600 });
				break;
			case 'whoosh':
				noise(c, { dur: 0.5, gain: 0.18, from: 400, to: 4000 });
				break;
			case 'coin':
				tone(c, { type: 'triangle', freq: 1320, dur: 0.08, gain: 0.12 });
				tone(c, { type: 'triangle', freq: 1760, start: 0.08, dur: 0.25, gain: 0.12 });
				break;
			case 'reveal':
				// rising stinger + major chord
				noise(c, { dur: 0.35, gain: 0.12, from: 500, to: 5000 });
				[523, 659, 784].forEach((f, i) => tone(c, { type: 'triangle', freq: f, start: 0.25 + i * 0.03, dur: 0.6, gain: 0.1 }));
				break;
			case 'boom':
				tone(c, { type: 'sine', freq: 120, to: 35, dur: 0.9, gain: 0.6 });
				noise(c, { dur: 0.6, gain: 0.35, from: 900, to: 80, type: 'lowpass' });
				[392, 494, 587, 784].forEach((f, i) => tone(c, { type: 'sawtooth', freq: f, start: 0.15 + i * 0.02, dur: 0.9, gain: 0.05 }));
				break;
			case 'buzzer':
				tone(c, { type: 'sawtooth', freq: 160, dur: 0.9, gain: 0.25, attack: 0.01 });
				tone(c, { type: 'square', freq: 163, dur: 0.9, gain: 0.12, attack: 0.01 });
				break;
			case 'gavel':
				tone(c, { type: 'square', freq: 300, to: 120, dur: 0.12, gain: 0.25 });
				noise(c, { dur: 0.1, gain: 0.25, from: 2000, type: 'highpass' });
				break;
			case 'crowd':
				noise(c, { dur: 1.6, gain: 0.12, from: 900, to: 1400 });
				noise(c, { start: 0.1, dur: 1.4, gain: 0.08, from: 2400, to: 1800 });
				break;
			case 'power':
				// card snapped onto the table: sweep up, thump, bright double hit
				noise(c, { dur: 0.3, gain: 0.16, from: 600, to: 6000 });
				tone(c, { type: 'sine', freq: 140, to: 50, start: 0.22, dur: 0.5, gain: 0.45 });
				tone(c, { type: 'triangle', freq: 988, start: 0.24, dur: 0.18, gain: 0.12 });
				tone(c, { type: 'triangle', freq: 1319, start: 0.34, dur: 0.5, gain: 0.12 });
				break;
			case 'collision':
				tone(c, { type: 'square', freq: 220, to: 110, dur: 0.35, gain: 0.2 });
				tone(c, { type: 'square', freq: 233, to: 116, dur: 0.35, gain: 0.15 });
				break;
		}
	} catch {
		/* audio is best-effort */
	}
}

// ─── arena (main screen) ────────────────────────────────────────

/** Is audio running? Browsers (TVs especially) keep it locked until a tap. */
export function audioReady(): boolean {
	return !!ctx && ctx.state === 'running';
}

/** Call from a user gesture to unlock audio. Resolves true once it's running. */
export async function unlockAudio(): Promise<boolean> {
	const c = audio();
	if (!c) return false;
	try {
		await c.resume();
		// a silent blip — some browsers only unlock once something plays
		const src = c.createBufferSource();
		src.buffer = c.createBuffer(1, 1, c.sampleRate);
		src.connect(c.destination);
		src.start();
	} catch {
		/* ignore */
	}
	return c.state === 'running';
}

const BED_LEVEL = 0.022;
let bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

/** Murmur of a crowd: looped brown-ish noise through a voice-band filter */
function makeBed(c: AudioContext) {
	const len = c.sampleRate * 3;
	const buf = c.createBuffer(2, len, c.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = buf.getChannelData(ch);
		let last = 0;
		for (let i = 0; i < len; i++) {
			last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.02;
			// slow random "chatter" swells so the loop doesn't sound like hiss
			data[i] = last * 3.2 * (0.75 + 0.25 * Math.sin((i / c.sampleRate) * 1.7 + ch * 2));
		}
	}
	const src = c.createBufferSource();
	src.buffer = buf;
	src.loop = true;
	const band = c.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.value = 650;
	band.Q.value = 0.6;
	const low = c.createBiquadFilter();
	low.type = 'lowpass';
	low.frequency.value = 2200;
	const gain = c.createGain();
	gain.gain.value = 0.0001;
	src.connect(band).connect(low).connect(gain).connect(c.destination);
	src.start();
	gain.gain.exponentialRampToValueAtTime(muted ? 0.0001 : BED_LEVEL, c.currentTime + 1.5);
	return { src, gain };
}

/** Arena crowd bed on/off (quiet background murmur, follows mute) */
export function crowdBed(on: boolean): void {
	try {
		if (!on) {
			if (bed && ctx) {
				const b = bed;
				b.gain.gain.cancelScheduledValues(ctx.currentTime);
				b.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
				setTimeout(() => b.src.stop(), 1500);
			}
			bed = null;
			return;
		}
		if (bed) return;
		const c = audio();
		if (!c) return;
		bed = makeBed(c);
	} catch {
		/* audio is best-effort */
	}
}

/** The crowd reacts: 0 = a murmur, 1 = the building comes down */
export function crowdSwell(intensity: number): void {
	if (muted) return;
	const c = audio();
	if (!c) return;
	const k = Math.max(0, Math.min(1, intensity));
	try {
		const t0 = c.currentTime;
		if (bed) {
			const g = bed.gain.gain;
			g.cancelScheduledValues(t0);
			g.setValueAtTime(Math.max(0.0001, g.value), t0);
			g.linearRampToValueAtTime(BED_LEVEL + 0.06 * k, t0 + 0.4);
			g.setTargetAtTime(BED_LEVEL, t0 + 0.8 + 1.5 * k, 0.8);
		}
		// the cheer: band-limited noise with a soft attack and a long tail
		const dur = 1.4 + 2 * k;
		const len = Math.ceil(c.sampleRate * dur);
		const buf = c.createBuffer(2, len, c.sampleRate);
		for (let ch = 0; ch < 2; ch++) {
			const data = buf.getChannelData(ch);
			for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		}
		const src = c.createBufferSource();
		src.buffer = buf;
		const f = c.createBiquadFilter();
		f.type = 'bandpass';
		f.Q.value = 0.8;
		f.frequency.setValueAtTime(700, t0);
		f.frequency.exponentialRampToValueAtTime(1100 + 700 * k, t0 + 0.5);
		f.frequency.exponentialRampToValueAtTime(800, t0 + dur);
		const g = c.createGain();
		const peak = 0.03 + 0.09 * k;
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(peak, t0 + 0.35);
		g.gain.setTargetAtTime(peak * 0.6, t0 + 0.5, 0.4);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		src.connect(f).connect(g).connect(c.destination);
		src.start(t0);
	} catch {
		/* audio is best-effort */
	}
}

listeners.add(m => {
	if (!bed || !ctx) return;
	bed.gain.gain.setTargetAtTime(m ? 0.0001 : BED_LEVEL, ctx.currentTime, 0.2);
});

/** Short vibration on phones that support it */
export function buzz(ms: number | number[] = 40): void {
	if (muted) return;
	try {
		navigator.vibrate?.(ms);
	} catch {
		/* ignore */
	}
}

/** What just happened to you — each one feels different in your hand */
export type HapticKind = 'turn' | 'outbid' | 'landed' | 'win' | 'power';

const HAPTICS: Record<HapticKind, number[]> = {
	// two quick taps: you're on the clock
	turn: [60, 80, 60],
	// long-short-long: someone beat your bid
	outbid: [180, 60, 40, 60, 180],
	// three taps: the wheel landed on you
	landed: [40, 50, 40, 50, 120],
	// a rumble: you won
	win: [90, 40, 90, 40, 300],
	// a sharp double hit: a power-up was played
	power: [25, 30, 25, 30, 220],
};

export function haptic(kind: HapticKind): void {
	buzz(HAPTICS[kind]);
}
