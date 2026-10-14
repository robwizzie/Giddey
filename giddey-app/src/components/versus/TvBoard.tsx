'use client';

import { actingSide, BAND_INFO, bandFor, isSharedRound, Side, teamIcon, teamName, teamOvr, VersusState, roundsTotal, players } from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { getTheme, themeTitle } from '@/lib/versus/themes';
import Icon from './Icon';
import VersusCard from './VersusCard';
import { useEffect, useRef, useState } from 'react';
import { PickReveal } from './DraftFx';
import { SIDE_COLORS } from './Fx';

function Column({ state, side }: { state: VersusState; side: Side }) {
	const d = state.draft!;
	const roster = players(state.teams[side]);
	const target = d.targets[side];
	const empty = Math.max(0, target - roster.length);
	return (
		<div className='rounded-3xl border-2 p-4 min-w-0 flex flex-col' style={{ borderColor: `${SIDE_COLORS[side]}66`, background: `linear-gradient(170deg, ${SIDE_COLORS[side]}22, transparent 55%)` }}>
			<div className='flex items-center justify-between gap-3 mb-4'>
				<div className='flex items-center gap-3 min-w-0'>
					<span className='inline-flex items-center justify-center rounded-2xl shrink-0 w-12 h-12' style={{ background: `${SIDE_COLORS[side]}22`, color: SIDE_COLORS[side], boxShadow: `inset 0 0 0 1px ${SIDE_COLORS[side]}55` }}>
						<Icon name={teamIcon(state.settings, side)} size={26} />
					</span>
					<div className='min-w-0'>
						<div className='text-3xl 2xl:text-4xl font-black truncate leading-tight' style={{ color: SIDE_COLORS[side] }}>
							{state.settings.names[side]}
						</div>
						{teamName(state.settings, side) !== state.settings.names[side] && <div className='text-sm font-bold uppercase tracking-widest text-white/45 truncate'>{teamName(state.settings, side)}</div>}
					</div>
				</div>
				<div className='text-right shrink-0'>
					<div className='text-4xl 2xl:text-5xl font-black text-white tabular-nums leading-none'>{roster.length ? teamOvr(state.teams[side]).toFixed(1) : '—'}</div>
					<div className='text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mt-1'>
						OVR · {roster.length}/{target}
					</div>
				</div>
			</div>
			<div className='space-y-2 flex-1'>
				{roster.map(p => (
					<div key={p.id} className='flex items-center gap-3 rounded-xl bg-black/30 px-3 py-2 min-w-0'>
						<div className={`tier-${p.tier} rounded-lg w-12 h-10 flex items-center justify-center text-xl font-black text-white shrink-0`} style={{ animation: 'none' }}>
							{p.overall}
						</div>
						<div className='min-w-0'>
							<div className='text-xl 2xl:text-2xl font-black text-white truncate'>
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
	// every new pick gets the full reveal (BOOM for superstars) on the big screen
	const [revealKey, setRevealKey] = useState<string | null>(null);
	const seen = useRef(d?.log.length ?? 0);
	useEffect(() => {
		if (!d) return;
		if (d.log.length > seen.current && d.lastPick && !d.lastPick.blind) setRevealKey(`${d.log.length}-${d.lastPick.id}`);
		seen.current = d.log.length;
	}, [d, d?.log.length]);
	if (!d) return null;
	const actor = d.auction ? (d.auction.lot ? d.auction.lot.turn : d.auction.nominator) : actingSide(d);
	const band = bandFor(d, actor);
	const last = d.lastPick ? getVersusPlayer(d.lastPick.id) : null;
	const lot = d.auction?.lot;
	const cards = lot ? [lot.id] : d.offered.length ? d.offered : d.stage === 'secret' ? [] : d.pack;
	// a coach's own pack stays private — the main screen shows card backs
	const themeInfo = getTheme(state.theme?.id);
	const privatePack = !lot && !d.offered.length && d.stage === 'pick' && (!isSharedRound(state, d) || d.solo);
	return (
		<div className='min-h-screen px-6 py-6 2xl:px-10 2xl:py-8 text-white max-w-[1920px] mx-auto'>
			{revealKey && <PickReveal key={revealKey} state={state} onDone={() => setRevealKey(null)} />}
			<div className='flex items-center justify-between gap-6 mb-6'>
				<div className='flex items-center gap-3 text-white/70'>
					<span className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30'>
						<Icon name='tv' size={22} />
					</span>
					<span className='text-xl font-black tracking-tight text-white'>
						Giddey <span className='text-orange-300'>Versus</span>
					</span>
				</div>
				<div className='flex flex-wrap items-center justify-end gap-2 text-sm font-black uppercase tracking-[0.2em]'>
					<span className='rounded-full bg-white/10 px-4 py-1.5 text-white tabular-nums'>
						Round {d.round + 1}
						<span className='text-white/45'> / {roundsTotal(d) || '—'}</span>
					</span>
					{band && <span className='rounded-full bg-white/5 ring-1 ring-white/10 px-4 py-1.5 text-white/70'>{BAND_INFO[band].label}</span>}
					{state.theme && (
						<span className='inline-flex items-center gap-2 rounded-full px-4 py-1.5' style={{ color: themeInfo?.color ?? '#fff', background: `${themeInfo?.color ?? '#ffffff'}1a`, boxShadow: `inset 0 0 0 1px ${themeInfo?.color ?? '#ffffff'}44` }}>
							<Icon name={themeInfo?.icon ?? 'sparkles'} />
							{themeTitle(state.theme, state.settings.names)}
						</span>
					)}
				</div>
			</div>
			<div className='grid grid-cols-[1fr_1.3fr_1fr] gap-6 2xl:gap-10 items-start'>
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
							return p ? <VersusCard key={id} player={p} width={200} faceDown={state.settings.blind} hidden={privatePack} /> : null;
						})}
						{d.stage === 'secret' && (
							<div className='flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.03] px-10 py-12 w-full max-w-md'>
								<span className='inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30'>
									<Icon name='eyeOff' size={32} />
								</span>
								<div className='text-2xl font-black text-white'>Picks are hidden</div>
								<div className='text-base text-white/50'>Both coaches choose in secret — reveal comes next.</div>
							</div>
						)}
					</div>
					{last && (
						<div className='mt-6 inline-flex flex-wrap items-center justify-center gap-x-2 rounded-2xl bg-black/30 px-5 py-3 text-xl text-white/70'>
							<span className='text-sm font-black uppercase tracking-[0.25em] text-white/40 mr-1'>Last pick</span>
							<span className='font-black text-white'>
								{last.firstName} {last.lastName}
							</span>
							<span className='text-white/35'>→</span>
							<span className='font-black' style={{ color: SIDE_COLORS[d.lastPick!.side] }}>
								{state.settings.names[d.lastPick!.side]}
							</span>
							{d.lastPick!.price !== undefined && <span className='text-emerald-300 font-black tabular-nums'>${d.lastPick!.price}</span>}
						</div>
					)}
				</div>
				<Column state={state} side={1} />
			</div>
		</div>
	);
}
