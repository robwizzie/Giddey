'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { history } from '@/lib/versus/history';
import { belt, hallOfFame, HOF_POTG, Inductee } from '@/lib/versus/legacy';
import { getVersusPlayer } from '@/lib/versus/pool';
import type { RivalryGame } from '@/lib/versus/rivalry';
import { SIDE_COLORS } from './Fx';
import Icon from './Icon';

type Side = 0 | 1;

const GOLD = 'linear-gradient(135deg, #facc15, #b45309)';

/** No real jersey numbers in the data — a stable 0–99 from the id */
function jerseyNo(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return h % 100;
}

/** A retired jersey hanging from the rafters */
function Jersey({ x, color, delay }: { x: Inductee; color: string; delay: number }) {
	const p = getVersusPlayer(x.id);
	const name = (p?.lastName ?? x.id).toUpperCase();
	const long = name.length > 8;
	return (
		<div className='flex flex-col items-center w-[104px] vs-rise' style={{ animationDelay: `${delay}ms` }} title={x.why}>
			<div className='w-px h-4 bg-white/30' />
			<svg viewBox='0 0 100 120' className='w-[84px] h-[100px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]' role='img' aria-label={`${p ? `${p.firstName} ${p.lastName}` : x.id}, retired`}>
				<path d='M28 2 L40 2 Q50 17 60 2 L72 2 Q74 26 90 32 L90 118 L10 118 L10 32 Q26 26 28 2 Z' fill={color} stroke='rgba(255,255,255,0.55)' strokeWidth='2.5' strokeLinejoin='round' />
				<path d='M40 2 Q50 17 60 2' fill='none' stroke='rgba(255,255,255,0.85)' strokeWidth='3' />
				<rect x='10' y='106' width='80' height='4' fill='rgba(255,255,255,0.35)' />
				<text x='50' y='44' textAnchor='middle' fontSize='12' fontWeight='900' fill='#fff' letterSpacing='0.5' {...(long ? { textLength: 66, lengthAdjust: 'spacingAndGlyphs' } : {})} style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2 }}>
					{name}
				</text>
				<text x='50' y='92' textAnchor='middle' fontSize='44' fontWeight='900' fill='#fff' style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 3 }}>
					{jerseyNo(x.id)}
				</text>
			</svg>
			<div className='mt-1.5 text-center leading-tight'>
				<div className='text-[11px] font-black text-white truncate max-w-[104px]'>{p ? `${p.firstName[0]}. ${p.lastName}` : x.id}</div>
				<div className='flex flex-wrap justify-center gap-0.5 mt-1'>
					{x.titles > 0 && (
						<span className='inline-flex items-center gap-0.5 rounded-full bg-yellow-400/15 text-yellow-300 text-[9px] font-black px-1.5 py-0.5'>
							<Icon name='trophy' size={9} />
							{x.titles}
						</span>
					)}
					{x.finalsMvp > 0 && <span className='rounded-full bg-yellow-400/15 text-yellow-300 text-[9px] font-black px-1.5 py-0.5'>FMVP{x.finalsMvp > 1 ? ` ×${x.finalsMvp}` : ''}</span>}
					{x.potg > 0 && (
						<span className='inline-flex items-center gap-0.5 rounded-full bg-white/10 text-white/80 text-[9px] font-black px-1.5 py-0.5'>
							<Icon name='star' size={9} className='fill-current' />
							{x.potg}
						</span>
					)}
				</div>
				<div className='text-[9px] text-white/45 mt-0.5'>
					{x.games} G · {x.wins} W
				</div>
			</div>
		</div>
	);
}

interface Reign {
	side: Side;
	/** games won in the reign, the one that took the belt included */
	len: number;
}

/** Every reign in order (league games don't count, like `belt`) */
function reigns(games: RivalryGame[]): Reign[] {
	const out: Reign[] = [];
	for (const g of games.filter(x => !x.league)) {
		const last = out[out.length - 1];
		if (last && last.side === g.winner) last.len++;
		else out.push({ side: g.winner, len: 1 });
	}
	return out;
}

