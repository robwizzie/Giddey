'use client';

import { useEffect, useRef, useState } from 'react';
import {
	actingSide,
	BAND_INFO,
	bandFor,
	cutOffer,
	cutOfferProblem,
	DraftState,
	fitsNeed,
	franchiseOptions,
	isSharedRound,
	landFranchise,
	missingPositions,
	other,
	pick,
	players,
	poolFor,
	reroll,
	roundsTotal,
	secretPick,
	Side,
	VersusState,
} from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { TEAMS_MAP } from '@/lib/teams';
import { play } from '@/lib/versus/sound';
import VersusCard, { RosterRow } from './VersusCard';
import Wheel from './Wheel';
import Scoreboard from './Scoreboard';
import { SIDE_COLORS } from './Fx';
import { BlindReveal, ChemBars, CommissionerIntro, Handoff, PickReveal, RewardBanner, ShotClockRing, useShotClock, ViolationToast } from './DraftFx';

function useCardWidth(count: number) {
	const [w, setW] = useState(130);
	useEffect(() => {
		const f = () => {
			const vw = window.innerWidth;
			if (vw >= 640) return setW(140);
			// 4 cards: 2x2 grid of big cards; otherwise fit 3 across
			const perRow = count === 4 || count === 2 ? 2 : 3;
			setW(Math.min(perRow === 2 ? 150 : 118, Math.floor((vw - 32 - 12 * (perRow - 1)) / perRow)));
		};
		f();
		window.addEventListener('resize', f);
		return () => window.removeEventListener('resize', f);
	}, [count]);
	return w;
}

const introsShown = new Set<string>();

export function RosterColumn({ state, side, active }: { state: VersusState; side: Side; active: boolean }) {
	const ids = state.teams[side];
	const ps = players(ids);
	const need = missingPositions(ids);
	const total = state.draft?.targets[side] ?? state.settings.rosterSize;
	const keeper = state.draft?.keepers[side];
	const budget = state.draft?.auction?.budgets[side];
	return (
		<div className={`rounded-2xl p-2.5 border transition-all ${active ? 'bg-white/[0.06]' : 'bg-white/[0.02] border-white/5'}`} style={active ? { borderColor: `${SIDE_COLORS[side]}88`, boxShadow: `0 0 24px ${SIDE_COLORS[side]}22` } : undefined}>
			<div className='flex items-center justify-between mb-2 px-0.5 gap-1'>
				<div className='text-xs font-black uppercase tracking-wider truncate' style={{ color: SIDE_COLORS[side] }}>
					{state.settings.names[side]}
				</div>
				<div className='text-[10px] font-bold text-white/40 shrink-0'>
					{budget !== undefined && <span className='text-green-400 mr-1.5'>${budget}</span>}
					{ids.length}/{total}
				</div>
			</div>
			<div className='space-y-1'>
				{ps.map((p, i) => {
					const price = state.draft?.log.find(e => e.id === p.id)?.price;
					return (
						<RosterRow
							key={p.id}
							player={p}
							highlight={state.draft?.lastPick?.id === p.id && i === ps.length - 1}
							tag={keeper === p.id ? 'Keeper' : price !== undefined ? `$${price}` : undefined}
							tagColor={keeper === p.id ? '#7c3aed' : '#15803d'}
						/>
					);
				})}
				{Array.from({ length: Math.max(0, total - ps.length) }, (_, i) => (
					<div key={i} className='h-11 rounded-lg border border-dashed border-white/10' />
				))}
			</div>
			{need.length > 0 && ids.length > 0 && (
				<div className='flex flex-wrap gap-1 mt-2'>
					<span className='text-[9px] text-white/40 font-bold uppercase self-center'>Needs</span>
					{need.map(pos => (
						<span key={pos} className='text-[9px] font-black text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5'>
							{pos}
						</span>
					))}
				</div>
			)}
			{ids.length >= 2 && (
				<div className='mt-2 pt-2 border-t border-white/5'>
					<ChemBars ids={ids} rosterSize={total} color={SIDE_COLORS[side]} compact />
				</div>
			)}
		</div>
	);
}

