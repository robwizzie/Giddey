'use client';

import { useState } from 'react';
import { other, setPunishment, VersusState } from '@/lib/versus/engine';
import { activePunishments, getPunishment, Punishment } from '@/lib/versus/wheels';
import { hostLock, isScreen } from '@/lib/versus/live';
import { buzz, haptic } from '@/lib/versus/sound';
import { useCanAct, WaitingBar } from './Live';
import Wheel from './Wheel';
import Icon, { IconTile } from './Icon';
import { Confetti, SIDE_COLORS } from './Fx';

type SetState = (s: VersusState) => void;

// ═══════════════════════════════════════════════════════════════
//  STAKES — before tip-off the coaches agree what's on the loser's
//  wheel; after the game the loser spins it.
// ═══════════════════════════════════════════════════════════════

/** Tonight's agreed punishments, as wheel items (custom ones that were deleted drop out) */
function stakeItems(ids: string[]): Punishment[] {
	return ids.map(id => getPunishment(id)).filter((p): p is Punishment => !!p);
}

/**
 * Before tip-off: toggle what's on the loser's wheel, or play for nothing.
 * One device edits (the host); the other sees where it stands.
 */
export function StakesPicker({ state, setState }: { state: VersusState; setState: SetState }) {
	const { names } = state.settings;
	const canEdit = useCanAct(null, names, true);
	const all = activePunishments();
	const [on, setOn] = useState<string[]>(() => all.map(p => p.id));
	const lock = (ids: string[]) => {
		buzz(30);
		setState({ ...state, gameday: { ...state.gameday, stakes: ids } });
	};
	return (
		<div className='rounded-2xl border border-rose-400/35 bg-rose-500/[0.06] p-4 animate-fade-in'>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-rose-300 mb-1'>
				<Icon name='flame' />
				Tonight&apos;s stakes
			</div>
			<div className='text-[12px] text-white/60 text-center mb-3'>{canEdit ? 'Agree on what the loser could get. Tap to take one off the wheel — the loser spins after the game.' : 'The loser spins one of these after the game.'}</div>
			<div className='flex flex-wrap justify-center gap-1.5 mb-4'>
				{all.map(p => {
					const sel = on.includes(p.id);
					return (
						<button
							key={p.id}
							disabled={!canEdit}
							aria-pressed={sel}
							title={p.desc}
							onClick={() => {
								buzz(8);
								setOn(o => (sel ? o.filter(x => x !== p.id) : [...o, p.id]));
							}}
							className={`min-h-[36px] rounded-full px-3 py-1.5 text-[12px] font-black border-2 transition-all disabled:cursor-default ${sel ? '' : 'opacity-40 line-through'}`}
							style={{ borderColor: sel ? p.color : 'rgba(255,255,255,0.12)', background: sel ? `${p.color}26` : 'transparent', color: sel ? '#fff' : 'rgba(255,255,255,0.6)' }}
						>
							{p.label}
						</button>
					);
				})}
			</div>
			{canEdit ? (
				<div className='space-y-2'>
					<button disabled={on.length < 2} onClick={() => lock(all.filter(p => on.includes(p.id)).map(p => p.id))} className='w-full inline-flex items-center justify-center gap-2 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white disabled:opacity-40'>
						<Icon name='handshake' />
						{on.length < 2 ? 'Keep at least 2 on the wheel' : `Lock in ${on.length} stakes`}
					</button>
					<button onClick={() => lock([])} className='w-full rounded-2xl py-2.5 text-sm font-bold text-white/50 bg-white/5 border border-white/10'>
						No stakes tonight
					</button>
				</div>
			) : (
				<WaitingBar name={hostLock(names) ?? 'the host'} fixed={false} what='is locking in the stakes' />
			)}
		</div>
	);
}

/** Game card strip: what's riding on tonight */
export function StakesStrip({ state }: { state: VersusState }) {
	const ids = state.gameday.stakes;
	if (!state.settings.stakes || !ids?.length) return null;
	const items = stakeItems(ids);
	return (
		<div className='rounded-xl border border-rose-400/30 bg-rose-500/[0.06] p-3 flex items-center gap-3'>
			<IconTile name='flame' color='#fb7185' size={40} />
			<div className='min-w-0'>
				<div className='text-xs font-black uppercase tracking-wider text-rose-300'>Loser spins for</div>
				<div className='text-[11px] text-white/65 leading-snug'>{items.map(p => p.label).join(' · ')}</div>
			</div>
		</div>
	);
}

/** The punishment, big — on every device, including the main screen */
export function PunishmentCard({ state }: { state: VersusState }) {
	const pun = state.punishment;
	const info = getPunishment(pun?.id);
	if (!pun || !info) return null;
	const name = state.settings.names[pun.side];
	const tv = isScreen();
	return (
		<div className='relative rounded-3xl border-2 p-5 text-center overflow-hidden vs-pop' style={{ borderColor: info.color, background: `linear-gradient(170deg, ${info.color}33, ${SIDE_COLORS[pun.side]}14 60%, transparent)` }}>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-[0.3em] text-white/55 mb-1'>
				<Icon name='flame' className='text-rose-300' />
				The loser pays up
			</div>
			<div className={`${tv ? 'text-6xl' : 'text-4xl'} font-black leading-none`} style={{ color: SIDE_COLORS[pun.side] }}>
				{name}
			</div>
			<div className={`${tv ? 'text-5xl' : 'text-3xl'} font-black text-white mt-1 vs-slam inline-block`}>{info.label}</div>
			<div className={`${tv ? 'text-lg' : 'text-sm'} text-white/65 mt-2 leading-snug`}>{info.desc}</div>
		</div>
	);
}

/** Postgame: the loser spins tonight's punishment wheel */
export function PunishmentSpin({ state, setState }: { state: VersusState; setState: SetState }) {
	const last = state.series[state.series.length - 1];
	const loser = other(last.winner);
	const { names } = state.settings;
	const canSpin = useCanAct(loser, names);
	const [size] = useState(() => (typeof window === 'undefined' ? 280 : Math.min(300, window.innerWidth - 64)));
	const [landed, setLanded] = useState<string | null>(null);
	const ids = last.stakes ?? state.gameday.stakes;
	if (!ids?.length) return null;
	if (state.punishment && state.punishment.game === last.game)
		return (
			<>
				{landed && <Confetti count={60} colors={[getPunishment(landed)?.color ?? '#fb7185', SIDE_COLORS[last.winner], '#ffffff']} />}
				<PunishmentCard state={state} />
			</>
		);
	const items = stakeItems(ids);
	if (!items.length) return null;
	return (
		<div className='rounded-2xl border border-rose-400/35 bg-rose-500/[0.06] p-4 flex flex-col items-center'>
			<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-rose-300 mb-1'>
				<Icon name='flame' />
				Punishment wheel
			</div>
			<div className='text-sm text-white/70 text-center mb-4'>
				<span className='font-black' style={{ color: SIDE_COLORS[loser] }}>
					{names[loser]}
				</span>{' '}
				lost — {canSpin ? 'spin for your punishment. You agreed to it.' : 'spins for their punishment.'}
			</div>
			{canSpin ? (
				<Wheel
					mirror='Punishment'
					items={items}
					size={size}
					accent='#fb7185'
					spinLabel='SPIN'
					onResult={i => {
						haptic('landed');
						const id = items[i].id;
						setTimeout(() => {
							setLanded(id);
							setState(setPunishment(state, id));
						}, 900);
					}}
				/>
			) : (
				<WaitingBar name={names[loser]} fixed={false} what='is spinning the punishment wheel' />
			)}
		</div>
	);
}
