'use client';

import { useEffect, useRef, useState } from 'react';
import { BAND_INFO, bandOf, Side, teamName, VersusState } from '@/lib/versus/engine';
import { getVersusPlayer, VersusPlayer } from '@/lib/versus/pool';
import { getPlayerHeadshotUrls } from '@/lib/images';
import { CATEGORY_INFO, Category, lineupChemistry } from '@/lib/versus/chemistry';
import { buzz, play } from '@/lib/versus/sound';
import { getBoost } from '@/lib/versus/wheels';
import Headshot from '@/components/Headshot';
import VersusCard from './VersusCard';
import { Confetti, SIDE_COLORS } from './Fx';

export function ordinal(n: number) {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── commissioner intro ─────────────────────────────────────────

export function CommissionerIntro({ state, onDone }: { state: VersusState; onDone: () => void }) {
	const [step, setStep] = useState(0);
	const first = state.draft?.order[0] ?? 0;
	const year = new Date().getFullYear();
	const lines = [
		{ kicker: 'Ladies and gentlemen…', text: 'The commissioner approaches the podium', sound: 'crowd' as const },
		{ kicker: `Game ${state.gameNo}`, text: `Welcome to the ${year} Giddey Versus Draft`, sound: 'gavel' as const },
		{ kicker: 'Tonight', text: `${teamName(state.settings, 0)}  vs  ${teamName(state.settings, 1)}`, sound: 'whoosh' as const },
		{ kicker: 'With the first pick', text: `${state.settings.names[first]} is on the clock`, sound: 'whoosh' as const },
	];
	useEffect(() => {
		play(lines[step].sound);
		const t = setTimeout(() => (step + 1 < lines.length ? setStep(step + 1) : onDone()), step === lines.length - 1 ? 1500 : 1500);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step]);
	const line = lines[step];
	return (
		<div className='fixed inset-0 z-[65] bg-black flex flex-col items-center justify-center px-6 text-center cursor-pointer select-none' onClick={onDone}>
			{/* spotlight */}
			<div className='absolute inset-0 pointer-events-none' style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 35%, rgba(255,255,255,0.10), transparent 70%)' }} />
			{/* podium */}
			<div className='absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-32 rounded-t-2xl vs-rise' style={{ background: 'linear-gradient(180deg, #1f2937, #0b0f19)', boxShadow: '0 -10px 60px rgba(249,115,22,0.15)' }}>
				<div className='mt-5 text-[10px] font-black tracking-[0.4em] text-white/40'>GIDDEY</div>
				<div className='text-xs font-black tracking-[0.3em] bg-gradient-to-r from-orange-500 to-sky-500 bg-clip-text text-transparent'>VERSUS DRAFT</div>
			</div>
			<div key={step} className='relative'>
				<div className='text-[11px] font-black uppercase tracking-[0.4em] text-white/50 mb-3 vs-rise'>{line.kicker}</div>
				<div className='text-3xl sm:text-5xl font-black text-white leading-tight vs-rise max-w-2xl' style={{ animationDelay: '120ms', color: step === 3 ? SIDE_COLORS[first] : undefined }}>
					{line.text}
				</div>
			</div>
			<div className='absolute bottom-40 text-[10px] text-white/30 uppercase tracking-widest'>Tap to skip</div>
		</div>
	);
}

// ─── shot clock ─────────────────────────────────────────────────

/**
 * Counts down `seconds` for whoever's on the clock. Resets when `key`
 * changes, freezes while `paused`, beeps the last 5 and calls `onExpire`.
 */
export function useShotClock(key: string, seconds: number, paused: boolean, onExpire: () => void): number {
	// Time left is stored with the turn it belongs to. A new turn (or the clock
	// switching on, e.g. after the franchise wheel lands) always starts full —
	// never from a stale 0 left over while the clock was off.
	const [clock, setClock] = useState({ key, seconds, left: seconds });
	const left = clock.key === key && clock.seconds === seconds ? clock.left : seconds;
	const expire = useRef(onExpire);
	expire.current = onExpire;
	const fired = useRef<string | null>(null);
	useEffect(() => {
		if (!seconds || paused) return;
		if (left <= 0) {
			if (fired.current === key) return;
			fired.current = key;
			play('buzzer');
			buzz(300);
			expire.current();
			return;
		}
		const t = setTimeout(() => {
			if (left <= 6 && left > 1) play('beep');
			setClock({ key, seconds, left: left - 1 });
		}, 1000);
		return () => clearTimeout(t);
	}, [key, left, paused, seconds]);
	return left;
}

