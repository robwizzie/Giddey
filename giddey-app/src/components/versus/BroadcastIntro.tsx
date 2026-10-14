'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { other, players, Side, teamIcon, teamName, teamOvr, VersusState } from '@/lib/versus/engine';
import { history } from '@/lib/versus/history';
import { belt } from '@/lib/versus/legacy';
import { nextSeasonTag, seasonLabel } from '@/lib/versus/seasons';
import { vegasLine } from '@/lib/versus/vegas';
import { buzz, play } from '@/lib/versus/sound';
import VersusCard from './VersusCard';
import Icon, { IconTile } from './Icon';
import { SIDE_COLORS } from './Fx';

// ═══════════════════════════════════════════════════════════════
//  BROADCAST INTRO — a TV-style open before tip-off: title card,
//  tale of the tape, then each coach walks out. Tap to advance.
// ═══════════════════════════════════════════════════════════════

type Scene = 'title' | 'tape' | 'walk0' | 'walk1';
const SCENES: Scene[] = ['title', 'tape', 'walk0', 'walk1'];
const DURATION: Record<Scene, number> = { title: 3600, tape: 8000, walk0: 2900, walk1: 2900 };

// slide-ins for the broadcast package (scoped names so nothing else picks them up)
const CSS = `
@keyframes biInL { from { opacity: 0; transform: translateX(-48px); } to { opacity: 1; transform: none; } }
@keyframes biInR { from { opacity: 0; transform: translateX(48px); } to { opacity: 1; transform: none; } }
@keyframes biBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes biSweep { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(260%) skewX(-20deg); } }
@keyframes biProg { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.bi-in-l { animation: biInL 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
.bi-in-r { animation: biInR 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
.bi-bar { animation: biBar 0.45s cubic-bezier(0.2, 0.9, 0.3, 1) both; transform-origin: left; }
.bi-sweep { animation: biSweep 1.6s ease-in-out 0.3s both; }
@media (prefers-reduced-motion: reduce) {
	.bi-in-l, .bi-in-r, .bi-bar, .bi-sweep { animation: none !important; }
}
`;

interface Tape {
	tag: string;
	games: number;
	wins: [number, number];
	/** current streak: who and how long */
	streak: { side: Side; n: number } | null;
	belt: { holder: Side; defenses: number } | null;
	lastMeeting: string | null;
	ovr: [number, number];
	best: [ReturnType<typeof players>, ReturnType<typeof players>];
	line: string | null;
}

function tape(state: VersusState): Tape {
	const { names } = state.settings;
	const h = history();
	const wins: [number, number] = [h.filter(g => g.winner === 0).length, h.filter(g => g.winner === 1).length];
	let streak: Tape['streak'] = null;
	if (h.length) {
		const side = h[h.length - 1].winner;
		let n = 0;
		for (let i = h.length - 1; i >= 0 && h[i].winner === side; i--) n++;
		streak = { side, n };
	}
	const b = belt(h);
	const last = h[h.length - 1];
	const lastMeeting = last
		? `${names[last.winner]} won${last.score[0] !== null && last.score[1] !== null ? ` ${Math.max(last.score[0], last.score[1])}–${Math.min(last.score[0], last.score[1])}` : ''}`
		: null;
	const tag = seasonLabel(nextSeasonTag(h, state.settings)) || `Game ${state.gameNo}${state.series.length ? ' of the series' : ''}`;
	const line = state.settings.vegas ? (() => {
		const l = vegasLine(state, h);
		return `${names[l.fav]} −${l.spread}`;
	})() : null;
	const best = ([0, 1] as Side[]).map(s => players(state.teams[s]).sort((a, b) => b.overall - a.overall).slice(0, 3)) as Tape['best'];
	return { tag, games: h.length, wins, streak, belt: b ? { holder: b.holder, defenses: b.defenses } : null, lastMeeting, ovr: [teamOvr(state.teams[0]), teamOvr(state.teams[1])], best, line };
}

