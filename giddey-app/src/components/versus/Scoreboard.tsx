'use client';

import { fairness, seriesScore, teamIcon, teamOvr, VersusState } from '@/lib/versus/engine';
import Icon from './Icon';
import { SIDE_COLORS } from './Fx';
import { CoachBadges } from './Badges';

export function FairnessMeter({ a, b, compact }: { a: string[]; b: string[]; compact?: boolean }) {
	const oa = teamOvr(a);
	const ob = teamOvr(b);
	const f = a.length && b.length ? fairness(a, b) : 100;
	// needle: -1 (side 0 way ahead) .. +1 (side 1 way ahead)
	const diff = Math.max(-4, Math.min(4, ob - oa));
	const pos = 50 + (diff / 4) * 46;
	const color = f >= 90 ? '#22c55e' : f >= 75 ? '#eab308' : '#ef4444';
	return (
		<div className='w-full'>
			<div className='relative h-2 rounded-full overflow-hidden' style={{ background: `linear-gradient(90deg, ${SIDE_COLORS[0]}, #334155 42%, #334155 58%, ${SIDE_COLORS[1]})` }}>
				<div className='absolute top-0 bottom-0 w-[16%] left-[42%] bg-green-500/35' />
			</div>
			<div className='relative h-0'>
				<div className='absolute -top-3.5 w-1.5 h-5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-700' style={{ left: `calc(${pos}% - 3px)` }} />
			</div>
			{!compact && (
				<div className='text-center mt-2 text-[10px] font-black uppercase tracking-widest' style={{ color }}>
					{f}% balanced
				</div>
			)}
		</div>
	);
}

export default function Scoreboard({ state, sub }: { state: VersusState; sub?: React.ReactNode }) {
	const { names } = state.settings;
	const ovr: [number, number] = [teamOvr(state.teams[0]), teamOvr(state.teams[1])];
	const [w0, w1] = seriesScore(state);
	const hasSeries = state.series.length > 0;
	return (
		<div className='sticky top-0 z-30 bg-[#0a0e17]/90 backdrop-blur border-b border-white/10'>
			<div className='max-w-3xl mx-auto px-4 pt-2.5 pb-3'>
				<div className='flex items-center gap-3'>
					{[0, 1].map(i => (
						<div key={i} className={`flex-1 min-w-0 flex items-center gap-2 ${i ? 'flex-row-reverse text-right' : ''}`}>
							<div className='min-w-0'>
								<div className='text-[10px] font-black uppercase tracking-widest truncate' style={{ color: SIDE_COLORS[i] }}>
									<Icon name={teamIcon(state.settings, i as 0 | 1)} className='mr-1' />
									{names[i]}
									{hasSeries && <span className='text-white/40'> · {i ? w1 : w0}W</span>} <CoachBadges side={i as 0 | 1} compact />
								</div>
								<div className='text-2xl font-black text-white leading-none tabular-nums'>{ovr[i] ? ovr[i].toFixed(1) : '—'}</div>
							</div>
						</div>
					))}
				</div>
				<div className='mt-2'>
					<FairnessMeter a={state.teams[0]} b={state.teams[1]} compact />
				</div>
				{sub && <div className='mt-2 text-center'>{sub}</div>}
			</div>
		</div>
	);
}
