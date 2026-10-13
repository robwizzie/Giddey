'use client';

import { useMemo, useState } from 'react';
import { Settings, Side } from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { clearRivalry, loadRivalry, rivalryStats } from '@/lib/versus/rivalry';
import { getSabotage } from '@/lib/versus/wheels';
import { SIDE_COLORS } from './Fx';

function Stat({ label, values, fmt = v => String(v) }: { label: string; values: [number, number]; fmt?: (v: number) => string }) {
	const better: Side | null = values[0] === values[1] ? null : values[0] > values[1] ? 0 : 1;
	return (
		<div className='flex items-center py-2 border-b border-white/5 last:border-0'>
			<div className={`w-16 text-left text-lg font-black tabular-nums ${better === 0 ? '' : 'text-white/60'}`} style={better === 0 ? { color: SIDE_COLORS[0] } : undefined}>
				{fmt(values[0])}
			</div>
			<div className='flex-1 text-center text-[10px] font-black uppercase tracking-widest text-white/45'>{label}</div>
			<div className={`w-16 text-right text-lg font-black tabular-nums ${better === 1 ? '' : 'text-white/60'}`} style={better === 1 ? { color: SIDE_COLORS[1] } : undefined}>
				{fmt(values[1])}
			</div>
		</div>
	);
}

