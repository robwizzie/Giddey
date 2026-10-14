'use client';

import { actingSide, BAND_INFO, bandFor, bandOf, isSharedRound, Side, teamIcon, teamName, teamOvr, VersusState, roundsTotal, players } from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { getTheme, themeTitle } from '@/lib/versus/themes';
import { audioReady, crowdBed, crowdSwell, isMuted, onMuteChange, unlockAudio } from '@/lib/versus/sound';
import Icon from './Icon';
import VersusCard from './VersusCard';
import { useEffect, useRef, useState } from 'react';
import { CommissionerIntro, isBoom, PickReveal, ShotClockRing, useShotClock, ViolationToast } from './DraftFx';
import { SIDE_COLORS } from './Fx';
import { BannedLine, DoublePickBanner, PowerChips, usePowerFx } from './PowerUps';

const introsShown = new Set<string>();

function useViewportWidth() {
	const [w, setW] = useState(1600);
	useEffect(() => {
		const f = () => setW(window.innerWidth);
		f();
		window.addEventListener('resize', f);
		return () => window.removeEventListener('resize', f);
	}, []);
	return w;
}

function Column({ state, side, active, arena }: { state: VersusState; side: Side; active: boolean; arena: boolean }) {
	const d = state.draft!;
	const roster = players(state.teams[side]);
	const target = d.targets[side];
	const empty = Math.max(0, target - roster.length);
	// deep rosters (10–12 players) get tighter rows so the column fits a 1080p screen
	const tight = target > 8;
	const color = SIDE_COLORS[side];
	return (
		<div
			className='rounded-3xl border-2 p-4 2xl:p-5 min-w-0 flex flex-col transition-all duration-700'
			style={{
				borderColor: active ? `${color}cc` : `${color}44`,
				background: `linear-gradient(170deg, ${color}${active ? '30' : '18'}, transparent 55%)`,
				boxShadow: active ? `0 0 ${arena ? 60 : 30}px ${color}${arena ? '55' : '33'}` : undefined,
			}}
		>
			<div className='flex items-center justify-between gap-3 mb-4'>
				<div className='flex items-center gap-3 min-w-0'>
					<span className='inline-flex items-center justify-center rounded-2xl shrink-0 w-12 h-12' style={{ background: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}55` }}>
						<Icon name={teamIcon(state.settings, side)} size={26} />
					</span>
					<div className='min-w-0'>
						<div className='text-2xl xl:text-3xl 2xl:text-4xl font-black truncate leading-tight' style={{ color }}>
							{state.settings.names[side]}
						</div>
						{teamName(state.settings, side) !== state.settings.names[side] && <div className='text-sm font-bold uppercase tracking-widest text-white/45 truncate'>{teamName(state.settings, side)}</div>}
					</div>
				</div>
				<div className='text-right shrink-0'>
					<div className='text-3xl xl:text-4xl 2xl:text-5xl font-black text-white tabular-nums leading-none'>{roster.length ? teamOvr(state.teams[side]).toFixed(1) : '—'}</div>
					<div className='text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mt-1'>
						OVR · {roster.length}/{target}
					</div>
					{d.auction && <div className='text-lg font-black text-emerald-300 tabular-nums mt-0.5'>${d.auction.budgets[side]}</div>}
				</div>
			</div>
			<div className={`${tight ? 'space-y-1.5' : 'space-y-2'} flex-1`}>
				{roster.map(p => {
					const fresh = d.lastPick?.id === p.id && !d.lastPick.vetoed;
					return (
						<div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 min-w-0 transition-colors ${tight ? 'py-1' : 'py-2'} ${fresh ? 'bg-white/15 vs-pop' : 'bg-black/30'}`}>
							<div className={`tier-${p.tier} rounded-lg ${tight ? 'w-10 h-8 text-lg' : 'w-12 h-10 text-xl'} flex items-center justify-center font-black text-white shrink-0`} style={{ animation: 'none' }}>
								{p.overall}
							</div>
							<div className='min-w-0 flex-1'>
								<div className={`${tight ? 'text-lg 2xl:text-xl' : 'text-xl 2xl:text-2xl'} font-black text-white truncate leading-tight`}>
									{p.firstName} {p.lastName}
								</div>
								{!tight && (
									<div className='text-sm text-white/50 truncate'>
										{p.position}/{p.secondaryPosition}
										{p.era === 'alltime' ? ` · ${p.eraLabel}` : ''}
									</div>
								)}
							</div>
							{tight && <div className='text-sm font-bold text-white/45 shrink-0'>{p.position}</div>}
						</div>
					);
				})}
				{Array.from({ length: empty }).map((_, i) => (
					<div key={i} className={`${tight ? 'h-10' : 'h-14'} rounded-xl border-2 border-dashed border-white/10`} />
				))}
			</div>
		</div>
	);
}

