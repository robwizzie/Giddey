'use client';

import { useEffect, useMemo, useState } from 'react';
import { LiveGate, useLive } from './Live';
import { afterBans, BAND_INFO, banCandidates, Band, bandOf, BANDS, other, Side, submitBans, VersusState } from '@/lib/versus/engine';
import { canSeePrivate, isScreen, liveInfo } from '@/lib/versus/live';
import { getVersusPlayer, VersusPlayer } from '@/lib/versus/pool';
import { haptic, play } from '@/lib/versus/sound';
import { Handoff } from './DraftFx';
import { Confetti, SectionTitle, SIDE_COLORS } from './Fx';
import Icon, { IconTile } from './Icon';
import VersusCard, { RosterRow } from './VersusCard';

type SetState = (s: VersusState) => void;

const TOP = 24;

function BottomBar({ children }: { children: React.ReactNode }) {
	return (
		<div className='fixed bottom-0 left-0 right-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
			<div className='max-w-3xl mx-auto flex gap-2'>{children}</div>
		</div>
	);
}

const fold = (t: string) =>
	t
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();

/**
 * Who's up on a secret step, shown to the devices that mustn't see it (the
 * other coach's phone, the main screen). Never shows the choices themselves.
 */
export function SecretWait({ state, side, kicker, what, done, icon }: { state: VersusState; side: Side; kicker: string; what: string; done: [boolean, boolean]; icon: string }) {
	useLive();
	const { names } = state.settings;
	const tv = isScreen();
	return (
		<div className={`min-h-screen flex flex-col items-center justify-center px-6 text-center animate-fade-in ${tv ? 'gap-8' : 'gap-5 pb-16'}`}>
			<div className={`font-black uppercase tracking-[0.3em] text-orange-400 ${tv ? 'text-lg' : 'text-[11px]'}`}>{kicker}</div>
			<div className='relative'>
				<span className='absolute inset-0 rounded-3xl animate-ping opacity-20' style={{ background: SIDE_COLORS[side] }} />
				<IconTile name={icon} color={SIDE_COLORS[side]} size={tv ? 140 : 80} className='rounded-3xl relative' />
			</div>
			<div className={`font-black text-white leading-tight ${tv ? 'text-6xl' : 'text-3xl'}`}>
				<span style={{ color: SIDE_COLORS[side] }}>{names[side]}</span> is {what}…
			</div>
			<div className={`text-white/50 max-w-md ${tv ? 'text-xl' : 'text-sm'}`}>It stays secret until both coaches lock in.</div>
			<div className={`grid grid-cols-2 w-full ${tv ? 'gap-6 max-w-3xl' : 'gap-3 max-w-sm'}`}>
				{([0, 1] as Side[]).map(i => (
					<div key={i} className={`rounded-2xl border flex flex-col items-center gap-1 ${tv ? 'p-6' : 'p-3'}`} style={{ borderColor: `${SIDE_COLORS[i]}55`, background: `${SIDE_COLORS[i]}12` }}>
						<div className={`font-black truncate max-w-full ${tv ? 'text-3xl' : 'text-base'}`} style={{ color: SIDE_COLORS[i] }}>
							{names[i]}
						</div>
						<div className={`inline-flex items-center gap-1.5 font-bold ${tv ? 'text-xl' : 'text-xs'} ${done[i] ? 'text-emerald-300' : 'text-white/45'}`}>
							<Icon name={done[i] ? 'lock' : i === side ? 'hourglass' : 'clock'} />
							{done[i] ? 'Locked in' : i === side ? 'Choosing…' : 'Up next'}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function PickRow({ p, on, color, onClick }: { p: VersusPlayer; on: boolean; color: string; onClick: () => void }) {
	return (
		<button onClick={onClick} aria-pressed={on} className='w-full text-left rounded-lg min-h-[44px]' style={on ? { outline: `2px solid ${color}`, outlineOffset: 1 } : undefined}>
			<RosterRow player={p} highlight={on} tag={on ? 'BAN' : undefined} tagColor={color} />
		</button>
	);
}

function BanPicker({ state, setState, side }: { state: VersusState; setState: SetState; side: Side }) {
	const { names } = state.settings;
	const all = useMemo(() => banCandidates(state).sort((a, b) => b.overall - a.overall), [state]);
	const n = Math.min(state.settings.bans, all.length);
	const [chosen, setChosen] = useState<string[]>([]);
	const [q, setQ] = useState('');
	useEffect(() => {
		setChosen([]);
		setQ('');
	}, [side]);
	const opp = other(side);
	const color = SIDE_COLORS[side];
	const toggle = (id: string) => {
		play('tick');
		setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : n === 1 ? [id] : c.length < n ? [...c, id] : [c[1], id]));
	};
	const query = fold(q.trim());
	const results = query ? all.filter(p => fold(`${p.firstName} ${p.lastName}`).includes(query) || p.teamId.toLowerCase() === query).slice(0, 40) : [];
	const groups: { band: Band; list: VersusPlayer[] }[] = [];
	if (!query) {
		for (const p of all.slice(0, TOP)) {
			const band = bandOf(state.settings, side, p.id);
			const g = groups.find(x => x.band === band);
			if (g) g.list.push(p);
			else groups.push({ band, list: [p] });
		}
		groups.sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band));
	}
	const otherDone = !!state.bans?.picks[opp];
	return (
		<div className='min-h-screen pb-28'>
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker={`Game ${state.gameNo} · Ban phase`} title={`${names[side]}, ban ${n === 1 ? 'a player' : `${n} players`}`} sub={`Take away the star you don't want to face. Banned players can't be drafted by either coach this draft.`} />
				<div className='flex items-center justify-center gap-2 text-[11px] font-bold text-white/45 mb-3'>
					<Icon name='eyeOff' />
					{otherDone ? `${names[opp]} already locked in — you'll see their ${n === 1 ? 'ban' : 'bans'} together.` : `${names[opp]} bans next. Both are revealed at the same time.`}
				</div>

				{/* chosen slots */}
				<div className='flex justify-center gap-2 mb-4'>
					{Array.from({ length: n }, (_, i) => {
						const p = chosen[i] ? getVersusPlayer(chosen[i]) : null;
						return p ? (
							<button key={i} onClick={() => toggle(p.id)} aria-label={`Remove ${p.lastName}`} className='vs-pop h-10 rounded-full pl-3 pr-2 inline-flex items-center gap-1.5 text-sm font-black text-white border' style={{ borderColor: color, background: `${color}26` }}>
								<Icon name='ban' style={{ color }} />
								{p.lastName}
								<span className='text-white/50 tabular-nums'>{p.overall}</span>
								<Icon name='x' className='text-white/50' />
							</button>
						) : (
							<div key={i} className='h-10 rounded-full px-4 inline-flex items-center gap-1.5 text-sm font-bold text-white/30 border border-dashed border-white/15'>
								<Icon name='ban' />
								Ban {n > 1 ? i + 1 : ''}
							</div>
						);
					})}
				</div>

				<div className='relative mb-4'>
					<Icon name='search' className='absolute left-3 top-1/2 -translate-y-1/2 text-white/35' />
					<input
						value={q}
						onChange={e => setQ(e.target.value)}
						placeholder={`Search all ${all.length} players`}
						aria-label='Search players to ban'
						className='w-full rounded-xl bg-white/[0.05] border border-white/10 pl-9 pr-10 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30'
					/>
					{q && (
						<button onClick={() => setQ('')} aria-label='Clear search' className='absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-white/45'>
							<Icon name='x' />
						</button>
					)}
				</div>

				{query ? (
					results.length ? (
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-1.5'>
							{results.map(p => (
								<PickRow key={p.id} p={p} on={chosen.includes(p.id)} color={color} onClick={() => toggle(p.id)} />
							))}
						</div>
					) : (
						<div className='text-center text-sm text-white/45 my-8'>Nobody by that name in this draft&apos;s pool.</div>
					)
				) : (
					<div className='space-y-4'>
						{groups.map(g => (
							<div key={g.band}>
								<div className='flex items-center gap-2 text-[11px] font-black uppercase tracking-widest mb-1.5' style={{ color: BAND_INFO[g.band].color }}>
									<span className='w-2 h-2 rounded-full' style={{ background: BAND_INFO[g.band].color }} />
									{BAND_INFO[g.band].label}
								</div>
								<div className='grid grid-cols-1 sm:grid-cols-2 gap-1.5'>
									{g.list.map(p => (
										<PickRow key={p.id} p={p} on={chosen.includes(p.id)} color={color} onClick={() => toggle(p.id)} />
									))}
								</div>
							</div>
						))}
						<div className='text-center text-[11px] text-white/35'>Top {Math.min(TOP, all.length)} shown — search to ban anyone else.</div>
					</div>
				)}
			</div>
			<BottomBar>
				<button
					disabled={chosen.length !== n}
					onClick={() => {
						haptic('landed');
						setState(submitBans(state, side, chosen));
					}}
					className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35 inline-flex items-center justify-center gap-2'
					style={{ background: chosen.length === n ? color : 'rgba(255,255,255,0.08)' }}
				>
					<Icon name='lock' />
					{chosen.length === n ? `Lock in ${n === 1 ? 'ban' : 'bans'}` : `Pick ${n - chosen.length} more`}
				</button>
			</BottomBar>
		</div>
	);
}

/** Both coaches' bans flip over at the same moment, on every screen */
function BanReveal({ state, setState }: { state: VersusState; setState: SetState }) {
	useLive();
	const { names } = state.settings;
	const b = state.bans!;
	const picks: [string[], string[]] = [b.picks[0] ?? [], b.picks[1] ?? []];
	const both = picks[0].filter(id => picks[1].includes(id));
	const tv = isScreen();
	const [flipped, setFlipped] = useState(false);
	const [w, setW] = useState(110);
	useEffect(() => {
		const most = Math.max(picks[0].length, picks[1].length, 1);
		const col = (Math.min(window.innerWidth, 768) - 48) / 2;
		setW(tv ? (most === 1 ? 240 : 180) : most === 1 ? Math.min(150, Math.floor(col - 8)) : Math.max(92, Math.min(130, Math.floor((col - 8) / 2))));
		play('whoosh');
		const t = setTimeout(() => {
			setFlipped(true);
			play('reveal');
			haptic('landed');
		}, 1300);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return (
		<div className='min-h-screen pb-28'>
			{flipped && <Confetti count={30} colors={[SIDE_COLORS[0], SIDE_COLORS[1], '#ffffff']} />}
			<div className={`mx-auto px-4 pt-6 animate-fade-in ${tv ? 'max-w-6xl' : 'max-w-3xl'}`}>
				{tv ? (
					<div className='text-center mb-8'>
						<div className='text-lg font-black uppercase tracking-[0.3em] text-orange-400 mb-2'>Game {state.gameNo} · Ban phase</div>
						<div className='text-6xl font-black text-white'>{flipped ? 'Off the board' : 'Revealing the bans…'}</div>
					</div>
				) : (
					<SectionTitle kicker={`Game ${state.gameNo} · Ban phase`} title={flipped ? 'Off the board' : 'Revealing the bans…'} sub='Nobody can draft these players this time.' />
				)}
				<div className={`grid grid-cols-2 ${tv ? 'gap-10' : 'gap-3'}`}>
					{([0, 1] as Side[]).map(side => (
						<div key={side} className={`rounded-2xl border flex flex-col items-center ${tv ? 'p-6 gap-5' : 'p-2.5 gap-2.5'}`} style={{ borderColor: `${SIDE_COLORS[side]}55`, background: `linear-gradient(170deg, ${SIDE_COLORS[side]}22, transparent 70%)` }}>
							<div className={`font-black uppercase tracking-widest truncate max-w-full inline-flex items-center gap-1.5 ${tv ? 'text-3xl' : 'text-xs'}`} style={{ color: SIDE_COLORS[side] }}>
								<Icon name='ban' />
								{names[side]} bans
							</div>
							<div className={`flex flex-wrap justify-center ${tv ? 'gap-5' : 'gap-2'}`}>
								{picks[side].map((id, i) => {
									const p = getVersusPlayer(id);
									if (!p) return null;
									return (
										<div key={id} className='flex flex-col items-center gap-1.5'>
											{flipped ? (
												<div className='vs-pick-flip' style={{ animationDelay: `${i * 120}ms` }}>
													<VersusCard player={p} width={w} />
												</div>
											) : (
												<div className='vs-pop' style={{ animationDelay: `${(side * 2 + i) * 120}ms` }}>
													<VersusCard player={p} width={w} hidden />
												</div>
											)}
											{flipped && both.includes(id) && (
												<div className={`vs-rise rounded-full px-2 py-0.5 font-black uppercase tracking-wider bg-white text-black ${tv ? 'text-base' : 'text-[10px]'}`} style={{ animationDelay: '700ms' }}>
													Both
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
				{flipped && both.length > 0 && (
					<div className={`text-center font-black text-white mt-5 vs-rise ${tv ? 'text-3xl' : 'text-sm'}`} style={{ animationDelay: '800ms' }}>
						Great minds — you both banned {both.map(id => getVersusPlayer(id)?.lastName).join(' and ')}.
					</div>
				)}
				{flipped && (
					<div className={`text-center text-white/45 mt-2 vs-rise ${tv ? 'text-xl' : 'text-xs'}`} style={{ animationDelay: '900ms' }}>
						{b.list.length} {b.list.length === 1 ? 'player' : 'players'} off the board for this draft.
					</div>
				)}
			</div>
			{flipped && (
				<LiveGate side={null} names={names}>
					<BottomBar>
						<button onClick={() => setState(afterBans(state))} className='flex-1 btn-primary rounded-2xl py-3.5 font-black uppercase tracking-wider text-white'>
							Continue →
						</button>
					</BottomBar>
				</LiveGate>
			)}
		</div>
	);
}

/** Ban phase: each coach secretly bans players, then both lists flip over together */
export default function BanPhase({ state, setState }: { state: VersusState; setState: SetState }) {
	useLive();
	const b = state.bans!;
	const side = b.turn;
	const { names } = state.settings;
	const [handoffDone, setHandoffDone] = useState<string | null>(null);
	if (b.revealed) return <BanReveal state={state} setState={setState} />;
	const done: [boolean, boolean] = [!!b.picks[0], !!b.picks[1]];
	const n = state.settings.bans;
	// separate devices: only the coach on the clock sees the board
	if (!canSeePrivate(side) || done[side]) return <SecretWait state={state} side={side} kicker='Ban phase' what={`choosing ${n === 1 ? 'a ban' : 'bans'}`} done={done} icon='ban' />;
	// one phone: pass it over first
	const key = `${state.gameNo}-${side}-${done[0]}-${done[1]}`;
	if (!liveInfo() && handoffDone !== key) {
		return <Handoff to={side} name={names[side]} note={`Secret ban${n === 1 ? '' : 's'} — ${names[other(side)]}, look away.`} onReady={() => setHandoffDone(key)} />;
	}
	return <BanPicker state={state} setState={setState} side={side} />;
}
