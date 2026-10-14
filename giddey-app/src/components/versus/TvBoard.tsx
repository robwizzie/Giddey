'use client';

import { actingSide, BAND_INFO, bandFor, Side, teamOvr, VersusState, roundsTotal, players } from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { themeTitle } from '@/lib/versus/themes';
import VersusCard from './VersusCard';
import { SIDE_COLORS } from './Fx';

function Column({ state, side }: { state: VersusState; side: Side }) {
	const d = state.draft!;
	const roster = players(state.teams[side]);
	const target = d.targets[side];
	const empty = Math.max(0, target - roster.length);
	return (
		<div className='rounded-3xl border-2 p-4 min-w-0 flex flex-col' style={{ borderColor: `${SIDE_COLORS[side]}66`, background: `linear-gradient(170deg, ${SIDE_COLORS[side]}22, transparent 55%)` }}>
			<div className='flex items-baseline justify-between mb-3'>
				<div className='text-3xl font-black truncate' style={{ color: SIDE_COLORS[side] }}>
					{state.settings.names[side]}
				</div>
				<div className='text-4xl font-black text-white tabular-nums'>{roster.length ? teamOvr(state.teams[side]).toFixed(1) : '—'}</div>
			</div>
			<div className='space-y-2 flex-1'>
				{roster.map(p => (
					<div key={p.id} className='flex items-center gap-3 rounded-xl bg-black/30 px-3 py-2'>
						<div className={`tier-${p.tier} rounded-lg w-12 h-10 flex items-center justify-center text-xl font-black text-white shrink-0`} style={{ animation: 'none' }}>
							{p.overall}
						</div>
						<div className='min-w-0'>
							<div className='text-xl font-black text-white truncate'>
								{p.firstName} {p.lastName}
							</div>
							<div className='text-sm text-white/50'>
								{p.position}/{p.secondaryPosition}
								{p.era === 'alltime' ? ` · ${p.eraLabel}` : ''}
							</div>
						</div>
					</div>
				))}
				{Array.from({ length: empty }).map((_, i) => (
					<div key={i} className='h-14 rounded-xl border-2 border-dashed border-white/10' />
				))}
			</div>
		</div>
	);
}

/** Big-screen draft board for a TV / laptop watching a live room */
export default function TvBoard({ state }: { state: VersusState }) {
	const d = state.draft;
	if (!d) return null;
	const actor = d.auction ? (d.auction.lot ? d.auction.lot.turn : d.auction.nominator) : actingSide(d);
	const band = bandFor(d, actor);
	const last = d.lastPick ? getVersusPlayer(d.lastPick.id) : null;
	const lot = d.auction?.lot;
	const cards = lot ? [lot.id] : d.offered.length ? d.offered : d.stage === 'secret' ? [] : d.pack;
	return (
		<div className='min-h-screen px-6 py-6 text-white'>
			<div className='text-center mb-4'>
				<div className='text-sm font-black uppercase tracking-[0.4em] text-white/45'>
					📺 Giddey Versus · Round {d.round + 1}/{roundsTotal(d) || '—'}
					{band ? ` · ${BAND_INFO[band].label}` : ''}
					{state.theme ? ` · ${themeTitle(state.theme, state.settings.names)}` : ''}
				</div>
			</div>
			<div className='grid grid-cols-[1fr_1.3fr_1fr] gap-6 items-start'>
				<Column state={state} side={0} />
				<div className='text-center'>
					<div className='rounded-3xl px-6 py-5 mb-5' style={{ background: `linear-gradient(135deg, ${SIDE_COLORS[actor]}44, ${SIDE_COLORS[actor]}11)`, border: `2px solid ${SIDE_COLORS[actor]}88` }}>
						<div className='text-lg font-black uppercase tracking-[0.35em] text-white/60'>{d.stage === 'secret' ? 'Blind bid — picking in secret' : lot ? 'On the block' : 'On the clock'}</div>
						<div className='text-6xl font-black' style={{ color: SIDE_COLORS[actor] }}>
							{state.settings.names[actor]}
						</div>
						{lot && (
							<div className='text-3xl font-black text-emerald-300 mt-1'>
								{lot.high === null ? `Opening at $${lot.bid}` : `$${lot.bid} — ${state.settings.names[lot.high]}`}
							</div>
						)}
					</div>
					<div className='flex flex-wrap justify-center gap-4'>
						{cards.map(id => {
							const p = getVersusPlayer(id);
							return p ? <VersusCard key={id} player={p} width={200} faceDown={state.settings.blind} /> : null;
						})}
						{d.stage === 'secret' && <div className='text-4xl py-16'>🙈</div>}
					</div>
					{last && (
						<div className='mt-6 text-xl text-white/70'>
							Last pick: <span className='font-black text-white'>{last.firstName} {last.lastName}</span> → <span style={{ color: SIDE_COLORS[d.lastPick!.side] }}>{state.settings.names[d.lastPick!.side]}</span>
							{d.lastPick!.price !== undefined ? ` for $${d.lastPick!.price}` : ''}
						</div>
					)}
				</div>
				<Column state={state} side={1} />
			</div>
		</div>
	);
}
