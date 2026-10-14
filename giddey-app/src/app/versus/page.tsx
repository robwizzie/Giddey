'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { beginDraft, freshPreDraft, initialState, migrateState, nextGame, normalizeSettings, Settings, sideColor, VersusState, DEFAULT_SETTINGS } from '@/lib/versus/engine';
import { loadRivalry, logGame } from '@/lib/versus/rivalry';
import { buildUsage, setUsage } from '@/lib/versus/usage';
import { setHistory } from '@/lib/versus/history';
import { setAnnouncer, setAnnouncerGate } from '@/lib/versus/announcer';
import { setCustomWheels } from '@/lib/versus/wheels';
import { dynastyOpener, homeCourt } from '@/lib/versus/engine';
import { DynastyKeepScreen, LotteryScreen } from '@/components/versus/Dynasty';

/** Rebuild everything derived from the rivalry log for these two coaches */
function rebuildHistory(names: [string, string]) {
	const log = loadRivalry();
	setUsage(buildUsage(log, names));
	setHistory(log, names);
}
import { ThemeScreen, FavoritesScreen } from '@/components/versus/PreDraft';
import HelpSheet from '@/components/versus/HelpSheet';
import LeagueSheet from '@/components/versus/LeagueSheet';
import type { LeagueTag } from '@/lib/versus/league';
import { registerVersusSW } from '@/components/versus/InstallButton';
import LiveSheet, { FxMirror, LivePill, useLive } from '@/components/versus/Live';
import TvBoard from '@/components/versus/TvBoard';
import Icon, { IconTile } from '@/components/versus/Icon';
import PowerRankings from '@/components/versus/PowerRankings';
import CareerSheet from '@/components/versus/CareerSheet';
import HallOfFame from '@/components/versus/HallOfFame';
import { useTurnNotifications } from '@/lib/versus/notify';
import { broadcastState, hostLock, joinRoom, liveAvailable, liveInfo, onRemoteState, parseRoomHash, savedRoom, takenSeats } from '@/lib/versus/live';
import SyncSheet, { ImportPreview } from '@/components/versus/SyncSheet';
import { decodeJson, decodeSync, SyncPayload } from '@/lib/versus/sync';
import { mergeWheels, SharedWheels } from '@/components/versus/CustomWheelsEditor';
import AccountSheet, { useCloud } from '@/components/versus/AccountSheet';
import { cloudEnabled, cloudState, joinRivalry, linkedRivalry, onCloudChange, startCloud, subscribeCloud, syncNow, updateProfile } from '@/lib/versus/cloud';

const JOIN_KEY = 'giddey-versus-join';
import { isMuted, onMuteChange, setMuted, play } from '@/lib/versus/sound';
import SetupScreen, { SettingsForm, settingsValid } from '@/components/versus/SetupScreen';
import DraftScreen from '@/components/versus/DraftScreen';
import BanPhase from '@/components/versus/BanPhase';
import ScoutingPhase from '@/components/versus/ScoutingReport';
import AuctionScreen from '@/components/versus/AuctionScreen';
import { BoostScreen, EqualizerScreen, KeepersScreen, RevealScreen, TradeScreen } from '@/components/versus/PostDraft';
import { GameDayScreen, PostGameScreen } from '@/components/versus/GameDay';
import RivalrySheet from '@/components/versus/RivalrySheet';
import { CoinFlip, Confetti, SectionTitle, setSideColors, SIDE_COLORS } from '@/components/versus/Fx';

const STORAGE_KEY = 'giddey-versus-v1';

function load(): VersusState | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const s = JSON.parse(raw);
		if (s.v !== 1) return null;
		// older saves: fill new settings and convert an in-progress draft
		return migrateState(s);
	} catch {
		return null;
	}
}

