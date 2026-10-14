'use client';

import { useMemo, useState } from 'react';
import { Retired, Settings, Side } from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { clearMatchup, loadRivalry, matchups, rivalryStats, RivalryStats } from '@/lib/versus/rivalry';
import { getTheme } from '@/lib/versus/themes';
import type { RivalryGame } from '@/lib/versus/rivalry';
import { seatGames } from '@/lib/versus/history';
import { seasons, SeasonSummary, winsNeeded } from '@/lib/versus/seasons';
import { achievementsFor } from '@/lib/versus/achievements';
import { belt, hallOfFame } from '@/lib/versus/legacy';
import HallOfFame from './HallOfFame';
import GameDetail, { GameRow, STYLE_META } from './GameDetail';
import { deleteCloudGames, linkedRivalry } from '@/lib/versus/cloud';
import { getSabotage } from '@/lib/versus/wheels';
import { SIDE_COLORS } from './Fx';
import Icon from './Icon';

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

/** Series lead after every game — above the line coach 1 leads, below coach 2 */
function LeadChart({ stats, names }: { stats: RivalryStats; names: [string, string] }) {
	const pts = [{ lead: 0 }, ...stats.timeline];
	const max = Math.max(2, ...pts.map(p => Math.abs(p.lead)));
	const W = 300;
	const H = 120;
	const x = (i: number) => (pts.length === 1 ? 0 : (i / (pts.length - 1)) * W);
	const y = (lead: number) => H / 2 - (lead / max) * (H / 2 - 8);
	const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.lead).toFixed(1)}`).join(' ');
	const area = `${line} L${W},${H / 2} L0,${H / 2} Z`;
	const peak = (side: Side) => Math.max(0, ...pts.map(p => (side === 0 ? p.lead : -p.lead)));
	return (
		<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4'>
			<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>
				<Icon name='lineChart' />
				Head-to-head over time
			</div>
			<svg viewBox={`0 0 ${W} ${H}`} className='w-full h-32' preserveAspectRatio='none'>
				<defs>
					<clipPath id='vs-above'>
						<rect x='0' y='0' width={W} height={H / 2} />
					</clipPath>
					<clipPath id='vs-below'>
						<rect x='0' y={H / 2} width={W} height={H / 2} />
					</clipPath>
				</defs>
				<path d={area} fill={SIDE_COLORS[0]} opacity='0.25' clipPath='url(#vs-above)' />
				<path d={area} fill={SIDE_COLORS[1]} opacity='0.25' clipPath='url(#vs-below)' />
				<line x1='0' x2={W} y1={H / 2} y2={H / 2} stroke='rgba(255,255,255,0.25)' strokeDasharray='3 3' vectorEffect='non-scaling-stroke' />
				<path d={line} fill='none' stroke='white' strokeWidth='2' vectorEffect='non-scaling-stroke' strokeLinejoin='round' />
			</svg>
			<div className='flex justify-between text-[10px] font-bold mt-1'>
				<span style={{ color: SIDE_COLORS[0] }}>
					▲ {names[0]} ahead · biggest lead +{peak(0)}
				</span>
				<span style={{ color: SIDE_COLORS[1] }}>
					{names[1]} ahead ▼ · biggest lead +{peak(1)}
				</span>
			</div>
		</div>
	);
}

function RecordRows({ title, icon, rows }: { title: string; icon?: string; rows: { label: string; icon?: string; wins: [number, number] }[] }) {
	if (!rows.length) return null;
	return (
		<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4'>
			<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>
				{icon && <Icon name={icon} />}
				{title}
			</div>
			<div className='space-y-2'>
				{rows.map(r => {
					const n = r.wins[0] + r.wins[1];
					return (
						<div key={r.label}>
							<div className='flex items-center justify-between text-[12px] mb-0.5'>
								<span className='font-black tabular-nums' style={{ color: SIDE_COLORS[0] }}>
									{r.wins[0]}
								</span>
								<span className='inline-flex items-center gap-1 min-w-0 text-white font-bold px-2'>
									{r.icon && <Icon name={r.icon} className='text-white/60' />}
									<span className='truncate'>{r.label}</span>
								</span>
								<span className='font-black tabular-nums' style={{ color: SIDE_COLORS[1] }}>
									{r.wins[1]}
								</span>
							</div>
							<div className='flex h-1.5 rounded-full overflow-hidden bg-white/10'>
								<div style={{ width: `${(r.wins[0] / n) * 100}%`, background: SIDE_COLORS[0] }} />
								<div style={{ width: `${(r.wins[1] / n) * 100}%`, background: SIDE_COLORS[1] }} />
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function PlayerLine({ id, right }: { id: string; right: string }) {
	const p = getVersusPlayer(id);
	if (!p) return null;
	return (
		<div className='flex justify-between text-[12px] py-0.5'>
			<span className='text-white truncate'>
				{p.firstName[0]}. {p.lastName}
			</span>
			<span className='text-white/45 font-bold shrink-0 ml-2'>{right}</span>
		</div>
	);
}

/** The championship belt: holder, defenses, reigns — plus the way into the Hall of Fame */
function BeltCard({ games, names, onHall }: { games: RivalryGame[]; names: [string, string]; onHall: () => void }) {
	const b = useMemo(() => belt(games), [games]);
	const retired = useMemo(() => {
		const h = hallOfFame(games);
		return h[0].length + h[1].length;
	}, [games]);
	return (
		<div className='rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-4 mb-4'>
			{b && (
				<>
					<div className='flex items-center gap-3'>
						<div className='w-12 h-12 rounded-2xl flex items-center justify-center shrink-0' style={{ background: 'linear-gradient(135deg, #facc15, #b45309)', color: '#1c1206', boxShadow: '0 0 18px rgba(250,204,21,0.35)' }}>
							<Icon name='award' size={26} strokeWidth={2.5} />
						</div>
						<div className='min-w-0 flex-1'>
							<div className='text-[10px] font-black uppercase tracking-widest text-yellow-300/80'>Belt holder</div>
							<div className='text-xl font-black leading-tight truncate' style={{ color: SIDE_COLORS[b.holder] }}>
								{names[b.holder]}
							</div>
							<div className='text-[11px] text-white/60'>{b.defenses ? `${b.defenses} straight defense${b.defenses === 1 ? '' : 's'}` : b.changed && b.games > 1 ? 'Just took the belt' : 'No defenses yet'} · next game is a title defense</div>
						</div>
					</div>
					<div className='grid grid-cols-2 gap-2 mt-3'>
						{([0, 1] as Side[]).map(side => (
							<div key={side} className={`rounded-xl bg-white/[0.04] px-2.5 py-2 ${side ? 'text-right' : ''}`}>
								<div className='text-[10px] font-black uppercase tracking-widest truncate' style={{ color: SIDE_COLORS[side] }}>
									{names[side]}
								</div>
								<div className='text-[11px] text-white/70'>
									<span className='font-black text-white'>{b.reigns[side]}</span> reign{b.reigns[side] === 1 ? '' : 's'} · longest <span className='font-black text-white'>{b.best[side]}</span>
								</div>
							</div>
						))}
					</div>
				</>
			)}
			<button onClick={onHall} className={`w-full h-11 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 text-white text-sm font-black inline-flex items-center justify-center gap-2 ${b ? 'mt-3' : ''}`}>
				<Icon name='shirt' size={16} className='text-yellow-300' />
				Hall of Fame
				<span className='text-white/45 font-bold'>· {retired ? `${retired} retired` : 'empty'}</span>
				<Icon name='chevronRight' className='text-white/30' />
			</button>
		</div>
	);
}

type Tab = 'overview' | 'games' | 'players' | 'records' | 'badges';

/** Title count + the season in progress */
function SeasonPanel({ list, names }: { list: SeasonSummary[]; names: [string, string] }) {
	if (!list.length) return null;
	const cur = list[list.length - 1];
	const t: [number, number] = [0, 0];
	for (const x of list) if (x.champion !== null) t[x.champion]++;
	const reg = cur.regular[0] + cur.regular[1];
	const inFinals = cur.champion === null && reg >= cur.len;
	return (
		<div className='rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.04] p-4 mb-4'>
			<div className='flex items-center'>
				{([0, 1] as Side[]).map(side => (
					<div key={side} className={`flex-1 ${side ? 'text-right' : ''}`}>
						<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
							{names[side]}
						</div>
						<div className={`flex items-center gap-0.5 h-8 text-2xl font-black text-yellow-300 ${side ? 'justify-end' : ''}`}>
							{t[side] ? (
								<>
									{Array.from({ length: Math.min(t[side], 5) }, (_, i) => (
										<Icon key={i} name='trophy' />
									))}
									{t[side] > 5 && <span className='text-base ml-1'>×{t[side]}</span>}
								</>
							) : (
								<span className='text-white/25 text-base'>No titles</span>
							)}
						</div>
					</div>
				))}
			</div>
			<div className='text-[11px] text-white/60 text-center mt-2'>
				{cur.champion !== null
					? `${names[cur.champion]} won Season ${cur.n}. Season ${cur.n + 1} starts next game.`
					: inFinals
						? `Season ${cur.n} Finals: ${names[0]} ${cur.finalsWins[0]}–${cur.finalsWins[1]} ${names[1]} · first to ${winsNeeded(cur.finals)}`
						: `Season ${cur.n}: ${names[0]} ${cur.regular[0]}–${cur.regular[1]} ${names[1]} · ${cur.len - reg} game${cur.len - reg === 1 ? '' : 's'} to the Finals`}
			</div>
		</div>
	);
}

export default function RivalrySheet({ settings, retired = [], onClose, onSync, onStats }: { settings: Settings; retired?: Retired[]; onClose: () => void; onSync: () => void; onStats?: () => void }) {
	const [version, setVersion] = useState(0);
	// any pair who's played on this phone can be viewed, not just tonight's coaches
	const pairs = useMemo(() => matchups(), [version]);
	const [names, setNames] = useState<[string, string]>(() => (settings.names[0].trim() && settings.names[1].trim() ? settings.names : (matchups()[0]?.names ?? settings.names)));
	const isCurrent = names.map(n => n.trim().toLowerCase()).sort().join('|') === settings.names.map(n => n.trim().toLowerCase()).sort().join('|');
	const [tab, setTab] = useState<Tab>('overview');
	const [open, setOpen] = useState<RivalryGame | null>(null);
	const [hall, setHall] = useState(false);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const games = useMemo(() => seatGames(loadRivalry(), names), [names, version]);
	const seasonList = useMemo(() => seasons(games), [games]);
	const stats = useMemo(() => rivalryStats(loadRivalry(), names), [names, version]);
	const [a, b] = stats.coaches;
	const total = a.wins + b.wins;
	const pct = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);
	const leader = a.wins === b.wins ? null : a.wins > b.wins ? 0 : 1;

	return (
		<div className='fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-4'>
					<div className='text-lg font-black text-white inline-flex items-center gap-2'>
						<Icon name='chart' className='text-orange-300' />
						Rivalry
					</div>
					{onStats && (
						<button onClick={onStats} className='ml-auto mr-1 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-orange-200 bg-orange-500/15 border border-orange-400/30 rounded-full px-3 py-2'>
							<Icon name='lineChart' />
							Stats
						</button>
					)}
					<button onClick={onSync} className={`${onStats ? '' : 'ml-auto '}mr-1 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-sky-200 bg-sky-500/15 border border-sky-400/30 rounded-full px-3 py-2`}>
						<Icon name='refresh' />
						Sync phones
					</button>
					<button onClick={onClose} className='p-2 -mr-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>

				{pairs.length > 1 && (
					<div className='flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-4 px-4 [scrollbar-width:none]'>
						{pairs.map(m => {
							const on = m.names.map(n => n.trim().toLowerCase()).sort().join('|') === names.map(n => n.trim().toLowerCase()).sort().join('|');
							return (
								<button
									key={m.names.join('|')}
									onClick={() => setNames(m.names)}
									className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black border ${on ? 'bg-white text-black border-white' : 'bg-white/5 text-white/70 border-white/10'}`}
								>
									{m.names[0]} vs {m.names[1]} · {m.games}
								</button>
							);
						})}
					</div>
				)}

				{!stats.games ? (
					<div className='text-center py-12 text-white/50'>
						<Icon name='ball' size={48} className='mx-auto mb-3 text-orange-300/70' />
						{names[0].trim() && names[1].trim() ? `No games between ${names[0]} and ${names[1]} yet.` : 'No games on this phone yet.'} Play one and the record starts here — it survives new series.
						<div className='mt-3 text-xs'>Played on the other phone? Tap Sync phones.</div>
					</div>
				) : (
					<>
						{/* Head to head */}
						<div className='rounded-2xl border border-white/10 p-4 mb-4' style={{ background: `linear-gradient(90deg, ${SIDE_COLORS[0]}22, transparent 45%, transparent 55%, ${SIDE_COLORS[1]}22)` }}>
							<div className='flex items-center'>
								{([0, 1] as Side[]).map(side => (
									<div key={side} className={`flex-1 ${side ? 'text-right' : ''}`}>
										<div className='text-xs font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
											{names[side]}
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
								{leader === null ? `All square after ${stats.games} games.` : `${names[leader]} leads the all-time series ${Math.max(a.wins, b.wins)}–${Math.min(a.wins, b.wins)}.`}
								{(() => {
									const s = a.streak > 0 ? { side: 0 as Side, n: a.streak } : b.streak > 0 ? { side: 1 as Side, n: b.streak } : null;
									return s && s.n >= 2 ? (
										<>
											{` ${names[s.side]} has won ${s.n} straight `}
											<Icon name='flame' className='text-orange-400' />
										</>
									) : null;
								})()}
							</div>
						</div>

						<div className='flex gap-1 rounded-xl bg-white/[0.05] p-1 mb-4 overflow-x-auto [scrollbar-width:none]'>
							{(
								[
									['overview', 'lineChart', 'Overview'],
									['games', 'calendar', 'Games'],
									['players', 'ball', 'Players'],
									['records', 'trophy', 'Records'],
									['badges', 'medal', 'Badges'],
								] as [Tab, string, string][]
							).map(([id, icon, label]) => (
								<button key={id} onClick={() => setTab(id)} className={`flex-1 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-black ${tab === id ? 'bg-white text-black' : 'text-white/60'}`}>
									<Icon name={icon} />
									{label}
								</button>
							))}
						</div>

						{tab === 'overview' && (
							<>
								<SeasonPanel list={seasonList} names={names} />
								<BeltCard games={games} names={names} onHall={() => setHall(true)} />
								<LeadChart stats={stats} names={names} />
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
													<Icon name='zap' className='mr-1 text-amber-300' />
													<span className='font-black text-white'>{u.winner}</span> won as a {u.gap}-OVR underdog
												</div>
											))}
										</div>
									)}
								</>
							) : (
								<div className='text-sm text-white/50'>Every game so far was dead even on paper.</div>
							)}
						</div>

								{/* Recent */}
								<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1.5'>Recent games · tap one for the full box</div>
								<div className='space-y-1 mb-6'>
									{games
										.slice(-8)
										.reverse()
										.map(g => (
											<GameRow key={g.ts} g={g} names={names} onOpen={() => setOpen(g)} />
										))}
								</div>
							</>
						)}

						{tab === 'games' && (
							<div className='space-y-4 mb-6'>
								{(() => {
									// newest first, grouped by season
									const groups: { label: string; games: RivalryGame[] }[] = [];
									for (const g of [...games].reverse()) {
										const label = g.season ? `Season ${g.season.n}${g.season.stage === 'finals' ? ' · Finals' : ''}` : 'Exhibition';
										const last = groups[groups.length - 1];
										if (last?.label === label) last.games.push(g);
										else groups.push({ label, games: [g] });
									}
									return groups.map((gr, i) => (
										<div key={`${gr.label}-${i}`}>
											<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1.5'>{gr.label}</div>
											<div className='space-y-1'>
												{gr.games.map(g => (
													<GameRow key={g.ts} g={g} names={names} onOpen={() => setOpen(g)} />
												))}
											</div>
										</div>
									));
								})()}
							</div>
						)}

						{tab === 'badges' && (
							<div className='grid grid-cols-2 gap-2 mb-6'>
								{([0, 1] as Side[]).map(side => {
									const list = achievementsFor(games, side);
									return (
										<div key={side} className='rounded-2xl border border-white/10 bg-white/[0.03] p-3 min-w-0'>
											<div className='text-[10px] font-black uppercase tracking-widest mb-2' style={{ color: SIDE_COLORS[side] }}>
												{names[side]} · {list.filter(x => x.done).length}/{list.length}
											</div>
											<div className='space-y-1.5'>
												{[...list]
													.sort((x, y) => Number(y.done) - Number(x.done) || y.have / y.need - x.have / x.need)
													.map(x => (
														<div key={x.a.id} className={`flex items-start gap-2 ${x.done ? '' : 'opacity-45'}`} title={x.a.desc}>
															<Icon name={x.a.icon} size={18} className={`mt-px ${x.done ? 'text-yellow-300' : 'text-white/60'}`} />
															<div className='min-w-0 flex-1'>
																<div className='text-[11px] font-black text-white leading-tight'>{x.a.title}</div>
																<div className='text-[9px] text-white/50 leading-tight'>{x.a.desc}</div>
																{!x.done && x.need > 1 && (
																	<div className='h-1 rounded-full bg-white/10 mt-1 overflow-hidden'>
																		<div className='h-full bg-white/60' style={{ width: `${(x.have / x.need) * 100}%` }} />
																	</div>
																)}
															</div>
														</div>
													))}
											</div>
										</div>
									);
								})}
							</div>
						)}

						{tab === 'records' && (
							<>
								{seasonList.some(x => x.champion !== null) && (
									<div className='rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-4 mb-4'>
										<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-300/80 mb-2'>
											<Icon name='trophy' />
											Banners
										</div>
										<div className='space-y-1.5'>
											{seasonList
												.filter(x => x.champion !== null)
												.reverse()
												.map(x => (
													<div key={x.n} className='flex items-center gap-2 text-[12px]'>
														<div className='w-1.5 h-1.5 rounded-full shrink-0' style={{ background: SIDE_COLORS[x.champion!] }} />
														<div className='flex-1 min-w-0 truncate text-white'>
															<span className='font-black'>Season {x.n}</span> · {names[x.champion!]} won the Finals {x.finalsWins[x.champion!]}–{x.finalsWins[x.champion === 0 ? 1 : 0]}
														</div>
														{x.finalsMvp && <div className='text-yellow-200/80 shrink-0 text-[11px]'>MVP {getVersusPlayer(x.finalsMvp)?.lastName}</div>}
													</div>
												))}
										</div>
									</div>
								)}
								{(() => {
									const graded = games.filter(g => g.grades && g.grades[0].score !== g.grades[1].score);
									const held = graded.filter(g => (g.grades![0].score > g.grades![1].score ? 0 : 1) === g.winner).length;
									const lined = games.filter(g => g.line && g.score[0] !== null && g.score[1] !== null);
									const ats: [number, number] = [0, 0];
									for (const g of lined) ats[g.covered ?? g.line!.fav]++;
									if (!graded.length && !lined.length) return null;
									return (
										<div className='grid grid-cols-2 gap-2 mb-4'>
											<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
												<div className='flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/45'>
													<Icon name='clipboard' />
													Do grades hold up?
												</div>
												{graded.length ? (
													<>
														<div className='text-2xl font-black text-white mt-1'>{pct(held, graded.length)}%</div>
														<div className='text-[11px] text-white/55'>
															The better-graded draft won {held} of {graded.length}
														</div>
													</>
												) : (
													<div className='text-xs text-white/40 mt-1'>No graded drafts yet</div>
												)}
											</div>
											<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
												<div className='flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/45'>
													<Icon name='trendUp' />
													Against the spread
												</div>
												{lined.length ? (
													<div className='text-sm text-white mt-1'>
														<span className='text-2xl font-black' style={{ color: SIDE_COLORS[0] }}>
															{ats[0]}
														</span>
														<span className='text-white/40'> – </span>
														<span className='text-2xl font-black' style={{ color: SIDE_COLORS[1] }}>
															{ats[1]}
														</span>
														<div className='text-[11px] text-white/55'>
															Covers · {games.filter(g => g.covered !== null && g.covered !== undefined).length} underdog cover{games.filter(g => g.covered !== null && g.covered !== undefined).length === 1 ? '' : 's'}
														</div>
													</div>
												) : (
													<div className='text-xs text-white/40 mt-1'>Enter scores to settle lines</div>
												)}
											</div>
										</div>
									);
								})()}
								{(() => {
									const b = belt(games);
									if (!b) return null;
									return (
										<div className='rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.04] px-4 py-1 mb-4'>
											<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-300/80 pt-3'>
												<Icon name='award' />
												Belt · {b.games} title game{b.games === 1 ? '' : 's'}
											</div>
											<Stat label='Belt reigns' values={b.reigns} />
											<Stat label='Longest reign (defenses)' values={b.best} />
										</div>
									);
								})()}
								<RecordRows title='Record by draft style' icon='layers' rows={stats.byStyle.map(r => ({ label: STYLE_META[r.style]?.label ?? r.style, icon: STYLE_META[r.style]?.icon, wins: r.wins }))} />
								<RecordRows title='Record by theme' icon='wheel' rows={stats.byTheme.map(r => ({ label: getTheme(r.theme)?.label ?? r.theme, icon: getTheme(r.theme)?.icon, wins: r.wins }))} />
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

							</>
						)}

						{tab === 'players' && (
							<>
								{stats.potg.length > 0 && (
									<div className='rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-3 mb-4'>
										<div className='flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-yellow-300/80 mb-1.5'>
											<Icon name='star' className='fill-current' />
											Player of the Game leaders
										</div>
										{stats.potg.map(x => (
											<div key={x.id} className='flex items-center gap-2'>
												<div className='w-1.5 h-1.5 rounded-full shrink-0' style={{ background: SIDE_COLORS[x.side] }} />
												<div className='flex-1 min-w-0'>
													<PlayerLine id={x.id} right={`×${x.count}`} />
												</div>
											</div>
										))}
									</div>
								)}
								<div className='grid grid-cols-2 gap-2 mb-4'>
									{([0, 1] as Side[]).map(side => (
										<div key={side} className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
											<div className='text-[10px] font-black uppercase tracking-widest mb-0.5' style={{ color: SIDE_COLORS[side] }}>
												{names[side]}
											</div>
											<div className='text-[10px] text-white/40 mb-2'>{stats.coaches[side].distinct} different players used</div>
											<div className='flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/45 mb-0.5'>
												<Icon name='flame' />
												Most used
											</div>
											{stats.coaches[side].topPicks.length ? stats.coaches[side].topPicks.map(tp => <PlayerLine key={tp.id} id={tp.id} right={`×${tp.count}`} />) : <div className='text-xs text-white/40'>—</div>}
											<div className='flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/45 mt-2.5 mb-0.5'>
												<Icon name='sparkles' />
												Best never used
											</div>
											{stats.coaches[side].neverUsed.map(id => (
												<PlayerLine key={id} id={id} right={`${getVersusPlayer(id)?.overall ?? ''}`} />
											))}
										</div>
									))}
								</div>
								{isCurrent && retired.length > 0 && (
									<div className='rounded-2xl border border-amber-400/30 bg-amber-400/[0.05] p-3 mb-4'>
										<div className='flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-300/80 mb-1.5'>
											<Icon name='medal' />
											Retired right now
										</div>
										{retired.map(r => (
											<div key={`${r.side}-${r.id}`} className='flex items-center gap-2'>
												<div className='w-1.5 h-1.5 rounded-full shrink-0' style={{ background: SIDE_COLORS[r.side] }} />
												<div className='flex-1 min-w-0'>
													<PlayerLine id={r.id} right={`${names[r.side]} · ${r.left} draft${r.left === 1 ? '' : 's'} left`} />
												</div>
											</div>
										))}
									</div>
								)}
							</>
						)}

						{open && <GameDetail g={open} names={names} onClose={() => setOpen(null)} />}
						{hall && <HallOfFame names={names} games={games} onClose={() => setHall(false)} />}

						<button
							onClick={() => {
								const linked = linkedRivalry(names);
								if (confirm(`Erase every ${names[0]} vs ${names[1]} game${linked ? ' on this phone and in the cloud (for both of you)' : ' on this phone'}? Other rivalries stay. This can’t be undone.`)) {
									clearMatchup(names);
									if (linked) void deleteCloudGames(linked).catch(() => undefined);
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
