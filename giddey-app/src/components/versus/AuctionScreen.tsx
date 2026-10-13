'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Position } from '@/lib/types';
import { auctionBoard, auctionValues, fitsNeed, maxBid, missingPositions, nominate, passBid, raise, Side, slotsLeft, VersusState } from '@/lib/versus/engine';
import { getTeamFor, getVersusPlayer, VersusPlayer } from '@/lib/versus/pool';
import { play } from '@/lib/versus/sound';
import VersusCard from './VersusCard';
import Scoreboard from './Scoreboard';
import { SIDE_COLORS } from './Fx';
import { RosterColumn } from './DraftScreen';
import { CommissionerIntro, PickReveal, ShotClockRing, useShotClock, ViolationToast } from './DraftFx';

const POSITIONS: (Position | 'ALL' | 'NEED')[] = ['ALL', 'NEED', 'PG', 'SG', 'SF', 'PF', 'C'];
const introsShown = new Set<string>();

function BoardRow({ p, value, need, selected, onClick }: { p: VersusPlayer; value: number; need: Position | null; selected: boolean; onClick: () => void }) {
	const team = getTeamFor(p);
	return (
		<button onClick={onClick} className={`w-full flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors ${selected ? 'bg-white/15 ring-2 ring-white/70' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}>
			<div className={`tier-${p.tier} rounded-md w-9 h-9 flex items-center justify-center text-sm font-black text-white shrink-0`} style={{ animation: 'none' }}>
				{p.overall}
			</div>
			<div className='min-w-0 flex-1'>
				<div className='text-sm font-bold text-white truncate leading-tight'>
					{p.firstName} {p.lastName}
				</div>
				<div className='text-[10px] text-white/45 truncate leading-tight'>
					{p.position}/{p.secondaryPosition} · {p.era === 'alltime' ? `${p.eraLabel ?? ''} ${team.name}`.trim() : team.abbreviation}
				</div>
			</div>
			{need && <span className='text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 shrink-0'>Fills {need}</span>}
			<div className='text-right shrink-0 w-12'>
				<div className='text-sm font-black text-green-400 tabular-nums'>${value}</div>
				<div className='text-[8px] text-white/35 uppercase font-bold'>value</div>
			</div>
		</button>
	);
}

export default function AuctionScreen({ state, setState }: { state: VersusState; setState: (s: VersusState) => void }) {
	const d = state.draft!;
	const a = d.auction!;
	const { names, shotClock } = state.settings;
	const lot = a.lot;
	const actor: Side = lot ? lot.turn : a.nominator;
	const values = auctionValues(state, actor);
	const needs = missingPositions(state.teams[actor]);
	const [query, setQuery] = useState('');
	const [pos, setPos] = useState<(typeof POSITIONS)[number]>('ALL');
	const [limit, setLimit] = useState(40);
	const [chosen, setChosen] = useState<string | null>(null);
	const [opening, setOpening] = useState(1);
	const [revealKey, setRevealKey] = useState<string | null>(null);
	const [violation, setViolation] = useState<string | null>(null);
	const introKey = `${state.gameNo}`;
	const [showIntro, setShowIntro] = useState(() => d.log.length === 0 && !introsShown.has(introKey));

	const seenLog = useRef(d.log.length);
	useEffect(() => {
		if (d.log.length > seenLog.current) {
			play('gavel');
			setRevealKey(`${d.log.length}-${d.lastPick?.id}`);
		}
		seenLog.current = d.log.length;
	}, [d.log.length, d.lastPick]);

	useEffect(() => {
		setChosen(null);
		setOpening(1);
	}, [d.log.length, a.nominator]);

	const board = useMemo(() => {
		const q = query.trim().toLowerCase();
		return auctionBoard(state).filter(p => {
			if (q && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false;
			if (pos === 'NEED') return !!fitsNeed(p, needs);
			if (pos !== 'ALL') return p.position === pos || p.secondaryPosition === pos;
			return true;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query, pos, state.teams, needs.join()]);

	const overlay = showIntro || !!revealKey;
	const clockKey = `${d.log.length}-${lot ? `${lot.id}-${lot.bid}-${lot.turn}` : `nom-${a.nominator}`}`;
	const left = useShotClock(clockKey, shotClock, overlay, () => {
		setViolation(lot ? `Shot clock — ${names[actor]} passes` : 'Shot clock — auto-nomination');
		setTimeout(() => setViolation(null), 2200);
		if (lot) setState(passBid(state));
		else {
			const fits = auctionBoard(state).filter(p => fitsNeed(p, needs));
			const p = (fits.length ? fits : auctionBoard(state))[0];
			if (p) setState(nominate(state, p.id, 1));
		}
	});

	const myMax = maxBid(state, actor);
	const chosenP = chosen ? getVersusPlayer(chosen) : null;
	const lotP = lot ? getVersusPlayer(lot.id)! : null;
	const lotValue = lot ? (auctionValues(state, actor).get(lot.id) ?? 1) : 0;
	const bid = (amt: number) => {
		play('coin');
		setState(raise(state, amt));
	};

	return (
		<div className='min-h-screen pb-40'>
			<Scoreboard state={state} />
			{showIntro && (
				<CommissionerIntro
					state={state}
					onDone={() => {
						introsShown.add(introKey);
						setShowIntro(false);
					}}
				/>
			)}
			{revealKey && <PickReveal key={revealKey} state={state} onDone={() => setRevealKey(null)} />}
			{violation && <ViolationToast text={violation} />}

			<div className='max-w-3xl mx-auto px-4'>
				{/* budgets */}
				<div className='grid grid-cols-2 gap-2 mt-3'>
					{([0, 1] as Side[]).map(side => (
						<div key={side} className='rounded-xl px-3 py-2 border' style={{ borderColor: `${SIDE_COLORS[side]}55`, background: `${SIDE_COLORS[side]}12` }}>
							<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
								{names[side]}
							</div>
							<div className='flex items-baseline gap-2'>
								<div className='text-2xl font-black text-green-400 tabular-nums'>${a.budgets[side]}</div>
								<div className='text-[10px] text-white/45 font-bold'>
									{slotsLeft(state, side)} slots · max ${slotsLeft(state, side) > 0 ? maxBid(state, side) : 0}
								</div>
							</div>
						</div>
					))}
				</div>

				{/* on the clock */}
				<div className='mt-3 rounded-2xl px-4 py-3 flex items-center gap-3 vs-clock' key={clockKey} style={{ background: `linear-gradient(135deg, ${SIDE_COLORS[actor]}33, ${SIDE_COLORS[actor]}0d)`, border: `1px solid ${SIDE_COLORS[actor]}66` }}>
					<div className='flex-1 text-center min-w-0'>
						<div className='text-[10px] font-black uppercase tracking-[0.3em] text-white/50'>{lot ? 'Bidding' : 'Nominating'}</div>
						<div className='text-3xl font-black leading-tight truncate' style={{ color: SIDE_COLORS[actor] }}>
							{names[actor]}
						</div>
						<div className='text-xs text-white/60'>{lot ? `Raise or pass — if you pass, ${names[lot.high]} wins him.` : 'Put a player up for auction. You open the bidding.'}</div>
					</div>
					{shotClock > 0 && <ShotClockRing left={left} total={shotClock} color={SIDE_COLORS[actor]} />}
				</div>

				{/* live lot */}
				{lot && lotP && (
					<div className='mt-5 flex flex-col items-center'>
						<div className='vs-deal'>
							<VersusCard player={lotP} width={170} />
						</div>
						<div className='mt-4 text-center'>
							<div className='text-[10px] font-black uppercase tracking-widest text-white/45'>Current bid</div>
							<div key={lot.bid} className='text-6xl font-black text-green-400 tabular-nums vs-pop'>${lot.bid}</div>
							<div className='text-sm font-black' style={{ color: SIDE_COLORS[lot.high] }}>
								{names[lot.high]} is high
							</div>
							<div className='text-[11px] text-white/40 mt-1'>Est. value ${lotValue}</div>
						</div>
					</div>
				)}

				{/* nomination board */}
				{!lot && (
					<div className='mt-4'>
						<input
							value={query}
							onChange={e => setQuery(e.target.value)}
							placeholder='Search players…'
							className='w-full rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/30'
						/>
						<div className='flex gap-1.5 overflow-x-auto mt-2 pb-1 [scrollbar-width:none]'>
							{POSITIONS.map(x => (
								<button key={x} onClick={() => setPos(x)} className={`shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full border ${pos === x ? 'bg-white text-black border-white' : 'bg-white/5 text-white/60 border-white/10'}`}>
									{x === 'NEED' ? `My needs${needs.length ? ` (${needs.join('/')})` : ''}` : x}
								</button>
							))}
						</div>
						<div className='space-y-1 mt-2'>
							{board.slice(0, limit).map(p => (
								<BoardRow
									key={p.id}
									p={p}
									value={values.get(p.id) ?? 1}
									need={fitsNeed(p, needs)}
									selected={chosen === p.id}
									onClick={() => {
										play('tick');
										setChosen(chosen === p.id ? null : p.id);
										setOpening(1);
									}}
								/>
							))}
							{board.length > limit && (
								<button onClick={() => setLimit(l => l + 40)} className='w-full py-2 text-xs font-bold text-white/50'>
									Show more ({board.length - limit})
								</button>
							)}
							{!board.length && <div className='text-center text-sm text-white/40 py-6'>No players match.</div>}
						</div>
					</div>
				)}

				<div className='grid grid-cols-2 gap-2 mt-8'>
					<RosterColumn state={state} side={0} active={actor === 0} />
					<RosterColumn state={state} side={1} active={actor === 1} />
				</div>
			</div>

			{/* action bar */}
			<div className='fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
				<div className='max-w-3xl mx-auto'>
					{lot ? (
						<div className='space-y-2'>
							<div className='grid grid-cols-4 gap-2'>
								{[1, 5, 10].map(inc => (
									<button key={inc} disabled={lot.bid + inc > myMax} onClick={() => bid(lot.bid + inc)} className='rounded-xl py-3 font-black text-white bg-white/10 border border-white/10 disabled:opacity-25 active:scale-95'>
										+${inc}
									</button>
								))}
								<button
									disabled={lotValue <= lot.bid || lotValue > myMax}
									onClick={() => bid(lotValue)}
									className='rounded-xl py-3 font-black text-green-300 bg-green-500/15 border border-green-500/30 disabled:opacity-25 active:scale-95 text-sm'
								>
									${lotValue}
								</button>
							</div>
							<button onClick={() => setState(passBid(state))} className='w-full rounded-2xl py-3.5 font-black uppercase tracking-wider text-white bg-white/10 border border-white/15'>
								Pass — {names[lot.high]} wins at ${lot.bid}
							</button>
						</div>
					) : (
						<div className='flex gap-2 items-stretch'>
							<div className='flex items-center rounded-2xl bg-white/10 border border-white/10 shrink-0'>
								<button onClick={() => setOpening(o => Math.max(1, o - 1))} className='px-3 py-3 font-black text-white text-lg'>
									−
								</button>
								<div className='w-12 text-center font-black text-green-400 tabular-nums'>${opening}</div>
								<button onClick={() => setOpening(o => Math.min(myMax, o + 1))} className='px-3 py-3 font-black text-white text-lg'>
									+
								</button>
							</div>
							<button
								disabled={!chosenP}
								onClick={() => {
									play('gavel');
									setState(nominate(state, chosen!, opening));
								}}
								className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35 truncate px-3'
								style={{ background: chosenP ? `linear-gradient(135deg, ${SIDE_COLORS[actor]}, ${SIDE_COLORS[actor]}bb)` : 'rgba(255,255,255,0.08)' }}
							>
								{chosenP ? `Nominate ${chosenP.lastName}` : 'Pick a player'}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
