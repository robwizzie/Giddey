'use client';

import { useEffect, useState } from 'react';
import { bestLineup, normalizeSettings, other, players, recordGame, RETIRE_DRAFTS, seriesScore, setSabotage, Settings, Side, teamName, teamOvr, VersusState } from '@/lib/versus/engine';
import { TierBuilder } from './SetupScreen';
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
	SABOTAGES,
	rollReward,
	TWISTS,
	HALFTIME,
	getHalftime,
	halftimeText,
} from '@/lib/versus/wheels';
import { history } from '@/lib/versus/history';
import { coveredBy, vegasLine } from '@/lib/versus/vegas';
import { nextSeasonTag, seasonLabel } from '@/lib/versus/seasons';
import { CoverCard, NewBadges, SeasonCard } from './PostGameExtras';
import { CoachBadges } from './Badges';
import { announce } from '@/lib/versus/announcer';
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
						<div className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${i === step ? 'bg-orange-500' : i < step ? 'bg-green-500/25' : 'bg-white/10'}`}>{i < step ? '✓' : i + 1}</div>
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
				<div className='text-xl'>{r.icon}</div>
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
function PotgVote({ state, side, value, onChange }: { state: VersusState; side: Side; value: string | null; onChange: (id: string | null) => void }) {
	const { names } = state.settings;
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
							onClick={() => {
								buzz(10);
								onChange(on ? null : p.id);
							}}
							className={`shrink-0 rounded-lg px-2 py-1.5 text-left border-2 transition-all ${on ? 'scale-105' : 'opacity-80'}`}
							style={{ borderColor: on ? '#facc15' : `${SIDE_COLORS[team]}55`, background: on ? 'rgba(250,204,21,0.15)' : `${SIDE_COLORS[team]}14` }}
						>
							<div className='text-[11px] font-black text-white whitespace-nowrap'>
								{on ? '⭐ ' : ''}
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
	const [votes, setVotes] = useState<[string | null, string | null]>([null, null]);
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
			? `🎖️ Retire rule: a Player of the Game on the winning team sits out that coach's next ${RETIRE_DRAFTS} drafts.`
			: state.settings.retire === 'starters'
				? `🎖️ Retire rule: the winner's starting five sit out that coach's next ${RETIRE_DRAFTS} drafts.`
				: null;
	return (
		<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-4 animate-slide-up'>
			<div className='text-center text-sm font-black uppercase tracking-widest text-white/60 mb-3'>Final buzzer 🚨</div>
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
						<div className={`text-[10px] font-black uppercase mt-1 ${winner === i ? 'text-green-400' : 'text-white/25'}`}>{winner === i ? '🏆 Winner' : 'Tap if won'}</div>
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
							<button onClick={() => setDone(d => (i ? [d[0], false] : [false, d[1]]))} className={`px-3 py-1.5 rounded-lg text-xs font-black ${done[i] === false ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60'}`}>
								Missed
							</button>
							<button onClick={() => setDone(d => (i ? [d[0], true] : [true, d[1]]))} className={`px-3 py-1.5 rounded-lg text-xs font-black ${done[i] === true ? 'bg-green-500 text-white' : 'bg-white/10 text-white/60'}`}>
								Done ✓
							</button>
						</div>
					);
				})}
			</div>
			{(() => {
				const ht = state.gameday.halftime;
				const t = getHalftime(ht?.id);
				return ht && t?.scoreNote ? <div className='text-[12px] text-sky-200 text-center -mt-2 mb-3'>🕐 {halftimeText(t.scoreNote, names, ht.leader)}</div> : null;
			})()}
			{state.settings.vegas &&
				(() => {
					const line = vegasLine(state, history());
					const a = parseInt(score[0], 10);
					const b = parseInt(score[1], 10);
					if (isNaN(a) || isNaN(b)) return <div className='text-[11px] text-white/40 text-center -mt-2 mb-3'>📈 Enter both scores to settle the spread ({names[line.fav]} −{line.spread}).</div>;
					const cov = coveredBy(line, [a, b]);
					return (
						<div className='text-[12px] text-center -mt-2 mb-3 font-bold'>
							{cov !== null ? (
								<span className='text-emerald-300'>
									📈 {names[cov]} covers +{line.spread} — ⬆️ Tier Up next draft
								</span>
							) : (
								<span className='text-white/55'>
									📈 {names[line.fav]} covers −{line.spread}
								</span>
							)}
						</div>
					);
				})()}
			<div className='mb-4'>
				<div className='text-center text-[11px] font-black uppercase tracking-widest text-white/50 mb-1'>⭐ Player of the Game</div>
				<div className='text-center text-[11px] text-white/40 mb-2'>Each coach votes — anyone from either team. Split votes? Both get it. Winners earn a ⭐ Hot hand tag in future drafts.</div>
				<div className='space-y-2'>
					{([0, 1] as Side[]).map(i => (
						<PotgVote key={i} state={state} side={i} value={votes[i]} onChange={id => setVotes(v => (i ? [v[0], id] : [id, v[1]]))} />
					))}
				</div>
				{retireNote && <div className='text-[11px] text-amber-200/80 text-center mt-2'>{retireNote}</div>}
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
					{hotHand(p.id) > 0 && <span className='mr-0.5'>⭐</span>}
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
							<div className='flex items-baseline justify-between mb-1 px-0.5'>
								<div className='text-xs font-black uppercase tracking-wider truncate' style={{ color: SIDE_COLORS[side] }}>{teamName(state.settings, side)}</div>
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
									<div key={b} className='text-[11px] text-white/80 leading-tight flex gap-1'>
										<span>{BOOSTS[b].icon}</span>
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
			<div className='text-2xl'>📈</div>
			<div className='min-w-0'>
				<div className='text-xs font-black uppercase tracking-wider text-emerald-300'>
					Vegas line: <span style={{ color: SIDE_COLORS[line.fav] }}>{names[line.fav]}</span> −{line.spread}
				</div>
				<div className='text-[11px] text-white/60 leading-snug'>
					<span className='font-black' style={{ color: SIDE_COLORS[dog] }}>
						{names[dog]}
					</span>{' '}
					covers by {line.spread < 1 ? 'winning' : `winning or losing by ${Math.floor(line.spread)} or less`} — and earns ⬆️ Tier Up for the next draft. Enter the score to settle it.
				</div>
			</div>
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
				<div className='text-2xl'>🕐</div>
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
			<div className='text-[11px] font-black uppercase tracking-widest text-sky-300 text-center mb-1'>🕐 Halftime wheel</div>
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
						items={HALFTIME}
						size={size}
						accent='#38bdf8'
						onResult={i => {
							const leader: Side = lead === 'tied' ? (Math.random() < 0.5 ? 0 : 1) : lead;
							setTimeout(() => setState({ ...state, gameday: { ...gd, halftime: { id: HALFTIME[i].id, leader, tied: lead === 'tied' } } }), 900);
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

export function GameDayScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const gd = state.gameday;
	const { names, rosterSize } = state.settings;
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
	const segs = risk
		? challengeSegments(rosterSize, risk)
				.filter(sg => sg.id !== gd.challenges[other(spinner)])
				.map((sg, i) => ({ ...sg, color: SEG_COLORS[i % SEG_COLORS.length], weight: 1 }))
		: [];

	return (
		<div className='min-h-screen pb-16'>
			<div className='max-w-3xl mx-auto px-4 pt-6'>
				<SectionTitle kicker={seasonLabel(nextSeasonTag(history(), state.settings)) || `Game ${state.gameNo} · Game day`} title={step === 2 ? 'Ball is tipped' : step === 0 ? 'Spin for the rules' : 'Challenge spins'} />
				<StepDots step={step} />

				{step === 0 && (
					<div className='animate-fade-in'>
						<p className='text-sm text-white/55 mb-4 text-center'>One pull sets the quarter length (2–5 min) and a rule twist for both teams.</p>
						<SlotMachine
							reels={[
								{ title: 'Quarters', items: QUARTER_REEL },
								{ title: 'Twist', items: TWISTS.map(t => ({ id: t.id, label: t.label, color: t.color, weight: t.weight })) },
							]}
							onDone={([q, t]) => set({ quarter: parseInt(QUARTER_REEL[q].id, 10), modifier: TWISTS[t].id })}
						/>
						<div className='text-center mt-3'>
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
							<Pill color='#f97316'>⏱ {gd.quarter}-min quarters</Pill>
							{(() => {
								const t = getTwist(gd.modifier);
								return t ? <Pill color={t.color}>🎲 {t.label}</Pill> : null;
							})()}
						</div>
						{gd.rewards[0] && (
							<div className='mb-5'>
								<ChallengeCard state={state} side={0} />
							</div>
						)}
						{!risk ? (
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
								<div className='flex gap-2 mb-4 text-[11px] text-white/50'>
									{REWARDS_BY_DIFFICULTY[risk].map(b => (
										<span key={b}>
											{BOOSTS[b].icon} {BOOSTS[b].label}
										</span>
									))}
								</div>
								<Wheel
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
										}, `${c.title} → ${BOOSTS[reward].icon} ${BOOSTS[reward].label}`);
									}}
								/>
								<button onClick={() => setRisk(null)} className='mt-3 text-xs text-white/35 underline'>
									← Change risk
								</button>
							</div>
						)}
					</div>
				)}

				{step === 2 && (
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

						{/* Sabotage in play */}
						{state.sabotage && <SabotageCard state={state} />}

						<div className='grid sm:grid-cols-2 gap-3'>
							<ChallengeCard state={state} side={0} />
							<ChallengeCard state={state} side={1} />
						</div>

						<HalftimeCard state={state} setState={setState} />

						{!showForm ? (
							<button onClick={() => setShowForm(true)} className='w-full btn-primary rounded-2xl py-4 font-black uppercase tracking-wider text-white text-lg mt-2'>
								🏀 Game over — enter result
							</button>
						) : (
							<ResultForm state={state} setState={setState} />
						)}
					</div>
				)}

				<GameRosters state={state} />
			</div>

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
			<div className='text-2xl'>😈</div>
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
	const [size] = useState(() => (typeof window === 'undefined' ? 280 : Math.min(300, window.innerWidth - 64)));
	if (state.pendingSabotage) return <SabotageCard state={state} pending />;
	return (
		<div className='rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 flex flex-col items-center'>
			<div className='text-[11px] font-black uppercase tracking-widest text-red-300 mb-1'>😈 Revenge spin</div>
			<div className='text-sm text-white/70 text-center mb-4'>
				<span className='font-black' style={{ color: SIDE_COLORS[loser] }}>{state.settings.names[loser]}</span> lost — spin a sabotage for{' '}
				<span className='font-black' style={{ color: SIDE_COLORS[last.winner] }}>{state.settings.names[last.winner]}</span> to suffer next game.
			</div>
			<Wheel items={SABOTAGES} size={size} accent='#ef4444' spinLabel='SPIN' onResult={i => setTimeout(() => setState(setSabotage(state, SABOTAGES[i].id)), 900)} />
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
				<div className='text-lg font-black text-white mb-1'>🎯 {state.settings.names[loser]} sets the handicap</div>
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

export function PostGameScreen({ state, setState, onRunBack, onRedraft, onNewSeries }: { state: VersusState; setState: SetState; onRunBack: () => void; onRedraft: () => void; onNewSeries: () => void }) {
	const { names } = state.settings;
	const last = state.series[state.series.length - 1];
	const [w0, w1] = seriesScore(state);
	const w = last.winner;
	const [handicapOpen, setHandicapOpen] = useState(false);
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
					<div className='text-6xl mb-2'>🏆</div>
					<div className='text-[11px] font-black uppercase tracking-[0.3em] text-white/45'>Game {last.game} goes to</div>
					<div className='text-5xl font-black' style={{ color: SIDE_COLORS[w] }}>
						{teamName(state.settings, w)}
					</div>
					{last.score[0] !== null && last.score[1] !== null && (
						<div className='text-xl font-black text-white/70 mt-1 tabular-nums'>
							{last.score[0]} – {last.score[1]}
						</div>
					)}
				</div>

				<SeasonCard state={state} last={last} />
				<NewBadges state={state} />
				<CoverCard state={state} last={last} />

				{(last.potg?.length ?? 0) > 0 && (
					<div className='rounded-2xl border border-yellow-400/40 bg-yellow-400/[0.07] p-4 mb-4 text-center vs-rise'>
						<div className='text-[11px] font-black uppercase tracking-widest text-yellow-300/80 mb-1'>⭐ Player of the Game{last.potg!.length > 1 ? ' (split vote)' : ''}</div>
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
							<div className='text-[11px] font-black uppercase tracking-widest text-amber-300/80 mb-1'>🎖️ Retired from {names[w]}&apos;s side</div>
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
													<span className='text-xl'>{info.icon}</span>
													<span className='font-black text-amber-300'>{info.label}</span>
													<span className='text-white/45 text-xs'>{last.covered === side && i === earned.length - 1 ? 'next draft · 📈 covered the spread' : 'next draft'}</span>
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

				<div className='mb-6'>
					<SabotageSpin state={state} setState={setState} />
				</div>

				{handicapOpen && <HandicapSheet state={state} setState={setState} onClose={() => setHandicapOpen(false)} />}

				<div className='space-y-2'>
					<button onClick={onRunBack} className='w-full btn-primary rounded-2xl py-4 font-black uppercase tracking-wider text-white text-lg'>
						🔁 Run it back — same squads
					</button>
					<button onClick={onRedraft} className='w-full rounded-2xl py-4 font-black uppercase tracking-wider text-white bg-white/10 border border-white/15'>
						🎴 Redraft — {names[other(w)]} wins the coin toss
					</button>
					<button onClick={() => setHandicapOpen(true)} className='w-full rounded-2xl py-3 text-sm font-black text-amber-300 bg-amber-400/10 border border-amber-400/25'>
						🎯 {names[other(w)]} sets {names[w]}&apos;s handicap for the redraft
					</button>
					<button onClick={onNewSeries} className='w-full rounded-2xl py-3 text-sm font-bold text-white/45'>
						End series &amp; start over
					</button>
				</div>
			</div>
		</div>
	);
}