/** A lower-third bar: colored tab + label + text */
function LowerThird({ label, children, color = '#f97316', delay = 0 }: { label: string; children: React.ReactNode; color?: string; delay?: number }) {
	return (
		<div className='flex items-stretch overflow-hidden rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.5)] bi-in-l' style={{ animationDelay: `${delay}s` }}>
			<div className='px-2.5 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-black flex items-center shrink-0' style={{ background: color }}>
				{label}
			</div>
			<div className='px-3 py-1.5 text-[13px] sm:text-base font-black text-white bg-[#0b1020]/95 border-y border-r border-white/10 flex items-center min-w-0 bi-bar' style={{ animationDelay: `${delay + 0.1}s` }}>
				<span className='truncate'>{children}</span>
			</div>
		</div>
	);
}

/** One tale-of-the-tape row: left value, label, right value */
function TapeRow({ label, a, b, lead, delay }: { label: string; a: React.ReactNode; b: React.ReactNode; lead?: Side | null; delay: number }) {
	return (
		<div className='grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-b border-white/10'>
			<div className={`text-right text-lg sm:text-2xl font-black tabular-nums bi-in-l ${lead === 0 ? 'text-white' : 'text-white/60'}`} style={{ animationDelay: `${delay}s` }}>
				{a}
			</div>
			<div className='text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-white/45 text-center w-20 sm:w-28'>{label}</div>
			<div className={`text-left text-lg sm:text-2xl font-black tabular-nums bi-in-r ${lead === 1 ? 'text-white' : 'text-white/60'}`} style={{ animationDelay: `${delay}s` }}>
				{b}
			</div>
		</div>
	);
}