/** Arena lighting: the whole board glows in the on-the-clock coach's color */
function ArenaLights({ actor }: { actor: Side }) {
	return (
		<div className='fixed inset-0 pointer-events-none z-0 vs-arena-breathe' aria-hidden>
			{([0, 1] as Side[]).map(side => {
				const c = SIDE_COLORS[side];
				return (
					<div
						key={side}
						className='absolute inset-0'
						style={{
							opacity: actor === side ? 1 : 0,
							transition: 'opacity 1.2s ease',
							background: `radial-gradient(ellipse 70% 45% at 50% 0%, ${c}38, transparent 70%), radial-gradient(ellipse 45% 70% at ${side === 0 ? '0%' : '100%'} 100%, ${c}30, transparent 70%), radial-gradient(ellipse 30% 50% at ${side === 0 ? '100%' : '0%'} 100%, ${c}14, transparent 70%)`,
							boxShadow: `inset 0 0 160px ${c}40`,
						}}
					/>
				);
			})}
		</div>
	);
}

/** TVs keep audio locked until someone taps or presses a key */
function useArenaAudio(arena: boolean, live: boolean) {
	const [ready, setReady] = useState(false);
	const [muted, setMuted] = useState(false);
	useEffect(() => {
		setReady(audioReady());
		setMuted(isMuted());
		return onMuteChange(setMuted);
	}, []);
	useEffect(() => {
		if (ready) return;
		const go = () => void unlockAudio().then(setReady);
		window.addEventListener('pointerdown', go);
		window.addEventListener('keydown', go);
		return () => {
			window.removeEventListener('pointerdown', go);
			window.removeEventListener('keydown', go);
		};
	}, [ready]);
	useEffect(() => {
		crowdBed(arena && ready && live);
	}, [arena, ready, live]);
	useEffect(() => () => crowdBed(false), []);
	return { ready, muted, unlock: () => void unlockAudio().then(setReady) };
}

