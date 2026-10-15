'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from '@/lib/versus/engine';
import { loadRivalry, matchups, RivalryGame } from '@/lib/versus/rivalry';
import { seatGames } from '@/lib/versus/history';
import { chartTone, H2H, headToHead, Night, TimelinePoint } from '@/lib/versus/h2h';
import { getVersusPlayer } from '@/lib/versus/pool';
import Icon from './Icon';

// ═══════════════════════════════════════════════════════════════
//  HEAD-TO-HEAD STATS — win share over time, every game's margin,
//  each coach's most-drafted players, and their best & worst nights.
//
//  Identity is never color alone: the win-share line is one series
//  around a 50% midline, game bars point up for coach 1 and down for
//  coach 2, the drafted lists are separate titled panels, and nights
//  are named cards. Coach colors are stepped into the dark-mode
//  lightness band for marks (chartTone); text stays in text ink.
// ═══════════════════════════════════════════════════════════════

type Side = 0 | 1;

const INK = { primary: 'rgba(255,255,255,0.92)', secondary: 'rgba(255,255,255,0.62)', muted: 'rgba(255,255,255,0.4)', grid: 'rgba(255,255,255,0.08)', axis: 'rgba(255,255,255,0.18)', surface: '#0d1220' };

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDay = (n: Night) => new Date(n.ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
	const ref = useRef<T>(null);
	const [w, setW] = useState(0);
	useEffect(() => {
		if (!ref.current) return;
		const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
		ro.observe(ref.current);
		return () => ro.disconnect();
	}, []);
	return [ref, w];
}

/** Floating tooltip inside a relative chart box */
function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: React.ReactNode }) {
	const left = Math.min(Math.max(x - 90, 0), Math.max(0, w - 180));
	// sit just above the hovered point so it stays visible; flip below near the top edge
	const above = y > 96;
	return (
		<div className='absolute z-10 pointer-events-none w-[180px] rounded-xl border border-white/15 bg-[#151c2e]/95 backdrop-blur px-3 py-2 text-[11px] leading-snug shadow-xl' style={{ left, top: above ? y - 12 : y + 14, transform: above ? 'translateY(-100%)' : undefined, color: INK.secondary }}>
			{children}
		</div>
	);
}

function ChartCard({ title, sub, children, table }: { title: string; sub?: string; children: React.ReactNode; table?: React.ReactNode }) {
	const [showTable, setShowTable] = useState(false);
	return (
		<section className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4'>
			<div className='flex items-start justify-between gap-3 mb-3'>
				<div className='min-w-0'>
					<h3 className='text-sm font-black text-white'>{title}</h3>
					{sub && <p className='text-[11px] text-white/50 leading-snug'>{sub}</p>}
				</div>
				{table && (
					<button onClick={() => setShowTable(t => !t)} className='shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-white/50 hover:text-white min-h-[32px]' aria-pressed={showTable}>
						<Icon name={showTable ? 'chart' : 'list'} size={13} /> {showTable ? 'Chart' : 'Table'}
					</button>
				)}
			</div>
			{showTable && table ? <div className='max-h-72 overflow-y-auto'>{table}</div> : children}
		</section>
	);
}

// ─── win share over time ────────────────────────────────────────

