'use client';

import { useEffect, useRef, useState } from 'react';
import { actingSide, other, playPower, PowerId, powerBlocked, POWERS, Side, VersusState } from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { canSeePrivate, liveInfo } from '@/lib/versus/live';
import { crowdSwell, haptic, play } from '@/lib/versus/sound';
import { announce } from '@/lib/versus/announcer';
import VersusCard from './VersusCard';
import { SIDE_COLORS } from './Fx';
import Icon from './Icon';
import { useLive } from './Live';

// ═══════════════════════════════════════════════════════════════
//  POWER-UP CARDS — each coach holds one secret card for the draft.
//  Played once, on their pick; every screen gets the reveal.
// ═══════════════════════════════════════════════════════════════

/** Face of a power-up card */
export function PowerFace({ id, width = 72, glow }: { id: PowerId; width?: number; glow?: boolean }) {
	const pw = POWERS[id];
	const h = Math.round(width * 1.4);
	const big = width >= 140;
	return (
		<div
			className={`relative rounded-xl overflow-hidden flex flex-col items-center justify-center text-center shrink-0 select-none ${glow ? 'vs-power-glow' : ''}`}
			style={
				{
					width,
					height: h,
					'--pc': pw.color,
					background: `radial-gradient(circle at 50% 30%, ${pw.color}66, transparent 65%), linear-gradient(160deg, ${pw.color}44, #0b0f19 70%)`,
					boxShadow: `0 0 0 1px ${pw.color}`,
				} as React.CSSProperties
			}
		>
			<div className='absolute inset-[5px] rounded-lg border pointer-events-none' style={{ borderColor: `${pw.color}55` }} />
			<Icon name={pw.icon} size={Math.round(width * 0.42)} style={{ color: pw.color, filter: `drop-shadow(0 0 ${big ? 18 : 8}px ${pw.color})` }} />
			<div className={`${big ? 'text-xl mt-3' : 'text-[10px] mt-1.5'} font-black uppercase tracking-wider text-white leading-tight px-1`}>{pw.label}</div>
			{big && <div className='text-[10px] font-black uppercase tracking-[0.3em] text-white/45 mt-1'>Power-up</div>}
		</div>
	);
}

/** Back of a power-up card (the other coach sees this) */
export function PowerBack({ width = 72, color = '#f97316', label }: { width?: number; color?: string; label?: string }) {
	return (
		<div
			className='relative rounded-xl overflow-hidden flex flex-col items-center justify-center shrink-0 vs-card-back select-none'
			style={{ width, height: Math.round(width * 1.4), background: `linear-gradient(160deg, ${color}40, #0b0f19 75%)`, boxShadow: `0 0 0 1px ${color}88` }}
		>
			<Icon name='zap' size={Math.round(width * 0.36)} style={{ color }} className='relative' />
			{label && <div className='relative text-[9px] font-black uppercase tracking-widest text-white/60 mt-1.5 px-1 text-center leading-tight'>{label}</div>}
		</div>
	);
}

