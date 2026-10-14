'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { belt } from '@/lib/versus/legacy';
import { history } from '@/lib/versus/history';
import { haptic, play } from '@/lib/versus/sound';
import Icon from './Icon';
import { Confetti, SIDE_COLORS } from './Fx';

type Side = 0 | 1;

/**
 * Small gold belt next to the holder's name. `side` = the coach this name
 * belongs to; renders nothing unless they hold the belt right now.
 * Reads the head-to-head history (re-seated to the current names).
 */
export function BeltBadge({ side, size = 'sm', showDefenses = false }: { side: 0 | 1; size?: 'sm' | 'lg'; showDefenses?: boolean }) {
	const b = belt(history());
	if (!b || b.holder !== side) return null;
	const lg = size === 'lg';
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wider align-middle ${lg ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[9px]'}`}
			style={{ background: 'linear-gradient(135deg, #facc15, #b45309)', color: '#1c1206', boxShadow: '0 0 12px rgba(250,204,21,0.35)' }}
			title={`Belt holder · ${b.defenses} straight defense${b.defenses === 1 ? '' : 's'}`}
		>
			<Icon name='award' size={lg ? 14 : 10} strokeWidth={2.75} />
			{showDefenses || lg ? `Belt${b.defenses ? ` · ${b.defenses}` : ''}` : 'Belt'}
		</span>
	);
}

/** The belt itself: leather strap, side plates and a big gold center plate */
export function BeltGraphic({ width = 320, color }: { width?: number; color?: string }) {
	const h = Math.round(width * 0.36);
	return (
		<div className='relative mx-auto' style={{ width, height: h }}>
			<svg width={width} height={h} viewBox='0 0 320 116' className='absolute inset-0' aria-hidden>
				<defs>
					<linearGradient id='beltGold' x1='0' y1='0' x2='1' y2='1'>
						<stop offset='0' stopColor='#fef08a' />
						<stop offset='0.45' stopColor='#facc15' />
						<stop offset='0.7' stopColor='#ca8a04' />
						<stop offset='1' stopColor='#fde047' />
					</linearGradient>
					<linearGradient id='beltStrap' x1='0' y1='0' x2='0' y2='1'>
						<stop offset='0' stopColor='#292524' />
						<stop offset='0.5' stopColor={color ?? '#1c1917'} stopOpacity='0.55' />
						<stop offset='1' stopColor='#0c0a09' />
					</linearGradient>
				</defs>
				{/* strap */}
				<rect x='0' y='38' width='320' height='40' rx='10' fill='url(#beltStrap)' stroke='#000' strokeOpacity='0.5' />
				<line x1='6' y1='44' x2='314' y2='44' stroke='#facc15' strokeOpacity='0.35' strokeDasharray='4 4' />
				<line x1='6' y1='72' x2='314' y2='72' stroke='#facc15' strokeOpacity='0.35' strokeDasharray='4 4' />
				{/* side plates */}
				{[38, 250].map(x => (
					<g key={x}>
						<rect x={x} y='32' width='32' height='52' rx='6' fill='url(#beltGold)' stroke='#78350f' strokeWidth='1.5' />
						<circle cx={x + 16} cy='58' r='8' fill='none' stroke='#78350f' strokeWidth='1.5' />
						<circle cx={x + 16} cy='58' r='3' fill={color ?? '#dc2626'} />
					</g>
				))}
				{/* center plate */}
				<path d='M160 2 L214 18 L232 58 L214 98 L160 114 L106 98 L88 58 L106 18 Z' fill='url(#beltGold)' stroke='#78350f' strokeWidth='2' />
				<path d='M160 14 L204 27 L219 58 L204 89 L160 102 L116 89 L101 58 L116 27 Z' fill='none' stroke='#92400e' strokeOpacity='0.6' strokeWidth='1.5' />
				{[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
					const a = (i / 8) * Math.PI * 2;
					return <circle key={i} cx={160 + Math.cos(a) * 50} cy={58 + Math.sin(a) * 36} r='2.6' fill='#fff' fillOpacity='0.85' />;
				})}
			</svg>
			<div className='absolute inset-0 flex flex-col items-center justify-center' style={{ color: '#451a03' }}>
				<Icon name='crown' size={Math.round(width * 0.09)} strokeWidth={2.5} />
				<div className='font-black uppercase leading-none' style={{ fontSize: Math.round(width * 0.032), letterSpacing: '0.18em' }}>
					Champion
				</div>
			</div>
		</div>
	);
}

