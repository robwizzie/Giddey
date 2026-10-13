'use client';

import { useState } from 'react';
import { bestLineup, normalizeSettings, other, players, recordGame, seriesScore, setSabotage, Settings, Side, teamName, teamOvr, VersusState } from '@/lib/versus/engine';
import { TierBuilder } from './SetupScreen';
import { getTeamFor, VersusPlayer } from '@/lib/versus/pool';
import { getPlayerHeadshotUrls } from '@/lib/images';
import Headshot from '@/components/Headshot';
import {
	BOOSTS,
	BoostId,
	challengeSegments,
	DIFFICULTY_INFO,
	getChallenge,
	getSabotage,
	getTwist,
	SABOTAGES,
	QUARTER_SEGMENTS,
	quarterMinutes,
	rollReward,
	TWISTS,
} from '@/lib/versus/wheels';
import Wheel from './Wheel';
import { Confetti, Pill, SectionTitle, SIDE_COLORS } from './Fx';

type SetState = (s: VersusState) => void;

function StepDots({ step }: { step: number }) {
	const labels = ['Clock', 'Twist', 'Challenges', 'Tip-off'];
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

function holder(state: VersusState, boost: BoostId): Side | null {
	if (state.honor[0].includes(boost)) return 0;
	if (state.honor[1].includes(boost)) return 1;
	return null;
}

function ChallengeCard({ state, side }: { state: VersusState; side: Side }) {
	const c = getChallenge(state.gameday.challenges[side]);
	const reward = state.gameday.rewards[side];
	if (!c || !reward) return null;
	const r = BOOSTS[reward];
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
					<div className='text-[11px] text-white/55 leading-snug'>{r.desc}</div>
				</div>
			</div>
		</div>
	);
}