/** "Rob has a card" / "Dave used Veto" — public card status for both coaches */
export function PowerChips({ state, big }: { state: VersusState; big?: boolean }) {
	useLive();
	const pw = state.draft?.powers;
	if (!pw) return null;
	const { names } = state.settings;
	const sides = ([0, 1] as Side[]).filter(s => pw.hand[s] || pw.used[s]);
	if (!sides.length) return null;
	return (
		<div className={`flex flex-wrap items-center justify-center ${big ? 'gap-3' : 'gap-1.5'}`}>
			{sides.map(side => {
				const used = pw.used[side];
				// in a live room your own phone may name your card
				const mine = !used && !!liveInfo() && canSeePrivate(side) ? pw.hand[side] : null;
				const color = used ? POWERS[used].color : SIDE_COLORS[side];
				return (
					<span
						key={side}
						className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider ${big ? 'text-base px-4 py-1.5' : 'text-[10px] px-2.5 py-1'} ${used ? 'opacity-60' : ''}`}
						style={{ color, background: `${color}18`, boxShadow: `inset 0 0 0 1px ${color}55` }}
					>
						<Icon name={used ? POWERS[used].icon : mine ? POWERS[mine].icon : 'zap'} />
						<span style={{ color: SIDE_COLORS[side] }}>{names[side]}</span>
						<span className='text-white/70'>{used ? `used ${POWERS[used].label}` : mine ? `· ${POWERS[mine].label}` : 'has a card'}</span>
					</span>
				);
			})}
		</div>
	);
}

/** The coach on the clock: their card, and a Play button */
export function PowerPanel({ state, setState, canAct }: { state: VersusState; setState: (s: VersusState) => void; canAct: boolean }) {
	useLive();
	const d = state.draft!;
	const pw = d.powers;
	const actor = actingSide(d);
	const id = pw?.hand[actor];
	const [peek, setPeek] = useState(false);
	const [armed, setArmed] = useState(false);
	const turnKey = `${d.round}-${d.turn}-${d.log.length}`;
	useEffect(() => {
		setArmed(false);
		setPeek(false);
	}, [turnKey]);
	useEffect(() => {
		if (!armed) return;
		const t = setTimeout(() => setArmed(false), 3000);
		return () => clearTimeout(t);
	}, [armed]);
	if (!pw || !id || pw.used[actor] || d.stage !== 'pick') return null;
	// separate devices: only the owner's phone sees the card (others get the chip row)
	const live = !!liveInfo();
	if (live && (!canSeePrivate(actor) || !canAct)) return null;
	const card = POWERS[id];
	const blocked = powerBlocked(state, actor);
	// one phone: face-down until pressed so the other coach doesn't see it
	const shown = live || peek;
	const color = SIDE_COLORS[actor];
	const holdProps = live
		? {}
		: {
				onPointerDown: (e: React.PointerEvent) => {
					e.preventDefault();
					setPeek(true);
				},
				onPointerUp: () => setPeek(false),
				onPointerLeave: () => setPeek(false),
				onPointerCancel: () => setPeek(false),
				onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
			};
	return (
		<div className='mt-4 rounded-2xl p-2.5 flex items-center gap-3 animate-fade-in' style={{ background: `linear-gradient(135deg, ${shown ? card.color : color}1f, rgba(255,255,255,0.02))`, border: `1px solid ${shown ? card.color : color}44` }}>
			<div {...holdProps} className={`shrink-0 ${live ? '' : 'cursor-pointer touch-none'}`} aria-label={live ? undefined : 'Hold to peek at your card'} role={live ? undefined : 'button'}>
				{shown ? <PowerFace id={id} width={58} glow={!blocked} /> : <PowerBack width={58} color={color} label='Hold' />}
			</div>
			<div className='flex-1 min-w-0'>
				<div className='text-[10px] font-black uppercase tracking-[0.25em] text-white/45'>{state.settings.names[actor]}&apos;s power-up</div>
				{shown ? (
					<>
						<div className='text-base font-black text-white leading-tight' style={{ color: card.color }}>
							{card.label}
						</div>
						<div className='text-[11px] text-white/70 leading-snug'>{card.desc}</div>
						<div className={`text-[10px] font-bold mt-0.5 ${blocked ? 'text-amber-300/90' : 'text-green-400'}`}>{blocked ? `${blocked} · ${card.when}` : 'Ready to play now'}</div>
					</>
				) : (
					<>
						<div className='text-base font-black text-white leading-tight'>Secret card</div>
						<div className='text-[11px] text-white/60 leading-snug'>Hold the card to peek. Keep it hidden from {state.settings.names[other(actor)]}.</div>
						{blocked && <div className='text-[10px] font-bold mt-0.5 text-white/40'>{blocked}</div>}
					</>
				)}
			</div>
			<button
				disabled={!!blocked || !canAct}
				onClick={() => {
					if (!armed) {
						play('tick');
						setArmed(true);
						return;
					}
					setArmed(false);
					setState(playPower(state, actor));
				}}
				className='shrink-0 min-h-[44px] rounded-xl px-3.5 font-black uppercase tracking-wider text-sm text-white disabled:opacity-30 active:scale-95 transition-all'
				style={{ background: blocked ? 'rgba(255,255,255,0.08)' : armed ? card.color : `${card.color}cc`, boxShadow: !blocked ? `0 4px 18px ${card.color}55` : undefined }}
			>
				{armed ? 'Sure?' : 'Play'}
			</button>
		</div>
	);
}

/** Is a Double Pick under way for the coach on the clock? 'first' / 'second' / null */
export function doublePickStep(state: VersusState): 'first' | 'second' | null {
	const d = state.draft;
	const pw = d?.powers;
	if (!d || !pw || d.stage !== 'pick') return null;
	const actor = actingSide(d);
	if (pw.extra === actor) return 'first';
	const lastLog = d.log[d.log.length - 1];
	if (pw.last?.id === 'double' && pw.last.side === actor && pw.used[actor] === 'double' && lastLog && lastLog.side === actor && lastLog.round === d.round && !lastLog.vetoed) return 'second';
	return null;
}

export function DoublePickBanner({ state, big }: { state: VersusState; big?: boolean }) {
	const step = doublePickStep(state);
	if (!step) return null;
	const c = POWERS.double.color;
	const name = state.settings.names[actingSide(state.draft!)];
	return (
		<div className={`${big ? 'mt-0 mb-4 px-5 py-3 text-2xl' : 'mt-3 px-3 py-2 text-sm'} rounded-xl font-black text-white flex items-center justify-center gap-2 vs-pop`} style={{ background: `${c}22`, boxShadow: `inset 0 0 0 1px ${c}88, 0 0 24px ${c}33` }}>
			<Icon name='layers' style={{ color: c }} />
			<span>
				<span style={{ color: c }}>Double Pick</span> — {step === 'first' ? `${big ? name : 'take'} two from this pack` : `${big ? `${name} takes` : 'take'} one more from this pack`}
			</span>
		</div>
	);
}

/** "Banned: Jokic, Curry" — public once the bans are revealed */
export function BannedLine({ state, big }: { state: VersusState; big?: boolean }) {
	const list = state.bans?.revealed !== false ? (state.bans?.list ?? []) : [];
	if (!list.length) return null;
	return (
		<div className={`flex flex-wrap items-center justify-center ${big ? 'gap-2' : 'mt-2 gap-1'}`}>
			<span className={`inline-flex items-center gap-1 font-black uppercase tracking-widest text-red-300/80 ${big ? 'text-sm' : 'text-[10px]'}`}>
				<Icon name='ban' />
				Banned
			</span>
			{list.map(id => {
				const p = getVersusPlayer(id);
				if (!p) return null;
				return (
					<span key={id} className={`rounded-full font-bold text-white/70 bg-red-500/10 line-through decoration-red-400/70 ${big ? 'text-sm px-3 py-1' : 'text-[10px] px-2 py-0.5'}`} style={{ boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.3)' }}>
						{big ? `${p.firstName} ${p.lastName}` : p.lastName}
					</span>
				);
			})}
		</div>
	);
}

type Play = { side: Side; id: PowerId; n: number; player?: string };

/** Full-screen card reveal — every screen, every time a card is played */
export function PowerReveal({ state, play: pl, onDone, tv }: { state: VersusState; play: Play; onDone: () => void; tv?: boolean }) {
	const card = POWERS[pl.id];
	const name = state.settings.names[pl.side];
	const victim = pl.player ? getVersusPlayer(pl.player) : null;
	useEffect(() => {
		play('power');
		haptic('power');
		if (tv) crowdSwell(0.5);
		announce(`${name} plays ${card.label}!${victim ? ` ${victim.firstName} ${victim.lastName} is out.` : ''}`, { hype: true });
		const t = setTimeout(onDone, victim ? 3200 : 2600);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const color = SIDE_COLORS[pl.side];
	return (
		<div
			className='fixed inset-0 z-[70] flex flex-col items-center justify-center px-6 text-center cursor-pointer select-none animate-fade-in'
			onClick={onDone}
			style={{ background: `radial-gradient(ellipse 60% 50% at 50% 42%, ${card.color}55, transparent 70%), radial-gradient(ellipse 90% 60% at 50% 100%, ${color}33, transparent 70%), rgba(0,0,0,0.92)` }}
		>
			<div className='absolute inset-0 vs-flash pointer-events-none' style={{ background: card.color }} />
			<div className={`${tv ? 'text-2xl' : 'text-[11px]'} font-black uppercase tracking-[0.4em] text-white/55 mb-4 vs-rise`}>Power-up</div>
			<div className='vs-pick-flip'>
				<PowerFace id={pl.id} width={tv ? 260 : 170} glow />
			</div>
			<div className={`${tv ? 'text-7xl mt-8' : 'text-3xl mt-5'} font-black uppercase leading-none tracking-tight vs-slam`} style={{ animationDelay: '600ms' }}>
				<span style={{ color }}>{name}</span> <span className='text-white'>plays</span> <span style={{ color: card.color, textShadow: `0 0 30px ${card.color}` }}>{card.label}</span>
			</div>
			<div className={`${tv ? 'text-3xl mt-5 max-w-4xl' : 'text-sm mt-3 max-w-xs'} text-white/75 font-semibold vs-rise`} style={{ animationDelay: '850ms' }}>
				{card.desc}
			</div>
			{victim && (
				<div className={`${tv ? 'mt-8 gap-5' : 'mt-5 gap-3'} flex items-center vs-rise`} style={{ animationDelay: '1100ms' }}>
					<VersusCard player={victim} width={tv ? 130 : 76} style={{ filter: 'grayscale(0.8)', transform: 'rotate(-6deg)' }} />
					<div className='text-left'>
						<div className={`${tv ? 'text-lg' : 'text-[10px]'} font-black uppercase tracking-[0.3em] text-red-400`}>{pl.id === 'veto' ? 'Vetoed' : 'Locked down'}</div>
						<div className={`${tv ? 'text-5xl' : 'text-2xl'} font-black text-white leading-tight`}>{victim.lastName}</div>
						<div className={`${tv ? 'text-xl' : 'text-xs'} text-white/55`}>Banned for this draft</div>
					</div>
				</div>
			)}
			<div className={`absolute bottom-8 ${tv ? 'text-sm' : 'text-[10px]'} text-white/30 uppercase tracking-widest`}>Tap to skip</div>
		</div>
	);
}

/** Lockdown fires after the pick — a short toast names who got banned */
function BanToast({ text, color, tv }: { text: string; color: string; tv?: boolean }) {
	return (
		<div className={`fixed ${tv ? 'top-10 text-3xl px-8 py-4' : 'top-24 text-sm px-4 py-2'} left-1/2 -translate-x-1/2 z-[66] rounded-2xl font-black text-white shadow-2xl vs-pop whitespace-nowrap`} style={{ background: '#0b0f19', boxShadow: `inset 0 0 0 2px ${color}, 0 10px 40px ${color}55` }}>
			<span className='inline-flex items-center gap-2'>
				<Icon name='lock' style={{ color }} />
				{text}
			</span>
		</div>
	);
}

/**
 * Watches `draft.powers.last` and shows the reveal on this screen whenever a
 * new card is played (never re-shown on remount). Returns the overlay and
 * whether it's up (to pause the shot clock).
 */
export function usePowerFx(state: VersusState, tv?: boolean): { node: React.ReactNode; active: boolean } {
	const last = state.draft?.powers?.last ?? null;
	const keyOf = (l: Play | null) => (l ? `${l.n}-${l.player ?? ''}` : '');
	const seen = useRef({ n: last?.n ?? 0, key: keyOf(last) });
	const [show, setShow] = useState<Play | null>(null);
	const [toast, setToast] = useState<string | null>(null);
	useEffect(() => {
		if (!last) return;
		const prev = seen.current;
		if (last.n > prev.n) setShow(last);
		else if (last.n === prev.n && keyOf(last) !== prev.key && last.player && last.id === 'lockdown') {
			const p = getVersusPlayer(last.player);
			if (p) {
				play('gavel');
				setToast(`Lockdown — ${p.firstName} ${p.lastName} is banned`);
			}
		}
		seen.current = { n: Math.max(prev.n, last.n), key: keyOf(last) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [last?.n, last?.player]);
	useEffect(() => {
		if (!toast) return;
		const t = setTimeout(() => setToast(null), 2800);
		return () => clearTimeout(t);
	}, [toast]);
	const node = (
		<>
			{show && <PowerReveal key={show.n} state={state} play={show} tv={tv} onDone={() => setShow(null)} />}
			{toast && <BanToast text={toast} color={POWERS.lockdown.color} tv={tv} />}
		</>
	);
	return { node, active: !!show };
}