/** Big-screen draft board for a TV / laptop watching a live room */
export default function TvBoard({ state }: { state: VersusState }) {
	const d = state.draft;
	const arena = !!state.settings.arena;
	const vw = useViewportWidth();
	const sound = useArenaAudio(arena, !!d);
	// every new pick gets the full reveal (BOOM for superstars, jumbotron in arena mode) on the big screen
	const [revealKey, setRevealKey] = useState<string | null>(null);
	const seen = useRef(d?.log.length ?? 0);
	useEffect(() => {
		if (!d) return;
		if (d.log.length > seen.current && d.lastPick) {
			const lp = d.lastPick;
			const p = getVersusPlayer(lp.id);
			if (!lp.blind) setRevealKey(`${d.log.length}-${lp.id}`);
			// the crowd reacts to the pick (superstars get the jumbotron's roar)
			if (arena && p && !isBoom(state, lp.side, p)) {
				const band = bandOf(state.settings, lp.side, lp.id);
				crowdSwell(band === 'star' ? 0.6 : band === 'starter' ? 0.35 : 0.2);
			}
		}
		seen.current = d.log.length;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [d, d?.log.length]);
	const powerFx = usePowerFx(state, true);
	const introKey = `${state.gameNo}`;
	const [showIntro, setShowIntro] = useState(() => !!d && d.log.length === 0 && !introsShown.has(introKey));
	const [violation, setViolation] = useState(false);

	// the main screen runs its own shot clock (display + buzzer); the coach's phone enforces it
	const shotClock = state.settings.shotClock;
	const lotKey = d?.auction ? `${d.log.length}-${d.auction.block?.lotNo ?? 0}-${d.auction.lot ? `${d.auction.lot.id}-${d.auction.lot.bid}-${d.auction.lot.turn}-${d.auction.lot.passes ?? 0}` : `nom-${d.auction.nominator}`}` : '';
	const clockKey = !d ? '' : d.auction ? lotKey : `${d.round}-${d.turn}-${d.stage}-${d.log.length}-${d.collisions}-${d.powers?.last?.n ?? 0}`;
	const clockOn = !!d && shotClock > 0 && (!!d.auction || d.stage !== 'spin');
	const left = useShotClock(clockKey, clockOn ? shotClock : 0, showIntro || !!revealKey || powerFx.active, () => {
		setViolation(true);
		setTimeout(() => setViolation(false), 2200);
	});

	if (!d) return null;
	const actor = d.auction ? (d.auction.lot ? d.auction.lot.turn : d.auction.nominator) : actingSide(d);
	const band = bandFor(d, actor);
	const lp = d.lastPick;
	const last = lp ? getVersusPlayer(lp.id) : null;
	const lot = d.auction?.lot;
	const cards = lot ? [lot.id] : d.offered.length ? d.offered : d.stage === 'secret' ? [] : d.pack;
	// a coach's own pack stays private — the main screen shows card backs
	const themeInfo = getTheme(state.theme?.id);
	const privatePack = !lot && !d.offered.length && d.stage === 'pick' && (!isSharedRound(state, d) || d.solo);
	// fit the pack in the middle column (1.3 of 3.3 shares) at 1280–1920px
	const mid = ((Math.min(vw, 1920) - 48 - 2 * 32) * 1.3) / 3.3;
	const perRow = cards.length <= 3 ? Math.max(1, cards.length) : Math.ceil(cards.length / 2);
	const cardW = Math.max(110, Math.min(lot ? 240 : 210, Math.floor((mid - 16 * (perRow - 1)) / perRow)));
	const color = SIDE_COLORS[actor];
	const stageLabel = d.stage === 'secret' ? 'Blind bid — picking in secret' : lot ? 'On the block' : d.stage === 'cut' ? 'Cutting the pack' : d.stage === 'spin' ? 'Spinning for a franchise' : d.offered.length ? 'Choosing from the offer' : 'On the clock';
	return (
		<div className='relative min-h-screen text-white'>
			{arena && <ArenaLights actor={actor} />}
			{showIntro && (
				<CommissionerIntro
					state={state}
					onDone={() => {
						introsShown.add(introKey);
						setShowIntro(false);
					}}
				/>
			)}
			{revealKey && <PickReveal key={revealKey} state={state} arena={arena} onDone={() => setRevealKey(null)} />}
			{powerFx.node}
			{violation && <ViolationToast text={`Shot clock violation — ${state.settings.names[actor]}`} />}
			{!sound.ready && !sound.muted && (
				<button onClick={sound.unlock} className='fixed bottom-6 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-black text-white bg-black/70 backdrop-blur ring-1 ring-white/25 shadow-2xl animate-fade-in'>
					<Icon name='volume' size={20} className='text-orange-300' />
					{arena ? 'Tap to turn on arena sound' : 'Tap to turn on sound'}
				</button>
			)}

			<div className='relative z-[1] px-6 py-6 2xl:px-10 2xl:py-8 max-w-[1920px] mx-auto'>
				<div className='flex items-center justify-between gap-6 mb-4'>
					<div className='flex items-center gap-3 text-white/70 shrink-0'>
						<span className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30'>
							<Icon name='tv' size={22} />
						</span>
						<span className='text-xl font-black tracking-tight text-white'>
							Giddey <span className='text-orange-300'>Versus</span>
						</span>
						{arena && <span className='ml-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.25em] text-white/60 ring-1 ring-white/15'>Arena</span>}
					</div>
					<div className='flex flex-wrap items-center justify-end gap-2 text-sm font-black uppercase tracking-[0.2em]'>
						<span className='rounded-full bg-white/10 px-4 py-1.5 text-white tabular-nums'>
							{d.auction ? `Pick ${d.log.length + 1}` : `Round ${d.round + 1}`}
							{!d.auction && <span className='text-white/45'> / {roundsTotal(d) || '—'}</span>}
						</span>
						{band && !d.auction && (
							<span className='rounded-full px-4 py-1.5' style={{ color: BAND_INFO[band].color, background: `${BAND_INFO[band].color}1a`, boxShadow: `inset 0 0 0 1px ${BAND_INFO[band].color}44` }}>
								{BAND_INFO[band].label}
							</span>
						)}
						{state.theme && (
							<span className='inline-flex items-center gap-2 rounded-full px-4 py-1.5' style={{ color: themeInfo?.color ?? '#fff', background: `${themeInfo?.color ?? '#ffffff'}1a`, boxShadow: `inset 0 0 0 1px ${themeInfo?.color ?? '#ffffff'}44` }}>
								<Icon name={themeInfo?.icon ?? 'sparkles'} />
								{themeTitle(state.theme, state.settings.names)}
							</span>
						)}
					</div>
				</div>
				{(state.bans?.list?.length ?? 0) > 0 && (
					<div className='mb-4'>
						<BannedLine state={state} big />
					</div>
				)}
				<div className='grid grid-cols-[1fr_1.3fr_1fr] gap-6 2xl:gap-8 items-start'>
					<Column state={state} side={0} active={actor === 0} arena={arena} />
					<div className='text-center min-w-0'>
						<div
							key={`${actor}-${d.stage}`}
							className='rounded-3xl px-6 py-5 mb-4 flex items-center gap-5 vs-clock transition-shadow duration-700'
							style={{ background: `linear-gradient(135deg, ${color}44, ${color}11)`, border: `2px solid ${color}88`, boxShadow: arena ? `0 0 70px ${color}44` : undefined }}
						>
							<div className='flex-1 min-w-0'>
								<div className='text-base 2xl:text-lg font-black uppercase tracking-[0.35em] text-white/60'>{stageLabel}</div>
								<div className='text-5xl 2xl:text-6xl font-black truncate leading-tight' style={{ color }}>
									{state.settings.names[actor]}
								</div>
								{lot && (
									<div className='text-3xl font-black text-emerald-300 mt-1'>
										{lot.high === null ? `Opening at $${lot.bid}` : `$${lot.bid} — ${state.settings.names[lot.high]}`}
									</div>
								)}
							</div>
							{clockOn && (
								<div className='shrink-0 scale-[1.6] origin-center mx-4'>
									<ShotClockRing left={left} total={shotClock} color={color} />
								</div>
							)}
						</div>
						<DoublePickBanner state={state} big />
						{d.powers && (
							<div className='mb-4'>
								<PowerChips state={state} big />
							</div>
						)}
						<div className='flex flex-wrap justify-center gap-4'>
							{cards.map((id, i) => {
								const p = getVersusPlayer(id);
								return p ? (
									<div key={id} className='vs-deal' style={{ animationDelay: `${i * 80}ms` }}>
										<VersusCard player={p} width={cardW} faceDown={state.settings.blind || !!lot?.mystery} hidden={privatePack} />
									</div>
								) : null;
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
						{privatePack && cards.length > 0 && <div className='mt-3 text-lg text-white/50 font-bold'>{state.settings.names[actor]}&apos;s own pack — only they can see it.</div>}
						{last && lp && (
							<div className='mt-6 inline-flex flex-wrap items-center justify-center gap-x-2 rounded-2xl bg-black/30 px-5 py-3 text-xl text-white/70'>
								<span className='text-sm font-black uppercase tracking-[0.25em] text-white/40 mr-1'>Last pick</span>
								<span className={`font-black ${lp.vetoed ? 'text-white/45 line-through decoration-red-400' : 'text-white'}`}>
									{last.firstName} {last.lastName}
								</span>
								<span className='text-white/35'>→</span>
								<span className='font-black' style={{ color: SIDE_COLORS[lp.side] }}>
									{state.settings.names[lp.side]}
								</span>
								{lp.vetoed && <span className='rounded-md bg-red-500/20 px-2 py-0.5 text-sm font-black uppercase tracking-widest text-red-300'>Vetoed</span>}
								{lp.price !== undefined && <span className='text-emerald-300 font-black tabular-nums'>${lp.price}</span>}
							</div>
						)}
					</div>
					<Column state={state} side={1} active={actor === 1} arena={arena} />
				</div>
			</div>
		</div>
	);
}
