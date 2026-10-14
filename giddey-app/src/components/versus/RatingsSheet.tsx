'use client';

import { fmtDate, RATING_UPDATES } from '@/lib/versus/ratingChanges';

/** Risers & fallers from every 2K rating update */
export default function RatingsSheet({ onClose }: { onClose: () => void }) {
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[88vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-1'>
					<div className='text-lg font-black text-white'>📈 2K27 rating updates</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
					</button>
				</div>
				<div className='text-xs text-white/50 mb-4'>Overalls follow 2K&apos;s in-season updates. Cards show 📈 / 📉 when a player has moved since launch.</div>
				{!RATING_UPDATES.length && <div className='text-sm text-white/60 rounded-xl bg-white/[0.04] border border-white/10 p-3'>Still on 2K27 launch ratings — no updates yet.</div>}
				<div className='space-y-4'>
					{RATING_UPDATES.map(u => {
						const sorted = [...u.changes].sort((a, b) => b.to - b.from - (a.to - a.from));
						return (
							<div key={u.date}>
								<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1.5'>
									{fmtDate(u.date)} · {u.changes.length} change{u.changes.length === 1 ? '' : 's'}
								</div>
								<div className='rounded-xl bg-white/[0.04] border border-white/10 divide-y divide-white/5'>
									{sorted.map(c => {
										const d = c.to - c.from;
										return (
											<div key={c.id} className='flex items-center gap-2 px-3 py-1.5 text-[12px]'>
												<span className='w-4'>{d > 0 ? '📈' : d < 0 ? '📉' : '🔁'}</span>
												<span className='flex-1 min-w-0 truncate text-white font-bold'>{c.name}</span>
												{c.team && (
													<span className='text-white/45 shrink-0'>
														{c.team.from} → {c.team.to}
													</span>
												)}
												<span className='tabular-nums text-white/60 shrink-0'>
													{c.from} → <span className='font-black text-white'>{c.to}</span>
												</span>
												{d !== 0 && <span className={`w-8 text-right font-black tabular-nums shrink-0 ${d > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{d > 0 ? `+${d}` : d}</span>}
											</div>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