function ResultForm({ state, setState }: { state: VersusState; setState: SetState }) {
	const { names } = state.settings;
	const [winner, setWinner] = useState<Side | null>(null);
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
			<button
				disabled={!ready}
				onClick={() => {
					const sc: [number | null, number | null] = [score[0] ? parseInt(score[0], 10) : null, score[1] ? parseInt(score[1], 10) : null];
					setState(recordGame(state, { winner: winner!, score: sc, challenges: done }));
				}}
				className='w-full btn-green rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'
			>
				Lock in result
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
				<div className={`${p.lastName.length > 10 ? 'text-[10.5px]' : 'text-[12px]'} font-bold text-white truncate leading-tight`} title={`${p.firstName} ${p.lastName}`}>
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
	// players benched for Q1 by a Late Scratch boost
	const sitting = new Set<string>();
	([0, 1] as Side[]).forEach(side => {
		if (state.honor[side].includes('starSit')) {
			const best = players(state.teams[other(side)]).sort((a, b) => b.overall - a.overall)[0];
			if (best) sitting.add(best.id);
		}
	});
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

export function GameDayScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const gd = state.gameday;
	const { names, rosterSize } = state.settings;
	const size = useWheelSize();
	const [showForm, setShowForm] = useState(false);
	const [pending, setPending] = useState<string | null>(null);
	const clockHolder = holder(state, 'quarterControl');

	const step = gd.quarter === null ? 0 : gd.modifier === null ? 1 : !gd.rewards[0] || !gd.rewards[1] ? 2 : 3;
	const set = (patch: Partial<typeof gd>) => setState({ ...state, gameday: { ...gd, ...patch } });
	const later = (fn: () => void, label: string) => {
		setPending(label);
		setTimeout(() => {
			setPending(null);
			fn();
		}, 1300);
	};

	// whose challenge spin is next
	const spinner: Side = !gd.rewards[0] ? 0 : 1;
	const segs = challengeSegments(rosterSize).filter(sg => sg.id !== gd.challenges[other(spinner)]);

	return (
		<div className='min-h-screen pb-16'>
			<div className='max-w-3xl mx-auto px-4 pt-6'>
				<SectionTitle kicker={`Game ${state.gameNo} · Game day`} title={step === 3 ? 'Ball is tipped' : 'Spin for the rules'} />
				<StepDots step={step} />

				{step === 0 &&
					(clockHolder !== null ? (
						<div className='text-center animate-fade-in'>
							<div className='text-sm text-white/60 mb-4'>
								⏱️ <span className='font-black' style={{ color: SIDE_COLORS[clockHolder] }}>{names[clockHolder]}</span> earned Clock Control — pick the quarter length.
							</div>
							<div className='grid grid-cols-4 gap-2 max-w-sm mx-auto'>
								{[5, 6, 7, 8].map(m => (
									<button key={m} onClick={() => set({ quarter: m })} className='rounded-2xl py-4 bg-white/[0.06] border border-white/10 hover:bg-white/10 text-2xl font-black text-white'>
										{m}
										<div className='text-[10px] text-white/40 font-bold'>MIN</div>
									</button>
								))}
							</div>
						</div>
					) : (
						<div className='flex flex-col items-center animate-fade-in'>
							<p className='text-sm text-white/55 mb-4 text-center'>Quarter length — always 5 to 8 minutes. Competitive, never a slog.</p>
							<Wheel items={QUARTER_SEGMENTS} size={size} onResult={i => later(() => set({ quarter: quarterMinutes(QUARTER_SEGMENTS[i].id) }), `${quarterMinutes(QUARTER_SEGMENTS[i].id)}-minute quarters!`)} />
						</div>
					))}

				{step === 1 && (
					<div className='flex flex-col items-center animate-fade-in'>
						<p className='text-sm text-white/55 mb-4 text-center'>Rule twist — applies to both teams.</p>
						<Wheel items={TWISTS} size={size} accent='#a855f7' onResult={i => later(() => set({ modifier: TWISTS[i].id }), TWISTS[i].label)} />
						<button onClick={() => set({ modifier: 'straight' })} className='mt-4 text-xs text-white/35 underline'>
							Skip — play it straight
						</button>
					</div>
				)}

				{step === 2 && (
					<div className='animate-fade-in'>
						<div className='grid sm:grid-cols-2 gap-3 mb-6'>
							{gd.rewards[0] && <ChallengeCard state={state} side={0} />}
							{gd.rewards[1] && <ChallengeCard state={state} side={1} />}
						</div>
						<div className='flex flex-col items-center'>
							<p className='text-sm text-center mb-4'>
								<span className='font-black' style={{ color: SIDE_COLORS[spinner] }}>
									{names[spinner]}
								</span>
								<span className='text-white/55'>, spin your challenge. Complete it in this game to earn a boost for the next one.</span>
							</p>
							<Wheel
								key={`ch-${spinner}`}
								items={segs}
								size={size}
								accent={SIDE_COLORS[spinner]}
								onResult={i => {
									const c = segs[i].challenge;
									later(() => {
										const challenges: [string | null, string | null] = [...gd.challenges];
										const rewards: [BoostId | null, BoostId | null] = [...gd.rewards];
										challenges[spinner] = c.id;
										rewards[spinner] = rollReward(c.difficulty, rosterSize);
										set({ challenges, rewards });
									}, c.title);
								}}
							/>
							<div className='flex gap-3 mt-3'>
								{(['easy', 'medium', 'hard'] as const).map(dif => (
									<span key={dif} className='flex items-center gap-1 text-[10px] font-bold text-white/50'>
										<span className='w-2 h-2 rounded-full' style={{ background: DIFFICULTY_INFO[dif].color }} />
										{DIFFICULTY_INFO[dif].label}
									</span>
								))}
							</div>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className='space-y-3 animate-fade-in'>
						{/* Game card */}
						<div className='rounded-2xl overflow-hidden border border-white/10'>
							<div className='grid grid-cols-3 text-center bg-white/[0.04]'>
								<div className='p-3'>
									<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[0] }}>{names[0]}</div>
									<div className='text-2xl font-black text-white tabular-nums'>{teamOvr(state.teams[0]).toFixed(1)}</div>
								</div>
								<div className='p-3 border-x border-white/10'>
									<div className='text-[10px] font-black uppercase tracking-widest text-white/50'>Quarters</div>
									<div className='text-2xl font-black text-orange-400'>{gd.quarter} min</div>
								</div>
								<div className='p-3'>
									<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[1] }}>{names[1]}</div>
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

						{/* Sabotage in play */}
						{state.sabotage && <SabotageCard state={state} />}

						{/* Honor boosts in play */}
						{([0, 1] as Side[]).flatMap(side =>
							state.honor[side]
								.filter(b => b !== 'quarterControl')
								.map(b => {
									const info = BOOSTS[b];
									const star = b === 'starSit' ? bestLineup(state.teams[other(side)]).starters.map(s => s.player).filter(Boolean).sort((x, y) => y!.overall - x!.overall)[0] : null;
									return (
										<div key={`${side}-${b}`} className='rounded-xl p-3 bg-amber-400/10 border border-amber-400/30 flex gap-3 items-start'>
											<div className='text-xl'>{info.icon}</div>
											<div className='text-[12px] text-white/75 leading-snug'>
												<span className='font-black' style={{ color: SIDE_COLORS[side] }}>{names[side]}</span> is using <span className='font-black text-amber-300'>{info.label}</span>: {info.desc}
												{star && <span className='font-bold text-white'> ({star.firstName} {star.lastName} sits.)</span>}
											</div>
										</div>
									);
								})
						)}

						<div className='grid sm:grid-cols-2 gap-3'>
							<ChallengeCard state={state} side={0} />
							<ChallengeCard state={state} side={1} />
						</div>

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
									earned.map(b => (
										<div key={b} className='mt-2 flex items-center gap-2 text-sm'>
											<span className='text-xl'>{BOOSTS[b].icon}</span>
											<span className='font-black text-amber-300'>{BOOSTS[b].label}</span>
											<span className='text-white/45 text-xs'>next game</span>
										</div>
									))
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