export function ShotClockRing({ left, total, color }: { left: number; total: number; color: string }) {
	if (!total) return null;
	const r = 20;
	const c = 2 * Math.PI * r;
	const pct = Math.max(0, left / total);
	const danger = left <= 5;
	return (
		<div className={`relative w-12 h-12 shrink-0 ${danger ? 'vs-shake' : ''}`} title='Shot clock'>
			<svg viewBox='0 0 48 48' className='w-12 h-12 -rotate-90'>
				<circle cx='24' cy='24' r={r} fill='rgba(0,0,0,0.4)' stroke='rgba(255,255,255,0.12)' strokeWidth='4' />
				<circle cx='24' cy='24' r={r} fill='none' stroke={danger ? '#ef4444' : color} strokeWidth='4' strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap='round' style={{ transition: 'stroke-dashoffset 1s linear' }} />
			</svg>
			<div className={`absolute inset-0 flex items-center justify-center font-black tabular-nums ${danger ? 'text-red-400' : 'text-white'}`} style={{ fontSize: 16 }}>
				{Math.max(0, left)}
			</div>
		</div>
	);
}

export function ViolationToast({ text }: { text: string }) {
	return (
		<div className='fixed top-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-black shadow-2xl vs-pop whitespace-nowrap'>
			⏱️ {text}
		</div>
	);
}

// ─── pick reveals ───────────────────────────────────────────────

function isBoom(state: VersusState, side: Side, p: VersusPlayer): boolean {
	return p.overall >= 95 || bandOf(state.settings, side, p.id) === 'superstar';
}

/** Full-screen "BOOM" for superstar picks */
function BoomReveal({ state, side, player: p, pickNo, price, onDone }: { state: VersusState; side: Side; player: VersusPlayer; pickNo: number; price?: number; onDone: () => void }) {
	useEffect(() => {
		play('boom');
		buzz(250);
		const t = setTimeout(onDone, 3200);
		return () => clearTimeout(t);
	}, [onDone]);
	const color = SIDE_COLORS[side];
	return (
		<div className='fixed inset-0 z-[60] overflow-hidden cursor-pointer select-none vs-boom-shake' onClick={onDone} style={{ background: `radial-gradient(ellipse at 50% 40%, ${color}66, transparent 70%), rgba(0,0,0,0.94)` }}>
			<div className='absolute inset-0 vs-flash bg-white pointer-events-none' />
			<Confetti count={110} colors={[color, '#facc15', '#ffffff']} />
			{/* giant headshot */}
			<div className='absolute inset-x-0 top-[8%] flex justify-center vs-zoom-in'>
				<div className='relative w-[78vw] max-w-[440px] aspect-[1.25]'>
					<Headshot
						urls={getPlayerHeadshotUrls(p.id.replace(/^at_/, ''), p.firstName, p.lastName, p.era)}
						alt=''
						className='absolute inset-0 w-full h-full'
						style={{ objectFit: 'contain', objectPosition: 'bottom center', filter: `drop-shadow(0 0 40px ${color})` }}
						fallback={
							<div className='absolute inset-0 flex items-center justify-center'>
								<div className='w-2/3 aspect-square rounded-full flex items-center justify-center text-7xl font-black text-white' style={{ background: `linear-gradient(135deg, ${color}, #111)` }}>
									{p.firstName[0]}
									{p.lastName[0]}
								</div>
							</div>
						}
					/>
				</div>
			</div>
			<div className='absolute inset-x-0 top-[44%] text-center vs-slam'>
				<div className='text-[22vw] sm:text-[160px] font-black leading-none tracking-tighter text-white' style={{ textShadow: `0 0 40px ${color}, 0 8px 0 rgba(0,0,0,0.5)`, WebkitTextStroke: `3px ${color}` }}>
					BOOM
				</div>
			</div>
			<div className='absolute inset-x-0 bottom-[12%] text-center px-6'>
				<div className='text-[11px] font-black uppercase tracking-[0.35em] text-white/60 vs-rise' style={{ animationDelay: '500ms' }}>
					{price !== undefined ? `Sold for $${price}` : `With the ${ordinal(pickNo)} pick`} · {state.settings.names[side]}
				</div>
				<div className='text-4xl sm:text-5xl font-black text-white vs-rise' style={{ animationDelay: '650ms' }}>
					{p.firstName} {p.lastName}
				</div>
				<div className='mt-1 inline-flex items-center gap-2 vs-rise' style={{ animationDelay: '800ms' }}>
					<span className='px-2 py-0.5 rounded-md font-black text-white' style={{ background: BAND_INFO.superstar.color }}>
						{p.overall} OVR
					</span>
					<span className='text-white/60 font-bold'>
						{p.position}/{p.secondaryPosition}
					</span>
				</div>
			</div>
		</div>
	);
}

