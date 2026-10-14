'use client';

import { useEffect, useState } from 'react';
import { LiveGate } from './Live';
import {
	answerTrade,
	applyEqualizer,
	bestLineup,
	chooseKeeper,
	fairness,
	other,
	passTrade,
	players,
	proposeTrade,
	resolveBoost,
	Side,
	teamIcon,
	teamName,
	teamOvr,
	VersusState,
} from '@/lib/versus/engine';
import { shareSquads } from '@/lib/versus/shareCard';
import { ChemBars } from './DraftFx';
import { getVersusPlayer, VersusPlayer } from '@/lib/versus/pool';
import { BOOSTS } from '@/lib/versus/wheels';
import { BAND_INFO } from '@/lib/versus/engine';
import VersusCard, { RosterRow } from './VersusCard';
import Scoreboard, { FairnessMeter } from './Scoreboard';
import { Confetti, SectionTitle, SIDE_COLORS } from './Fx';
import { GradeCards } from './GradeCards';
import Icon, { IconTile } from './Icon';
import { announce } from '@/lib/versus/announcer';

type SetState = (s: VersusState) => void;

function BottomBar({ children }: { children: React.ReactNode }) {
	return (
		<div className='fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
			<div className='max-w-3xl mx-auto flex gap-2'>{children}</div>
		</div>
	);
}

function OptionPicker({ options, chosen, setChosen }: { options: string[]; chosen: string | null; setChosen: (id: string | null) => void }) {
	const [w, setW] = useState(120);
	useEffect(() => setW(window.innerWidth < 420 ? 104 : 132), []);
	return (
		<div className='flex flex-wrap justify-center gap-3'>
			{options.map((id, i) => (
				<div key={id} className='vs-deal' style={{ animationDelay: `${i * 120}ms` }}>
					<VersusCard player={getVersusPlayer(id)!} width={w} selected={chosen === id} onClick={() => setChosen(chosen === id ? null : id)} />
				</div>
			))}
		</div>
	);
}

// ─── Equalizer ──────────────────────────────────────────────────

export function EqualizerScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const eq = state.equalizer!;
	const [chosen, setChosen] = useState<string | null>(null);
	const name = state.settings.names[eq.side];
	const replaces = getVersusPlayer(eq.replaces)!;
	const gap = Math.abs(teamOvr(state.teams[0]) - teamOvr(state.teams[1])).toFixed(1);
	const preview = chosen ? teamOvr(state.teams[eq.side].map(x => (x === eq.replaces ? chosen : x))) : null;
	return (
		<div className='min-h-screen pb-28'>
			<Scoreboard state={state} />
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker='Balance check' title={`${name} gets the Equalizer`} sub={`The teams finished ${gap} OVR apart. ${name} can swap out ${replaces.firstName} ${replaces.lastName} (${replaces.overall}) for one of these free agents.`} />
				<OptionPicker options={eq.options} chosen={chosen} setChosen={setChosen} />
				{preview !== null && (
					<div className='text-center mt-4 text-sm text-white/60'>
						New team OVR: <span className='font-black text-white'>{preview.toFixed(1)}</span>
					</div>
				)}
			</div>
			<LiveGate side={state.equalizer!.side} names={state.settings.names}>
				<BottomBar>
				<button onClick={() => setState(applyEqualizer(state, null))} className='rounded-2xl px-4 py-3.5 font-bold text-sm bg-white/10 text-white/70'>
					Keep my team
				</button>
				<button disabled={!chosen} onClick={() => setState(applyEqualizer(state, chosen))} className='flex-1 btn-green rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'>
					Sign him
				</button>
			</BottomBar>
			</LiveGate>
		</div>
	);
}

// ─── Trade window ───────────────────────────────────────────────

function TradeList({ ids, sel, onSel, color }: { ids: string[]; sel: string | null; onSel: (id: string) => void; color: string }) {
	return (
		<div className='space-y-1'>
			{players(ids)
				.sort((a, b) => b.overall - a.overall)
				.map(p => (
					<button key={p.id} onClick={() => onSel(p.id)} className='w-full text-left rounded-lg transition-all' style={sel === p.id ? { outline: `2px solid ${color}`, outlineOffset: 1 } : undefined}>
						<RosterRow player={p} highlight={sel === p.id} />
					</button>
				))}
		</div>
	);
}