/** Round track — one bar per coach when their tiers differ (handicap / keepers) */
function RoundTrack({ d }: { d: DraftState }) {
	const same = d.blueprints[0].join() === d.blueprints[1].join();
	const rows: Side[] = same ? [0] : [0, 1];
	const total = roundsTotal(d);
	return (
		<div className='mt-3 space-y-1'>
			{rows.map(side => (
				<div key={side} className='flex gap-1 items-center'>
					{!same && <div className='w-1.5 h-1.5 rounded-full shrink-0' style={{ background: SIDE_COLORS[side] }} />}
					{Array.from({ length: total }, (_, i) => {
						const b = d.blueprints[side][i];
						return (
							<div
								key={i}
								className='flex-1 h-1.5 rounded-full transition-all'
								style={{
									background: b ? BAND_INFO[b].color : 'rgba(255,255,255,0.04)',
									opacity: !b ? 1 : i < d.round ? 0.35 : i === d.round ? 1 : 0.55,
									boxShadow: b && i === d.round ? `0 0 10px ${BAND_INFO[b].color}` : undefined,
									outline: i === d.blindRound ? '1px dashed rgba(255,255,255,0.6)' : undefined,
									outlineOffset: 1,
								}}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}

export default function DraftScreen({ state, setState }: { state: VersusState; setState: (s: VersusState) => void }) {
	const d = state.draft!;
	const { names, style, blind, shotClock } = state.settings;
	const actor = actingSide(d);
	const band = bandFor(d, actor) ?? 'deep';
	const shared = isSharedRound(state);
	const actorNeeds = missingPositions(state.teams[actor]);
	const [selected, setSelected] = useState<string[]>([]);
	const [revealKey, setRevealKey] = useState<string | null>(null);
	const [blindShow, setBlindShow] = useState<{ picks: [string, string] | null; collision: string | null } | null>(null);
	const [landedTeam, setLandedTeam] = useState<string | null>(null);
	const [violation, setViolation] = useState<string | null>(null);
	const introKey = `${state.gameNo}`;
	const [showIntro, setShowIntro] = useState(() => d.log.length === 0 && !introsShown.has(introKey));
	const [handoffDone, setHandoffDone] = useState<string | null>(null);

	// new picks → reveal (single pick) or blind reveal (both secret picks)
	const seen = useRef({ log: d.log.length, collisions: d.collisions, round: d.round });
	useEffect(() => {
		const prev = seen.current;
		if (d.log.length > prev.log) {
			const added = d.log.slice(prev.log);
			if (added.length === 2 && added.every(e => e.blind)) setBlindShow({ picks: [added[0].id, added[1].id], collision: null });
			else setRevealKey(`${d.log.length}-${d.lastPick?.id}`);
		} else if (d.collisions > prev.collisions && d.round === prev.round && d.lastCollision) {
			setBlindShow({ picks: null, collision: d.lastCollision });
		}
		seen.current = { log: d.log.length, collisions: d.collisions, round: d.round };
	}, [d.log, d.collisions, d.round, d.lastCollision, d.lastPick]);

	useEffect(() => {
		setSelected([]);
		setLandedTeam(null);
	}, [d.round, d.turn, d.stage, d.collisions]);

	// new pack dealt
	const packKey = d.pack.join('|');
	useEffect(() => {
		if (d.pack.length && d.stage !== 'spin') play('flip');
	}, [packKey, d.stage, d.pack.length]);

	const isCutStage = d.stage === 'cut';
	const isSecret = d.stage === 'secret';
	const visible = d.offered.length ? d.offered : d.pack;
	const needCount = isCutStage ? 2 : 1;
	const cardW = useCardWidth(visible.length);

	// secret round: whoever is up must take the phone first
	const handoffKey = isSecret ? `${d.round}-${d.turn}-${d.collisions}` : null;
	const needHandoff = isSecret && handoffDone !== handoffKey;

	const overlay = showIntro || !!revealKey || !!blindShow || needHandoff;
	const clockKey = `${d.round}-${d.turn}-${d.stage}-${d.log.length}-${d.collisions}`;

	const autoAct = () => {
		const fits = visible.filter(id => fitsNeed(getVersusPlayer(id)!, actorNeeds));
		const best = (fits.length ? fits : visible)[0];
		setViolation(isCutStage ? 'Shot clock violation — auto-split' : 'Shot clock violation — auto-pick');
		setTimeout(() => setViolation(null), 2200);
		if (isCutStage) {
			let pair = d.pack.slice(0, 2);
			outer: for (let i = 0; i < d.pack.length; i++)
				for (let j = i + 1; j < d.pack.length; j++)
					if (!cutOfferProblem(state, [d.pack[i], d.pack[j]])) {
						pair = [d.pack[i], d.pack[j]];
						break outer;
					}
			setState(cutOffer(state, pair));
		} else if (isSecret) setState(secretPick(state, best));
		else if (best) setState(pick(state, best));
	};
	const clockOn = shotClock > 0 && d.stage !== 'spin';
	const left = useShotClock(clockKey, clockOn ? shotClock : 0, overlay, autoAct);

	const toggle = (id: string) => {
		play('tick');
		if (needCount === 1) setSelected(s => (s[0] === id ? [] : [id]));
		else setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]));
	};

	const cutProblem = isCutStage ? cutOfferProblem(state, selected) : null;
	const confirm = () => {
		if (selected.length !== needCount || cutProblem) return;
		if (isCutStage) setState(cutOffer(state, selected));
		else if (isSecret) setState(secretPick(state, selected[0]));
		else setState(pick(state, selected[0]));
		setSelected([]);
	};

	const pickNo = d.log.length + 1;
	const opp = other(actor);
	let instruction = '';
	if (d.stage === 'spin') instruction = 'Spin for this round’s franchise';
	else if (isSecret) instruction = `Blind bid: pick in secret. If ${names[opp]} takes the same player, nobody gets him.`;
	else if (isCutStage) instruction = `Split the pack: choose 2 cards to put on the table. ${names[opp]} takes one — you get the other.`;
	else if (d.offered.length) instruction = `${names[opp]} offered these two. Take one — the other goes to them.`;
	else if (d.solo) instruction = `${names[opp]}'s draft is done — ${names[actor]} picks alone this round.`;
	else if (!shared) instruction = `Your own pack this round. ${names[opp]} gets a separate pack next.`;
	else if (d.turn === 0) instruction = `${visible.length} cards in the pack. Take your guy — ${names[opp]} picks from what's left.`;
	else instruction = 'Your pick from what’s left.';

	const franchiseItems =
		d.stage === 'spin' ? franchiseOptions(state).map(t => ({ id: t, label: t, color: TEAMS_MAP[t].primaryColor === '#000000' ? '#374151' : TEAMS_MAP[t].primaryColor })) : [];

	const selectedPlayer = selected.length === 1 ? getVersusPlayer(selected[0]) : null;
	const poolTag = state.settings.pool === 'erawars' ? (poolFor(state.settings, actor) === 'modern' ? 'Modern' : 'All-Time') : null;
	const roundLabel = `Round ${d.round + 1}/${roundsTotal(d)} · Pick ${pickNo}`;

	return (
		<div className='min-h-screen pb-32'>
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
			{blindShow && <BlindReveal state={state} picks={blindShow.picks} collision={blindShow.collision} onDone={() => setBlindShow(null)} />}
			{!showIntro && !revealKey && !blindShow && needHandoff && (
				<Handoff
					to={actor}
					name={names[actor]}
					note={d.turn === 0 ? (d.collisions ? 'Collision — new pack. Pick again in secret.' : `🙈 Blind bid round! ${names[opp]}, look away.`) : `Pick in secret — ${names[opp]} already locked theirs in. Don't take the same guy.`}
					onReady={() => setHandoffDone(handoffKey)}
				/>
			)}
			{violation && <ViolationToast text={violation} />}

			<div className='max-w-3xl mx-auto px-4'>
				<RoundTrack d={d} />
				<RewardBanner state={state} />
				<div className='flex items-center justify-between mt-2 gap-2'>
					<div className='text-[11px] font-black uppercase tracking-widest text-white/40 truncate'>{roundLabel}</div>
					<div className='text-[11px] font-black uppercase tracking-widest truncate' style={{ color: BAND_INFO[band].color }}>
						{isSecret ? '🙈 Blind bid · ' : ''}
						{BAND_INFO[band].label}
						{poolTag ? ` · ${poolTag}` : ''}
						{d.franchise ? ` · ${TEAMS_MAP[d.franchise].name}` : ''}
					</div>
				</div>

				{/* On the clock */}
				<div
					key={`${d.round}-${d.turn}-${d.stage}`}
					className='mt-4 rounded-2xl px-4 py-3 vs-clock flex items-center gap-3'
					style={{ background: `linear-gradient(135deg, ${SIDE_COLORS[actor]}33, ${SIDE_COLORS[actor]}0d)`, border: `1px solid ${SIDE_COLORS[actor]}66` }}
				>
					<div className='flex-1 text-center min-w-0'>
						<div className='text-[10px] font-black uppercase tracking-[0.3em] text-white/50'>{isCutStage ? 'Cutting the pack' : d.stage === 'spin' ? 'Spinning' : isSecret ? 'Secret pick' : 'On the clock'}</div>
						<div className='text-3xl font-black leading-tight truncate' style={{ color: SIDE_COLORS[actor] }}>
							{names[actor]}
						</div>
						<div className='text-xs text-white/60 mt-0.5 max-w-md mx-auto'>{instruction}</div>
					</div>
					{clockOn && <ShotClockRing left={left} total={shotClock} color={SIDE_COLORS[actor]} />}
				</div>

				{/* Franchise wheel */}
				{d.stage === 'spin' && (
					<div className='mt-6 flex flex-col items-center'>
						<Wheel
							key={`fw-${d.round}`}
							items={franchiseItems}
							size={Math.min(320, cardW * 2.6)}
							accent={SIDE_COLORS[actor]}
							onResult={i => {
								const team = franchiseItems[i].id;
								setLandedTeam(team);
								setTimeout(() => setState(landFranchise(state, team)), 1100);
							}}
						/>
						{landedTeam && (
							<div className='mt-4 text-2xl font-black text-white vs-rise text-center'>
								{state.settings.pool === 'alltime' ? 'All-Time ' : ''}
								{TEAMS_MAP[landedTeam].city} {TEAMS_MAP[landedTeam].name}!
							</div>
						)}
					</div>
				)}

				{/* Pack */}
				{d.stage !== 'spin' && !needHandoff && (
					<div className='mt-6 flex flex-wrap justify-center gap-x-3 gap-y-5'>
						{visible.map((id, i) => {
							const p = getVersusPlayer(id)!;
							const isSel = selected.includes(id);
							// cut stage: the cutter is building an offer for the other coach
							const forSide = isCutStage ? opp : actor;
							const need = fitsNeed(p, isCutStage ? missingPositions(state.teams[forSide]) : actorNeeds);
							return (
								<div key={id} className='vs-deal relative' style={{ animationDelay: `${i * 90}ms` }}>
									<VersusCard player={p} width={cardW} selected={isSel} faceDown={blind} onClick={() => toggle(id)} />
									{need && (
										<div className='absolute -top-2.5 left-0 right-0 flex justify-center z-30 pointer-events-none'>
											<span className='text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#052e16] text-green-400 border border-green-500/60 shadow-[0_2px_8px_rgba(0,0,0,0.6)] whitespace-nowrap'>
												{isCutStage ? `${names[forSide]} needs ${need}` : `Fills ${need}`}
											</span>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}

				{/* Rosters */}
				<div className='grid grid-cols-2 gap-2 mt-8'>
					<RosterColumn state={state} side={0} active={actor === 0} />
					<RosterColumn state={state} side={1} active={actor === 1} />
				</div>
			</div>

			{/* Action bar */}
			{d.stage !== 'spin' && !needHandoff && (
				<div className='fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
					{cutProblem && <div className='max-w-3xl mx-auto mb-2 text-center text-xs font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2'>{cutProblem}</div>}
					<div className='max-w-3xl mx-auto flex gap-2'>
						<button
							onClick={() => setState(reroll(state))}
							disabled={d.rerolls[actor] <= 0 || (!!d.offered.length && !isCutStage) || isSecret}
							className='shrink-0 rounded-2xl px-4 py-3.5 font-black text-sm bg-white/10 text-white disabled:opacity-30 border border-white/10 active:scale-95 transition-transform'
							title='Replace the pack with new cards from the same tier'
						>
							🎲 {d.rerolls[actor]}
						</button>
						<button
							onClick={confirm}
							disabled={selected.length !== needCount || !!cutProblem}
							className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35 active:scale-[0.98] transition-all truncate px-3'
							style={{
								background: selected.length === needCount ? `linear-gradient(135deg, ${SIDE_COLORS[actor]}, ${SIDE_COLORS[actor]}bb)` : 'rgba(255,255,255,0.08)',
								boxShadow: selected.length === needCount ? `0 6px 24px ${SIDE_COLORS[actor]}55` : undefined,
							}}
						>
							{isCutStage
								? selected.length === 2
									? `Offer these 2 to ${names[opp]}`
									: `Pick ${2 - selected.length} more`
								: selectedPlayer
									? isSecret
										? `Lock in ${blind ? 'mystery ' + selectedPlayer.position : selectedPlayer.lastName} 🔒`
										: blind
											? `Draft mystery ${selectedPlayer.position}`
											: `Draft ${selectedPlayer.lastName}`
									: 'Tap a card'}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