function WinShare({ points, names, tones }: { points: TimelinePoint[]; names: [string, string]; tones: [string, string] }) {
	const [box, width] = useWidth<HTMLDivElement>();
	const [hover, setHover] = useState<number | null>(null);
	const H = 180;
	const pad = { l: 34, r: 56, t: 10, b: 22 };
	const iw = Math.max(10, width - pad.l - pad.r);
	const ih = H - pad.t - pad.b;
	const x = (i: number) => pad.l + (points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
	const y = (v: number) => pad.t + ih - (v / 100) * ih;
	const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.share).toFixed(1)}`).join('');
	// shade between the line and 50%: above = coach 1 ahead, below = coach 2
	const area = points.length ? `${line}L${x(points.length - 1)},${y(50)}L${x(0)},${y(50)}Z` : '';
	const last = points[points.length - 1];
	const onMove = (clientX: number) => {
		const r = box.current!.getBoundingClientRect();
		const rel = clientX - r.left - pad.l;
		const i = points.length < 2 ? 0 : Math.round((rel / iw) * (points.length - 1));
		setHover(Math.max(0, Math.min(points.length - 1, i)));
	};
	const h = hover !== null ? points[hover] : null;
	return (
		<div ref={box} className='relative select-none touch-pan-y' onPointerMove={e => onMove(e.clientX)} onPointerDown={e => onMove(e.clientX)} onPointerLeave={() => setHover(null)}>
			{width > 0 && (
				<svg width={width} height={H} role='img' aria-label={`${names[0]}'s share of all games over time, now ${Math.round(last?.share ?? 0)}%`}>
					<defs>
						<clipPath id='h2h-above'>
							<rect x={0} y={0} width={width} height={y(50)} />
						</clipPath>
						<clipPath id='h2h-below'>
							<rect x={0} y={y(50)} width={width} height={H} />
						</clipPath>
					</defs>
					{[0, 25, 50, 75, 100].map(v => (
						<g key={v}>
							<line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke={v === 50 ? INK.axis : INK.grid} strokeWidth={1} strokeDasharray={v === 50 ? '4 4' : undefined} />
							<text x={pad.l - 6} y={y(v)} dy='0.32em' textAnchor='end' fontSize={10} fill={INK.muted}>
								{v}%
							</text>
						</g>
					))}
					<path d={area} fill={tones[0]} opacity={0.22} clipPath='url(#h2h-above)' />
					<path d={area} fill={tones[1]} opacity={0.22} clipPath='url(#h2h-below)' />
					<path d={line} fill='none' stroke='rgba(255,255,255,0.85)' strokeWidth={2} strokeLinejoin='round' strokeLinecap='round' />
					{last && (
						<>
							<circle cx={x(points.length - 1)} cy={y(last.share)} r={4} fill='#fff' stroke={INK.surface} strokeWidth={2} />
							<text x={x(points.length - 1) + 8} y={y(last.share)} dy='0.32em' fontSize={11} fontWeight={800} fill={INK.primary}>
								{Math.round(last.share)}%
							</text>
						</>
					)}
					<text x={pad.l + 4} y={pad.t + 10} fontSize={10} fontWeight={700} fill={INK.secondary}>
						{names[0]} ahead
					</text>
					<text x={pad.l + 4} y={pad.t + ih - 4} fontSize={10} fontWeight={700} fill={INK.secondary}>
						{names[1]} ahead
					</text>
					<text x={pad.l} y={H - 4} fontSize={10} fill={INK.muted}>
						Game 1
					</text>
					<text x={pad.l + iw} y={H - 4} fontSize={10} textAnchor='end' fill={INK.muted}>
						Game {points.length}
					</text>
					{h && (
						<>
							<line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={pad.t + ih} stroke='rgba(255,255,255,0.35)' strokeWidth={1} />
							<circle cx={x(hover!)} cy={y(h.share)} r={5} fill='#fff' stroke={INK.surface} strokeWidth={2} />
						</>
					)}
				</svg>
			)}
			{h && (
				<Tip x={x(hover!)} y={y(h.share)} w={width}>
					<div className='font-black text-white'>
						Game {h.i + 1} · {fmtDate(h.ts)}
					</div>
					<div>
						{names[h.winner]} won{h.score[0] !== null && h.score[1] !== null ? ` ${Math.max(h.score[0], h.score[1]!)}–${Math.min(h.score[0], h.score[1]!)}` : ''}
					</div>
					<div>
						{names[0]} {Math.round(h.share)}% · {names[1]} {Math.round(100 - h.share)}% of games so far
					</div>
				</Tip>
			)}
		</div>
	);
}

// ─── every game's margin ────────────────────────────────────────

