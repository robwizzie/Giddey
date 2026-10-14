'use client';

import { useEffect, useState } from 'react';
import { LiveGate } from './Live';
import { afterLottery, chooseDynastyKeeps, DYNASTY_KEEPS, lotteryBalls, other, players, runLottery, Side, VersusState } from '@/lib/versus/engine';
import { getVersusPlayer } from '@/lib/versus/pool';
import { announce } from '@/lib/versus/announcer';
import { buzz, play } from '@/lib/versus/sound';
import { RosterRow } from './VersusCard';
import { Confetti, SectionTitle, SIDE_COLORS } from './Fx';

type SetState = (s: VersusState) => void;

function BottomBar({ children }: { children: React.ReactNode }) {
	return (
		<div className='fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
			<div className='max-w-3xl mx-auto flex gap-2'>{children}</div>
		</div>
	);
}

/** Season opener: ping-pong balls decide who picks first */
export function LotteryScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const { names } = state.settings;
	const balls = lotteryBalls(state);
	const [drawn, setDrawn] = useState<VersusState | null>(null);
	const [spinning, setSpinning] = useState(false);
	const [tick, setTick] = useState(0);
	const total = balls[0] + balls[1];
	const pool: Side[] = [...Array(balls[0]).fill(0), ...Array(balls[1]).fill(1)];
	useEffect(() => {
		if (!spinning) return;
		const t = setInterval(() => {
			setTick(x => x + 1);
			play('tick');
		}, 110);
		return () => clearInterval(t);
	}, [spinning]);
	const winner = drawn?.dynasty?.lottery?.winner;
	return (
		<div className='min-h-screen pb-28'>
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in text-center'>
				<SectionTitle kicker='Dynasty · New season' title='Draft lottery' sub='Last season’s worse record gets more ping-pong balls. The winner picks first in the season-opening draft and keeps first.' />
				<div className='flex justify-center gap-6 mb-6'>
					{([0, 1] as Side[]).map(side => (
						<div key={side}>
							<div className='text-xs font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
								{names[side]}
							</div>
							<div className='text-3xl font-black text-white'>{Math.round((balls[side] / total) * 100)}%</div>
							<div className='text-[11px] text-white/45'>
								{balls[side]} ball{balls[side] === 1 ? '' : 's'}
							</div>
						</div>
					))}
				</div>
				<div className='relative mx-auto w-56 h-56 rounded-full border-4 border-white/15 bg-white/[0.04] flex flex-wrap items-center justify-center gap-2 p-8 mb-6'>
					{pool.map((side, i) => {
						const lit = winner !== undefined ? side === winner && i === pool.indexOf(winner) : spinning && i === tick % pool.length;
						return (
							<div
								key={i}
								className='w-12 h-12 rounded-full flex items-center justify-center text-xs font-black text-black transition-transform'
								style={{ background: SIDE_COLORS[side], transform: lit ? 'scale(1.35)' : spinning ? `translateY(${((tick + i) % 3) * 6 - 6}px)` : 'none', boxShadow: lit ? `0 0 24px ${SIDE_COLORS[side]}` : 'none', opacity: winner !== undefined && !lit ? 0.3 : 1 }}
							>
								{names[side].slice(0, 3).toUpperCase()}
							</div>
						);
					})}
				</div>
				{winner !== undefined && (
					<div className='vs-pop'>
						<Confetti count={60} colors={[SIDE_COLORS[winner], '#ffffff']} />
						<div className='text-3xl font-black' style={{ color: SIDE_COLORS[winner] }}>
							{names[winner]} wins the lottery
						</div>
						<div className='text-sm text-white/60'>First pick, and first to choose keepers.</div>
					</div>
				)}
			</div>
			<LiveGate host names={state.settings.names}>
				<BottomBar>
				{winner === undefined ? (
					<button
						disabled={spinning}
						onClick={() => {
							setSpinning(true);
							setTimeout(() => {
								const next = runLottery(state);
								const w = next.dynasty!.lottery!.winner;
								setSpinning(false);
								setDrawn(next);
								play('reveal');
								buzz([40, 30, 80]);
								announce(`The ping-pong balls have spoken. ${names[w]} wins the lottery!`, { hype: true });
							}, 2600);
						}}
						className='flex-1 btn-primary rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-50'
					>
						{spinning ? 'Drawing…' : '🎱 Draw the lottery'}
					</button>
				) : (
					<button onClick={() => setState(afterLottery(drawn!))} className='flex-1 btn-primary rounded-2xl py-3.5 font-black uppercase tracking-wider text-white'>
						{state.teams[0].length || state.teams[1].length ? 'Pick keepers →' : 'Start the draft →'}
					</button>
				)}
			</BottomBar>
			</LiveGate>
		</div>
	);
}

/** Season opener: each coach keeps up to 3 players from last season's roster */
export function DynastyKeepScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const side = state.dynasty?.turn ?? 0;
	const [chosen, setChosen] = useState<string[]>([]);
	useEffect(() => setChosen([]), [side]);
	const name = state.settings.names[side];
	const mine = players(state.teams[side]).sort((a, b) => b.overall - a.overall);
	const theirs = state.dynasty?.keeps[other(side)] ?? [];
	const toggle = (id: string) => setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : c.length >= DYNASTY_KEEPS ? c : [...c, id]));
	return (
		<div className='min-h-screen pb-28'>
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker='Dynasty · Keepers' title={`${name}, keep up to ${DYNASTY_KEEPS}`} sub='They come with you into the new season and each one uses up a round in his tier.' />
				{theirs.length > 0 && (
					<div className='text-center text-xs text-white/50 mb-4'>
						{state.settings.names[other(side)]} kept{' '}
						<span className='font-black text-white'>
							{theirs
								.map(id => getVersusPlayer(id)?.lastName)
								.filter(Boolean)
								.join(', ')}
						</span>
						.
					</div>
				)}
				<div className='text-center text-sm font-black mb-2' style={{ color: SIDE_COLORS[side] }}>
					{chosen.length}/{DYNASTY_KEEPS} kept
				</div>
				<div className='space-y-1.5 max-w-md mx-auto'>
					{mine.map(p => (
						<button key={p.id} onClick={() => toggle(p.id)} className='w-full text-left rounded-lg' style={chosen.includes(p.id) ? { outline: `2px solid ${SIDE_COLORS[side]}`, outlineOffset: 1 } : undefined}>
							<RosterRow player={p} highlight={chosen.includes(p.id)} />
						</button>
					))}
				</div>
			</div>
			<LiveGate side={state.dynasty?.turn ?? 0} names={state.settings.names}>
				<BottomBar>
				<button onClick={() => setState(chooseDynastyKeeps(state, []))} className='rounded-2xl px-4 py-3.5 font-bold text-sm bg-white/10 text-white/70'>
					Start fresh
				</button>
				<button
					disabled={!chosen.length}
					onClick={() => setState(chooseDynastyKeeps(state, chosen))}
					className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'
					style={{ background: chosen.length ? SIDE_COLORS[side] : 'rgba(255,255,255,0.08)' }}
				>
					{chosen.length ? `Keep ${chosen.length}` : 'Pick who stays'}
				</button>
			</BottomBar>
			</LiveGate>
		</div>
	);
}
