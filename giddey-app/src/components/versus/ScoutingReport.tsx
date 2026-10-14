'use client';

import { useEffect, useState } from 'react';
import { useLive } from './Live';
import { other, readTruth, Reads, scoreReads, Side, SLOTS, submitReads, VersusState } from '@/lib/versus/engine';
import { canSeePrivate, liveInfo } from '@/lib/versus/live';
import { Position } from '@/lib/types';
import { haptic, play } from '@/lib/versus/sound';
import { Handoff } from './DraftFx';
import { SectionTitle, SIDE_COLORS } from './Fx';
import Icon from './Icon';
import { SecretWait } from './BanPhase';

type SetState = (s: VersusState) => void;

const GUARDS: Reads['guards'][] = ['0-1', '2', '3+'];
const guardLabel = (g: Reads['guards']) => `${g.replace('-', '–')} guard${g === '0-1' ? '' : 's'}`;

function Chip({ on, color, onClick, children, label }: { on: boolean; color: string; onClick: () => void; children: React.ReactNode; label?: string }) {
	return (
		<button
			onClick={() => {
				play('tick');
				onClick();
			}}
			aria-pressed={on}
			aria-label={label}
			className={`flex-1 min-h-[44px] rounded-xl px-2 py-2.5 text-sm font-black border transition-colors ${on ? 'text-white' : 'text-white/60 border-white/10 bg-white/[0.04]'}`}
			style={on ? { borderColor: color, background: `${color}33`, boxShadow: `0 0 0 1px ${color}` } : undefined}
		>
			{children}
		</button>
	);
}