function Margins({ points, names, tones }: { points: TimelinePoint[]; names: [string, string]; tones: [string, string] }) {
	const [box, width] = useWidth<HTMLDivElement>();
	const [hover, setHover] = useState<number | null>(null);
	const H = 170;
	const pad = { l: 34, r: 8, t: 14, b: 14 };
	const iw = Math.max(10, width - pad.l - pad.r);
	const ih = H - pad.t - pad.b;
	const max = Math.max(10, ...points.map(p => Math.abs(p.margin ?? 0)));
	const step = Math.ceil(max / 10) * 10;
	const mid = pad.t + ih / 2;
	const yv = (v: number) => mid - (v / step) * (ih / 2);
	const slot = iw / Math.max(1, points.length);
	const bw = Math.max(2, Math.min(18, slot - 2));
	// a win with no score entered still gets a short bar so the result shows
	const unknown = step * 0.12;
	const bar = (p: TimelinePoint, i: number) => {
		const v = p.margin ?? (p.winner === 0 ? unknown : -unknown);
		const x = pad.l + i * slot + (slot - bw) / 2;
		const y0 = yv(0);
		const y1 = yv(v);
		const top = Math.min(y0, y1);
		const hgt = Math.max(2, Math.abs(y1 - y0));
		const r = Math.min(4, bw / 2, hgt);
		// rounded at the data end, square on the zero line
		const d = v >= 0 ? `M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${y0}Z` : `M${x},${y0}V${top + hgt - r}Q${x},${top + hgt} ${x + r},${top + hgt}H${x + bw - r}Q${x + bw},${top + hgt} ${x + bw},${top + hgt - r}V${y0}Z`;
		return { d, x, top, hgt };
	};
	const onMove = (clientX: number) => {
		const r = box.current!.getBoundingClientRect();
		const i = Math.floor((clientX - r.left - pad.l) / slot);
		setHover(i >= 0 && i < points.length ? i : null);
	};
	const h = hover !== null ? points[hover] : null;
	const hb = h ? bar(h, hover!) : null;
	return (
		<div ref={box} className='relative select-none touch-pan-y' onPointerMove={e => onMove(e.clientX)} onPointerDown={e => onMove(e.clientX)} onPointerLeave={() => setHover(null)}>
			{width > 0 && (
				<svg width={width} height={H} role='img' aria-label={`Every game's margin: bars up are ${names[0]} wins, bars down are ${names[1]} wins`}>
					{[step, step / 2, 0, -step / 2, -step].map(v => (
						<g key={v}>
							<line x1={pad.l} x2={pad.l + iw} y1={yv(v)} y2={yv(v)} stroke={v === 0 ? INK.axis : INK.grid} strokeWidth={1} />
							<text x={pad.l - 6} y={yv(v)} dy='0.32em' textAnchor='end' fontSize={10} fill={INK.muted}>
								{v === 0 ? '0' : `+${Math.abs(v)}`}
							</text>
						</g>
					))}
					{points.map((p, i) => {
						const b = bar(p, i);
						return <path key={i} d={b.d} fill={tones[p.winner]} opacity={p.margin === null ? 0.45 : hover === null || hover === i ? 1 : 0.55} />;
					})}
					<text x={pad.l + 4} y={pad.t - 3} fontSize={10} fontWeight={700} fill={INK.secondary}>
						▲ {names[0]} won by
					</text>
					<text x={pad.l + 4} y={H - 2} fontSize={10} fontWeight={700} fill={INK.secondary}>
						▼ {names[1]} won by
					</text>
				</svg>
			)}
			{h && hb && (
				<Tip x={hb.x + bw / 2} y={hb.top} w={width}>
					<div className='font-black text-white'>
						Game {h.i + 1} · {fmtDate(h.ts)}
					</div>
					<div>
						{names[h.winner]} won
						{h.margin !== null ? ` by ${Math.abs(h.margin)} (${Math.max(h.score[0]!, h.score[1]!)}–${Math.min(h.score[0]!, h.score[1]!)})` : ' — no score entered'}
					</div>
				</Tip>
			)}
		</div>
	);
}

// ─── most-drafted players ───────────────────────────────────────