/** "With the 3rd pick, Rob selects…" overlay — BOOMs for superstars */
export function PickReveal({ state, onDone }: { state: VersusState; onDone: () => void }) {
	const lp = state.draft!.lastPick!;
	const p = getVersusPlayer(lp.id)!;
	const pickNo = state.draft!.log.length;
	const boom = isBoom(state, lp.side, p);
	useEffect(() => {
		if (boom) return;
		play('reveal');
		const t = setTimeout(onDone, 1900);
		return () => clearTimeout(t);
	}, [onDone, boom]);
	if (boom) return <BoomReveal state={state} side={lp.side} player={p} pickNo={pickNo} price={lp.price} onDone={onDone} />;
	return (
		<div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm' onClick={onDone}>
			<div className='text-[11px] font-black uppercase tracking-[0.35em] text-white/50 mb-1 vs-rise'>{lp.price !== undefined ? `Sold for $${lp.price}` : `With the ${ordinal(pickNo)} pick`}</div>
			<div className='text-3xl font-black mb-5 vs-rise' style={{ color: SIDE_COLORS[lp.side], animationDelay: '120ms' }}>
				{state.settings.names[lp.side]} {lp.price !== undefined ? 'wins' : 'selects'}
			</div>
			<div className='vs-pick-flip'>
				<VersusCard player={p} width={190} />
			</div>
			<div className='mt-5 text-center vs-rise' style={{ animationDelay: '700ms' }}>
				<div className='text-2xl font-black text-white'>
					{p.firstName} {p.lastName}
				</div>
				<div className='text-sm text-white/50'>
					{p.overall} OVR · {p.position}/{p.secondaryPosition}
				</div>
			</div>
		</div>
	);
}

/** Blind-bid round: both secret picks flip over at once */
export function BlindReveal({ state, picks, collision, onDone }: { state: VersusState; picks: [string, string] | null; collision: string | null; onDone: () => void }) {
	useEffect(() => {
		play(collision ? 'collision' : 'reveal');
		if (collision) buzz(200);
		const t = setTimeout(onDone, collision ? 2600 : 2400);
		return () => clearTimeout(t);
	}, [onDone, collision]);
	const { names } = state.settings;
	if (collision) {
		const p = getVersusPlayer(collision)!;
		return (
			<div className='fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm px-6 text-center vs-boom-shake' onClick={onDone}>
				<div className='text-6xl mb-3'>💥</div>
				<div className='text-4xl font-black text-red-400 mb-2 vs-slam'>COLLISION!</div>
				<div className='text-white/70 mb-5'>You both went for him. Nobody gets him — new pack.</div>
				<div className='flex gap-3 items-center'>
					<VersusCard player={p} width={130} style={{ transform: 'rotate(-8deg)', filter: 'grayscale(0.7)' }} />
				</div>
			</div>
		);
	}
	const [a, b] = picks!;
	const order = state.draft!.order;
	return (
		<div className='fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm px-4 text-center' onClick={onDone}>
			<div className='text-[11px] font-black uppercase tracking-[0.35em] text-white/50 mb-4 vs-rise'>Blind bid — revealed</div>
			<div className='flex gap-4 items-end'>
				{[a, b].map((id, i) => (
					<div key={id} className='flex flex-col items-center gap-2'>
						<div className='text-sm font-black' style={{ color: SIDE_COLORS[order[i]] }}>
							{names[order[i]]}
						</div>
						<div className='vs-pick-flip' style={{ animationDelay: `${i * 250}ms` }}>
							<VersusCard player={getVersusPlayer(id)!} width={140} />
						</div>
					</div>
				))}
			</div>
			<div className='mt-5 text-green-400 font-black vs-rise' style={{ animationDelay: '800ms' }}>
				No collision — both picks stand.
			</div>
		</div>
	);
}