export default function RivalrySheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
	const [version, setVersion] = useState(0);
	const stats = useMemo(() => rivalryStats(loadRivalry(), settings.names), [settings.names, version]);
	const [a, b] = stats.coaches;
	const total = a.wins + b.wins;
	const pct = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);
	const leader = a.wins === b.wins ? null : a.wins > b.wins ? 0 : 1;

	return (
		<div className='fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-4'>
					<div className='text-lg font-black text-white'>📊 Rivalry</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
					</button>
				</div>

				{!stats.games ? (
					<div className='text-center py-12 text-white/50'>
						<div className='text-5xl mb-3'>🏀</div>
						No games between {settings.names[0]} and {settings.names[1]} yet. Play one and the record starts here — it survives new series.
					</div>
				) : (
					<>
						{/* Head to head */}
						<div className='rounded-2xl border border-white/10 p-4 mb-4' style={{ background: `linear-gradient(90deg, ${SIDE_COLORS[0]}22, transparent 45%, transparent 55%, ${SIDE_COLORS[1]}22)` }}>
							<div className='flex items-center'>
								{([0, 1] as Side[]).map(side => (
									<div key={side} className={`flex-1 ${side ? 'text-right' : ''}`}>
										<div className='text-xs font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
											{settings.names[side]}
										</div>
										<div className='text-6xl font-black text-white tabular-nums leading-none'>{stats.coaches[side].wins}</div>
									</div>
								))}
							</div>
							<div className='flex h-2 rounded-full overflow-hidden mt-3 bg-white/10'>
								<div style={{ width: `${pct(a.wins, total)}%`, background: SIDE_COLORS[0] }} />
								<div style={{ width: `${pct(b.wins, total)}%`, background: SIDE_COLORS[1] }} />
							</div>
							<div className='text-center text-[11px] text-white/55 mt-2'>
								{leader === null ? `All square after ${stats.games} games.` : `${settings.names[leader]} leads the all-time series ${Math.max(a.wins, b.wins)}–${Math.min(a.wins, b.wins)}.`}
								{(() => {
									const s = a.streak > 0 ? { side: 0 as Side, n: a.streak } : b.streak > 0 ? { side: 1 as Side, n: b.streak } : null;
									return s && s.n >= 2 ? ` ${settings.names[s.side]} has won ${s.n} straight 🔥` : '';
								})()}
							</div>
						</div>

						{/* Side by side */}
						<div className='rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-1 mb-4'>
							<Stat label='Longest win streak' values={[a.longestStreak, b.longestStreak]} />
							<Stat label='Challenges hit' values={[pct(a.challengesDone, a.challengesTried), pct(b.challengesDone, b.challengesTried)]} fmt={v => `${v}%`} />
							<Stat label='Avg team OVR' values={[a.avgTeamOvr, b.avgTeamOvr]} fmt={v => v.toFixed(1)} />
							<Stat label='Points / game' values={[a.scoredGames ? Math.round(a.pointsFor / a.scoredGames) : 0, b.scoredGames ? Math.round(b.pointsFor / b.scoredGames) : 0]} />
						</div>

						{/* Does the better team win? */}
						<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4'>
							<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1'>Does the better draft win?</div>
							{stats.favoriteGames ? (
								<>
									<div className='text-2xl font-black text-white'>
										{pct(stats.favoriteWins, stats.favoriteGames)}%
										<span className='text-sm text-white/50 font-bold'>
											{' '}
											— the higher-OVR team won {stats.favoriteWins} of {stats.favoriteGames}
										</span>
									</div>
									{stats.upsets.length > 0 && (
										<div className='mt-2 space-y-1'>
											{stats.upsets.map((u, i) => (
												<div key={i} className='text-[12px] text-white/65'>
													🐶 <span className='font-black text-white'>{u.winner}</span> won as a {u.gap}-OVR underdog
												</div>
											))}
										</div>
									)}
								</>
							) : (
								<div className='text-sm text-white/50'>Every game so far was dead even on paper.</div>
							)}
						</div>

						{/* Records */}
						<div className='grid grid-cols-2 gap-2 mb-4'>
							<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
								<div className='text-[10px] font-black uppercase tracking-widest text-white/45'>Biggest blowout</div>
								{stats.biggestBlowout ? (
									<div className='text-sm text-white mt-1'>
										<span className='text-2xl font-black'>+{stats.biggestBlowout.margin}</span>
										<div className='text-[11px] text-white/55'>
											{stats.biggestBlowout.winner}, {stats.biggestBlowout.game.score[0]}–{stats.biggestBlowout.game.score[1]}
										</div>
									</div>
								) : (
									<div className='text-xs text-white/40 mt-1'>Enter scores to track</div>
								)}
							</div>
							<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
								<div className='text-[10px] font-black uppercase tracking-widest text-white/45'>Closest game</div>
								{stats.closestGame ? (
									<div className='text-sm text-white mt-1'>
										<span className='text-2xl font-black'>{stats.closestGame.margin} pt{stats.closestGame.margin === 1 ? '' : 's'}</span>
										<div className='text-[11px] text-white/55'>
											{stats.closestGame.winner}, {stats.closestGame.game.score[0]}–{stats.closestGame.game.score[1]}
										</div>
									</div>
								) : (
									<div className='text-xs text-white/40 mt-1'>Enter scores to track</div>
								)}
							</div>
						</div>

						{/* Favorite players */}
						<div className='grid grid-cols-2 gap-2 mb-4'>
							{([0, 1] as Side[]).map(side => (
								<div key={side} className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
									<div className='text-[10px] font-black uppercase tracking-widest mb-1.5' style={{ color: SIDE_COLORS[side] }}>
										{settings.names[side]}&apos;s go-to guys
									</div>
									{stats.coaches[side].topPicks.length ? (
										stats.coaches[side].topPicks.map(tp => {
											const p = getVersusPlayer(tp.id);
											return p ? (
												<div key={tp.id} className='flex justify-between text-[12px] py-0.5'>
													<span className='text-white truncate'>
														{p.firstName[0]}. {p.lastName}
													</span>
													<span className='text-white/45 font-bold shrink-0 ml-2'>×{tp.count}</span>
												</div>
											) : null;
										})
									) : (
										<div className='text-xs text-white/40'>—</div>
									)}
								</div>
							))}
						</div>

						{/* Recent */}
						<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1.5'>Recent games</div>
						<div className='space-y-1 mb-6'>
							{stats.recent.map(g => (
								<div key={g.ts} className='flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px]'>
									<div className='w-2 h-2 rounded-full shrink-0' style={{ background: SIDE_COLORS[g.winner] }} />
									<div className='flex-1 min-w-0 truncate text-white'>
										<span className='font-black'>{g.winnerName}</span> won
										{g.score[0] !== null && g.score[1] !== null ? ` ${Math.max(g.score[0], g.score[1])}–${Math.min(g.score[0], g.score[1])}` : ''}
										{g.sabotage && g.sabotage !== 'mercy' ? <span className='text-red-300'> · 😈 {getSabotage(g.sabotage)?.label}</span> : null}
									</div>
									<div className='text-white/40 shrink-0'>{new Date(g.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
								</div>
							))}
						</div>

						<button
							onClick={() => {
								if (confirm('Erase the whole rivalry record? This can’t be undone.')) {
									clearRivalry();
									setVersion(v => v + 1);
								}
							}}
							className='w-full text-xs font-bold text-red-300/60 hover:text-red-300 py-2'
						>
							Reset rivalry record
						</button>
					</>
				)}
			</div>
		</div>
	);
}