/** Full-screen "the belt changes hands" moment. `from` = null for the first ever holder. */
export function BeltCutscene({ names, from, to, onDone }: { names: [string, string]; from: Side | null; to: Side; onDone: () => void }) {
	useEffect(() => {
		play('boom');
		haptic('win');
		const t1 = setTimeout(() => play('crowd'), 500);
		const t2 = setTimeout(onDone, 7000);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	if (typeof document === 'undefined') return null;
	const w = typeof window === 'undefined' ? 320 : Math.min(420, window.innerWidth - 40);
	return createPortal(
		<div className='fixed inset-0 z-[95] flex flex-col items-center justify-center px-5 text-center overflow-hidden animate-fade-in' style={{ background: `radial-gradient(circle at 50% 42%, ${SIDE_COLORS[to]}55, #0a0e17 62%)` }} onClick={onDone} role='dialog' aria-label='New belt champion'>
			<Confetti count={120} colors={['#facc15', '#fde68a', SIDE_COLORS[to], '#ffffff']} />
			<div className='text-[11px] sm:text-sm font-black uppercase tracking-[0.4em] text-yellow-200/80 vs-rise'>The belt changes hands</div>
			<div className='my-5 vs-zoom-in'>
				<BeltGraphic width={w} color={SIDE_COLORS[to]} />
			</div>
			<div className='text-4xl sm:text-6xl font-black text-yellow-300 tracking-tight vs-slam drop-shadow-[0_0_24px_rgba(250,204,21,0.5)]'>NEW CHAMPION</div>
			<div className='mt-4 flex items-center justify-center gap-3 text-2xl sm:text-4xl font-black vs-rise' style={{ animationDelay: '0.6s' }}>
				{from !== null ? (
					<>
						<span className='line-through decoration-2' style={{ color: SIDE_COLORS[from], opacity: 0.55 }}>
							{names[from]}
						</span>
						<Icon name='arrowRight' className='text-white/60' />
					</>
				) : null}
				<span style={{ color: SIDE_COLORS[to] }}>{names[to]}</span>
			</div>
			<div className='text-sm text-white/55 mt-2 vs-rise' style={{ animationDelay: '0.9s' }}>
				{from !== null ? `${names[to]} beat the champ. Every game from here is a title defense.` : `${names[to]} is the first to wear it. Every game is a title defense.`}
			</div>
			<button onClick={onDone} className='mt-8 min-h-[44px] rounded-2xl px-8 py-3 font-black uppercase tracking-wider text-[#1c1206]' style={{ background: 'linear-gradient(135deg, #facc15, #b45309)' }}>
				Continue
			</button>
		</div>,
		document.body,
	);
}

/** Smaller inline moment when the holder kept it */
export function BeltDefense({ names, holder, defenses }: { names: [string, string]; holder: Side; defenses: number }) {
	return (
		<div className='rounded-2xl border border-yellow-400/40 p-4 mb-4 flex items-center gap-3 vs-rise' style={{ background: `linear-gradient(160deg, rgba(250,204,21,0.12), ${SIDE_COLORS[holder]}14 70%)` }}>
			<div className='shrink-0 -my-2'>
				<BeltGraphic width={110} color={SIDE_COLORS[holder]} />
			</div>
			<div className='min-w-0'>
				<div className='text-[10px] font-black uppercase tracking-widest text-yellow-300/80'>Title defense</div>
				<div className='text-lg font-black text-white leading-tight'>
					<span style={{ color: SIDE_COLORS[holder] }}>{names[holder]}</span> defends the belt
				</div>
				<div className='text-[12px] text-white/60'>
					{defenses} straight defense{defenses === 1 ? '' : 's'}
				</div>
			</div>
		</div>
	);
}