export default function BroadcastIntro({ state, onDone }: { state: VersusState; onDone: () => void }) {
	const { names } = state.settings;
	const t = useMemo(() => tape(state), [state]);
	const [scene, setScene] = useState(0);
	const [cardW] = useState(() => (typeof window === 'undefined' ? 56 : Math.max(46, Math.min(96, Math.floor((window.innerWidth - 56) / 6.6)))));
	const cur = SCENES[scene];

	const next = () => {
		buzz(8);
		if (scene >= SCENES.length - 1) onDone();
		else setScene(scene + 1);
	};

	useEffect(() => {
		const id = setTimeout(() => (scene >= SCENES.length - 1 ? onDone() : setScene(scene + 1)), DURATION[cur]);
		if (cur === 'title') play('whoosh');
		if (cur === 'tape') play('reveal');
		if (cur === 'walk0' || cur === 'walk1') play('crowd');
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scene]);

	if (typeof document === 'undefined') return null;

	const walk = (side: Side) => {
		const ws = t.wins[side];
		const ls = t.wins[other(side)];
		return (
			<div key={`walk${side}`} className='absolute inset-0 flex flex-col items-center justify-center px-5 text-center overflow-hidden' style={{ background: `radial-gradient(ellipse at 50% 38%, ${SIDE_COLORS[side]}66, #05070d 65%)` }}>
				{/* spotlight sweep */}
				<div className='absolute top-0 bottom-0 left-0 w-1/3 bi-sweep pointer-events-none' style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />
				<div className='text-[11px] sm:text-sm font-black uppercase tracking-[0.4em] text-white/55 vs-rise'>{side === 0 ? 'Making their way out' : 'And their opponent'}</div>
				<div className='mt-4 vs-pop'>
					<IconTile name={teamIcon(state.settings, side)} color={SIDE_COLORS[side]} size={96} className='rounded-3xl' />
				</div>
				<div className={`mt-3 ${names[side].length > 9 ? 'text-4xl sm:text-6xl' : 'text-6xl sm:text-8xl'} font-black uppercase leading-none tracking-tight vs-zoom-in break-words max-w-full`} style={{ color: SIDE_COLORS[side], textShadow: `0 0 40px ${SIDE_COLORS[side]}88` }}>
					{names[side]}
				</div>
				<div className='mt-2 text-lg sm:text-2xl font-black text-white/85 vs-rise' style={{ animationDelay: '0.35s' }}>
					{teamName(state.settings, side)}
				</div>
				<div className='absolute left-4 right-4 bottom-16 sm:bottom-20 flex flex-col items-start gap-1.5 max-w-xl mx-auto'>
					<LowerThird label='Coach' color={SIDE_COLORS[side]} delay={0.5}>
						{names[side]} · {t.ovr[side].toFixed(1)} OVR
					</LowerThird>
					{t.games > 0 && (
						<LowerThird label='Head to head' color='#ffffff' delay={0.7}>
							{ws}–{ls}
							{t.belt?.holder === side ? ` · Belt holder${t.belt.defenses ? `, ${t.belt.defenses} defense${t.belt.defenses === 1 ? '' : 's'}` : ''}` : ''}
						</LowerThird>
					)}
				</div>
			</div>
		);
	};

	return createPortal(
		<div className='fixed inset-0 z-[96] bg-[#05070d] text-white overflow-hidden select-none animate-fade-in' onClick={next} role='dialog' aria-label='Broadcast intro'>
			<style>{CSS}</style>

			{cur === 'title' && (
				<div key='title' className='absolute inset-0 flex flex-col items-center justify-center px-6 text-center' style={{ background: `linear-gradient(115deg, ${SIDE_COLORS[0]}40, #05070d 45%, #05070d 55%, ${SIDE_COLORS[1]}40)` }}>
					<div className='absolute top-0 bottom-0 left-0 w-1/3 bi-sweep pointer-events-none' style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />
					<div className='text-xs sm:text-base font-black uppercase tracking-[0.5em] text-white/60 vs-rise'>Tonight on</div>
					<div className='mt-2 text-5xl sm:text-8xl font-black tracking-tight leading-none vs-zoom-in'>
						GIDDEY <span className='text-orange-500'>VERSUS</span>
					</div>
					<div className='mt-5 flex items-center gap-3 text-2xl sm:text-4xl font-black vs-rise' style={{ animationDelay: '0.5s' }}>
						<span style={{ color: SIDE_COLORS[0] }}>{names[0]}</span>
						<span className='text-white/35 text-lg sm:text-2xl'>vs</span>
						<span style={{ color: SIDE_COLORS[1] }}>{names[1]}</span>
					</div>
					<div className='mt-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-black uppercase tracking-widest bg-yellow-400 text-black vs-pop' style={{ animationDelay: '0.9s' }}>
						<Icon name={t.tag.includes('Finals') ? 'trophy' : 'calendar'} />
						{t.tag}
					</div>
				</div>
			)}

			{cur === 'tape' && (
				<div key='tape' className='absolute inset-0 flex flex-col items-center justify-center px-4 py-16 overflow-y-auto'>
					<div className='w-full max-w-2xl'>
						<div className='flex items-center justify-center gap-2 mb-3 bi-in-l'>
							<div className='h-px flex-1 bg-gradient-to-r from-transparent to-white/30' />
							<div className='text-[11px] sm:text-sm font-black uppercase tracking-[0.4em] text-yellow-300'>Tale of the tape</div>
							<div className='h-px flex-1 bg-gradient-to-l from-transparent to-white/30' />
						</div>
						<div className='grid grid-cols-[1fr_auto_1fr] items-end gap-2 mb-2'>
							{([0, 1] as Side[]).map(side => (
								<div key={side} className={`flex flex-col ${side ? 'items-start bi-in-r col-start-3' : 'items-end bi-in-l'} min-w-0`}>
									<div className='text-2xl sm:text-4xl font-black leading-none truncate max-w-full' style={{ color: SIDE_COLORS[side] }}>
										{names[side]}
									</div>
									<div className='text-[10px] sm:text-xs font-bold text-white/50 truncate max-w-full'>{teamName(state.settings, side)}</div>
								</div>
							))}
						</div>
						<TapeRow label='Team OVR' a={t.ovr[0].toFixed(1)} b={t.ovr[1].toFixed(1)} lead={t.ovr[0] === t.ovr[1] ? null : t.ovr[0] > t.ovr[1] ? 0 : 1} delay={0.15} />
						<TapeRow label='Head to head' a={t.wins[0]} b={t.wins[1]} lead={t.wins[0] === t.wins[1] ? null : t.wins[0] > t.wins[1] ? 0 : 1} delay={0.3} />
						<TapeRow label='Streak' a={t.streak?.side === 0 ? `W${t.streak.n}` : t.streak ? `L${t.streak.n}` : '—'} b={t.streak?.side === 1 ? `W${t.streak.n}` : t.streak ? `L${t.streak.n}` : '—'} lead={t.streak?.side ?? null} delay={0.45} />
						<TapeRow
							label='Belt'
							a={t.belt?.holder === 0 ? <span className='text-yellow-300'><Icon name='award' className='mr-1' />{t.belt.defenses ? `${t.belt.defenses} def` : 'Champ'}</span> : '—'}
							b={t.belt?.holder === 1 ? <span className='text-yellow-300'><Icon name='award' className='mr-1' />{t.belt.defenses ? `${t.belt.defenses} def` : 'Champ'}</span> : '—'}
							lead={t.belt?.holder ?? null}
							delay={0.6}
						/>
						<div className='grid grid-cols-2 gap-3 mt-4'>
							{([0, 1] as Side[]).map(side => (
								<div key={side} className={`flex gap-1.5 ${side ? 'justify-start' : 'justify-end'}`}>
									{t.best[side].map((p, i) => (
										<div key={p.id} className='vs-deal' style={{ animationDelay: `${0.8 + i * 0.15 + side * 0.1}s` }}>
											<VersusCard player={p} width={cardW} />
										</div>
									))}
								</div>
							))}
						</div>
						<div className='mt-4 flex flex-col items-start gap-1.5'>
							<LowerThird label='Last meeting' color='#38bdf8' delay={1.4}>
								{t.lastMeeting ?? 'First ever meeting'}
							</LowerThird>
							{t.line && (
								<LowerThird label='Vegas' color='#34d399' delay={1.6}>
									{t.line}
								</LowerThird>
							)}
						</div>
					</div>
				</div>
			)}

			{cur === 'walk0' && walk(0)}
			{cur === 'walk1' && walk(1)}

			{/* broadcast chrome */}
			<div className='absolute top-0 left-0 right-0 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none'>
				<div className='flex items-center gap-2'>
					<span className='inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-red-600 text-white'>
						<span className='w-1.5 h-1.5 rounded-full bg-white vs-blink' />
						Live
					</span>
					<span className='text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-white/60'>Giddey Versus</span>
				</div>
				<button
					onClick={e => {
						e.stopPropagation();
						onDone();
					}}
					className='pointer-events-auto min-h-[36px] rounded-full px-4 text-xs font-black uppercase tracking-wider bg-white/10 border border-white/20 text-white/80 inline-flex items-center gap-1'
				>
					Skip
					<Icon name='chevronRight' />
				</button>
			</div>
			<div className='absolute bottom-0 left-0 right-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none'>
				<div className='flex items-center gap-1.5 justify-center mb-2'>
					{SCENES.map((s, i) => (
						<div key={s} className='h-1 w-10 rounded-full bg-white/15 overflow-hidden'>
							{i < scene ? <div className='h-full bg-white/70' /> : i === scene ? <div key={scene} className='h-full bg-white/70 origin-left' style={{ animation: `biProg ${DURATION[s]}ms linear both` }} /> : null}
						</div>
					))}
				</div>
				<div className='text-center text-[10px] text-white/35 font-bold'>Tap to skip ahead</div>
			</div>
		</div>,
		document.body,
	);
}