export function TradeScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const t = state.trade!;
	const { names } = state.settings;
	const [give, setGive] = useState<string | null>(null);
	const [get, setGet] = useState<string | null>(null);
	const [handoff, setHandoff] = useState(false);

	useEffect(() => {
		setGive(null);
		setGet(null);
		setHandoff(!!t.proposal);
	}, [t.turn, t.proposal]);

	if (t.proposal) {
		const p = t.proposal;
		const to = other(p.from);
		const giveP = getVersusPlayer(p.give)!;
		const getP = getVersusPlayer(p.get)!;
		const after: [string[], string[]] = [[...state.teams[0]], [...state.teams[1]]];
		after[p.from] = after[p.from].map(x => (x === p.give ? p.get : x));
		after[to] = after[to].map(x => (x === p.get ? p.give : x));
		if (handoff) {
			return (
				<div className='min-h-screen flex flex-col items-center justify-center px-6 text-center animate-fade-in'>
					<IconTile name='phone' color={SIDE_COLORS[to]} size={72} className='mb-5 rounded-2xl' />
					<div className='text-sm text-white/50 uppercase tracking-widest font-bold mb-2'>Hand the phone to</div>
					<div className='text-4xl font-black mb-8' style={{ color: SIDE_COLORS[to] }}>
						{names[to]}
					</div>
					<button onClick={() => setHandoff(false)} className='btn-primary text-white font-black uppercase tracking-wider px-8 py-3 rounded-xl'>
						I&apos;m {names[to]} — show me
					</button>
				</div>
			);
		}
		return (
			<div className='min-h-screen pb-28'>
				<Scoreboard state={state} />
				<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
					<SectionTitle kicker='Incoming trade' title={`${names[p.from]} wants to deal`} sub={`${names[to]}, accept or decline.`} />
					<div className='flex items-center justify-center gap-3 sm:gap-6'>
						<div className='text-center'>
							<div className='text-[10px] font-black uppercase tracking-widest text-white/50 mb-2'>You get</div>
							<VersusCard player={giveP} width={120} />
						</div>
						<Icon name='swap' size={30} className='text-white/40 shrink-0' />
						<div className='text-center'>
							<div className='text-[10px] font-black uppercase tracking-widest text-white/50 mb-2'>You give</div>
							<VersusCard player={getP} width={120} />
						</div>
					</div>
					<div className='mt-6 max-w-sm mx-auto'>
						<div className='flex justify-between text-xs font-bold text-white/60 mb-3'>
							<span>
								{names[0]}: {teamOvr(state.teams[0]).toFixed(1)} → <span className='text-white'>{teamOvr(after[0]).toFixed(1)}</span>
							</span>
							<span>
								{names[1]}: {teamOvr(state.teams[1]).toFixed(1)} → <span className='text-white'>{teamOvr(after[1]).toFixed(1)}</span>
							</span>
						</div>
						<FairnessMeter a={after[0]} b={after[1]} />
					</div>
				</div>
				<LiveGate side={other(state.trade!.proposal!.from)} names={state.settings.names}>
				<BottomBar>
					<button onClick={() => setState(answerTrade(state, false))} className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider bg-red-500/80 text-white'>
						Decline
					</button>
					<button onClick={() => setState(answerTrade(state, true))} className='flex-1 btn-green rounded-2xl py-3.5 font-black uppercase tracking-wider text-white'>
						Accept
					</button>
				</BottomBar>
			</LiveGate>
			</div>
		);
	}

	const me = t.turn;
	const opp = other(me);
	const last = t.history[t.history.length - 1];
	return (
		<div className='min-h-screen pb-28'>
			<Scoreboard state={state} />
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker='Trade window' title={`${names[me]}'s offer`} sub={`Pick one of yours and one of ${names[opp]}'s. One offer each — ${names[opp]} can say no.`} />
				{last && (
					<div className={`text-center text-xs font-bold mb-4 ${last.accepted ? 'text-green-400' : 'text-red-400'}`}>
						{names[other(last.from)]} {last.accepted ? 'accepted' : 'declined'} {names[last.from]}&apos;s offer.
					</div>
				)}
				<div className='grid grid-cols-2 gap-3'>
					<div>
						<div className='text-[10px] font-black uppercase tracking-widest mb-1.5' style={{ color: SIDE_COLORS[me] }}>
							You send
						</div>
						<TradeList ids={state.teams[me]} sel={give} onSel={setGive} color={SIDE_COLORS[me]} />
					</div>
					<div>
						<div className='text-[10px] font-black uppercase tracking-widest mb-1.5' style={{ color: SIDE_COLORS[opp] }}>
							You receive
						</div>
						<TradeList ids={state.teams[opp]} sel={get} onSel={setGet} color={SIDE_COLORS[opp]} />
					</div>
				</div>
			</div>
			<LiveGate side={state.trade!.turn} names={state.settings.names}>
				<BottomBar>
				<button onClick={() => setState(passTrade(state))} className='rounded-2xl px-4 py-3.5 font-bold text-sm bg-white/10 text-white/70'>
					No trade
				</button>
				<button disabled={!give || !get} onClick={() => setState(proposeTrade(state, give!, get!))} className='flex-1 btn-primary rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'>
					Send offer
				</button>
			</BottomBar>
			</LiveGate>
		</div>
	);
}