/** Pass-the-phone screen for secret actions */
export function Handoff({ to, name, note, onReady }: { to: Side; name: string; note?: string; onReady: () => void }) {
	return (
		<div className='fixed inset-0 z-[55] bg-[#0a0e17] flex flex-col items-center justify-center px-6 text-center animate-fade-in'>
			<div className='text-5xl mb-4'>🙈</div>
			<div className='text-sm text-white/50 uppercase tracking-widest font-bold mb-2'>Hand the phone to</div>
			<div className='text-5xl font-black mb-3' style={{ color: SIDE_COLORS[to] }}>
				{name}
			</div>
			{note && <div className='text-sm text-white/50 mb-8 max-w-xs'>{note}</div>}
			<button onClick={onReady} className='btn-primary text-white font-black uppercase tracking-wider px-8 py-3 rounded-xl'>
				I&apos;m {name} — go
			</button>
		</div>
	);
}

// ─── chemistry readout ──────────────────────────────────────────

export function ChemBars({ ids, rosterSize, color, compact }: { ids: string[]; rosterSize: number; color: string; compact?: boolean }) {
	const chem = lineupChemistry(ids, rosterSize);
	const cats: Category[] = rosterSize > 5 ? ['shooting', 'playmaking', 'rim', 'rebounding', 'depth'] : ['shooting', 'playmaking', 'rim', 'rebounding'];
	if (!ids.length) return null;
	return (
		<div className={compact ? 'space-y-1' : 'space-y-1.5'}>
			{cats.map(cat => {
				const v = chem.ratings[cat];
				const pct = Math.max(0, Math.min(100, ((v - 60) / 39) * 100));
				const weak = chem.weakest === cat;
				return (
					<div key={cat} className='flex items-center gap-1.5'>
						<div className={`${compact ? 'w-7 text-[8px]' : 'w-24 text-[10px]'} font-black uppercase tracking-wider shrink-0 ${weak ? 'text-amber-300' : 'text-white/45'}`}>{compact ? CATEGORY_INFO[cat].short : CATEGORY_INFO[cat].label}</div>
						<div className={`flex-1 ${compact ? 'h-1' : 'h-1.5'} rounded-full bg-white/10 overflow-hidden`}>
							<div className='h-full rounded-full transition-all duration-700' style={{ width: `${pct}%`, background: weak ? '#f59e0b' : color }} />
						</div>
						<div className={`${compact ? 'w-5 text-[9px]' : 'w-7 text-[11px]'} text-right font-black tabular-nums ${weak ? 'text-amber-300' : 'text-white/70'}`}>{v || '–'}</div>
					</div>
				);
			})}
			{chem.hint && ids.length >= 3 && <div className={`${compact ? 'text-[9px]' : 'text-[11px]'} text-amber-300/90 font-bold leading-tight pt-0.5`}>⚠️ {chem.hint}</div>}
		</div>
	);
}

// ─── challenge rewards in effect ────────────────────────────────

export function RewardBanner({ state }: { state: VersusState }) {
	const rewards = state.draft?.rewards;
	if (!rewards || (!rewards[0].length && !rewards[1].length)) return null;
	return (
		<div className='mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2 space-y-1'>
			<div className='text-[10px] font-black uppercase tracking-widest text-amber-300'>🎁 Challenge rewards this draft</div>
			{([0, 1] as Side[]).map(side =>
				rewards[side].length ? (
					<div key={side} className='text-[12px] text-white/80 flex flex-wrap gap-x-2'>
						<span className='font-black' style={{ color: SIDE_COLORS[side] }}>
							{state.settings.names[side]}:
						</span>
						{rewards[side].map((r, i) => {
							const b = getBoost(r);
							return b ? (
								<span key={i}>
									{b.icon} {b.label}
								</span>
							) : null;
						})}
					</div>
				) : null
			)}
		</div>
	);
}
