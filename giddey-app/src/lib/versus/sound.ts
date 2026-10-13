// ═══════════════════════════════════════════════════════════════
//  DRAFT-NIGHT SOUND EFFECTS
//  Synthesized with WebAudio — no audio files to ship. Everything is a
//  no-op until the first user gesture unlocks the AudioContext, and
//  while muted.
// ═══════════════════════════════════════════════════════════════

export type SoundName = 'tick' | 'flip' | 'reveal' | 'boom' | 'buzzer' | 'beep' | 'whoosh' | 'gavel' | 'crowd' | 'collision' | 'coin';

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
			case 'collision':
				tone(c, { type: 'square', freq: 220, to: 110, dur: 0.35, gain: 0.2 });
				tone(c, { type: 'square', freq: 233, to: 116, dur: 0.35, gain: 0.15 });
				break;
		}
	} catch {
		/* audio is best-effort */
	}
}

/** Short vibration on phones that support it */
export function buzz(ms = 40): void {
	if (muted) return;
	try {
		navigator.vibrate?.(ms);
	} catch {
		/* ignore */
	}
}
