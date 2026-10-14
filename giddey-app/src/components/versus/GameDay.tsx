'use client';

import { useEffect, useMemo, useState } from 'react';
import { bestLineup, deadlineOpen, normalizeSettings, other, players, Prediction, tradeDeadline, recordGame, RETIRE_DRAFTS, seriesScore, setSabotage, Settings, Side, teamIcon, teamName, teamOvr, VersusState } from '@/lib/versus/engine';
import { TierBuilder } from './SetupScreen';
import { useCanAct, WaitingBar } from './Live';
import { canSeePrivate, hostLock, isScreen, liveInfo, mySide } from '@/lib/versus/live';
import Icon, { IconTile } from './Icon';
import { getTeamFor, getVersusPlayer, VersusPlayer } from '@/lib/versus/pool';
import { hotHand } from '@/lib/versus/usage';
import { buzz } from '@/lib/versus/sound';
import { getPlayerHeadshotUrls } from '@/lib/images';
import Headshot from '@/components/Headshot';
import {
	BOOSTS,
	BoostId,
	challengeSegments,
	Difficulty,
	DIFFICULTY_INFO,
	getBoost,
	REWARDS_BY_DIFFICULTY,
	getChallenge,
	getSabotage,
	getTwist,
	activeSabotages,
	rollReward,
	activeTwists,
	activeHalftime,
	getHalftime,
	halftimeText,
} from '@/lib/versus/wheels';
import { history } from '@/lib/versus/history';
import { rosterChallengeSegments } from '@/lib/versus/rosterChallenges';
import { coveredBy, vegasLine } from '@/lib/versus/vegas';
import { nextSeasonTag, seasonLabel } from '@/lib/versus/seasons';
import { BeltMoment, CoverCard, EloCard, LeagueResultCard, NewBadges, PredictionReveal, SeasonCard } from './PostGameExtras';
import { PunishmentSpin, StakesPicker, StakesStrip } from './Stakes';
import BroadcastIntro from './BroadcastIntro';
import { CoachBadges } from './Badges';
import { announce } from '@/lib/versus/announcer';
import { renderRecap } from '@/lib/versus/recapCard';
import { shareImage } from '@/lib/versus/shareCard';
import Wheel from './Wheel';
import SlotMachine from './SlotMachine';
import { Confetti, Pill, SectionTitle, SIDE_COLORS } from './Fx';

type SetState = (s: VersusState) => void;