function BeltHistory({ games, names }: { games: RivalryGame[]; names: [string, string] }) {
	const b = belt(games);
	const list = useMemo(() => reigns(games), [games]);
	if (!b) return null;
	const total = list.reduce((n, r) => n + r.len, 0);
	return (
		<div className='rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-4 mb-5'>
			<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-300/80 mb-3'>
				<Icon name='award' />
				Belt history
			</div>
			<div className='flex items-center gap-3 mb-3'>
				<div className='w-12 h-12 rounded-2xl flex items-center justify-center shrink-0' style={{ background: GOLD, color: '#1c1206', boxShadow: '0 0 18px rgba(250,204,21,0.35)' }}>
					<Icon name='award' size={26} strokeWidth={2.5} />
				</div>
				<div className='min-w-0'>
					<div className='text-[10px] font-black uppercase tracking-widest text-white/45'>Holder</div>
					<div className='text-xl font-black leading-tight truncate' style={{ color: SIDE_COLORS[b.holder] }}>
						{names[b.holder]}
					</div>
					<div className='text-[11px] text-white/60'>
						{b.defenses ? `${b.defenses} straight defense${b.defenses === 1 ? '' : 's'}` : b.changed && b.games > 1 ? 'Just took it' : 'No defenses yet'} · {b.games} game{b.games === 1 ? '' : 's'} on the line
					</div>
				</div>
			</div>
			{/* reign strip, oldest first */}
			<div className='flex h-2.5 rounded-full overflow-hidden gap-px bg-black/30 mb-3'>
				{list.map((r, i) => (
					<div key={i} title={`${names[r.side]} · ${r.len - 1} defense${r.len === 2 ? '' : 's'}`} style={{ flex: `${r.len / total} 0 0`, background: SIDE_COLORS[r.side], opacity: i === list.length - 1 ? 1 : 0.6 }} />
				))}
			</div>
			<div className='grid grid-cols-2 gap-2'>
				{([0, 1] as Side[]).map(side => (
					<div key={side} className={`rounded-xl bg-white/[0.04] p-2.5 ${side ? 'text-right' : ''}`}>
						<div className='text-[10px] font-black uppercase tracking-widest truncate' style={{ color: SIDE_COLORS[side] }}>
							{names[side]}
						</div>
						<div className='text-[12px] text-white mt-0.5'>
							<span className='font-black text-lg tabular-nums'>{b.reigns[side]}</span> reign{b.reigns[side] === 1 ? '' : 's'}
						</div>
						<div className='text-[11px] text-white/55'>Longest: {b.best[side]} defense{b.best[side] === 1 ? '' : 's'}</div>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * Retired jerseys for both coaches plus the belt's history. Reads the
 * head-to-head log (`history()` by default — pass `games` to show another
 * pair, already seated to `names`).
 */
export default function HallOfFame({ names, onClose, games }: { names: [string, string]; onClose: () => void; games?: RivalryGame[] }) {
	const log = games ?? history();
	const hof = useMemo(() => hallOfFame(log), [log]);
	const any = hof[0].length + hof[1].length > 0;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	// portal: the rivalry sheet animates with a transform, which would trap a fixed overlay inside it
	return createPortal(
		<div className='fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-4'>
					<div className='text-lg font-black text-white inline-flex items-center gap-2'>
						<Icon name='shirt' className='text-orange-300' />
						Hall of Fame
					</div>
					<button onClick={onClose} className='p-2 -mr-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>

				{!any && (
					<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5 text-center'>
						<Icon name='shirt' size={40} className='mx-auto mb-2 text-white/25' />
						<div className='text-sm font-black text-white'>The rafters are empty</div>
						<div className='text-[12px] text-white/55 mt-1 leading-snug'>
							A player&apos;s jersey goes up when you win a title with him on your roster for the clinching game, or when he wins Player of the Game for you {HOF_POTG} times.
						</div>
					</div>
				)}

				{([0, 1] as Side[]).map(side => (
					<div key={side} className='mb-5'>
						<div className='flex items-baseline justify-between mb-1'>
							<div className='text-xs font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
								{names[side]}&apos;s rafters
							</div>
							<div className='text-[10px] font-black text-white/40'>
								{hof[side].length} retired
							</div>
						</div>
						{/* the rafter beam */}
						<div className='h-2 rounded-full' style={{ background: `linear-gradient(90deg, ${SIDE_COLORS[side]}, ${SIDE_COLORS[side]}55)` }} />
						{hof[side].length ? (
							<div className='flex flex-wrap justify-center gap-x-2 gap-y-3 rounded-b-2xl pb-3' style={{ background: `linear-gradient(180deg, ${SIDE_COLORS[side]}14, transparent 80%)` }}>
								{hof[side].map((x, i) => (
									<Jersey key={x.id} x={x} color={SIDE_COLORS[side]} delay={i * 80} />
								))}
							</div>
						) : (
							<div className='text-[12px] text-white/40 text-center py-5'>{any ? 'No jerseys up yet. Win a title to change that.' : 'Nothing hanging yet.'}</div>
						)}
					</div>
				))}

				<BeltHistory games={log} names={names} />
			</div>
		</div>,
		document.body,
	);
}