function Question({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
	return (
		<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3.5'>
			<div className='flex items-center gap-2 text-sm font-black text-white mb-2.5'>
				<span className='w-6 h-6 rounded-full bg-white/10 text-[11px] flex items-center justify-center shrink-0'>{n}</span>
				{title}
			</div>
			<div className='flex gap-2'>{children}</div>
		</div>
	);
}

function ReadsForm({ state, setState, side }: { state: VersusState; setState: SetState; side: Side }) {
	const { names } = state.settings;
	const opp = other(side);
	const color = SIDE_COLORS[side];
	const [pos, setPos] = useState<Position | null>(null);
	const [higher, setHigher] = useState<Side | null>(null);
	const [guards, setGuards] = useState<Reads['guards'] | null>(null);
	useEffect(() => {
		setPos(null);
		setHigher(null);
		setGuards(null);
	}, [side]);
	const ready = pos !== null && higher !== null && guards !== null;
	const otherDone = !!state.board?.picks[opp];
	return (
		<div className='min-h-screen pb-28'>
			<div className='max-w-xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker={`Game ${state.gameNo} · Scouting report`} title={`${names[side]}, scout ${names[opp]}`} sub={`Three secret reads on ${names[opp]}'s draft. 1 point for each one you get right — revealed after the draft.`} />
				<div className='flex items-center justify-center gap-2 text-[11px] font-bold text-white/45 mb-4'>
					<Icon name='eyeOff' />
					{otherDone ? `${names[opp]} already scouted you.` : `${names[opp]} scouts you next.`}
				</div>
				<div className='space-y-3'>
					<Question n={1} title={`${names[opp]}'s first pick plays…`}>
						{SLOTS.map(p => (
							<Chip key={p} on={pos === p} color={color} onClick={() => setPos(p)}>
								{p}
							</Chip>
						))}
					</Question>
					<Question n={2} title='Who ends the draft with the higher team OVR?'>
						{([0, 1] as Side[]).map(i => (
							<Chip key={i} on={higher === i} color={SIDE_COLORS[i]} onClick={() => setHigher(i)}>
								<span className='truncate block' style={{ color: higher === i ? '#fff' : SIDE_COLORS[i] }}>
									{names[i]}
								</span>
							</Chip>
						))}
					</Question>
					<Question n={3} title={`How many guards (PG/SG) does ${names[opp]} end with?`}>
						{GUARDS.map(g => (
							<Chip key={g} on={guards === g} color={color} onClick={() => setGuards(g)}>
								{g.replace('-', '–')}
							</Chip>
						))}
					</Question>
				</div>
			</div>
			<div className='fixed bottom-0 left-0 right-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
				<div className='max-w-xl mx-auto flex gap-2'>
					<button
						disabled={!ready}
						onClick={() => {
							if (!ready) return;
							haptic('landed');
							setState(submitReads(state, side, { pos, higher, guards }));
						}}
						className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35 inline-flex items-center justify-center gap-2'
						style={{ background: ready ? color : 'rgba(255,255,255,0.08)' }}
					>
						<Icon name='lock' />
						{ready ? 'Lock in my reads' : 'Answer all three'}
					</button>
				</div>
			</div>
		</div>
	);
}

/** Scouting report: each coach secretly predicts three things about the other's draft */
export default function ScoutingPhase({ state, setState }: { state: VersusState; setState: SetState }) {
	useLive();
	const b = state.board!;
	const side = b.turn;
	const { names } = state.settings;
	const [handoffDone, setHandoffDone] = useState<string | null>(null);
	const done: [boolean, boolean] = [!!b.picks[0], !!b.picks[1]];
	if (!canSeePrivate(side) || done[side]) return <SecretWait state={state} side={side} kicker='Scouting report' what={`scouting ${names[other(side)]}`} done={done} icon='clipboard' />;
	const key = `${state.gameNo}-${side}-${done[0]}-${done[1]}`;
	if (!liveInfo() && handoffDone !== key) {
		return <Handoff to={side} name={names[side]} note={`Secret scouting report — ${names[other(side)]}, look away.`} onReady={() => setHandoffDone(key)} />;
	}
	return <ReadsForm state={state} setState={setState} side={side} />;
}

/** After the draft: each coach's reads vs what actually happened */
export function ScoutingResult({ state }: { state: VersusState }) {
	const picks = state.board?.picks;
	const pts = scoreReads(state);
	if (!picks?.[0] || !picks[1] || !pts) return null;
	const { names } = state.settings;
	const win: Side | null = pts[0] > pts[1] ? 0 : pts[1] > pts[0] ? 1 : null;
	const headline =
		win !== null
			? pts[win] === 3
				? `${names[win]} read ${names[other(win)]} like a book — 3/3`
				: `${names[win]} out-scouted ${names[other(win)]}, ${pts[win]}–${pts[other(win)]}`
			: pts[0] === 0
				? 'Nobody saw that draft coming — 0 apiece'
				: `Dead even — ${pts[0]} apiece`;
	return (
		<div>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>
				<Icon name='clipboard' />
				Scouting reports
			</div>
			<div className='text-center text-base font-black mb-3' style={{ color: win !== null ? SIDE_COLORS[win] : '#fff' }}>
				{headline}
			</div>
			<div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
				{([0, 1] as Side[]).map(side => {
					const r = picks[side]!;
					const t = readTruth(state, other(side));
					const rows: { label: string; guess: string; truth: string | null; ok: boolean }[] = [
						{ label: 'First pick', guess: r.pos, truth: t?.pos ?? null, ok: !!t && r.pos === t.pos },
						{ label: 'Higher OVR', guess: names[r.higher], truth: t ? names[t.higher] : null, ok: !!t && r.higher === t.higher },
						{ label: 'Guards', guess: guardLabel(r.guards), truth: t ? guardLabel(t.guards) : null, ok: !!t && r.guards === t.guards },
					];
					return (
						<div key={side} className='rounded-2xl border p-3' style={{ borderColor: `${SIDE_COLORS[side]}55`, background: `linear-gradient(160deg, ${SIDE_COLORS[side]}1f, transparent 70%)` }}>
							<div className='flex items-center justify-between gap-2 mb-2'>
								<div className='text-xs font-black uppercase tracking-widest truncate' style={{ color: SIDE_COLORS[side] }}>
									{names[side]} on {names[other(side)]}
								</div>
								<div className='text-lg font-black text-white tabular-nums shrink-0'>
									{pts[side]}
									<span className='text-white/40 text-sm'>/3</span>
								</div>
							</div>
							<div className='space-y-1'>
								{rows.map(row => (
									<div key={row.label} className='flex items-center gap-2 text-[12px]'>
										<Icon name={row.ok ? 'check' : 'x'} strokeWidth={3} className={`shrink-0 ${row.ok ? 'text-emerald-400' : 'text-red-400'}`} aria-label={row.ok ? 'Right' : 'Wrong'} />
										<span className='text-white/45 w-[68px] shrink-0'>{row.label}</span>
										<span className='font-bold text-white truncate'>{row.guess}</span>
										{!row.ok && row.truth && <span className='text-white/40 truncate'>· was {row.truth}</span>}
									</div>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
