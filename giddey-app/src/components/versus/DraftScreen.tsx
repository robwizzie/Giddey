'use client';

import { useEffect, useRef, useState } from 'react';
import {
	actingSide,
	BAND_INFO,
	currentBand,
	cutOffer,
	cutOfferProblem,
	franchiseOptions,
	landFranchise,
	fitsNeed,
	missingPositions,
	other,
	pick,
	players,
	reroll,
	Side,
	VersusState,
} from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { TEAMS_MAP } from '@/lib/teams';
import VersusCard, { RosterRow } from './VersusCard';
import Wheel from './Wheel';
import Scoreboard from './Scoreboard';
import { Confetti, SIDE_COLORS } from './Fx';

function ordinal(n: number) {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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

/** "With the 3rd pick, Rob selects…" overlay */
function PickReveal({ state, onDone }: { state: VersusState; onDone: () => void }) {
	const lp = state.draft!.lastPick!;
	const p = getVersusPlayer(lp.id)!;
	const pickNo = state.draft!.log.length;
	const big = p.overall >= 93;
	useEffect(() => {
		const t = setTimeout(onDone, big ? 2600 : 1900);
		return () => clearTimeout(t);
	}, [onDone, big]);
	return (
		<div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm' onClick={onDone}>
			{big && <Confetti count={60} />}
			<div className='text-[11px] font-black uppercase tracking-[0.35em] text-white/50 mb-1 vs-rise' style={{ animationDelay: '0ms' }}>
				With the {ordinal(pickNo)} pick
			</div>
			<div className='text-3xl font-black mb-5 vs-rise' style={{ color: SIDE_COLORS[lp.side], animationDelay: '120ms' }}>
				{state.settings.names[lp.side]} selects
			</div>
			<div className='vs-pick-flip'>
				<VersusCard player={p} width={190} />
			</div>
			<div className='mt-5 text-center vs-rise' style={{ animationDelay: '700ms' }}>
				<div className='text-2xl font-black text-white'>
					{p.firstName} {p.lastName}
				</div>
				<div className='text-sm text-white/50'>
					{p.overall} OVR · {p.position}/{p.secondaryPosition}
				</div>
			</div>
		</div>
	);
}

function RosterColumn({ state, side, active }: { state: VersusState; side: Side; active: boolean }) {
	const ids = state.teams[side];
	const ps = players(ids);
	const need = missingPositions(ids);
	const total = state.draft?.blueprint.length ?? state.settings.rosterSize;
	return (
		<div className={`rounded-2xl p-2.5 border transition-all ${active ? 'bg-white/[0.06]' : 'bg-white/[0.02] border-white/5'}`} style={active ? { borderColor: `${SIDE_COLORS[side]}88`, boxShadow: `0 0 24px ${SIDE_COLORS[side]}22` } : undefined}>
			<div className='flex items-center justify-between mb-2 px-0.5'>
				<div className='text-xs font-black uppercase tracking-wider truncate' style={{ color: SIDE_COLORS[side] }}>
					{state.settings.names[side]}
				</div>
				<div className='text-[10px] font-bold text-white/40'>
					{ids.length}/{total}
				</div>
			</div>
			<div className='space-y-1'>
				{ps.map((p, i) => (
					<RosterRow key={p.id} player={p} highlight={state.draft?.lastPick?.id === p.id && i === ps.length - 1} />
				))}
				{Array.from({ length: total - ps.length }, (_, i) => (
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
		</div>
	);
}

export default function DraftScreen({ state, setState }: { state: VersusState; setState: (s: VersusState) => void }) {
	const d = state.draft!;
	const { names, style, blind } = state.settings;
	const actor = actingSide(d);
	const band = currentBand(state);
	const blueprint = d.blueprint;
	const rosterSize = blueprint.length;
	const actorNeeds = missingPositions(state.teams[actor]);
	const [selected, setSelected] = useState<string[]>([]);
	const [revealKey, setRevealKey] = useState<string | null>(null);
	const seenPick = useRef<string | null>(d.lastPick ? `${d.lastPick.id}-${d.log.length}` : null);
	const [landedTeam, setLandedTeam] = useState<string | null>(null);

	// show the reveal whenever a new pick lands
	const pickKey = d.lastPick ? `${d.lastPick.id}-${d.log.length}` : null;
	useEffect(() => {
		if (pickKey && pickKey !== seenPick.current) {
			seenPick.current = pickKey;
			setRevealKey(pickKey);
		}
	}, [pickKey]);

	useEffect(() => {
		setSelected([]);
		setLandedTeam(null);
	}, [d.round, d.turn, d.stage]);

	const isCutStage = d.stage === 'cut';
	const visible = d.stage === 'pick' && style === 'cut' ? d.offered : d.pack;
	const needCount = isCutStage ? 2 : 1;
	const cardW = useCardWidth(visible.length);

	const toggle = (id: string) => {
		if (needCount === 1) setSelected(s => (s[0] === id ? [] : [id]));
		else setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]));
	};

	const cutProblem = isCutStage ? cutOfferProblem(state, selected) : null;
	const confirm = () => {
		if (selected.length !== needCount || cutProblem) return;
		if (isCutStage) setState(cutOffer(state, selected));
		else setState(pick(state, selected[0]));
		setSelected([]);
	};

	const pickNo = d.log.length + 1;
	let instruction = '';
	if (d.stage === 'spin') instruction = 'Spin for this round’s franchise';
	else if (isCutStage) instruction = `Split the pack: choose 2 cards to put on the table. ${names[other(actor)]} takes one — you get the other.`;
	else if (style === 'cut') instruction = `${names[other(actor)]} offered these two. Take one — the other goes to them.`;
	else if (d.turn === 0) instruction = `${visible.length} cards in the pack. Take your guy — ${names[other(actor)]} picks from what's left.`;
	else instruction = 'Your pick from what’s left.';

	const franchiseItems = d.stage === 'spin'
		? franchiseOptions(state).map(t => ({ id: t, label: t, color: TEAMS_MAP[t].primaryColor === '#000000' ? '#374151' : TEAMS_MAP[t].primaryColor }))
		: [];

	const selectedPlayer = selected.length === 1 ? getVersusPlayer(selected[0]) : null;

	return (
		<div className='min-h-screen pb-32'>
			<Scoreboard state={state} />

			{revealKey && <PickReveal key={revealKey} state={state} onDone={() => setRevealKey(null)} />}

			<div className='max-w-3xl mx-auto px-4'>
				{/* Round track */}
				<div className='flex gap-1 mt-3'>
					{blueprint.map((b, i) => (
						<div key={i} className='flex-1 h-1.5 rounded-full transition-all' style={{ background: i < d.round ? BAND_INFO[b].color : i === d.round ? BAND_INFO[b].color : 'rgba(255,255,255,0.08)', opacity: i < d.round ? 0.4 : 1, boxShadow: i === d.round ? `0 0 10px ${BAND_INFO[b].color}` : undefined }} />
					))}
				</div>
				<div className='flex items-center justify-between mt-2'>
					<div className='text-[11px] font-black uppercase tracking-widest text-white/40'>
						Round {d.round + 1}/{rosterSize} · Pick {pickNo}
					</div>
					<div className='text-[11px] font-black uppercase tracking-widest' style={{ color: BAND_INFO[band].color }}>
						{BAND_INFO[band].label} tier{d.franchise ? ` · ${TEAMS_MAP[d.franchise].name}` : ''}
					</div>
				</div>

				{/* On the clock */}
				<div key={`${d.round}-${d.turn}-${d.stage}`} className='mt-4 rounded-2xl px-4 py-3 text-center vs-clock' style={{ background: `linear-gradient(135deg, ${SIDE_COLORS[actor]}33, ${SIDE_COLORS[actor]}0d)`, border: `1px solid ${SIDE_COLORS[actor]}66` }}>
					<div className='text-[10px] font-black uppercase tracking-[0.3em] text-white/50'>{isCutStage ? 'Cutting the pack' : d.stage === 'spin' ? 'Spinning' : 'On the clock'}</div>
					<div className='text-3xl font-black leading-tight' style={{ color: SIDE_COLORS[actor] }}>
						{names[actor]}
					</div>
					<div className='text-xs text-white/60 mt-0.5 max-w-md mx-auto'>{instruction}</div>
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
							<div className='mt-4 text-2xl font-black text-white vs-rise'>
								{state.settings.pool === 'alltime' ? 'All-Time ' : ''}
								{TEAMS_MAP[landedTeam].city} {TEAMS_MAP[landedTeam].name}!
							</div>
						)}
					</div>
				)}

				{/* Pack */}
				{d.stage !== 'spin' && (
					<div className='mt-6 flex flex-wrap justify-center gap-x-3 gap-y-5'>
						{visible.map((id, i) => {
							const p = getVersusPlayer(id)!;
							const isSel = selected.includes(id);
							return (
								<div key={id} className='vs-deal relative' style={{ animationDelay: `${i * 90}ms` }}>
									<VersusCard player={p} width={cardW} selected={isSel} faceDown={blind} onClick={() => toggle(id)} />
									{(() => {
										// cut stage: the cutter is building an offer for the other coach
										const forSide = isCutStage ? other(actor) : actor;
										const need = fitsNeed(p, isCutStage ? missingPositions(state.teams[forSide]) : actorNeeds);
										return need ? (
											<div className='absolute -top-2.5 left-0 right-0 flex justify-center z-30 pointer-events-none'>
												<span className='text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#052e16] text-green-400 border border-green-500/60 shadow-[0_2px_8px_rgba(0,0,0,0.6)] whitespace-nowrap'>
													{isCutStage ? `${names[forSide]} needs ${need}` : `Fills ${need}`}
												</span>
											</div>
										) : null;
									})()}
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
			{d.stage !== 'spin' && (
				<div className='fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
					{cutProblem && <div className='max-w-3xl mx-auto mb-2 text-center text-xs font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2'>{cutProblem}</div>}
					<div className='max-w-3xl mx-auto flex gap-2'>
						<button
							onClick={() => setState(reroll(state))}
							disabled={d.rerolls[actor] <= 0 || (style === 'cut' && !isCutStage)}
							className='shrink-0 rounded-2xl px-4 py-3.5 font-black text-sm bg-white/10 text-white disabled:opacity-30 border border-white/10 active:scale-95 transition-transform'
							title='Replace the pack with new cards from the same tier'
						>
							🎲 {d.rerolls[actor]}
						</button>
						<button
							onClick={confirm}
							disabled={selected.length !== needCount || !!cutProblem}
							className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35 active:scale-[0.98] transition-all truncate px-3'
							style={{ background: selected.length === needCount ? `linear-gradient(135deg, ${SIDE_COLORS[actor]}, ${SIDE_COLORS[actor]}bb)` : 'rgba(255,255,255,0.08)', boxShadow: selected.length === needCount ? `0 6px 24px ${SIDE_COLORS[actor]}55` : undefined }}
						>
							{isCutStage
								? selected.length === 2
									? `Offer these 2 to ${names[other(actor)]}`
									: `Pick ${2 - selected.length} more`
								: selectedPlayer
									? blind
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