function SettingsSheet({ state, onSave, onClose }: { state: VersusState; onSave: (s: Settings) => void; onClose: () => void }) {
	const [s, setS] = useState<Settings>(state.settings);
	const lockDraft = state.phase === 'draft';
	return (
		<div className='fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-28 relative animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-4 sticky -top-4 bg-[#0d1220] py-2 z-10'>
					<div className='flex items-center gap-2 text-lg font-black text-white'>
						<Icon name='settings' className='text-orange-300' /> Series settings
					</div>
					<button onClick={onClose} className='p-2 -mr-2 text-white/50 hover:text-white' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>
				{!lockDraft && state.phase !== 'coin' && (
					<div className='rounded-xl bg-sky-400/10 border border-sky-400/30 text-sky-200 text-xs p-3 mb-4'>Draft changes apply the next time you redraft. Your current squads stay as they are.</div>
				)}
				<SettingsForm s={s} setS={setS} lockDraft={lockDraft} />
				<div className='fixed sm:sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0d1220] via-[#0d1220] to-transparent -mx-4 -mb-28 mt-6'>
					<button
						disabled={!settingsValid(s)}
						onClick={() => onSave(normalizeSettings({ ...s, names: [s.names[0].trim(), s.names[1].trim()] }))}
						className='btn-primary w-full text-white font-black uppercase tracking-wider py-3.5 rounded-2xl disabled:opacity-40'
					>
						Save settings
					</button>
				</div>
			</div>
		</div>
	);
}

function MuteButton() {
	const [muted, setM] = useState(false);
	useEffect(() => {
		setM(isMuted());
		return onMuteChange(setM);
	}, []);
	return (
		<button
			onClick={() => {
				setMuted(!muted);
				if (muted) play('tick');
			}}
			className='w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 flex items-center justify-center'
			aria-label={muted ? 'Unmute sound' : 'Mute sound'}
			title={muted ? 'Unmute' : 'Mute'}
		>
			<Icon name={muted ? 'mute' : 'volume'} size={18} />
		</button>
	);
}

interface TopBarProps {
	onReset: () => void;
	showReset: boolean;
	onSettings: () => void;
	onRivalry: () => void;
	onHelp: () => void;
	onAccount: () => void;
	onLive: () => void;
	onLeagues: () => void;
	onRankings: () => void;
	onCareer: () => void;
	onHall: () => void;
}

