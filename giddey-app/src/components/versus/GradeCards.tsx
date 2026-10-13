'use client';

import { Grade, Side, VersusState } from '@/lib/versus/engine';
import { gradeColor, pickCallout } from '@/lib/versus/grades';
import { getVersusPlayer } from '@/lib/versus/pool';
import { SIDE_COLORS } from './Fx';

/** Letter grade + analyst take for both coaches */
export function GradeCards({ grades, names, state }: { grades: [Grade, Grade]; names: [string, string]; state?: VersusState }) {
	// steals / reaches only exist while the draft log is around
	const calls = state?.draft ? state.draft.log.map(e => ({ e, c: pickCallout(state, e) })).filter(x => x.c) : [];
	return (
		<div className='grid grid-cols-2 gap-2'>
			{([0, 1] as Side[]).map(side => {
				const g = grades[side];
				const mine = calls.filter(x => x.e.side === side);
				return (
					<div key={side} className='rounded-2xl border border-white/10 bg-white/[0.03] p-3 min-w-0'>
						<div className='flex items-center justify-between'>
							<div className='text-[10px] font-black uppercase tracking-widest truncate' style={{ color: SIDE_COLORS[side] }}>
								{names[side]}
							</div>
							<div className='text-3xl font-black leading-none vs-slam' style={{ color: gradeColor(g.letter), animationDelay: `${300 + side * 350}ms` }}>
								{g.letter}
							</div>
						</div>
						<div className='text-[12px] text-white/75 leading-snug mt-1.5'>“{g.take}”</div>
						{mine.length > 0 && (
							<div className='mt-2 space-y-0.5'>
								{mine.map(({ e, c }) => (
									<div key={`${e.round}-${e.id}`} className='text-[10px] leading-tight'>
										<span className={c!.kind === 'steal' ? 'text-green-300 font-black' : 'text-amber-300 font-black'}>{c!.kind === 'steal' ? '💰 STEAL' : '🤨 REACH'}</span>{' '}
										<span className='text-white/70'>{getVersusPlayer(e.id)?.lastName}</span>
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
