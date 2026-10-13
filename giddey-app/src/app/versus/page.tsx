'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { buildBlueprint, initialState, nextGame, normalizeSettings, Settings, startDraft, VersusState, DEFAULT_SETTINGS } from '@/lib/versus/engine';
import SetupScreen, { SettingsForm, settingsValid } from '@/components/versus/SetupScreen';
import DraftScreen from '@/components/versus/DraftScreen';
import { BoostScreen, EqualizerScreen, RevealScreen, TradeScreen } from '@/components/versus/PostDraft';
import { GameDayScreen, PostGameScreen } from '@/components/versus/GameDay';
import { CoinFlip, Confetti, SectionTitle, SIDE_COLORS } from '@/components/versus/Fx';

const STORAGE_KEY = 'giddey-versus-v1';

function load(): VersusState | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const s = JSON.parse(raw) as VersusState;
		if (s.v !== 1) return null;
		// saves from before custom tiers: fill new settings and pin the in-progress draft's rounds
		const settings = normalizeSettings(s.settings);
		const draft = s.draft && !s.draft.blueprint ? { ...s.draft, blueprint: buildBlueprint({ ...settings, shuffleRounds: false }) } : s.draft;
		return { ...s, settings, draft };
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

function TopBar({ onReset, showReset, onSettings }: { onReset: () => void; showReset: boolean; onSettings: () => void }) {
	return (
		<header className='w-full bg-[#111]/80 border-b border-white/10 px-4 py-2.5 shrink-0'>
			<div className='max-w-3xl mx-auto flex items-center justify-between'>
				<Link href='/' className='flex items-center gap-2 no-underline'>
					<img src='/logo.png' alt='Giddey' className='w-8 h-8 rounded-lg' />
					<span className='text-lg font-black tracking-tight text-white'>GIDDEY</span>
					<span className='text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500 to-sky-500 text-white'>Versus</span>
				</Link>
				{showReset && (
					<div className='flex items-center gap-3'>
						<button onClick={onSettings} className='text-xs font-bold text-white/60 hover:text-white rounded-lg bg-white/10 px-2.5 py-1.5'>
							⚙️ Settings
						</button>
						<button onClick={onReset} className='text-xs font-bold text-white/40 hover:text-white/80'>
							New series
						</button>
					</div>
				)}
			</div>
		</header>
	);
}

export default function VersusPage() {
	const [state, setStateRaw] = useState<VersusState | null>(null);
	const [showSettings, setShowSettings] = useState(false);

	useEffect(() => {
		setStateRaw(load() ?? initialState());
	}, []);

	const setState = useCallback((s: VersusState) => {
		setStateRaw(s);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
		} catch {
			/* storage full or blocked — the session just won't survive a refresh */
		}
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}, []);

	const reset = () => {
		if (!state) return;
		if (state.phase !== 'setup' && !confirm('Start a new series? Current teams and series score will be cleared.')) return;
		setState(initialState(state.settings));
	};

	if (!state) return <div className='min-h-screen' />;

	const showReset = state.phase !== 'setup';
	const wrap = (node: React.ReactNode) => (
		<div className='min-h-screen vs-bg'>
			<TopBar onReset={reset} showReset={showReset} onSettings={() => setShowSettings(true)} />
			{node}
			{showSettings && (
				<SettingsSheet
					state={state}
					onClose={() => setShowSettings(false)}
					onSave={settings => {
						setStateRaw({ ...state, settings });
						try {
							localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, settings }));
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
			return wrap(<SetupScreen initial={state.settings ?? DEFAULT_SETTINGS} onStart={(settings: Settings) => setState({ ...state, settings, phase: 'coin', coinWinner: null })} />);
		case 'coin':
			return wrap(
				<div className='max-w-3xl mx-auto px-4 pt-10 flex flex-col items-center animate-fade-in'>
					<SectionTitle kicker='Coin toss' title='Who picks first?' sub='Winner gets the first pick of round 1.' />
					<CoinFlip names={state.settings.names} onResult={w => setStateRaw({ ...state, coinWinner: w })} />
					{state.coinWinner !== null && (
						<>
							<Confetti count={50} colors={[SIDE_COLORS[state.coinWinner], '#ffffff']} />
							<div className='mt-6 text-center vs-rise'>
								<div className='text-3xl font-black' style={{ color: SIDE_COLORS[state.coinWinner] }}>
									{state.settings.names[state.coinWinner]} picks first
								</div>
								<button onClick={() => setState(startDraft({ ...state }))} className='mt-5 btn-primary text-white font-black uppercase tracking-wider px-10 py-4 rounded-2xl text-lg'>
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
		case 'draft':
			return wrap(<DraftScreen state={state} setState={setState} />);
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
					onRunBack={() => setState(nextGame(state, false))}
					onRedraft={() => setState(nextGame(state, true))}
					onNewSeries={() => {
						if (confirm('End the series and start over?')) setState(initialState(state.settings));
					}}
				/>
			);
	}
}
