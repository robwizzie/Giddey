'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { beginDraft, freshPreDraft, initialState, migrateState, nextGame, normalizeSettings, Settings, sideColor, VersusState, DEFAULT_SETTINGS } from '@/lib/versus/engine';
import { loadRivalry, logGame } from '@/lib/versus/rivalry';
import { buildUsage, setUsage } from '@/lib/versus/usage';
import { setHistory } from '@/lib/versus/history';
import { setAnnouncer } from '@/lib/versus/announcer';
import { homeCourt } from '@/lib/versus/engine';

/** Rebuild everything derived from the rivalry log for these two coaches */
function rebuildHistory(names: [string, string]) {
	const log = loadRivalry();
	setUsage(buildUsage(log, names));
	setHistory(log, names);
}
import { ThemeScreen, FavoritesScreen } from '@/components/versus/PreDraft';
import HelpSheet from '@/components/versus/HelpSheet';
import { registerVersusSW } from '@/components/versus/InstallButton';
import SyncSheet, { ImportPreview } from '@/components/versus/SyncSheet';
import { decodeSync, SyncPayload } from '@/lib/versus/sync';
import { isMuted, onMuteChange, setMuted, play } from '@/lib/versus/sound';
import SetupScreen, { SettingsForm, settingsValid } from '@/components/versus/SetupScreen';
import DraftScreen from '@/components/versus/DraftScreen';
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
					<div className='text-lg font-black text-white'>⚙️ Series settings</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
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
			className='w-8 h-8 rounded-lg bg-white/10 text-sm flex items-center justify-center'
			aria-label={muted ? 'Unmute sound' : 'Mute sound'}
			title={muted ? 'Unmute' : 'Mute'}
		>
			{muted ? '🔇' : '🔊'}
		</button>
	);
}

function TopBar({ onReset, showReset, onSettings, onRivalry, onHelp }: { onReset: () => void; showReset: boolean; onSettings: () => void; onRivalry: () => void; onHelp: () => void }) {
	return (
		<header className='w-full bg-[#111]/80 border-b border-white/10 px-4 py-2.5 shrink-0'>
			<div className='max-w-3xl mx-auto flex items-center justify-between'>
				<Link href='/' className='flex items-center gap-2 no-underline'>
					<img src='/logo.png' alt='Giddey' className='w-8 h-8 rounded-lg' />
					<span className='hidden min-[430px]:inline text-lg font-black tracking-tight text-white'>GIDDEY</span>
					<span className='text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500 to-sky-500 text-white'>Versus</span>
				</Link>
				<div className='flex items-center gap-1.5'>
					<MuteButton />
					<button onClick={onHelp} className='w-8 h-8 rounded-lg bg-white/10 text-sm flex items-center justify-center' aria-label='How Versus works' title='How it works'>
						❓
					</button>
					<button onClick={onRivalry} className='w-8 h-8 rounded-lg bg-white/10 text-sm flex items-center justify-center' aria-label='Rivalry record' title='Rivalry record'>
						📊
					</button>
					{showReset && (
						<>
							<button onClick={onSettings} className='w-8 h-8 rounded-lg bg-white/10 text-sm flex items-center justify-center' aria-label='Settings' title='Settings'>
								⚙️
							</button>
							<button onClick={onReset} className='text-[11px] font-bold text-white/40 hover:text-white/80 pl-1.5'>
								New series
							</button>
						</>
					)}
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
	const [incoming, setIncoming] = useState<SyncPayload | null>(null);
	const current = useRef<VersusState | null>(null);

	useEffect(() => {
		const s = load() ?? initialState();
		current.current = s;
		setStateRaw(s);
		registerVersusSW();
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

	const setState = useCallback((s: VersusState) => {
		// a newly recorded game goes into the permanent rivalry log
		const prev = current.current;
		if (prev && s.series.length > prev.series.length) {
			logGame(s.settings, s.series[s.series.length - 1]);
			rebuildHistory(s.settings.names);
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
	}, []);

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
	// coaches' chosen colors feed every component that reads SIDE_COLORS
	setSideColors([sideColor(state.settings, 0), sideColor(state.settings, 1)]);

	const showReset = state.phase !== 'setup';
	const wrap = (node: React.ReactNode) => (
		<div className='min-h-screen vs-bg'>
			<TopBar onReset={reset} showReset={showReset} onSettings={() => setShowSettings(true)} onRivalry={() => setShowRivalry(true)} onHelp={() => setShowHelp(true)} />
			{/* keyed by phase so every screen change animates in */}
			<div key={state.phase} className='vs-screen'>
				{node}
			</div>
			{showHelp && <HelpSheet settings={state.settings} onClose={() => setShowHelp(false)} />}
			{showRivalry && <RivalrySheet key={syncs} settings={state.settings} retired={state.retired} onClose={() => setShowRivalry(false)} onSync={() => setShowSync(true)} />}
			{showSync && <SyncSheet settings={state.settings} onClose={() => setShowSync(false)} onImported={afterSync} />}
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
			return wrap(<SetupScreen initial={state.settings ?? DEFAULT_SETTINGS} onRivalry={() => setShowRivalry(true)} onHelp={() => setShowHelp(true)} onStart={(settings: Settings) => setState({ ...state, settings, phase: 'coin', coinWinner: null })} />);
		case 'coin': {
			// Finals: the higher seed has home court — no coin flip
			const seed = homeCourt(state);
			if (seed !== null)
				return wrap(
					<div className='max-w-3xl mx-auto px-4 pt-10 flex flex-col items-center text-center animate-fade-in'>
						<SectionTitle kicker='The Finals' title='Home court' sub='The higher seed from the regular season picks first in every Finals draft.' />
						<div className='text-7xl mb-2'>🏠</div>
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
					<CoinFlip names={state.settings.names} onResult={w => setState({ ...state, coinWinner: w })} />
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
		case 'theme':
			return wrap(<ThemeScreen state={state} setState={setState} />);
		case 'favorites':
			return wrap(<FavoritesScreen state={state} setState={setState} />);
		case 'keepers':
			return wrap(<KeepersScreen state={state} setState={setState} />);
		case 'draft':
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
				/>
			);
	}
}
