'use client';

import { useMemo, useState } from 'react';
import { computeElo, EloRow } from '@/lib/versus/elo';
import { loadRivalry, RivalryGame } from '@/lib/versus/rivalry';
import GameDetail from './GameDetail';
import Icon from './Icon';

function Spark({ values }: { values: number[] }) {
	const v = values.slice(-12);
	if (v.length < 2) return <div className='w-16' />;
	const lo = Math.min(...v);
	const hi = Math.max(...v);
	const pts = v.map((x, i) => `${((i / (v.length - 1)) * 60).toFixed(1)},${(18 - ((x - lo) / (hi - lo || 1)) * 16).toFixed(1)}`).join(' ');
	const up = v[v.length - 1] >= v[0];
	return (
		<svg viewBox='0 0 60 20' className='w-16 h-5 shrink-0'>
			<polyline points={pts} fill='none' stroke={up ? '#34d399' : '#f87171'} strokeWidth='1.6' strokeLinejoin='round' />
		</svg>
	);
}

/** Gold, silver, bronze for the top three */
const MEDAL = ['#facc15', '#cbd5e1', '#d97706'];

/** Every coach on this phone (and synced from the cloud), by skill rating */
export default function PowerRankings({ onClose, highlight }: { onClose: () => void; highlight?: string[] }) {
	const { table, upsets } = useMemo(() => computeElo(loadRivalry()), []);
	const [open, setOpen] = useState<RivalryGame | null>(null);
	const hl = new Set((highlight ?? []).map(n => n.trim().toLowerCase()));
	const row = (r: EloRow, i: number) => (
		<div key={r.key} className={`flex items-center gap-2 px-3 py-2 ${hl.has(r.key) ? 'bg-orange-500/10' : ''}`}>
			<div className='w-7 flex justify-center text-sm font-black text-white/60 shrink-0'>{MEDAL[i] ? <Icon name='medal' size={20} style={{ color: MEDAL[i] }} aria-label={`#${i + 1}`} /> : i + 1}</div>
			<div className='flex-1 min-w-0'>
				<div className='text-sm font-black text-white truncate'>{r.name}</div>
				<div className='text-[10px] text-white/45'>
					{r.wins}–{r.losses} · {r.opponents} opponent{r.opponents === 1 ? '' : 's'} · peak {r.peak}
				</div>
			</div>
			<Spark values={r.history} />
			<div className='text-right shrink-0 w-14'>
				<div className='text-lg font-black text-white tabular-nums leading-none'>{r.rating}</div>
				{r.trend !== 0 && <div className={`text-[10px] font-black tabular-nums ${r.trend > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{r.trend > 0 ? `▲ ${r.trend}` : `▼ ${-r.trend}`}</div>}
			</div>
		</div>
	);
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-1'>
					<div className='text-lg font-black text-white inline-flex items-center gap-2'>
						<Icon name='trophy' className='text-yellow-300' />
						Power rankings
					</div>
					<button onClick={onClose} className='p-2 -mr-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>
				<div className='text-xs text-white/50 mb-4'>
					A skill rating for every coach you&apos;ve played, starting at 1500. It rates the coach, not the draft: beating a better-drafted team moves you more than winning with the stronger squad.
				</div>
				{!table.length ? (
					<div className='text-sm text-white/55 rounded-xl bg-white/[0.04] border border-white/10 p-3'>No games yet — play one and the rankings start here.</div>
				) : (
					<div className='rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5 mb-5 overflow-hidden'>{table.map(row)}</div>
				)}
				{upsets.length > 0 && (
					<>
						<div className='flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-white/45 mb-1.5'>
							<Icon name='zap' />
							Biggest upsets ever
						</div>
						<div className='space-y-1'>
							{upsets.map(u => (
								<button key={u.game.ts} onClick={() => setOpen(u.game)} className='w-full flex items-center gap-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 text-[12px] text-left'>
									<span className='font-black text-amber-300 w-10 shrink-0 tabular-nums'>{Math.round(u.chance * 100)}%</span>
									<span className='flex-1 min-w-0 truncate text-white'>
										<span className='font-black'>{u.winner}</span> beat {u.loser}
										{u.game.score[0] !== null && u.game.score[1] !== null ? ` ${Math.max(u.game.score[0], u.game.score[1])}–${Math.min(u.game.score[0], u.game.score[1])}` : ''}
									</span>
									<span className='text-white/40 shrink-0'>{new Date(u.game.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
								</button>
							))}
						</div>
						<div className='text-[10px] text-white/35 mt-1'>% = the winner&apos;s chance before tip-off, from both ratings and the team OVRs.</div>
					</>
				)}
				{open && <GameDetail g={open} names={open.names} onClose={() => setOpen(null)} />}
			</div>
		</div>
	);
}
