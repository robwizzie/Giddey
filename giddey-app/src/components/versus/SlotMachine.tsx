'use client';

import { useEffect, useRef, useState } from 'react';
import { weightedIndex } from '@/lib/versus/wheels';
import { buzz, play } from '@/lib/versus/sound';
import { broadcastFx } from '@/lib/versus/live';
import Icon from './Icon';

export interface ReelItem {
	id: string;
	label: string;
	sub?: string;
	color: string;
	weight?: number;
}

export interface Reel {
	title: string;
	items: ReelItem[];
}

const ITEM_H = 92;
const CYCLES = 9;

/**
 * Slot machine: every reel spins at once and stops left to right.
 * Results are decided (by weight) the moment the lever is pulled.
 */
export default function SlotMachine({ reels, onDone, accent = '#f97316', forced, mirror }: { reels: Reel[]; onDone: (picks: number[]) => void; accent?: string; forced?: number[]; mirror?: string }) {
	const [targets, setTargets] = useState<number[] | null>(null);
	const [stopped, setStopped] = useState<boolean[]>(reels.map(() => false));
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	useEffect(() => () => timers.current.forEach(clearTimeout), []);

	const durations = reels.map((_, i) => 1700 + i * 750);

	const pull = (replay?: number[]) => {
		if (targets) return;
		const picks = replay ?? reels.map(r => weightedIndex(r.items.map(it => ({ weight: it.weight ?? 1 }))));
		if (!replay && mirror) broadcastFx({ kind: 'slot', title: mirror, reels: reels.map(r => ({ title: r.title, items: r.items.map(({ id, label, color }) => ({ id, label, color })) })), picks });
		setTargets(picks);
		play('whoosh');
		// ticking that slows down
		let t = 0;
		const tick = () => {
			t++;
			play('tick');
			const delay = 45 + t * t * 0.9;
			if (delay < durations[durations.length - 1] * 0.45) timers.current.push(setTimeout(tick, delay));
		};
		tick();
		reels.forEach((_, i) =>
			timers.current.push(
				setTimeout(() => {
					play('gavel');
					buzz(30);
					setStopped(s => s.map((x, j) => (j === i ? true : x)));
				}, durations[i])
			)
		);
		timers.current.push(setTimeout(() => onDone(picks), durations[durations.length - 1] + 900));
	};

	useEffect(() => {
		if (forced) pull(forced);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className='w-full max-w-md mx-auto'>
			<div className='rounded-3xl p-3 border-2 relative' style={{ borderColor: `${accent}88`, background: 'linear-gradient(180deg, #1f2937, #0b0f19)', boxShadow: `0 0 40px ${accent}33, inset 0 2px 0 rgba(255,255,255,0.06)` }}>
				{/* marquee lights */}
				<div className='flex justify-center gap-2 mb-2'>
					{Array.from({ length: 9 }, (_, i) => (
						<span key={i} className={`w-1.5 h-1.5 rounded-full ${targets && !stopped[stopped.length - 1] ? 'vs-blink' : ''}`} style={{ background: i % 2 ? accent : '#facc15', animationDelay: `${i * 80}ms` }} />
					))}
				</div>
				<div className='grid gap-2' style={{ gridTemplateColumns: `repeat(${reels.length}, minmax(0, 1fr))` }}>
					{reels.map((reel, i) => {
						const n = reel.items.length;
						const target = targets ? (CYCLES - 1) * n + targets[i] : 0;
						const done = stopped[i];
						const landed = done && targets ? reel.items[targets[i]] : null;
						return (
							<div key={reel.title} className='min-w-0'>
								<div className='text-center text-[10px] font-black uppercase tracking-widest text-white/50 mb-1'>{reel.title}</div>
								<div className='relative rounded-xl overflow-hidden bg-black/60 border border-white/10' style={{ height: ITEM_H }}>
									<div
										style={{
											transform: `translateY(-${target * ITEM_H}px)`,
											transition: targets ? `transform ${durations[i]}ms cubic-bezier(0.12, 0.8, 0.2, 1)` : 'none',
										}}
									>
										{Array.from({ length: CYCLES }, (_, c) =>
											reel.items.map((it, j) => (
												<div key={`${c}-${j}`} className='flex flex-col items-center justify-center text-center px-1' style={{ height: ITEM_H, background: `linear-gradient(180deg, ${it.color}55, ${it.color}22)` }}>
													<div className='text-xl sm:text-2xl font-black text-white leading-tight'>{it.label}</div>
													{it.sub && <div className='text-[10px] font-bold text-white/60 uppercase tracking-wider'>{it.sub}</div>}
												</div>
											))
										)}
									</div>
									{/* glass + payline */}
									<div className='absolute inset-0 pointer-events-none' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 30%, transparent 70%, rgba(0,0,0,0.55))' }} />
									{landed && <div className='absolute inset-0 pointer-events-none rounded-xl vs-pop' style={{ boxShadow: `inset 0 0 0 3px ${landed.color}, 0 0 24px ${landed.color}` }} />}
								</div>
							</div>
						);
					})}
				</div>
				<button
					onClick={() => pull()}
					disabled={!!targets || !!forced}
					className='mt-3 w-full rounded-2xl py-3.5 font-black uppercase tracking-[0.2em] text-white text-lg disabled:opacity-60 active:scale-[0.98] transition-transform'
					style={{ background: targets ? '#374151' : `linear-gradient(135deg, ${accent}, #db2777)`, boxShadow: targets ? 'none' : `0 8px 28px ${accent}66` }}
				>
					{targets ? (
						stopped.every(Boolean) ? (
							'Locked in'
						) : (
							'Spinning…'
						)
					) : (
						<>
							<Icon name='zap' className='mr-1.5' />
							Pull
						</>
					)}
				</button>
			</div>
		</div>
	);
}