/** Everything that isn't needed every minute lives in the ⋯ menu */
function MoreMenu(p: TopBarProps) {
	const [open, setOpen] = useState(false);
	const cloud = useCloud();
	const item = (icon: string, label: string, fn: () => void, sub?: string) => (
		<button
			key={label}
			onClick={() => {
				setOpen(false);
				fn();
			}}
			className='w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/10 rounded-xl'
		>
			<Icon name={icon} size={18} className='w-6 shrink-0 text-orange-300' />
			<span className='min-w-0'>
				<span className='block text-sm font-black text-white'>{label}</span>
				{sub && <span className='block text-[10px] text-white/45'>{sub}</span>}
			</span>
		</button>
	);
	return (
		<div className='relative'>
			<button onClick={() => setOpen(o => !o)} className='relative w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/85' aria-label='More options' title='More options'>
				<Icon name='more' size={18} />
				{cloudEnabled && cloud.session && <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111] ${cloud.error ? 'bg-red-400' : cloud.syncing ? 'bg-amber-300' : 'bg-emerald-400'}`} />}
			</button>
			{open && (
				<>
					<div className='fixed inset-0 z-[60]' onClick={() => setOpen(false)} />
					<div className='absolute right-0 top-10 z-[61] w-64 rounded-2xl border border-white/10 bg-[#0d1220] p-1.5 shadow-2xl animate-fade-in'>
						{item('arena', 'Leagues', p.onLeagues, '3+ friends · standings & playoffs')}
						{item('trophy', 'Power rankings', p.onRankings, 'Skill ratings & biggest upsets')}
						{item('medal', 'Career', p.onCareer, 'Record, titles, badges — share it')}
						{item('shirt', 'Hall of Fame', p.onHall, 'Retired jerseys & belt history')}
						{liveAvailable && item('cast', 'Play on separate devices', p.onLive, 'Each coach on their own phone, plus a TV')}
						{cloudEnabled && item('user', cloud.session ? 'Account' : 'Sign in (optional)', p.onAccount, cloud.session ? (cloud.syncing ? 'Syncing…' : 'Cloud rivalries & sync') : 'Back up & share your rivalries')}
						{item('help', 'How it works', p.onHelp)}
						{p.showReset && item('refresh', 'New series', p.onReset, 'Clears the current teams & score')}
					</div>
				</>
			)}
		</div>
	);
}

function TopBar(p: TopBarProps) {
	return (
		<header className='w-full bg-[#111]/80 border-b border-white/10 px-4 py-2.5 shrink-0'>
			<div className='max-w-3xl mx-auto flex items-center justify-between'>
				<Link href='/' className='flex items-center gap-2 no-underline'>
					<img src='/logo.png' alt='Giddey' className='w-8 h-8 rounded-lg' />
					<span className='hidden min-[400px]:inline text-lg font-black tracking-tight text-white'>GIDDEY</span>
					<span className='text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500 to-sky-500 text-white'>Versus</span>
				</Link>
				<div className='flex items-center gap-1.5'>
					<MuteButton />
					<button onClick={p.onRivalry} className='w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 flex items-center justify-center' aria-label='Rivalry record' title='Rivalry record'>
						<Icon name='chart' size={18} />
					</button>
					{p.showReset && (
						<button onClick={p.onSettings} className='w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 flex items-center justify-center' aria-label='Settings' title='Settings'>
							<Icon name='settings' size={18} />
						</button>
					)}
					<MoreMenu {...p} />
				</div>
			</div>
		</header>
	);
}

export default function VersusPage() {
	const [state, setStateRaw] = useState<VersusState | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [showRivalry, setShowRivalry] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const [showSync, setShowSync] = useState(false);
	// bumps after a sync so open sheets re-read the log
	const [syncs, setSyncs] = useState(0);
	const [showAccount, setShowAccount] = useState(false);
	const [joinCode, setJoinCode] = useState<string | null>(null);
	const [showLeagues, setShowLeagues] = useState(false);
	const [showLive, setShowLive] = useState(false);
	const [showRankings, setShowRankings] = useState(false);
	const [showCareer, setShowCareer] = useState(false);
	const [showHall, setShowHall] = useState(false);
	const live = useLive();
	useTurnNotifications(state);
	const [leagueCode, setLeagueCode] = useState<string | null>(null);
	const [incoming, setIncoming] = useState<SyncPayload | null>(null);
	const [sharedWheels, setSharedWheels] = useState<SharedWheels | null>(null);
	const current = useRef<VersusState | null>(null);

	useEffect(() => {
		const s = load() ?? initialState();
		current.current = s;
		setStateRaw(s);
		registerVersusSW();
		// league invite: open the join screen
		const lm = location.hash.match(/^#league=([A-Za-z0-9]+)/);
		if (lm) {
			setLeagueCode(lm[1].toUpperCase());
			setShowLeagues(true);
			history.replaceState(null, '', location.pathname + location.search);
		}
		// invite link: remember the code through a sign-in redirect
		const jm = location.hash.match(/^#join=([A-Za-z0-9]+)/);
		if (jm) {
			try {
				localStorage.setItem(JOIN_KEY, jm[1].toUpperCase());
			} catch {
				/* ignore */
			}
			history.replaceState(null, '', location.pathname + location.search);
		}
		let pending: string | null = null;
		try {
			pending = localStorage.getItem(JOIN_KEY);
		} catch {
			/* ignore */
		}
		if (pending && cloudEnabled) {
			setJoinCode(pending);
			setShowAccount(true);
		}
		void startCloud();
		// live room: a join / TV link, or the room this phone was in before a refresh
		const room = parseRoomHash(location.hash);
		if (room && liveAvailable) {
			history.replaceState(null, '', location.pathname + location.search);
			void joinRoom(room.code, { role: room.role, side: room.side, host: false });
		} else if (liveAvailable) {
			const saved = savedRoom();
			if (saved) void joinRoom(saved.code, { role: saved.role, side: saved.side, host: saved.host }, saved.host ? s : undefined);
		}
		// someone shared their custom wheels
		if (location.hash.startsWith('#wheels=')) {
			decodeJson<SharedWheels>(location.hash.slice(8)).then(w => {
				if (w?.v === 1 && w.wheels) setSharedWheels(w);
				history.replaceState(null, '', location.pathname + location.search);
			});
		}
		// opened from a sync link: offer to merge it
		if (location.hash.startsWith('#sync=')) {
			decodeSync(location.hash).then(p => {
				if (p) setIncoming(p);
				history.replaceState(null, '', location.pathname + location.search);
			});
		}
	}, []);

	// The log drives freshness, tags, seasons, the line and badges. Rebuild it
	// before rendering whenever the coach names change (new games rebuild in
	// setState) so nothing renders against a stale history.
	const builtFor = useRef('');
	if (state) {
		const key = state.settings.names.join('|');
		if (builtFor.current !== key) {
			rebuildHistory(state.settings.names);
			builtFor.current = key;
		}
	}

	const setState = useCallback((s: VersusState, fromRemote = false) => {
		// a newly recorded game goes into the permanent rivalry log
		const prev = current.current;
		if (prev && s.series.length > prev.series.length) {
			logGame(s.settings, s.series[s.series.length - 1]);
			rebuildHistory(s.settings.names);
			// a league match counts once; the next game is a friendly unless you pick another match
			if (s.settings.league) s = { ...s, settings: { ...s.settings, league: null } };
			// signed in and this pair is a cloud rivalry: upload right away
			if (linkedRivalry(s.settings.names)) void syncNow();
		}
		const screenChanged = !prev || prev.phase !== s.phase;
		current.current = s;
		setStateRaw(s);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
		} catch {
			/* storage full or blocked — the session just won't survive a refresh */
		}
		if (screenChanged) window.scrollTo({ top: 0, behavior: 'smooth' });
		// live room: send every local change to the other phone (and the TV)
		if (!fromRemote) broadcastState(s);
	}, []);

	// live room: a state from the other phone replaces ours
	useEffect(() => onRemoteState(s => setState(migrateState(s as Parameters<typeof migrateState>[0]), true)), [setState]);

	// cloud sync pulled games / favorites: rebuild and fill in franchise guys by name
	useEffect(() => {
		onCloudChange((favs, myNames) => {
			const s = current.current;
			if (!s) return;
			const norm = (n: string) => n.trim().toLowerCase();
			const favorites: [string[], string[]] = [[...s.settings.favorites[0]], [...s.settings.favorites[1]]];
			([0, 1] as const).forEach(seat => {
				const name = s.settings.names[seat];
				const key = Object.keys(favs).find(k => norm(k) === norm(name));
				if (!key) return;
				const mine = myNames.some(n => norm(n) === norm(name));
				// first sign-in: your local pins seed your profile instead of being wiped
				if (mine && !favs[key].length && favorites[seat].length) void updateProfile({ favorites: favorites[seat] }).catch(() => undefined);
				else favorites[seat] = favs[key];
			});
			rebuildHistory(s.settings.names);
			setSyncs(n => n + 1);
			const next = { ...s, settings: { ...s.settings, favorites } };
			current.current = next;
			setStateRaw(next);
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			} catch {
				/* ignore */
			}
		});
	}, []);

	// an invite opened before signing in: join as soon as there's a session
	useEffect(
		() =>
			subscribeCloud(() => {
				const code = (() => {
					try {
						return localStorage.getItem(JOIN_KEY);
					} catch {
						return null;
					}
				})();
				if (!code || !cloudState().session) return;
				try {
					localStorage.removeItem(JOIN_KEY);
				} catch {
					/* ignore */
				}
				joinRivalry(code)
					.then(() => setJoinCode(null))
					.catch(() => setJoinCode(code));
			}),
		[],
	);

	/** Switch tonight's coaches to a cloud rivalry's two names */
	const playRivalry = (names: [string, string], league: LeagueTag | null = null) => {
		const s = current.current;
		if (!s) return;
		setShowAccount(false);
		setShowLeagues(false);
		const same = s.settings.names.map(n => n.trim().toLowerCase()).join('|') === names.map(n => n.trim().toLowerCase()).join('|');
		// same two coaches mid-series: just tag the next game
		if (s.phase === 'setup' || same) return setState({ ...s, settings: { ...s.settings, names, league } });
		if (!confirm(`Start a new series: ${names[0]} vs ${names[1]}? The current teams and series score will be cleared.`)) return;
		setState(initialState({ ...s.settings, names, league }));
	};

	/** After a sync merge: new favorites, and rebuild everything derived from the log */
	const afterSync = (favorites: [string[], string[]]) => {
		const s = current.current;
		if (!s) return;
		rebuildHistory(s.settings.names);
		setSyncs(n => n + 1);
		const next = { ...s, settings: { ...s.settings, favorites } };
		current.current = next;
		setStateRaw(next);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			/* ignore */
		}
	};

	const reset = () => {
		if (!state) return;
		if (state.phase !== 'setup' && !confirm('Start a new series? Current teams and series score will be cleared.')) return;
		setState(initialState(state.settings));
	};

	if (!state) return <div className='min-h-screen' />;
	setAnnouncer(state.settings.announcer);
	// live room: the main screen does the talking (or the host when there's no screen)
	setAnnouncerGate(() => {
		const l = liveInfo();
		if (!l) return true;
		if (l.role === 'screen') return true;
		return l.host && !takenSeats().screens;
	});
	setCustomWheels(state.settings.custom);
	// coaches' chosen colors feed every component that reads SIDE_COLORS
	setSideColors([sideColor(state.settings, 0), sideColor(state.settings, 1)]);

	const showReset = state.phase !== 'setup';
	const wrap = (node: React.ReactNode) => (
		<div className='min-h-screen vs-bg'>
			<TopBar onReset={reset} showReset={showReset} onSettings={() => setShowSettings(true)} onRivalry={() => setShowRivalry(true)} onHelp={() => setShowHelp(true)} onAccount={() => setShowAccount(true)} onLive={() => setShowLive(true)} onLeagues={() => setShowLeagues(true)} onRankings={() => setShowRankings(true)} onCareer={() => setShowCareer(true)} onHall={() => setShowHall(true)} />
			{live && (
				<div className='max-w-3xl mx-auto px-4 pt-2 flex justify-end'>
					<LivePill names={state.settings.names} onClick={() => setShowLive(true)} />
				</div>
			)}
			{/* keyed by phase so every screen change animates in */}
			<div key={state.phase} className='vs-screen'>
				{node}
			</div>
			{showHelp && <HelpSheet settings={state.settings} onClose={() => setShowHelp(false)} />}
			{showRivalry && <RivalrySheet key={syncs} settings={state.settings} retired={state.retired} onClose={() => setShowRivalry(false)} onSync={() => setShowSync(true)} />}
			{showRankings && <PowerRankings highlight={[...state.settings.names]} onClose={() => setShowRankings(false)} />}
			{showCareer && <CareerSheet initial={state.settings.names[0]} onClose={() => setShowCareer(false)} />}
			{showHall && <HallOfFame names={state.settings.names} onClose={() => setShowHall(false)} />}
			{live && <FxMirror />}
			{showLive && <LiveSheet state={state} onClose={() => setShowLive(false)} />}
			{showLeagues && <LeagueSheet seedNames={[...state.settings.names]} joinCode={leagueCode} onPlay={(names, tag) => playRivalry(names, tag)} onClose={() => { setShowLeagues(false); setLeagueCode(null); }} />}
			{showAccount && <AccountSheet settings={state.settings} joinCode={joinCode} onPlay={playRivalry} onClose={() => setShowAccount(false)} />}
			{showSync && <SyncSheet settings={state.settings} onClose={() => setShowSync(false)} onImported={afterSync} />}
			{sharedWheels &&
				(() => {
					const { merged, added } = mergeWheels(state.settings.custom, sharedWheels.wheels);
					const w = sharedWheels.wheels;
					return (
						<div className='fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={() => setSharedWheels(null)}>
							<div className='w-full max-w-md bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up' onClick={e => e.stopPropagation()}>
								<div className='flex justify-center mb-2'>
									<IconTile name='wheel' color='#f97316' size={48} />
								</div>
								<div className='text-lg font-black text-white text-center'>{sharedWheels.from} shared their wheels</div>
								<div className='text-sm text-white/65 text-center mb-4'>
									{[`${w.challenges?.length ?? 0} challenges`, `${w.sabotages?.length ?? 0} sabotages`, `${w.twists?.length ?? 0} twists`, `${w.halftime?.length ?? 0} halftime rules`, `${w.punishments?.length ?? 0} punishments`].join(' · ')}
								</div>
								<div className='flex gap-2'>
									<button onClick={() => setSharedWheels(null)} className='rounded-2xl px-4 py-3 font-bold text-sm bg-white/10 text-white/70'>
										No thanks
									</button>
									<button
										onClick={() => {
											const next = { ...state, settings: { ...state.settings, custom: merged } };
											current.current = next;
											setStateRaw(next);
											try {
												localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
											} catch {
												/* ignore */
											}
											setSharedWheels(null);
										}}
										className='flex-1 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white'
									>
										{added ? `Add ${added} to my wheels` : 'Already have them ✓'}
									</button>
								</div>
							</div>
						</div>
					);
				})()}
			{incoming && (
				<ImportPreview
					payload={incoming}
					settings={state.settings}
					onCancel={() => setIncoming(null)}
					onDone={favs => {
						setIncoming(null);
						afterSync(favs);
						setShowRivalry(true);
					}}
				/>
			)}
			{showSettings && (
				<SettingsSheet
					state={state}
					onClose={() => setShowSettings(false)}
					onSave={settings => {
						// your franchise guys follow your account
						const r = linkedRivalry(settings.names);
						const me = cloudState().profile;
						if (r && me) {
							const seat = settings.names.findIndex(n => n.trim().toLowerCase() === r.names[r.mySeat].trim().toLowerCase());
							if (seat >= 0 && settings.favorites[seat].join() !== me.favorites.join()) void updateProfile({ favorites: settings.favorites[seat] }).catch(() => undefined);
						}
						const next = { ...state, settings };
						current.current = next;
						setStateRaw(next);
						try {
							localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
						} catch {
							/* ignore */
						}
						setShowSettings(false);
					}}
				/>
			)}
		</div>
	);

	switch (state.phase) {
		case 'setup':
			if (live && !live.host)
				return wrap(
					<div className='max-w-md mx-auto px-4 pt-16 text-center'>
						<Icon name='radio' size={48} className='mx-auto mb-3 text-sky-300' />
						<div className='text-xl font-black text-white'>Connected to room {live.code}</div>
						<div className='text-sm text-white/55 mt-1'>{live.connected ? `${hostLock(state.settings.names) ?? 'The host'} is setting up the draft — it starts here automatically.` : 'Connecting…'}</div>
					</div>,
				);
			return wrap(<SetupScreen key={JSON.stringify([state.settings.names, state.settings.league, syncs])} initial={state.settings ?? DEFAULT_SETTINGS} onRivalry={() => setShowRivalry(true)} onHelp={() => setShowHelp(true)} onLeagues={() => setShowLeagues(true)} onStart={(settings: Settings) => setState({ ...state, settings, phase: 'coin', coinWinner: null })} />);
		case 'coin': {
			// live room: the host flips and starts the draft
			if (live && !live.host)
				return wrap(
					<div className='max-w-md mx-auto px-4 pt-16 text-center'>
						<Icon name='coins' size={48} className='mx-auto mb-3 text-amber-300' />
						<div className='text-xl font-black text-white'>Coin toss</div>
						<div className='text-sm text-white/55 mt-1'>{state.coinWinner !== null ? `${state.settings.names[state.coinWinner]} picks first — waiting for the draft to start…` : `${hostLock(state.settings.names) ?? 'The host'} is flipping the coin…`}</div>
					</div>,
				);
			// Dynasty season opener: the lottery replaces the coin flip
			if (dynastyOpener(state)) return wrap(<LotteryScreen state={state} setState={setState} />);
			// Finals: the higher seed has home court — no coin flip
			const seed = homeCourt(state);
			if (seed !== null)
				return wrap(
					<div className='max-w-3xl mx-auto px-4 pt-10 flex flex-col items-center text-center animate-fade-in'>
						<SectionTitle kicker='The Finals' title='Home court' sub='The higher seed from the regular season picks first in every Finals draft.' />
						<Icon name='home' size={64} className='mb-3' style={{ color: SIDE_COLORS[seed] }} />
						<div className='text-3xl font-black' style={{ color: SIDE_COLORS[seed] }}>
							{state.settings.names[seed]} picks first
						</div>
						<button onClick={() => setState(beginDraft(freshPreDraft({ ...state, coinWinner: seed })))} className='mt-6 btn-primary text-white font-black uppercase tracking-wider px-10 py-4 rounded-2xl text-lg'>
							Start the draft →
						</button>
						<button onClick={() => setState({ ...state, phase: 'setup' })} className='mt-8 text-xs text-white/35 underline'>
							← Back to settings
						</button>
					</div>
				);
			return wrap(
				<div className='max-w-3xl mx-auto px-4 pt-10 flex flex-col items-center animate-fade-in'>
					<SectionTitle kicker='Coin toss' title='Who picks first?' sub='Winner gets the first pick of round 1.' />
					<CoinFlip mirror names={state.settings.names} onResult={w => setState({ ...state, coinWinner: w })} />
					{state.coinWinner !== null && (
						<>
							<Confetti count={50} colors={[SIDE_COLORS[state.coinWinner], '#ffffff']} />
							<div className='mt-6 text-center vs-rise'>
								<div className='text-3xl font-black' style={{ color: SIDE_COLORS[state.coinWinner] }}>
									{state.settings.names[state.coinWinner]} picks first
								</div>
								<button onClick={() => setState(beginDraft(freshPreDraft({ ...state })))} className='mt-5 btn-primary text-white font-black uppercase tracking-wider px-10 py-4 rounded-2xl text-lg'>
									Start the draft →
								</button>
							</div>
						</>
					)}
					<button onClick={() => setState({ ...state, phase: 'setup' })} className='mt-8 text-xs text-white/35 underline'>
						← Back to settings
					</button>
				</div>
			);
		}
		case 'lottery':
			return wrap(<LotteryScreen state={state} setState={setState} />);
		case 'dynasty':
			return wrap(<DynastyKeepScreen state={state} setState={setState} />);
		case 'theme':
			return wrap(<ThemeScreen state={state} setState={setState} />);
		case 'favorites':
			return wrap(<FavoritesScreen state={state} setState={setState} />);
		case 'keepers':
			return wrap(<KeepersScreen state={state} setState={setState} />);
		case 'bans':
			return wrap(<BanPhase state={state} setState={setState} />);
		case 'board':
			return wrap(<ScoutingPhase state={state} setState={setState} />);
		case 'draft':
			if (live?.role === 'screen') return wrap(<TvBoard state={state} />);
			return wrap(state.draft?.auction ? <AuctionScreen state={state} setState={setState} /> : <DraftScreen state={state} setState={setState} />);
		case 'equalizer':
			return wrap(<EqualizerScreen state={state} setState={setState} />);
		case 'trade':
			return wrap(<TradeScreen state={state} setState={setState} />);
		case 'boosts':
			return wrap(<BoostScreen state={state} setState={setState} />);
		case 'reveal':
			return wrap(<RevealScreen state={state} onNext={() => setState({ ...state, phase: 'gameday' })} />);
		case 'gameday':
			return wrap(<GameDayScreen state={state} setState={setState} />);
		case 'postgame':
			return wrap(
				<PostGameScreen
					state={state}
					setState={setState}
					onRunBack={() => setState(nextGame(state, false))}
					onRedraft={() => setState(nextGame(state, true))}
					onNewSeries={() => {
						if (confirm('End the series and start over?')) setState(initialState(state.settings));
					}}
					onLeagues={() => setShowLeagues(true)}
				/>
			);
	}
}