// ─── Earned boosts (upgrade / heist) ────────────────────────────

export function BoostScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const head = state.boostQueue[0];
	const [chosen, setChosen] = useState<string | null>(null);
	useEffect(() => setChosen(null), [state.boostQueue.length]);
	if (!head) return null;
	const reward = head.from ? BOOSTS[head.from] : undefined;
	const name = state.settings.names[head.side];
	const weakest = players(state.teams[head.side]).sort((x, y) => x.overall - y.overall)[0];
	const opts = state.boostOptions ?? [];
	const sign = head.boost === 'sign';
	const tier = head.band ? BAND_INFO[head.band].label : '';
	return (
		<div className='min-h-screen pb-28'>
			<Scoreboard state={state} />
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<div className='flex justify-center mb-2'>
					<IconTile name={reward?.icon ?? 'chevronsUp'} color={SIDE_COLORS[head.side]} size={48} className='rounded-2xl' />
				</div>
				<SectionTitle
					kicker={`Challenge reward${reward ? ` · ${reward.label}` : ''}`}
					title={sign ? `${name} signs a ${tier}` : `${name} upgrades`}
					sub={sign ? `Running it back — pick one ${tier}-tier free agent to add to your roster.` : `Running it back — replace ${weakest.firstName} ${weakest.lastName} (${weakest.overall}) with one of these.`}
				/>
				{opts.length ? <OptionPicker options={opts} chosen={chosen} setChosen={setChosen} /> : <div className='text-center text-white/50'>Nothing to take — boost fizzles.</div>}
			</div>
			<LiveGate side={state.boostQueue[0]?.side ?? null} names={state.settings.names}>
				<BottomBar>
				<button onClick={() => setState(resolveBoost(state, null))} className='rounded-2xl px-4 py-3.5 font-bold text-sm bg-white/10 text-white/70'>
					Skip
				</button>
				<button disabled={!chosen} onClick={() => setState(resolveBoost(state, chosen))} className='flex-1 btn-green rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'>
					{sign ? 'Sign him' : 'Upgrade'}
				</button>
			</BottomBar>
			</LiveGate>
		</div>
	);
}

// ─── Tale of the tape ───────────────────────────────────────────

function rosterText(state: VersusState, side: Side): string {
	const lu = bestLineup(state.teams[side]);
	const line = (p: VersusPlayer) => `${p.firstName} ${p.lastName} (${p.overall}${p.era === 'alltime' ? `, All-Time ${p.teamId}` : `, ${p.teamId}`})`;
	return [
		`${state.settings.names[side]} — ${teamOvr(state.teams[side]).toFixed(1)} OVR`,
		...lu.starters.filter(s => s.player).map(s => `  ${s.slot}: ${line(s.player!)}`),
		...lu.bench.map(p => `  BN: ${line(p)}`),
	].join('\n');
}