function Drafted({ list, name, tone, games }: { list: H2H['drafted'][0]; name: string; tone: string; games: number }) {
	const top = list.slice(0, 8);
	const max = Math.max(1, ...top.map(d => d.count));
	return (
		<div className='min-w-0'>
			<div className='text-[11px] font-black uppercase tracking-widest text-white/70 mb-2 flex items-center gap-1.5'>
				<span className='w-2.5 h-2.5 rounded-sm' style={{ background: tone }} aria-hidden />
				{name}
			</div>
			{!top.length && <div className='text-[12px] text-white/40'>No rosters saved yet.</div>}
			<ol className='space-y-1.5'>
				{top.map(d => {
					const p = getVersusPlayer(d.id);
					return (
						<li key={d.id} title={`${p ? `${p.firstName} ${p.lastName}` : d.id}: drafted in ${d.count} of ${games} games, won ${d.wins}`}>
							<div className='flex items-baseline justify-between gap-2 text-[12px]'>
								<span className='font-bold text-white truncate'>{p ? p.lastName : d.id}</span>
								<span className='tabular-nums text-white/60 shrink-0'>
									{d.count}× · {Math.round((d.wins / d.count) * 100)}% W
								</span>
							</div>
							<div className='h-2 rounded-full bg-white/[0.06] overflow-hidden'>
								<div className='h-full rounded-full' style={{ width: `${(d.count / max) * 100}%`, background: tone }} />
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

// ─── nights ─────────────────────────────────────────────────────

function NightCard({ label, night, side, names, tone, good }: { label: string; night: Night | null; side: Side; names: [string, string]; tone: string; good: boolean }) {
	if (!night) return null;
	const o: Side = side === 0 ? 1 : 0;
	const pts = side === 0 ? night.diff : -night.diff;
	return (
		<div className='rounded-xl border border-white/10 bg-black/20 p-3 min-w-0' style={{ boxShadow: `inset 3px 0 0 ${tone}` }}>
			<div className='text-[10px] font-black uppercase tracking-widest text-white/50 flex items-center gap-1'>
				<Icon name={good ? 'trendUp' : 'trendDown'} size={12} /> {names[side]}’s {label}
			</div>
			<div className='text-lg font-black text-white tabular-nums leading-tight mt-0.5'>
				{night.wins[side]}–{night.wins[o]}
			</div>
			<div className='text-[11px] text-white/55'>
				{fmtDay(night)}
				{pts ? ` · ${pts > 0 ? '+' : ''}${pts} pts` : ''}
			</div>
		</div>
	);
}

// ─── the sheet ──────────────────────────────────────────────────

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<div className='rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 min-w-0'>
			<div className='text-[10px] font-black uppercase tracking-widest text-white/45'>{label}</div>
			<div className='text-xl font-black text-white tabular-nums leading-tight truncate'>{value}</div>
			{sub && <div className='text-[11px] text-white/50 truncate'>{sub}</div>}
		</div>
	);
}

export default function H2HStats({ settings, onClose }: { settings: Settings; onClose: () => void }) {
	const pairs = useMemo(() => matchups(), []);
	const [names, setNames] = useState<[string, string]>(() => (settings.names[0].trim() && settings.names[1].trim() ? settings.names : (pairs[0]?.names ?? settings.names)));
	const [range, setRange] = useState<'all' | 20>('all');
	const all: RivalryGame[] = useMemo(() => seatGames(loadRivalry(), names), [names]);
	const games = range === 'all' ? all : all.slice(-range);
	const s = useMemo(() => headToHead(games), [games]);
	// tonight's colors when it's tonight's pair, the default pair otherwise
	const same = names.map(n => n.trim().toLowerCase()).join('|') === settings.names.map(n => n.trim().toLowerCase()).join('|');
	const colors: [string, string] = same ? [settings.identity[0].color, settings.identity[1].color] : ['#f97316', '#38bdf8'];
	const tones: [string, string] = [chartTone(colors[0]), chartTone(colors[1])];
	useEffect(() => {
		const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		window.addEventListener('keydown', k);
		return () => window.removeEventListener('keydown', k);
	}, [onClose]);

	const pct = s.games ? Math.round((s.wins[0] / s.games) * 100) : 0;
	const leader = s.wins[0] === s.wins[1] ? null : s.wins[0] > s.wins[1] ? 0 : 1;

	return createPortal(
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div role='dialog' aria-label='Head-to-head stats' className='w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-3'>
					<div className='text-lg font-black text-white inline-flex items-center gap-2'>
						<Icon name='lineChart' className='text-orange-300' />
						Head-to-head stats
					</div>
					<button onClick={onClose} className='p-2 -mr-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>

				{/* filters: one row above the charts */}
				<div className='flex flex-wrap items-center gap-2 mb-4'>
					{pairs.length > 1 && (
						<select
							value={names.join('|')}
							onChange={e => setNames(e.target.value.split('|') as [string, string])}
							className='min-h-[36px] rounded-xl bg-white/[0.06] border border-white/10 px-3 text-sm font-bold text-white'
							aria-label='Which rivalry'
						>
							{pairs.map(m => (
								<option key={m.names.join('|')} value={m.names.join('|')} className='bg-[#0d1220]'>
									{m.names[0]} vs {m.names[1]}
								</option>
							))}
						</select>
					)}
					<div className='flex rounded-xl bg-white/[0.06] border border-white/10 p-0.5' role='group' aria-label='Games shown'>
						{(['all', 20] as const).map(r => (
							<button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`min-h-[32px] px-3 rounded-lg text-xs font-black ${range === r ? 'bg-white text-black' : 'text-white/60'}`}>
								{r === 'all' ? 'All games' : 'Last 20'}
							</button>
						))}
					</div>
				</div>

				{!s.games ? (
					<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/55'>
						<Icon name='chart' size={28} className='mx-auto mb-2 text-white/30' />
						No games between {names[0] || 'these two'} and {names[1] || 'their rival'} yet. Play one and the charts fill in.
					</div>
				) : (
					<>
						<div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4'>
							<Tile label='Record' value={`${s.wins[0]}–${s.wins[1]}`} sub={leader === null ? 'All square' : `${names[leader]} leads`} />
							<Tile label={`${names[0]} win %`} value={`${pct}%`} sub={`${s.games} games`} />
							<Tile label='Streak' value={s.streak ? `${s.streak.n}` : '—'} sub={s.streak ? (s.streak.n === 1 ? `${names[s.streak.side]} won the last one` : `${names[s.streak.side]} in a row`) : undefined} />
							<Tile label='Nights won' value={`${s.nightWins[0]}–${s.nightWins[1]}`} sub={`${s.nights.length} nights played`} />
						</div>

						<ChartCard
							title='Win share over time'
							sub={`${names[0]}'s share of every game played so far. Above the dashed line, ${names[0]} is ahead overall.`}
							table={
								<table className='w-full text-[12px] text-white/70'>
									<thead className='text-white/45'>
										<tr>
											<th className='text-left font-bold py-1'>Game</th>
											<th className='text-left font-bold'>Date</th>
											<th className='text-left font-bold'>Winner</th>
											<th className='text-right font-bold'>{names[0]} share</th>
										</tr>
									</thead>
									<tbody>
										{s.timeline.map(p => (
											<tr key={p.i} className='border-t border-white/5'>
												<td className='py-1 tabular-nums'>{p.i + 1}</td>
												<td>{fmtDate(p.ts)}</td>
												<td>{names[p.winner]}</td>
												<td className='text-right tabular-nums'>{Math.round(p.share)}%</td>
											</tr>
										))}
									</tbody>
								</table>
							}
						>
							<WinShare points={s.timeline} names={names} tones={tones} />
						</ChartCard>

						<ChartCard
							title='Every game'
							sub='How much each game was won by. Faded bars are games without a score.'
							table={
								<table className='w-full text-[12px] text-white/70'>
									<thead className='text-white/45'>
										<tr>
											<th className='text-left font-bold py-1'>Game</th>
											<th className='text-left font-bold'>Winner</th>
											<th className='text-right font-bold'>Score</th>
										</tr>
									</thead>
									<tbody>
										{s.timeline.map(p => (
											<tr key={p.i} className='border-t border-white/5'>
												<td className='py-1 tabular-nums'>{p.i + 1}</td>
												<td>{names[p.winner]}</td>
												<td className='text-right tabular-nums'>{p.score[0] !== null && p.score[1] !== null ? `${p.score[0]}–${p.score[1]}` : '—'}</td>
											</tr>
										))}
									</tbody>
								</table>
							}
						>
							<Margins points={s.timeline} names={names} tones={tones} />
							<div className='grid grid-cols-2 gap-2 mt-3 text-[11px] text-white/60'>
								<div>
									<span className='font-black text-white'>Biggest win:</span> {s.blowout ? `${names[s.blowout.margin! > 0 ? 0 : 1]} by ${Math.abs(s.blowout.margin!)}, ${fmtDate(s.blowout.ts)}` : '—'}
								</div>
								<div>
									<span className='font-black text-white'>Closest:</span> {s.closest ? `${names[s.closest.margin! > 0 ? 0 : 1]} by ${Math.abs(s.closest.margin!)}, ${fmtDate(s.closest.ts)}` : '—'}
								</div>
								<div>
									<span className='font-black text-white'>Avg win by:</span> {names[0]} {s.avgWinBy[0] !== null ? s.avgWinBy[0].toFixed(1) : '—'} · {names[1]} {s.avgWinBy[1] !== null ? s.avgWinBy[1].toFixed(1) : '—'}
								</div>
								<div>
									<span className='font-black text-white'>Longest streak:</span> {names[0]} {s.longest[0]} · {names[1]} {s.longest[1]}
								</div>
							</div>
						</ChartCard>

						<ChartCard title='Most-drafted players' sub='How often each coach took a player, and how often they won with him.'>
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
								<Drafted list={s.drafted[0]} name={names[0]} tone={tones[0]} games={s.games} />
								<Drafted list={s.drafted[1]} name={names[1]} tone={tones[1]} games={s.games} />
							</div>
						</ChartCard>

						<ChartCard
							title='Best and worst nights'
							sub='A night is every game played on the same day. Best = most games won over the other coach, then points.'
							table={
								<table className='w-full text-[12px] text-white/70'>
									<thead className='text-white/45'>
										<tr>
											<th className='text-left font-bold py-1'>Night</th>
											<th className='text-right font-bold'>{names[0]}</th>
											<th className='text-right font-bold'>{names[1]}</th>
											<th className='text-right font-bold'>Pts</th>
										</tr>
									</thead>
									<tbody>
										{[...s.nights].reverse().map(n => (
											<tr key={n.day} className='border-t border-white/5'>
												<td className='py-1'>{fmtDay(n)}</td>
												<td className='text-right tabular-nums'>{n.wins[0]}</td>
												<td className='text-right tabular-nums'>{n.wins[1]}</td>
												<td className='text-right tabular-nums'>{n.diff > 0 ? `+${n.diff}` : n.diff}</td>
											</tr>
										))}
									</tbody>
								</table>
							}
						>
							{s.nights.length < 2 ? (
								<div className='text-[12px] text-white/50'>Play on a second night and the best and worst nights show up here.</div>
							) : (
								<div className='grid grid-cols-2 gap-2'>
									<NightCard label='best night' night={s.best[0]} side={0} names={names} tone={tones[0]} good />
									<NightCard label='best night' night={s.best[1]} side={1} names={names} tone={tones[1]} good />
									<NightCard label='worst night' night={s.worst[0]} side={0} names={names} tone={tones[0]} good={false} />
									<NightCard label='worst night' night={s.worst[1]} side={1} names={names} tone={tones[1]} good={false} />
								</div>
							)}
						</ChartCard>
					</>
				)}
			</div>
		</div>,
		document.body,
	);
}