function StepDots({ step }: { step: number }) {
	const labels = ['Rules', 'Challenges', 'Tip-off'];
	return (
		<div className='flex items-center justify-center gap-2 mb-6'>
			{labels.map((l, i) => (
				<div key={l} className='flex items-center gap-2'>
					<div className={`flex items-center gap-1.5 ${i === step ? 'text-white' : i < step ? 'text-green-400' : 'text-white/30'}`}>
						<div className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${i === step ? 'bg-orange-500' : i < step ? 'bg-green-500/25' : 'bg-white/10'}`}>{i < step ? <Icon name='check' size={12} strokeWidth={3} /> : i + 1}</div>
						<span className='text-[11px] font-bold uppercase tracking-wider hidden sm:inline'>{l}</span>
					</div>
					{i < labels.length - 1 && <div className='w-4 h-px bg-white/15' />}
				</div>
			))}
		</div>
	);
}

function useWheelSize() {
	const [s] = useState(() => (typeof window === 'undefined' ? 300 : Math.min(340, window.innerWidth - 48)));
	return s;
}

function ChallengeCard({ state, side }: { state: VersusState; side: Side }) {
	const c = getChallenge(state.gameday.challenges[side]);
	const reward = state.gameday.rewards[side];
	if (!c || !reward) return null;
	const r = BOOSTS[reward];
	if (!r) return null;
	return (
		<div className='rounded-2xl p-4 border vs-rise' style={{ borderColor: `${SIDE_COLORS[side]}66`, background: `linear-gradient(160deg, ${SIDE_COLORS[side]}1f, transparent 70%)` }}>
			<div className='flex items-center justify-between mb-1'>
				<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
					{state.settings.names[side]}&apos;s challenge
				</div>
				<Pill color={DIFFICULTY_INFO[c.difficulty].color}>{DIFFICULTY_INFO[c.difficulty].label}</Pill>
			</div>
			<div className='text-xl font-black text-white'>{c.title}</div>
			<div className='text-sm text-white/65 leading-snug'>{c.desc}</div>
			<div className='mt-3 flex items-start gap-2 rounded-xl bg-black/30 p-2.5'>
				<IconTile name={r.icon} color='#fbbf24' size={32} className='rounded-lg' />
				<div>
					<div className='text-xs font-black text-amber-300 uppercase tracking-wider'>Reward: {r.label}</div>
					<div className='text-[11px] text-white/65 leading-snug'>{r.desc}</div>
					<div className='text-[10px] text-white/35 leading-snug mt-0.5'>Run it back instead: {r.runBack.toLowerCase()}.</div>
				</div>
			</div>
		</div>
	);
}

/** One coach's Player of the Game vote — anyone from either roster */
function PotgVote({ state, setState, side }: { state: VersusState; setState: SetState; side: Side }) {
	const { names } = state.settings;
	const canVote = useCanAct(side, names);
	const votes = state.gameday.votes ?? [null, null];
	const value = votes[side];
	const onChange = (id: string | null) => {
		const next: [string | null, string | null] = [...votes];
		next[side] = id;
		setState({ ...state, gameday: { ...state.gameday, votes: next } });
	};
	// another coach's vote stays secret until the result is locked in
	if (!canSeePrivate(side))
		return (
			<div className='rounded-xl bg-black/25 p-3 flex items-center gap-2 text-sm'>
				<span className='font-black' style={{ color: SIDE_COLORS[side] }}>
					{names[side]}
				</span>
				<span className='text-white/60'>{value ? 'has voted' : 'is voting on their phone…'}</span>
				{value && <Icon name='lock' className='ml-auto text-white/40' />}
			</div>
		);
	const both = [...players(state.teams[0]).map(p => ({ p, team: 0 as Side })), ...players(state.teams[1]).map(p => ({ p, team: 1 as Side }))].sort((a, b) => b.p.overall - a.p.overall);
	return (
		<div className='rounded-xl bg-black/25 p-2.5'>
			<div className='text-[10px] font-black uppercase tracking-wider mb-1.5' style={{ color: SIDE_COLORS[side] }}>
				{names[side]}&apos;s vote
			</div>
			<div className='flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]'>
				{both.map(({ p, team }) => {
					const on = value === p.id;
					return (
						<button
							key={p.id}
							disabled={!canVote}
							onClick={() => {
								buzz(10);
								onChange(on ? null : p.id);
							}}
							className={`shrink-0 rounded-lg px-2 py-1.5 text-left border-2 transition-all ${on ? 'scale-105' : 'opacity-80'}`}
							style={{ borderColor: on ? '#facc15' : `${SIDE_COLORS[team]}55`, background: on ? 'rgba(250,204,21,0.15)' : `${SIDE_COLORS[team]}14` }}
						>
								<div className='text-[11px] font-black text-white whitespace-nowrap'>
									{on && <Icon name='star' className='mr-1 text-yellow-300 fill-current' />}
									{p.lastName}
							</div>
							<div className='text-[9px] text-white/45 whitespace-nowrap'>
								{p.overall} · {names[team]}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function ResultForm({ state, setState }: { state: VersusState; setState: SetState }) {
	const { names } = state.settings;
	const [winner, setWinner] = useState<Side | null>(null);
	const votes = state.gameday.votes ?? [null, null];
	const [score, setScore] = useState<[string, string]>(['', '']);
	const [done, setDone] = useState<[boolean | null, boolean | null]>([null, null]);

	// auto-pick the winner from the score
	const setS = (i: Side, v: string) => {
		const next: [string, string] = [...score];
		next[i] = v.replace(/\D/g, '').slice(0, 3);
		setScore(next);
		const a = parseInt(next[0], 10);
		const b = parseInt(next[1], 10);
		if (!isNaN(a) && !isNaN(b) && a !== b) setWinner(a > b ? 0 : 1);
	};

	const ready = winner !== null && done[0] !== null && done[1] !== null;
	// agree → one Player of the Game; split votes → both get the award
	const potg = [...new Set(votes.filter((v): v is string => !!v))];
	const retireNote =
		state.settings.retire === 'potg'
			? `Retire rule: a Player of the Game on the winning team sits out that coach's next ${RETIRE_DRAFTS} drafts.`
			: state.settings.retire === 'starters'
				? `Retire rule: the winner's starting five sit out that coach's next ${RETIRE_DRAFTS} drafts.`
				: null;
	return (
		<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 animate-slide-up'>
			<div className='flex items-center justify-center gap-1.5 text-sm font-black uppercase tracking-widest text-white/60 mb-3'>
				<Icon name='siren' className='text-red-400' />
				Final buzzer
			</div>
			<div className='grid grid-cols-2 gap-3 mb-4'>
				{([0, 1] as Side[]).map(i => (
					<button
						key={i}
						onClick={() => setWinner(i)}
						className='rounded-2xl p-3 border-2 transition-all text-center'
						style={{ borderColor: winner === i ? SIDE_COLORS[i] : 'rgba(255,255,255,0.1)', background: winner === i ? `${SIDE_COLORS[i]}22` : 'transparent' }}
					>
						<div className='text-xs font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[i] }}>
							{names[i]}
						</div>
						<input
							inputMode='numeric'
							value={score[i]}
							onClick={e => e.stopPropagation()}
							onChange={e => setS(i, e.target.value)}
							placeholder='pts'
							className='w-20 mx-auto block text-center bg-transparent text-3xl font-black text-white outline-none placeholder:text-white/15 tabular-nums'
						/>
						<div className={`inline-flex items-center gap-1 text-[10px] font-black uppercase mt-1 ${winner === i ? 'text-green-400' : 'text-white/25'}`}>
								{winner === i && <Icon name='trophy' />}
								{winner === i ? 'Winner' : 'Tap if won'}
							</div>
					</button>
				))}
			</div>
			<div className='space-y-2 mb-4'>
				{([0, 1] as Side[]).map(i => {
					const c = getChallenge(state.gameday.challenges[i]);
					return (
						<div key={i} className='flex items-center gap-2 rounded-xl bg-black/25 p-2.5'>
							<div className='flex-1 min-w-0'>
								<div className='text-[10px] font-black uppercase tracking-wider' style={{ color: SIDE_COLORS[i] }}>
									{names[i]}
								</div>
								<div className='text-sm font-bold text-white truncate'>{c?.title}</div>
							</div>
							<button onClick={() => setDone(d => (i ? [d[0], false] : [false, d[1]]))} className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-black ${done[i] === false ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60'}`}>
								Missed
							</button>
							<button onClick={() => setDone(d => (i ? [d[0], true] : [true, d[1]]))} className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-black ${done[i] === true ? 'bg-green-500 text-white' : 'bg-white/10 text-white/60'}`}>
								Done ✓
							</button>
						</div>
					);
				})}
			</div>
			{(() => {
				const ht = state.gameday.halftime;
				const t = getHalftime(ht?.id);
				return ht && t?.scoreNote ? (
					<div className='text-[12px] text-sky-200 text-center -mt-2 mb-3'>
						<Icon name='clock' className='mr-1' />
						{halftimeText(t.scoreNote, names, ht.leader)}
					</div>
				) : null;
			})()}
			{state.settings.vegas &&
				(() => {
					const line = vegasLine(state, history());
					const a = parseInt(score[0], 10);
					const b = parseInt(score[1], 10);
					if (isNaN(a) || isNaN(b)) return <div className='text-[11px] text-white/40 text-center -mt-2 mb-3'><Icon name='trendUp' className='mr-1' />Enter both scores to settle the spread ({names[line.fav]} −{line.spread}).</div>;
					const cov = coveredBy(line, [a, b]);
					return (
						<div className='text-[12px] text-center -mt-2 mb-3 font-bold'>
							{cov !== null ? (
								<span className='text-emerald-300'>
										<Icon name='trendUp' className='mr-1' />
										{names[cov]} covers +{line.spread} — <Icon name='chevronsUp' className='mx-0.5' />
										Tier Up next draft
								</span>
							) : (
								<span className='text-white/55'>
										<Icon name='trendUp' className='mr-1' />
										{names[line.fav]} covers −{line.spread}
								</span>
							)}
						</div>
					);
				})()}
			<div className='mb-4'>
				<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white/50 mb-1'>
					<Icon name='star' className='text-yellow-300' />
					Player of the Game
				</div>
				<div className='text-center text-[11px] text-white/40 mb-2'>
					Each coach votes — anyone from either team. Split votes? Both get it. Winners earn a <Icon name='star' className='mx-0.5 text-yellow-300 fill-current' />
					Hot hand tag in future drafts.
				</div>
				<div className='space-y-2'>
					{([0, 1] as Side[]).map(i => (
						<PotgVote key={i} state={state} setState={setState} side={i} />
					))}
				</div>
				{retireNote && (
					<div className='text-[11px] text-amber-200/80 text-center mt-2'>
						<Icon name='medal' className='mr-1' />
						{retireNote}
					</div>
				)}
			</div>
			<button
				disabled={!ready}
				onClick={() => {
					const sc: [number | null, number | null] = [score[0] ? parseInt(score[0], 10) : null, score[1] ? parseInt(score[1], 10) : null];
					buzz([20, 40, 60]);
					setState(recordGame(state, { winner: winner!, score: sc, challenges: done, potg }));
				}}
				className='w-full btn-green rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'
			>
				{ready && !potg.length ? 'Lock in result (no POTG vote)' : 'Lock in result'}
			</button>
		</div>
	);
}

function MiniPlayer({ player: p, slot, tag }: { player: VersusPlayer; slot: string; tag?: string }) {
	const team = getTeamFor(p);
	return (
		<div className='flex items-center gap-1.5 py-1'>
			<div className='w-6 text-[9px] font-black text-white/40 shrink-0'>{slot}</div>
			<div className='relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/15' style={{ background: `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor})` }}>
				<Headshot
					urls={getPlayerHeadshotUrls(p.id.replace(/^at_/, ''), p.firstName, p.lastName, p.era)}
					alt=''
					className='absolute inset-0 w-full h-full'
					style={{ objectFit: 'cover', objectPosition: 'top center' }}
					fallback={<div className='absolute inset-0 flex items-center justify-center text-[10px] font-black text-white'>{p.firstName[0]}{p.lastName[0]}</div>}
				/>
			</div>
			<div className='min-w-0 flex-1'>
				<div className={`${p.lastName.length > 10 ? 'text-[10.5px]' : 'text-[12px]'} font-bold text-white truncate leading-tight`} title={`${p.firstName} ${p.lastName}${hotHand(p.id) ? ` — Player of the Game ×${hotHand(p.id)}` : ''}`}>
					{hotHand(p.id) > 0 && <Icon name='star' className='mr-0.5 text-yellow-300 fill-current' />}
					{p.lastName}
				</div>
				<div className='text-[9px] text-white/40 truncate leading-tight'>
					{tag ? <span className='font-black uppercase text-amber-400'>{tag}</span> : <>{p.position}/{p.secondaryPosition} · {p.era === 'alltime' ? `${p.eraLabel ?? ''} ${team.abbreviation}`.trim() : team.abbreviation}</>}
				</div>
			</div>
			<div className={`tier-${p.tier} rounded w-7 h-6 flex items-center justify-center text-[11px] font-black text-white shrink-0`} style={{ animation: 'none' }}>
				{p.overall}
			</div>
		</div>
	);
}

/** Both squads, starters + bench, visible the whole game day */
function GameRosters({ state }: { state: VersusState }) {
	const { names } = state.settings;
	const sitting = new Set<string>();
	return (
		<div className='mt-8'>
			<div className='text-[11px] font-black uppercase tracking-widest text-white/45 text-center mb-3'>Tonight&apos;s rosters</div>
			<div className='grid grid-cols-2 gap-2'>
				{([0, 1] as Side[]).map(side => {
					const lu = bestLineup(state.teams[side]);
					return (
						<div key={side} className='rounded-2xl p-2.5 border min-w-0' style={{ borderColor: `${SIDE_COLORS[side]}55`, background: `linear-gradient(160deg, ${SIDE_COLORS[side]}18, transparent 60%)` }}>
							<div className='flex items-center justify-between gap-1 mb-1 px-0.5'>
								<div className='flex items-center gap-1 min-w-0 text-xs font-black uppercase tracking-wider' style={{ color: SIDE_COLORS[side] }}>
									<Icon name={teamIcon(state.settings, side)} />
									<span className='truncate'>{teamName(state.settings, side)}</span>
								</div>
								<div className='text-sm font-black text-white tabular-nums'>{teamOvr(state.teams[side]).toFixed(1)}</div>
							</div>
							<div className='divide-y divide-white/5'>
								{lu.starters.map(st => st.player && <MiniPlayer key={st.slot} player={st.player} slot={st.slot} tag={sitting.has(st.player.id) ? 'Sits Q1' : st.fit === 'out' ? 'OOP' : undefined} />)}
							</div>
							{lu.bench.length > 0 && (
								<>
									<div className='text-[9px] font-black uppercase tracking-widest text-white/30 mt-2 mb-0.5 px-0.5'>Bench</div>
									<div className='divide-y divide-white/5'>
										{lu.bench.map(p => <MiniPlayer key={p.id} player={p} slot='BN' tag={sitting.has(p.id) ? 'Sits Q1' : undefined} />)}
									</div>
								</>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

const QUARTER_REEL = [
	{ id: '2', label: '2 MIN', sub: 'Sprint', color: '#f97316', weight: 2 },
	{ id: '3', label: '3 MIN', sub: 'Quick', color: '#3b82f6', weight: 3 },
	{ id: '4', label: '4 MIN', sub: 'Standard', color: '#a855f7', weight: 3 },
	{ id: '5', label: '5 MIN', sub: 'Long', color: '#ef4444', weight: 2 },
];

const SEG_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#22c55e', '#ef4444', '#06b6d4', '#eab308', '#ec4899'];

/** Pick a risk level — the harder the challenge, the bigger the draft reward */
function RiskPicker({ side, name, onPick }: { side: Side; name: string; onPick: (d: Difficulty) => void }) {
	return (
		<div className='animate-fade-in'>
			<p className='text-sm text-center mb-3'>
				<span className='font-black' style={{ color: SIDE_COLORS[side] }}>
					{name}
				</span>
				<span className='text-white/60'>, pick your risk. Complete the challenge this game to bank the reward for your next draft.</span>
			</p>
			<div className='grid grid-cols-3 gap-2'>
				{(['easy', 'medium', 'hard'] as const).map(dif => {
					const info = DIFFICULTY_INFO[dif];
					return (
						<button
							key={dif}
							onClick={() => onPick(dif)}
							className='rounded-2xl p-3 text-left border-2 transition-transform active:scale-95 hover:scale-[1.02]'
							style={{ borderColor: `${info.color}88`, background: `linear-gradient(170deg, ${info.color}26, transparent 70%)` }}
						>
							<div className='text-base font-black' style={{ color: info.color }}>
								{info.label}
							</div>
							<div className='text-[10px] text-white/45 font-bold uppercase tracking-wider mb-2'>{dif === 'easy' ? 'Safe' : dif === 'medium' ? 'Solid' : 'Big swing'}</div>
							<div className='space-y-1'>
								{REWARDS_BY_DIFFICULTY[dif].map(b => (
									<div key={b} className='text-[11px] text-white/80 leading-tight flex items-start gap-1'>
										<Icon name={BOOSTS[b].icon} className='shrink-0 mt-px text-amber-300' />
										<span className='font-bold'>{BOOSTS[b].label}</span>
									</div>
								))}
							</div>
						</button>
					);
				})}
			</div>
			<div className='text-center text-[10px] text-white/35 mt-2'>You land one of the three rewards at random.</div>
		</div>
	);
}

/** Point spread for tonight, with what covering means */
function LineCard({ state }: { state: VersusState }) {
	if (!state.settings.vegas) return null;
	const { names } = state.settings;
	const line = vegasLine(state, history());
	const dog = other(line.fav);
	return (
		<div className='rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3 flex items-center gap-3'>
			<IconTile name='trendUp' color='#34d399' size={40} />
			<div className='min-w-0'>
				<div className='text-xs font-black uppercase tracking-wider text-emerald-300'>
					Vegas line: <span style={{ color: SIDE_COLORS[line.fav] }}>{names[line.fav]}</span> −{line.spread}
				</div>
				<div className='text-[11px] text-white/60 leading-snug'>
					<span className='font-black' style={{ color: SIDE_COLORS[dog] }}>
						{names[dog]}
					</span>{' '}
					covers by {line.spread < 1 ? 'winning' : `winning or losing by ${Math.floor(line.spread)} or less`} — and earns <Icon name='chevronsUp' className='text-amber-300' /> Tier Up for the next draft. Enter the score to settle it.
				</div>
			</div>
		</div>
	);
}

/** Secret picks before tip-off — pass the phone, closer guess earns +1 Rotation */
function PredictionCard({ state, setState }: { state: VersusState; setState: SetState }) {
	const { names } = state.settings;
	const preds = state.gameday.predictions ?? [null, null];
	const [open, setOpen] = useState<Side | null>(null);
	const [winner, setWinner] = useState<Side | null>(null);
	const [margin, setMargin] = useState(5);
	const mine = [useCanAct(0, names), useCanAct(1, names)];
	const lock = (side: Side) => {
		const next: [Prediction | null, Prediction | null] = [...preds];
		next[side] = { winner: winner!, margin };
		buzz(30);
		setState({ ...state, gameday: { ...state.gameday, predictions: next } });
		setOpen(null);
		setWinner(null);
		setMargin(5);
	};
	return (
		<div className='rounded-2xl border border-violet-400/30 bg-violet-400/[0.06] p-4'>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-violet-300 mb-1'>
				<Icon name='sparkles' />
				Predictions
			</div>
			<div className='text-[12px] text-white/60 text-center mb-3'>Each coach secretly picks the winner and margin. Closer guess earns a +1 Rotation player next draft. Revealed after the game.</div>
			<div className='grid grid-cols-2 gap-2'>
				{([0, 1] as Side[]).map(side =>
					preds[side] ? (
						<div key={side} className='flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-sm font-black border border-white/10 bg-white/5 text-white/70 min-w-0'>
							<Icon name='lock' className='shrink-0' />
							<span className='truncate'>{names[side]} locked in</span>
						</div>
					) : (
						<button key={side} disabled={!mine[side]} onClick={() => setOpen(side)} className='rounded-xl py-2.5 text-sm font-black border disabled:opacity-40' style={{ borderColor: `${SIDE_COLORS[side]}66`, color: SIDE_COLORS[side], background: `${SIDE_COLORS[side]}14` }}>
							{names[side]}&apos;s pick
						</button>
					),
				)}
			</div>
			{open !== null && (
				<div className='fixed inset-0 z-[80] bg-black/90 backdrop-blur flex items-center justify-center p-6' onClick={() => setOpen(null)}>
					<div className='w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d1220] p-5 vs-pop' onClick={e => e.stopPropagation()}>
						<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white/45'>
							<Icon name='eye' />
							Only {names[open]} looks
						</div>
						<div className='text-center text-xl font-black text-white mb-4'>Who wins?</div>
						<div className='grid grid-cols-2 gap-2 mb-4'>
							{([0, 1] as Side[]).map(w => (
								<button key={w} onClick={() => setWinner(w)} className='rounded-xl py-3 font-black border-2' style={{ borderColor: winner === w ? SIDE_COLORS[w] : 'rgba(255,255,255,0.1)', color: SIDE_COLORS[w], background: winner === w ? `${SIDE_COLORS[w]}22` : 'transparent' }}>
									{names[w]}
								</button>
							))}
						</div>
						<div className='text-center text-[11px] font-black uppercase tracking-widest text-white/45 mb-1'>By how much?</div>
						<div className='flex items-center justify-center gap-4 mb-5'>
							<button onClick={() => setMargin(m => Math.max(1, m - 1))} aria-label='Smaller margin' className='w-10 h-10 rounded-full bg-white/10 text-white text-xl font-black flex items-center justify-center'>
								<Icon name='minus' />
							</button>
							<div className='text-4xl font-black text-white tabular-nums w-16 text-center'>{margin}</div>
							<button onClick={() => setMargin(m => Math.min(60, m + 1))} aria-label='Bigger margin' className='w-10 h-10 rounded-full bg-white/10 text-white text-xl font-black flex items-center justify-center'>
								<Icon name='plus' />
							</button>
						</div>
						<button disabled={winner === null} onClick={() => lock(open)} className='w-full inline-flex items-center justify-center gap-2 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white disabled:opacity-40'>
							<Icon name='lock' />
							Lock it in
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

/** Halftime: whoever's behind spins a second-half twist */
function HalftimeCard({ state, setState }: { state: VersusState; setState: SetState }) {
	const gd = state.gameday;
	const { names } = state.settings;
	const [lead, setLead] = useState<Side | 'tied' | null>(null);
	const [size] = useState(() => (typeof window === 'undefined' ? 280 : Math.min(300, window.innerWidth - 64)));
	if (!state.settings.halftime) return null;
	const ht = gd.halftime;
	if (ht) {
		const t = getHalftime(ht.id);
		if (!t) return null;
		return (
			<div className='rounded-xl p-3 border flex gap-3 items-start vs-rise' style={{ borderColor: `${t.color}66`, background: `${t.color}18` }}>
				<IconTile name='clock' color={t.color} size={36} />
				<div className='text-[12px] text-white/80 leading-snug'>
					<div className='text-xs font-black uppercase tracking-wider' style={{ color: t.color }}>
						Second half: {t.label}
					</div>
					{halftimeText(t.desc, names, ht.leader)}
					{ht.tied && <span className='text-white/45'> (Tied at the half — the wheel picked who it hits.)</span>}
				</div>
			</div>
		);
	}
	return (
		<div className='rounded-2xl border border-sky-400/30 bg-sky-400/[0.05] p-4'>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-sky-300 mb-1'>
				<Icon name='clock' />
				Halftime wheel
			</div>
			{lead === null ? (
				<>
					<div className='text-sm text-white/65 text-center mb-3'>At the half, pause and tap who&apos;s leading. The team that&apos;s behind spins a second-half twist.</div>
					<div className='grid grid-cols-3 gap-2'>
						{([0, 1] as Side[]).map(side => (
							<button key={side} onClick={() => setLead(side)} className='rounded-xl py-2.5 text-sm font-black border' style={{ borderColor: `${SIDE_COLORS[side]}66`, color: SIDE_COLORS[side], background: `${SIDE_COLORS[side]}14` }}>
								{names[side]} leads
							</button>
						))}
						<button onClick={() => setLead('tied')} className='rounded-xl py-2.5 text-sm font-black border border-white/15 text-white/70 bg-white/5'>
							Tied
						</button>
					</div>
				</>
			) : (
				<div className='flex flex-col items-center'>
					<div className='text-sm text-white/65 text-center mb-3'>
						{lead === 'tied' ? (
							'Tied up — spin, and the wheel decides who it hits.'
						) : (
							<>
								<span className='font-black' style={{ color: SIDE_COLORS[other(lead)] }}>
									{names[other(lead)]}
								</span>{' '}
								is behind — spin for a way back.
							</>
						)}
					</div>
					<Wheel
						mirror='Halftime wheel'
						items={activeHalftime()}
						size={size}
						accent='#38bdf8'
						onResult={i => {
							const leader: Side = lead === 'tied' ? (Math.random() < 0.5 ? 0 : 1) : lead;
							setTimeout(() => setState({ ...state, gameday: { ...gd, halftime: { id: activeHalftime()[i].id, leader, tied: lead === 'tied' } } }), 900);
						}}
					/>
					<button onClick={() => setLead(null)} className='mt-3 text-xs text-white/35 underline'>
						← Change
					</button>
				</div>
			)}
		</div>
	);
}

// short wheel labels for roster challenges (the wheel cuts labels at 14 chars)
const ROSTER_SHORT: Record<string, string> = { star20: '20 pts', star30: '30 pts', two15: '15 pts', low3: 'a 3', low8: '8 pts', c8: '8 reb', pg6: '6 ast', dd: 'dbl-dbl', dunk: '2 dunks', bench10: '10 pts' };
const MAX_ROSTER_SEGS = 3;
const MAX_SEGS = 10;

function rosterLabel(id: string, title: string): string {
	const [, tid, pid] = id.split(':');
	const p = getVersusPlayer(pid ?? '');
	const short = ROSTER_SHORT[tid];
	if (!p || !short) return title;
	const room = 14 - short.length - 1;
	const name = p.lastName.split(' ').slice(-1)[0];
	return `${name.length > room ? `${name.slice(0, room - 1)}.` : name} ${short}`;
}

/** Challenge wheel: the regular challenges, with up to 3 about the spinner's own roster spread around it */
function challengeWheel(state: VersusState, spinner: Side, risk: Difficulty) {
	const taken = state.gameday.challenges[other(spinner)];
	const base = challengeSegments(state.settings.rosterSize, risk).filter(sg => sg.id !== taken);
	const roster = state.settings.rosterChallenges
		? rosterChallengeSegments(state.teams[spinner], risk)
				.filter(sg => sg.id !== taken)
				.sort(() => Math.random() - 0.5)
				.slice(0, MAX_ROSTER_SEGS)
				.map(sg => ({ ...sg, label: rosterLabel(sg.id, sg.label) }))
		: [];
	if (!roster.length) return base.map((sg, i) => ({ ...sg, color: SEG_COLORS[i % SEG_COLORS.length], weight: 1 }));
	const kept = base.sort(() => Math.random() - 0.5).slice(0, Math.max(3, MAX_SEGS - roster.length));
	// interleave so the roster ones don't bunch up
	const out: typeof kept = [];
	const every = Math.max(1, Math.floor(kept.length / roster.length));
	let r = 0;
	kept.forEach((sg, i) => {
		out.push(sg);
		if (r < roster.length && (i + 1) % every === 0) out.push(roster[r++]);
	});
	while (r < roster.length) out.push(roster[r++]);
	return out.map((sg, i) => ({ ...sg, color: SEG_COLORS[i % SEG_COLORS.length], weight: 1 }));
}

const INTRO_SEEN = 'giddey-versus-intro-seen';

export function GameDayScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const gd = state.gameday;
	const { names } = state.settings;
	const size = useWheelSize();
	const [showForm, setShowForm] = useState(false);
	const [pending, setPending] = useState<string | null>(null);
	const [risk, setRisk] = useState<Difficulty | null>(null);

	const step = gd.quarter === null || gd.modifier === null ? 0 : !gd.rewards[0] || !gd.rewards[1] ? 1 : 2;
	const set = (patch: Partial<typeof gd>) => setState({ ...state, gameday: { ...gd, ...patch } });
	const later = (fn: () => void, label: string) => {
		setPending(label);
		setTimeout(() => {
			setPending(null);
			fn();
		}, 1400);
	};

	// whose challenge spin is next
	const spinner: Side = !gd.rewards[0] ? 0 : 1;
	const canSpin = useCanAct(spinner, names);
	const canHost = useCanAct(null, names, true);
	const liveSide = mySide();
	// built once per spin so the wheel doesn't reshuffle under the pointer
	const segs = useMemo(
		() => (risk ? challengeWheel(state, spinner, risk) : []),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[risk, spinner, gd.challenges[other(spinner)], state.teams[spinner]],
	);

	// broadcast intro: plays on its own on a single phone and on the main screen,
	// once per game; coach phones in a live room get a button instead
	const [intro, setIntro] = useState(false);
	const introKey = `${names.join('|')}#${history().length}#${state.gameNo}`;
	const introButton = state.settings.intro && !!liveInfo() && !isScreen();
	useEffect(() => {
		if (!state.settings.intro || gd.quarter !== null) return;
		if (liveInfo() && !isScreen()) return;
		try {
			if (localStorage.getItem(INTRO_SEEN) === introKey) return;
			localStorage.setItem(INTRO_SEEN, introKey);
		} catch {
			/* storage blocked — still show it */
		}
		setIntro(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [introKey]);
	const needStakes = state.settings.stakes && (gd.stakes ?? null) === null;

	return (
		<div className='min-h-screen pb-16'>
			<div className='max-w-3xl mx-auto px-4 pt-6'>
				<SectionTitle kicker={seasonLabel(nextSeasonTag(history(), state.settings)) || `Game ${state.gameNo} · Game day`} title={step === 2 ? (needStakes ? 'Tonight’s stakes' : 'Ball is tipped') : step === 0 ? 'Spin for the rules' : 'Challenge spins'} />
				<StepDots step={step} />
				{introButton && (
					<div className='flex justify-center -mt-3 mb-4'>
						<button onClick={() => setIntro(true)} className='min-h-[36px] inline-flex items-center gap-1.5 rounded-full px-4 text-xs font-black uppercase tracking-wider text-white/75 bg-white/[0.06] border border-white/15'>
							<Icon name='tv' />
							Watch the intro
						</button>
					</div>
				)}

				{step === 0 && (
					<div className='animate-fade-in'>
						<p className='text-sm text-white/55 mb-4 text-center'>One pull sets the quarter length (2–5 min) and a rule twist for both teams.</p>
						{!canHost ? (
							<WaitingBar name={hostLock(names) ?? 'the host'} fixed={false} what='is pulling for the rules' />
						) : (
						<SlotMachine
							mirror='Tonight’s rules'
							reels={[
								{ title: 'Quarters', items: QUARTER_REEL },
								{ title: 'Twist', items: activeTwists().map(t => ({ id: t.id, label: t.label, color: t.color, weight: t.weight })) },
							]}
							onDone={([q, t]) => set({ quarter: parseInt(QUARTER_REEL[q].id, 10), modifier: activeTwists()[t].id })}
						/>
						)}
						<div className={`text-center mt-3 ${canHost ? '' : 'hidden'}`}>
							<button onClick={() => later(() => set({ quarter: 4, modifier: 'straight' }), '4-minute quarters, straight up')} className='text-xs text-white/35 underline'>
								Skip — 4-minute quarters, no twist
							</button>
						</div>
					</div>
				)}

				{step === 1 && (
					<div className='animate-fade-in'>
						{/* this game's rules */}
						<div className='flex justify-center gap-2 mb-5 flex-wrap'>
							<Pill color='#f97316'>
								<Icon name='timer' />
								{gd.quarter}-min quarters
							</Pill>
							{(() => {
								const t = getTwist(gd.modifier);
								return t ? (
									<Pill color={t.color}>
										<Icon name='dice' />
										{t.label}
									</Pill>
								) : null;
							})()}
						</div>
						{gd.rewards[0] && (
							<div className='mb-5'>
								<ChallengeCard state={state} side={0} />
							</div>
						)}
						{!canSpin ? (
							<WaitingBar name={names[spinner]} fixed={false} />
						) : !risk ? (
							<RiskPicker key={spinner} side={spinner} name={names[spinner]} onPick={setRisk} />
						) : (
							<div className='flex flex-col items-center'>
								<p className='text-sm text-center mb-1'>
									<span className='font-black' style={{ color: SIDE_COLORS[spinner] }}>
										{names[spinner]}
									</span>
									<span className='text-white/60'> — spin a </span>
									<span className='font-black' style={{ color: DIFFICULTY_INFO[risk].color }}>
										{DIFFICULTY_INFO[risk].label}
									</span>
									<span className='text-white/60'> challenge</span>
								</p>
								<div className='flex flex-wrap justify-center gap-x-3 gap-y-1 mb-4 text-[11px] text-white/50'>
									{REWARDS_BY_DIFFICULTY[risk].map(b => (
										<span key={b} className='inline-flex items-center gap-1'>
											<Icon name={BOOSTS[b].icon} className='text-amber-300/80' />
											{BOOSTS[b].label}
										</span>
									))}
								</div>
								<Wheel
									mirror={`${names[spinner]}'s ${DIFFICULTY_INFO[risk].label} challenge`}
									key={`ch-${spinner}-${risk}`}
									items={segs}
									size={size}
									accent={DIFFICULTY_INFO[risk].color}
									onResult={i => {
										const c = segs[i].challenge;
										const reward = rollReward(risk);
										later(() => {
											const challenges: [string | null, string | null] = [...gd.challenges];
											const rewards: [BoostId | null, BoostId | null] = [...gd.rewards];
											challenges[spinner] = c.id;
											rewards[spinner] = reward;
											setRisk(null);
											set({ challenges, rewards });
										}, `${c.title} → ${BOOSTS[reward].label}`);
									}}
								/>
								<button onClick={() => setRisk(null)} className='mt-3 text-xs text-white/35 underline'>
									← Change risk
								</button>
							</div>
						)}
					</div>
				)}

				{step === 2 && needStakes && <StakesPicker state={state} setState={setState} />}

				{step === 2 && !needStakes && (
					<div className='space-y-3 animate-fade-in'>
						{/* Game card */}
						<div className='rounded-2xl overflow-hidden border border-white/10'>
							<div className='grid grid-cols-3 text-center bg-white/[0.04]'>
								<div className='p-3'>
									<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[0] }}>{names[0]}</div>
									<CoachBadges side={0} compact />
									<div className='text-2xl font-black text-white tabular-nums'>{teamOvr(state.teams[0]).toFixed(1)}</div>
								</div>
								<div className='p-3 border-x border-white/10'>
									<div className='text-[10px] font-black uppercase tracking-widest text-white/50'>Quarters</div>
									<div className='text-2xl font-black text-orange-400'>{gd.quarter} min</div>
								</div>
								<div className='p-3'>
									<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[1] }}>{names[1]}</div>
									<CoachBadges side={1} compact />
									<div className='text-2xl font-black text-white tabular-nums'>{teamOvr(state.teams[1]).toFixed(1)}</div>
								</div>
							</div>
							{(() => {
								const t = getTwist(gd.modifier);
								return t ? (
									<div className='p-3 border-t border-white/10 flex items-center gap-3'>
										<div className='w-2 self-stretch rounded-full' style={{ background: t.color }} />
										<div>
											<div className='text-xs font-black uppercase tracking-wider text-white'>Twist: {t.label}</div>
											<div className='text-[11px] text-white/55'>{t.desc}</div>
										</div>
									</div>
								) : null;
							})()}
						</div>

						<LineCard state={state} />
						<StakesStrip state={state} />

						{/* Sabotage in play */}
						{state.sabotage && <SabotageCard state={state} />}

						<div className='grid sm:grid-cols-2 gap-3'>
							<ChallengeCard state={state} side={0} />
							<ChallengeCard state={state} side={1} />
						</div>

						{!showForm && <PredictionCard state={state} setState={setState} />}
						<HalftimeCard state={state} setState={setState} />

						{!canHost && liveSide !== null && (
							<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4'>
								<div className='text-center text-[11px] font-black uppercase tracking-widest text-white/50 mb-2'>Your Player of the Game vote</div>
								<PotgVote state={state} setState={setState} side={liveSide} />
								<div className='text-center text-[11px] text-white/40 mt-2'>Secret until the result is in. Anyone from either team.</div>
							</div>
						)}
						{!canHost ? (
							<WaitingBar name={hostLock(names) ?? 'the host'} fixed={false} what='enters the final score' />
						) : !showForm ? (
							<button onClick={() => setShowForm(true)} className='w-full inline-flex items-center justify-center gap-2 btn-primary rounded-2xl py-4 font-black uppercase tracking-wider text-white text-lg mt-2'>
								<Icon name='ball' />
								Game over — enter result
							</button>
						) : (
							<ResultForm state={state} setState={setState} />
						)}
					</div>
				)}

				<GameRosters state={state} />
			</div>

			{intro && <BroadcastIntro state={state} onDone={() => setIntro(false)} />}

			{pending && (
				<div className='fixed inset-0 z-50 flex items-center justify-center pointer-events-none'>
					<Confetti count={40} />
					<div className='px-6 py-4 rounded-2xl bg-black/80 border border-white/15 text-2xl sm:text-3xl font-black text-white text-center vs-pop'>{pending}</div>
				</div>
			)}
		</div>
	);
}

export function SabotageCard({ state, pending }: { state: VersusState; pending?: boolean }) {
	const sab = pending ? state.pendingSabotage : state.sabotage;
	const info = getSabotage(sab?.id);
	if (!sab || !info) return null;
	const { names } = state.settings;
	return (
		<div className='rounded-xl p-3 border flex gap-3 items-start vs-rise' style={{ borderColor: `${info.color}66`, background: `${info.color}18` }}>
			<IconTile name='skull' color={info.color} size={36} />
			<div className='text-[12px] text-white/80 leading-snug'>
				<div className='text-xs font-black uppercase tracking-wider' style={{ color: info.color }}>
					Sabotage: {info.label}
				</div>
				{info.id === 'mercy' ? (
					<>
						<span className='font-black' style={{ color: SIDE_COLORS[sab.on] }}>{names[sab.on]}</span> walks free. {info.desc}
					</>
				) : (
					<>
						<span className='font-black' style={{ color: SIDE_COLORS[sab.by] }}>{names[sab.by]}</span> hits <span className='font-black' style={{ color: SIDE_COLORS[sab.on] }}>{names[sab.on]}</span>
						{pending ? ' next game' : ''}: {info.desc}
					</>
				)}
			</div>
		</div>
	);
}

function SabotageSpin({ state, setState }: { state: VersusState; setState: SetState }) {
	const last = state.series[state.series.length - 1];
	const loser = other(last.winner);
	const canSpin = useCanAct(loser, state.settings.names);
	const [size] = useState(() => (typeof window === 'undefined' ? 280 : Math.min(300, window.innerWidth - 64)));
	if (state.pendingSabotage) return <SabotageCard state={state} pending />;
	return (
		<div className='rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 flex flex-col items-center'>
			<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-red-300 mb-1'>
				<Icon name='skull' />
				Revenge spin
			</div>
			<div className='text-sm text-white/70 text-center mb-4'>
				<span className='font-black' style={{ color: SIDE_COLORS[loser] }}>{state.settings.names[loser]}</span> lost — spin a sabotage for{' '}
				<span className='font-black' style={{ color: SIDE_COLORS[last.winner] }}>{state.settings.names[last.winner]}</span> to suffer next game.
			</div>
			<Wheel mirror={`${state.settings.names[loser]}'s revenge spin`} items={activeSabotages()} size={size} accent='#ef4444' spinLabel='SPIN' disabled={!canSpin} onResult={i => setTimeout(() => setState(setSabotage(state, activeSabotages()[i].id)), 900)} />
		</div>
	);
}

/** The loser of the last game sets the winner's roster build for the redraft */
function HandicapSheet({ state, setState, onClose }: { state: VersusState; setState: SetState; onClose: () => void }) {
	const last = state.series[state.series.length - 1];
	const winner = last.winner;
	const loser = other(winner);
	const [s, setS] = useState<Settings>(() => normalizeSettings({ ...state.settings, handicap: true, tiers2: state.settings.handicap ? state.settings.tiers2 : { ...state.settings.tiers } }));
	const field = winner === 0 ? 'tiers' : 'tiers2';
	return (
		<div className='fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl p-4 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center gap-2 text-lg font-black text-white mb-1'>
					<Icon name='target' className='text-amber-300' />
					{state.settings.names[loser]} sets the handicap
				</div>
				<div className='text-xs text-white/50 mb-4'>Choose {state.settings.names[winner]}&apos;s roster build for the redraft. Your own build stays as it is. Handicap mode turns on.</div>
				<TierBuilder s={s} setS={setS} field={field} title={`${state.settings.names[winner]}'s roster`} color={SIDE_COLORS[winner]} />
				<div className='flex gap-2'>
					<button onClick={onClose} className='rounded-2xl px-4 py-3 font-bold text-sm bg-white/10 text-white/70'>
						Cancel
					</button>
					<button
						onClick={() => {
							setState({ ...state, settings: normalizeSettings(s) });
							onClose();
						}}
						className='flex-1 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white'
					>
						Lock it in
					</button>
				</div>
			</div>
		</div>
	);
}

export function PostGameScreen({ state, setState, onRunBack, onRedraft, onNewSeries, onLeagues }: { state: VersusState; setState: SetState; onRunBack: () => void; onRedraft: () => void; onNewSeries: () => void; onLeagues: () => void }) {
	const { names } = state.settings;
	const last = state.series[state.series.length - 1];
	const [w0, w1] = seriesScore(state);
	const w = last.winner;
	const [handicapOpen, setHandicapOpen] = useState(false);
	const [recapMsg, setRecapMsg] = useState<string | null>(null);
	const canNext = useCanAct(null, names, true);
	useEffect(() => {
		const sc = last.score[0] !== null && last.score[1] !== null ? ` ${Math.max(last.score[0], last.score[1])} to ${Math.min(last.score[0], last.score[1])}` : '';
		announce(`Ballgame! ${names[w]} wins${sc}.`);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return (
		<div className='min-h-screen pb-10'>
			<Confetti count={90} colors={[SIDE_COLORS[w], '#facc15', '#ffffff']} />
			<div className='max-w-3xl mx-auto px-4 pt-10 animate-fade-in'>
				<div className='text-center mb-8'>
					<Icon name='trophy' size={60} className='mx-auto mb-2 text-yellow-300 drop-shadow-[0_0_18px_rgba(250,204,21,0.45)]' />
					<div className='text-[11px] font-black uppercase tracking-[0.3em] text-white/45'>Game {last.game} goes to</div>
					<div className='flex items-center justify-center gap-3 text-5xl font-black' style={{ color: SIDE_COLORS[w] }}>
						<Icon name={teamIcon(state.settings, w)} size={40} />
						{teamName(state.settings, w)}
					</div>
					{last.score[0] !== null && last.score[1] !== null && (
						<div className='text-xl font-black text-white/70 mt-1 tabular-nums'>
							{last.score[0]} – {last.score[1]}
						</div>
					)}
				</div>

				<LeagueResultCard last={last} onOpen={onLeagues} />
				<SeasonCard state={state} last={last} />
				<BeltMoment state={state} last={last} />
				<NewBadges state={state} />
				<EloCard state={state} />
				<CoverCard state={state} last={last} />
				<PredictionReveal state={state} last={last} />

				{(last.potg?.length ?? 0) > 0 && (
					<div className='rounded-2xl border border-yellow-400/40 bg-yellow-400/[0.07] p-4 mb-4 text-center vs-rise'>
						<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-300/80 mb-1'>
							<Icon name='star' className='fill-current' />
							Player of the Game{last.potg!.length > 1 ? ' (split vote)' : ''}
						</div>
						<div className='flex justify-center gap-4 flex-wrap'>
							{last.potg!.map(id => {
								const p = getVersusPlayer(id);
								if (!p) return null;
								const side: Side = last.rosters?.[1]?.includes(id) ? 1 : 0;
								return (
									<div key={id}>
										<div className='text-2xl font-black text-white'>
											{p.firstName} {p.lastName}
										</div>
										<div className='text-[11px] font-bold' style={{ color: SIDE_COLORS[side] }}>
											{p.overall} OVR · {names[side]} · {hotHand(id) > 1 ? `${hotHand(id)}× all-time` : 'first award'}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
				{(() => {
					const fresh = (state.retired ?? []).filter(r => r.left === RETIRE_DRAFTS && last.rosters?.[r.side]?.includes(r.id));
					if (!fresh.length) return null;
					return (
						<div className='rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 mb-4'>
							<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-300/80 mb-1'>
								<Icon name='medal' />
								Retired from {names[w]}&apos;s side
							</div>
							<div className='text-sm text-white font-bold'>{fresh.map(r => getVersusPlayer(r.id)?.lastName).filter(Boolean).join(', ')}</div>
							<div className='text-[11px] text-white/50 mt-0.5'>
								{names[w]} can&apos;t draft {fresh.length === 1 ? 'him' : 'them'} for the next {RETIRE_DRAFTS} drafts. {names[other(w)]} still can — run it back keeps current squads as they are.
							</div>
						</div>
					);
				})()}

				{/* Series */}
				<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4'>
					<div className='text-[11px] font-black uppercase tracking-widest text-white/45 text-center mb-2'>Series</div>
					<div className='flex items-center justify-center gap-6'>
						<div className='text-center'>
							<div className='text-xs font-black uppercase' style={{ color: SIDE_COLORS[0] }}>{names[0]}</div>
							<div className='text-4xl font-black text-white'>{w0}</div>
						</div>
						<div className='text-white/25 font-black'>—</div>
						<div className='text-center'>
							<div className='text-xs font-black uppercase' style={{ color: SIDE_COLORS[1] }}>{names[1]}</div>
							<div className='text-4xl font-black text-white'>{w1}</div>
						</div>
					</div>
					<div className='flex justify-center gap-1.5 mt-3 flex-wrap'>
						{state.series.map(g => (
							<div key={g.game} className='w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center text-black' style={{ background: SIDE_COLORS[g.winner] }} title={`Game ${g.game}`}>
								G{g.game}
							</div>
						))}
					</div>
				</div>

				{/* Boosts */}
				<div className='grid sm:grid-cols-2 gap-3 mb-6'>
					{([0, 1] as Side[]).map(side => {
						const c = getChallenge(state.gameday.challenges[side]);
						const ok = last.challenges[side];
						const earned = state.earned[side];
						// earned in order: challenge reward, spread cover, prediction duel
						const sources = [...(ok && state.gameday.rewards[side] ? [''] : []), ...(last.covered === side ? [' · covered the spread'] : []), ...(last.oracle === side ? [' · best prediction'] : [])];
						const bonusSource = (_side: Side, i: number) => sources[i] ?? '';
						return (
							<div key={side} className='rounded-2xl p-4 border' style={{ borderColor: ok ? '#22c55e66' : 'rgba(255,255,255,0.1)', background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)' }}>
								<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>{names[side]}</div>
								<div className='text-sm font-bold text-white'>
									{c?.title} — {ok ? <span className='text-green-400'>completed</span> : <span className='text-red-400'>missed</span>}
								</div>
								{earned.length > 0 ? (
									earned.map((b, i) => {
										const info = getBoost(b);
										if (!info) return null;
										return (
											<div key={`${b}-${i}`} className='mt-2 text-sm'>
												<div className='flex items-center gap-2'>
													<IconTile name={info.icon} color='#fbbf24' size={30} className='rounded-lg' />
													<span className='font-black text-amber-300'>{info.label}</span>
													<span className='text-white/45 text-xs'>next draft{bonusSource(side, i)}</span>
												</div>
												<div className='text-[11px] text-white/45 mt-0.5'>
													{info.desc} Run it back instead: {info.runBack.toLowerCase()}.
												</div>
											</div>
										);
									})
								) : (
									<div className='text-xs text-white/35 mt-1'>No boost this time.</div>
								)}
							</div>
						);
					})}
				</div>

				{(last.stakes?.length ?? 0) > 0 && (
					<div className='mb-4'>
						<PunishmentSpin state={state} setState={setState} />
					</div>
				)}

				<div className='mb-6'>
					<SabotageSpin state={state} setState={setState} />
				</div>

				{handicapOpen && <HandicapSheet state={state} setState={setState} onClose={() => setHandicapOpen(false)} />}

				{!canNext && <WaitingBar name={hostLock(names) ?? 'the host'} fixed={false} what='picks what’s next' />}
				<div className={`space-y-2 ${canNext ? '' : 'hidden'}`}>
					{deadlineOpen(state) && (
						<button onClick={() => setState(tradeDeadline(state))} className='w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4 px-3 font-black uppercase tracking-wider text-white text-lg bg-gradient-to-r from-emerald-600 to-teal-600 border border-emerald-300/40'>
							<Icon name='handshake' className='shrink-0' />
							Trade deadline — deal, then run it back
						</button>
					)}
					{state.settings.dynasty && (
						<div className='text-[11px] text-white/45 text-center'>
							<Icon name='crown' className='mr-1 text-amber-300/80' />
							Dynasty: squads carry through the season — running it back is the default.
						</div>
					)}
					<button onClick={onRunBack} className='w-full inline-flex items-center justify-center gap-2 btn-primary rounded-2xl py-4 px-3 font-black uppercase tracking-wider text-white text-lg'>
							<Icon name='repeat' className='shrink-0' />
							Run it back — same squads
					</button>
					<button onClick={onRedraft} className='w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4 px-3 font-black uppercase tracking-wider text-white bg-white/10 border border-white/15'>
							<Icon name='layers' className='shrink-0' />
							Redraft — {names[other(w)]} wins the coin toss
					</button>
					<button onClick={() => setHandicapOpen(true)} className='w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-sm font-black text-amber-300 bg-amber-400/10 border border-amber-400/25'>
							<Icon name='target' className='shrink-0' />
							{names[other(w)]} sets {names[w]}&apos;s handicap for the redraft
					</button>
					<button
						onClick={async () => {
							setRecapMsg('Drawing…');
							const r = await shareImage(await renderRecap(state), 'giddey-versus-night-recap.png', `${names[0]} vs ${names[1]} — night recap`);
							setRecapMsg(r === 'failed' ? 'Couldn’t draw the recap' : r === 'downloaded' ? '✓ Saved' : null);
							setTimeout(() => setRecapMsg(null), 2000);
						}}
						className='w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-sm font-black text-fuchsia-200 bg-fuchsia-500/15 border border-fuchsia-400/30'
						>
							<Icon name='camera' className='shrink-0' />
							{recapMsg ?? 'Night recap card'}
					</button>
					<button onClick={onNewSeries} className='w-full rounded-2xl py-3 text-sm font-bold text-white/45'>
						End series &amp; start over
					</button>
				</div>
			</div>
		</div>
	);
}
