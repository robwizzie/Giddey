import { isMuted } from './sound';

// ═══════════════════════════════════════════════════════════════
//  ANNOUNCER — reads picks aloud with the browser's built-in speech
//  voice. Nothing to download. Silent while muted, when the setting is
//  off, or on browsers without speechSynthesis.
// ═══════════════════════════════════════════════════════════════

let enabled = true;
let voice: SpeechSynthesisVoice | null = null;
let unlocked = false;

function synth(): SpeechSynthesis | null {
	return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Prefer a natural English voice when the browser offers one */
function pickVoice() {
	const s = synth();
	if (!s) return;
	const voices = s.getVoices().filter(v => v.lang.toLowerCase().startsWith('en'));
	const prefer = ['Google US English', 'Samantha', 'Daniel', 'Alex', 'Aaron', 'Microsoft Guy', 'Microsoft David', 'Arthur', 'Fred'];
	voice = prefer.map(n => voices.find(v => v.name.includes(n))).find(Boolean) ?? voices.find(v => v.lang === 'en-US') ?? voices[0] ?? null;
}

if (typeof window !== 'undefined') {
	const s = synth();
	if (s) {
		pickVoice();
		s.addEventListener?.('voiceschanged', pickVoice);
		// iOS only lets speech start from a tap — say nothing on the first one to unlock it
		const unlock = () => {
			if (unlocked) return;
			unlocked = true;
			try {
				const u = new SpeechSynthesisUtterance(' ');
				u.volume = 0;
				s.speak(u);
			} catch {
				/* ignore */
			}
		};
		window.addEventListener('pointerdown', unlock, { once: true, capture: true });
	}
}

export function setAnnouncer(on: boolean): void {
	enabled = on;
	if (!on) synth()?.cancel();
}

export function announcerSupported(): boolean {
	return !!synth();
}

/** Speak a line. `hype` reads it louder, slower and a touch higher */
export function announce(text: string, opts: { hype?: boolean; interrupt?: boolean } = {}): void {
	const s = synth();
	if (!s || !enabled || isMuted()) return;
	try {
		if (opts.interrupt !== false) s.cancel();
		const u = new SpeechSynthesisUtterance(text);
		if (voice) u.voice = voice;
		u.lang = voice?.lang ?? 'en-US';
		u.rate = opts.hype ? 0.95 : 1.05;
		u.pitch = opts.hype ? 1.15 : 0.95;
		u.volume = 1;
		s.speak(u);
	} catch {
		/* speech is best-effort */
	}
}

export function stopAnnouncer(): void {
	synth()?.cancel();
}

function ordinal(n: number) {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const HYPE_OPEN = ['Oh my!', 'Here we go!', 'Big-time move!', 'Are you kidding me?', 'Stop the presses!'];
const HYPE_CLOSE = ['What a get!', 'The building is shaking!', 'Franchise changer!', 'That is a superstar!', 'Somebody call the league office!'];

const pickOne = (arr: string[], seed: number) => arr[Math.abs(seed) % arr.length];

/** "With the 4th pick, Dave selects… Allen Iverson." */
export function pickLine(o: { pickNo: number; coach: string; player: string; price?: number; superstar?: boolean; callout?: 'steal' | 'reach' | null }): { text: string; hype: boolean } {
	const seed = o.pickNo * 7 + o.player.length;
	let text =
		o.price !== undefined
			? `Sold! ${o.coach} wins ${o.player} for ${o.price} dollars.`
			: `With the ${ordinal(o.pickNo)} pick, ${o.coach} selects… ${o.player}.`;
	if (o.superstar) text = `${pickOne(HYPE_OPEN, seed)} ${text} ${pickOne(HYPE_CLOSE, seed + 3)}`;
	else if (o.callout === 'steal') text += ' What a steal!';
	else if (o.callout === 'reach') text += ' Hmm. That’s a reach.';
	return { text, hype: !!o.superstar };
}
