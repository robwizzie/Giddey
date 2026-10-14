'use client';

import type { CareerData } from '@/lib/versus/career';
import { getVersusPlayer } from '@/lib/versus/pool';

function Big({ label, value }: { label: string; value: string | number }) {
	return (
		<div className='rounded-2xl bg-white/[0.05] border border-white/10 p-3 text-center'>
			<div className='text-2xl font-black text-white tabular-nums'>{value}</div>
			<div className='text-[10px] font-black uppercase tracking-widest text-white/45'>{label}</div>
		</div>
	);
}

/** A coach's career at a glance — used in the app and on the public page */
export default function CareerCard({ c }: { c: CareerData }) {
	const games = c.wins + c.losses;
	return (
		<div className='space-y-4'>
			<div className='text-center'>
				<div className='text-[11px] font-black uppercase tracking-[0.3em] text-white/45'>Giddey Versus career</div>
				<div className='text-5xl font-black text-white'>{c.name}</div>
				<div className='text-sm text-white/55 mt-1'>
					{games} game{games === 1 ? '' : 's'}
					{c.since ? ` since ${new Date(c.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}
				</div>
				{(c.titles > 0 || c.leagueTitles.length > 0) && (
					<div className='text-3xl mt-2' title='Titles'>
						{'🏆'.repeat(Math.min(c.titles + c.leagueTitles.length, 8))}
					</div>
				)}
			</div>
			<div className='grid grid-cols-3 gap-2'>
				<Big label='Record' value={`${c.wins}–${c.losses}`} />
				<Big label='Win %' value={games ? `${Math.round((c.wins / games) * 100)}%` : '—'} />
				<Big label={c.rank ? `Rating · #${c.rank}` : 'Rating'} value={c.rating ?? '—'} />
				<Big label='Season titles' value={c.titles} />
				<Big label='League titles' value={c.leagueTitles.length} />
				<Big label='Players of the Game' value={c.potg} />
			</div>
			{c.badges.length > 0 && (
				<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
					<div className='text-[10px] font-black uppercase tracking-widest text-white/45 mb-2'>🏅 Badges · {c.badges.length}</div>
					<div className='flex flex-wrap gap-1.5'>
						{c.badges.map(b => (
							<span key={b.title} className='rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-white'>
								{b.icon} {b.title}
							</span>
						))}
					</div>
				</div>
			)}
			<div className='grid grid-cols-2 gap-2'>
				<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
					<div className='text-[10px] font-black uppercase tracking-widest text-white/45 mb-1'>🔥 Go-to guys</div>
					{c.favorites.length ? (
						c.favorites.map(f => {
							const p = getVersusPlayer(f.id);
							return p ? (
								<div key={f.id} className='flex justify-between text-[12px] py-0.5'>
									<span className='text-white truncate'>
										{p.firstName[0]}. {p.lastName}
									</span>
									<span className='text-white/45 font-bold ml-2'>×{f.count}</span>
								</div>
							) : null;
						})
					) : (
						<div className='text-xs text-white/40'>—</div>
					)}
				</div>
				<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
					<div className='text-[10px] font-black uppercase tracking-widest text-white/45 mb-1'>⚔️ Rivals</div>
					{c.rivals.length ? (
						c.rivals.map(r => (
							<div key={r.name} className='flex justify-between text-[12px] py-0.5'>
								<span className='text-white truncate'>vs {r.name}</span>
								<span className={`font-black tabular-nums ml-2 ${r.wins > r.losses ? 'text-emerald-300' : r.wins < r.losses ? 'text-red-300' : 'text-white/60'}`}>
									{r.wins}–{r.losses}
								</span>
							</div>
						))
					) : (
						<div className='text-xs text-white/40'>—</div>
					)}
				</div>
			</div>
			{c.bestWin && (
				<div className='text-center text-[12px] text-white/60'>
					💥 Biggest win: <span className='font-black text-white'>{c.bestWin.score}</span> over {c.bestWin.opponent}
				</div>
			)}
			{c.leagueTitles.length > 0 && <div className='text-center text-[12px] text-yellow-200'>🏟️ League champion: {c.leagueTitles.join(', ')}</div>}
		</div>
	);
}
