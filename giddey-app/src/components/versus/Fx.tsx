'use client';

import { useEffect, useMemo, useState } from 'react';
import { buzz, play } from '@/lib/versus/sound';
import { broadcastFx } from '@/lib/versus/live';

/**
 * Each coach's color. Mutable on purpose: the Versus page calls
 * setSideColors() with the coaches' chosen colors at the top of every
 * render, so every component reading SIDE_COLORS[side] picks them up.
 */
export const SIDE_COLORS: [string, string] = ['#f97316', '#38bdf8'];

export function setSideColors(colors: [string, string]) {
	SIDE_COLORS[0] = colors[0];
	SIDE_COLORS[1] = colors[1];
}

/** Burst of confetti — remount (change key) to replay */
export function Confetti({ count = 70, colors = ['#f97316', '#38bdf8', '#facc15', '#a855f7', '#22c55e', '#ffffff'] }: { count?: number; colors?: string[] }) {
	const bits = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => ({
				left: Math.random() * 100,
				delay: Math.random() * 0.35,
				dur: 1.6 + Math.random() * 1.4,
				dx: (Math.random() - 0.5) * 260,
				rot: Math.random() * 720 - 360,
				size: 6 + Math.random() * 7,
				color: colors[i % colors.length],
				round: Math.random() > 0.6,
			})),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[count]
	);
	return (
		<div className='pointer-events-none fixed inset-0 z-[60] overflow-hidden'>
			{bits.map((b, i) => (
				<span
					key={i}
					className='absolute vs-confetti'
					style={
						{
							left: `${b.left}%`,
							top: -20,
							width: b.size,
							height: b.round ? b.size : b.size * 0.45,
							background: b.color,
							borderRadius: b.round ? '50%' : 2,
							animationDelay: `${b.delay}s`,
							animationDuration: `${b.dur}s`,
							'--dx': `${b.dx}px`,
							'--rot': `${b.rot}deg`,
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	);
}

/** 3D coin flip. Result is decided on click, the coin lands on it. */
export function CoinFlip({ names, onResult, forced, mirror }: { names: [string, string]; onResult: (winner: 0 | 1) => void; forced?: 0 | 1; mirror?: boolean }) {
	const [rot, setRot] = useState(0);
	const [flipping, setFlipping] = useState(false);
	const [winner, setWinner] = useState<0 | 1 | null>(null);

	const flip = (replay?: 0 | 1) => {
		if (flipping || winner !== null) return;
		const w: 0 | 1 = replay ?? (Math.random() < 0.5 ? 0 : 1);
		if (replay === undefined && mirror) broadcastFx({ kind: 'coin', names, winner: w });
		play('whoosh');
		setFlipping(true);
		setRot(360 * 8 + (w === 1 ? 180 : 0));
		setTimeout(() => {
			setFlipping(false);
			play('coin');
			buzz([30, 40, 60]);
			setWinner(w);
			onResult(w);
		}, 2300);
	};

	const face = (side: 0 | 1) => (
		<div
			className='absolute inset-0 rounded-full flex flex-col items-center justify-center font-black text-white'
			style={{
				backfaceVisibility: 'hidden',
				transform: side === 1 ? 'rotateY(180deg)' : undefined,
				background: `radial-gradient(circle at 35% 30%, ${SIDE_COLORS[side]}ee, ${SIDE_COLORS[side]}88 60%, #0a0e17 140%)`,
				border: '6px solid rgba(255,255,255,0.85)',
				boxShadow: `inset 0 0 0 4px ${SIDE_COLORS[side]}, 0 0 40px ${SIDE_COLORS[side]}88`,
			}}
		>
			<div className='text-[11px] tracking-[0.3em] opacity-80'>{side === 0 ? 'HEADS' : 'TAILS'}</div>
			<div className='text-2xl leading-tight px-3 text-center break-all'>{names[side]}</div>
		</div>
	);

	useEffect(() => {
		if (forced !== undefined) flip(forced);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className='flex flex-col items-center gap-6'>
			<div style={{ perspective: 800 }} onClick={() => forced === undefined && flip()} className={winner === null ? 'cursor-pointer' : ''}>
				<div
					className='relative w-44 h-44'
					style={{
						transformStyle: 'preserve-3d',
						transform: `rotateY(${rot}deg) translateY(${flipping ? -10 : 0}px)`,
						transition: flipping ? 'transform 2.2s cubic-bezier(0.2, 0.7, 0.2, 1)' : 'none',
					}}
				>
					{face(0)}
					{face(1)}
				</div>
			</div>
			{winner === null && forced === undefined && (
				<button onClick={() => flip()} disabled={flipping} className='btn-primary text-white font-black uppercase tracking-wider px-8 py-3 rounded-xl disabled:opacity-50'>
					{flipping ? 'In the air…' : 'Flip the coin'}
				</button>
			)}
		</div>
	);
}

export function Pill({ children, color }: { children: React.ReactNode; color: string }) {
	return (
		<span className='inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full' style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
			{children}
		</span>
	);
}

export function SectionTitle({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
	return (
		<div className='text-center mb-5'>
			{kicker && <div className='text-[11px] font-black uppercase tracking-[0.3em] text-orange-400 mb-1'>{kicker}</div>}
			<h2 className='text-2xl sm:text-3xl font-black text-white tracking-tight'>{title}</h2>
			{sub && <p className='text-sm text-white/50 mt-1 max-w-md mx-auto'>{sub}</p>}
		</div>
	);
}