export function RevealScreen({ state, onNext }: { state: VersusState; onNext: () => void }) {
	const { names } = state.settings;
	const lus = [bestLineup(state.teams[0]), bestLineup(state.teams[1])];
	const ovr = [teamOvr(state.teams[0]), teamOvr(state.teams[1])];
	const f = fairness(state.teams[0], state.teams[1]);
	const [copied, setCopied] = useState(false);
	const [sharing, setSharing] = useState<string | null>(null);
	const grades = state.grades;
	useEffect(() => {
		if (!grades) return;
		const say = (l: string) => l.replace('+', ' plus').replace('-', ' minus');
		announce(`The grades are in. ${names[0]} gets ${/^[AE]/.test(grades[0].letter) ? 'an' : 'a'} ${say(grades[0].letter)}. ${names[1]}, ${/^[AE]/.test(grades[1].letter) ? 'an' : 'a'} ${say(grades[1].letter)}.`);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const share = async () => {
		setSharing('Rendering…');
		const r = await shareSquads(state);
		setSharing(r === 'failed' ? 'Couldn’t render the image' : r === 'downloaded' ? '✓ Saved image' : null);
		setTimeout(() => setSharing(null), 2000);
	};

	const copy = async () => {
		const txt = `Giddey Versus — Game ${state.gameNo}\n\n${rosterText(state, 0)}\n\n${rosterText(state, 1)}`;
		try {
			await navigator.clipboard.writeText(txt);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch {
			/* clipboard blocked — ignore */
		}
	};

	return (
		<div className='min-h-screen pb-28'>
			<Confetti count={50} />
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker={`Game ${state.gameNo} · Tale of the tape`} title='The squads are set' />

				{/* Big numbers */}
				<div className='flex items-stretch gap-3 mb-4'>
					{[0, 1].map(i => (
						<div key={i} className='flex-1 rounded-2xl p-4 text-center border' style={{ borderColor: `${SIDE_COLORS[i]}66`, background: `linear-gradient(160deg, ${SIDE_COLORS[i]}2a, transparent 70%)` }}>
							<div className='flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest min-w-0' style={{ color: SIDE_COLORS[i] }}>
								<Icon name={teamIcon(state.settings, i as Side)} />
								<span className='truncate'>{teamName(state.settings, i as Side)}</span>
							</div>
							<div className='text-5xl font-black text-white tabular-nums leading-none mt-1'>{ovr[i].toFixed(1)}</div>
							<div className='text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1'>Team OVR</div>
							<div className='mt-3 text-left'>
								<ChemBars ids={state.teams[i]} rosterSize={state.teams[i].length} color={SIDE_COLORS[i]} compact />
							</div>
						</div>
					))}
				</div>
				<div className='mb-6 px-2'>
					<FairnessMeter a={state.teams[0]} b={state.teams[1]} />
					<div className='text-center text-[11px] text-white/45 mt-1'>{f >= 90 ? 'Dead even. This one comes down to the sticks.' : f >= 75 ? 'Slight edge — the underdog has the challenge wheel.' : 'Lopsided. Spin hard, underdog.'}</div>
				</div>

				{grades && (
					<div className='mb-6'>
						<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>
							<Icon name='clipboard' />
							Draft grades
						</div>
						<GradeCards grades={grades} names={names} state={state} />
						<div className='text-center text-[10px] text-white/35 mt-1.5'>Saved with the game — the rivalry page tracks whether the better grade actually wins.</div>
					</div>
				)}

				{/* Position matchups */}
				<div className='rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden mb-4'>
					{lus[0].starters.map((s0, i) => {
						const s1 = lus[1].starters[i];
						const a = s0.player;
						const b = s1.player;
						const edge = a && b ? a.overall - b.overall : 0;
						return (
							<div key={s0.slot} className='flex items-center gap-2 px-2 py-2 border-b border-white/5 last:border-0'>
								<div className='flex-1 min-w-0'>{a ? <RosterRow compact player={a} tag={s0.fit === 'out' ? 'OOP' : undefined} tagColor='#b45309' highlight={edge > 0} /> : <div className='h-11' />}</div>
								<div className='w-10 text-center shrink-0'>
									<div className='text-[11px] font-black text-white/70'>{s0.slot}</div>
									{edge !== 0 && (
										<div className='inline-flex items-center text-[10px] font-black' style={{ color: SIDE_COLORS[edge > 0 ? 0 : 1] }}>
											<Icon name={edge > 0 ? 'chevronLeft' : 'chevronRight'} strokeWidth={3} />
											{Math.abs(edge)}
										</div>
									)}
								</div>
								<div className='flex-1 min-w-0'>{b ? <RosterRow compact player={b} tag={s1.fit === 'out' ? 'OOP' : undefined} tagColor='#b45309' highlight={edge < 0} /> : <div className='h-11' />}</div>
							</div>
						);
					})}
				</div>

				{(lus[0].bench.length > 0 || lus[1].bench.length > 0) && (
					<>
						<div className='text-[11px] font-bold uppercase tracking-wider text-white/45 mb-1.5'>Bench</div>
						<div className='grid grid-cols-2 gap-2 mb-6'>
							{lus.map((lu, i) => (
								<div key={i} className='space-y-1'>
									{lu.bench.map(p => (
										<RosterRow compact key={p.id} player={p} />
									))}
								</div>
							))}
						</div>
					</>
				)}

				<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 text-[11px] text-white/50 leading-relaxed mb-4'>
					<span className='font-bold text-white/70'>Setting it up in 2K27:</span> Play Now → choose two teams → Edit Rosters / Custom Rosters, then sign or trade these players onto each side. Starters above are auto-fit to positions (<span className='text-amber-400 font-bold'>OOP</span> = out of position).
				</div>
				<div className='grid grid-cols-2 gap-2'>
					<button onClick={share} disabled={!!sharing} className='inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-sm font-black bg-gradient-to-r from-pink-500/30 to-violet-500/30 text-white border border-white/15'>
						{sharing ?? (
							<>
								<Icon name='camera' />
								Share squads
							</>
						)}
					</button>
					<button onClick={copy} className='inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-sm font-bold bg-white/10 text-white/80 border border-white/10'>
						<Icon name={copied ? 'check' : 'copy'} />
						{copied ? 'Copied' : 'Copy rosters'}
					</button>
				</div>
			</div>
			<BottomBar>
				<button onClick={onNext} className='flex-1 btn-primary rounded-2xl py-4 font-black uppercase tracking-wider text-white text-lg'>
					Game Day →
				</button>
			</BottomBar>
		</div>
	);
}


// ─── Keepers (redraft) ──────────────────────────────────────────

export function KeepersScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const side = state.keeperTurn;
	const [chosen, setChosen] = useState<string | null>(null);
	useEffect(() => setChosen(null), [side]);
	const name = state.settings.names[side];
	const mine = players(state.teams[side]).sort((a, b) => b.overall - a.overall);
	const otherPick = state.keeperPicks[other(side)];
	return (
		<div className='min-h-screen pb-28'>
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker='Keepers' title={`${name}, keep one player`} sub='He comes with you into the redraft and uses up one of your rounds in his tier.' />
				{otherPick && (
					<div className='text-center text-xs text-white/50 mb-4'>
						{state.settings.names[other(side)]} kept <span className='font-black text-white'>{getVersusPlayer(otherPick)?.lastName}</span>.
					</div>
				)}
				<div className='space-y-1.5 max-w-md mx-auto'>
					{mine.map(p => (
						<button key={p.id} onClick={() => setChosen(chosen === p.id ? null : p.id)} className='w-full text-left rounded-lg' style={chosen === p.id ? { outline: `2px solid ${SIDE_COLORS[side]}`, outlineOffset: 1 } : undefined}>
							<RosterRow player={p} highlight={chosen === p.id} />
						</button>
					))}
				</div>
			</div>
			<LiveGate side={state.keeperTurn} names={state.settings.names}>
				<BottomBar>
				<button onClick={() => setState(chooseKeeper(state, null))} className='rounded-2xl px-4 py-3.5 font-bold text-sm bg-white/10 text-white/70'>
					No keeper
				</button>
				<button
					disabled={!chosen}
					onClick={() => setState(chooseKeeper(state, chosen))}
					className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'
					style={{ background: chosen ? SIDE_COLORS[side] : 'rgba(255,255,255,0.08)' }}
				>
					{chosen ? `Keep ${getVersusPlayer(chosen)?.lastName}` : 'Pick a keeper'}
				</button>
			</BottomBar>
			</LiveGate>
		</div>
	);
}
