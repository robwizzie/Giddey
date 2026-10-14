'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

import { bestLineup, POWERS, Side } from '@/lib/versus/engine';
import { getVersusPlayer, VersusPlayer } from '@/lib/versus/pool';
import type { RivalryGame } from '@/lib/versus/rivalry';
import { seasonLabel } from '@/lib/versus/seasons';
import { getTheme } from '@/lib/versus/themes';
import { getHalftime, getPunishment, getSabotage, getTwist, halftimeText } from '@/lib/versus/wheels';
import DraftReplay from './DraftReplay';
import { SIDE_COLORS } from './Fx';
import { GradeCards } from './GradeCards';
import Icon from './Icon';

/** Draft style → icon name + label (shared with the rivalry sheet) */
export const STYLE_META: Record<string, { icon: string; label: string }> = {
	snake: { icon: 'shuffle', label: 'Snake' },
	cut: { icon: 'scissors', label: 'You Cut, I Choose' },
	franchise: { icon: 'wheel', label: 'Franchise wheel' },
	auction: { icon: 'dollar', label: 'Auction' },
	block: { icon: 'gavel', label: 'Auction Block' },
};

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** One tappable line in a list of games */
export function GameRow({ g, names, onOpen }: { g: RivalryGame; names: [string, string]; onOpen: () => void }) {
	return (
		<button onClick={onOpen} className='w-full flex items-center gap-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 text-[12px] text-left'>
			<div className='w-2 h-2 rounded-full shrink-0' style={{ background: SIDE_COLORS[g.winner] }} />
			<div className='flex-1 min-w-0 truncate text-white'>
				<span className='font-black'>{names[g.winner]}</span> won
				{g.score[0] !== null && g.score[1] !== null ? ` ${Math.max(g.score[0], g.score[1])}–${Math.min(g.score[0], g.score[1])}` : ''}
				{g.season?.stage === 'finals' ? (
					<span className='text-yellow-300'>
						{' · '}
						<Icon name='trophy' className='mr-0.5' />
						Finals
					</span>
				) : null}
				{g.potg?.length ? (
					<span className='text-yellow-300'>
						{' · '}
						<Icon name='star' className='mr-0.5 fill-current' />
						{g.potg.map(id => getVersusPlayer(id)?.lastName).join(' & ')}
					</span>
				) : null}
				{g.theme && getTheme(g.theme) ? (
					<span className='text-white/50'>
						{' · '}
						<Icon name={getTheme(g.theme)!.icon} />
					</span>
				) : null}
			</div>
			<div className='text-white/40 shrink-0'>{new Date(g.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
			<Icon name='chevronRight' className='text-white/30' />
		</button>
	);
}

function Row({ p, slot, potg }: { p: VersusPlayer; slot: string; potg: boolean }) {
	return (
		<div className='flex items-center gap-1.5 py-1'>
			<div className='w-6 text-[9px] font-black text-white/40 shrink-0'>{slot}</div>
			<div className='min-w-0 flex-1 text-[12px] font-bold text-white truncate'>
				{potg && <Icon name='star' className='mr-1 text-yellow-300 fill-current' />}
				{p.firstName[0]}. {p.lastName}
			</div>
			<div className={`tier-${p.tier} rounded w-7 h-6 flex items-center justify-center text-[11px] font-black text-white shrink-0`} style={{ animation: 'none' }}>
				{p.overall}
			</div>
		</div>
	);
}

function Fact({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
	return (
		<div className='rounded-xl bg-white/[0.04] border border-white/10 p-2.5 min-w-0'>
			<div className='flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/45'>
				<Icon name={icon} size={11} />
				{label}
			</div>
			<div className='text-[12px] text-white leading-snug mt-0.5'>{children}</div>
		</div>
	);
}

/** Everything about one past game: rosters, rules, line, grades, awards */
export default function GameDetail({ g, names, onClose }: { g: RivalryGame; names: [string, string]; onClose: () => void }) {
	const twist = getTwist(g.twist ?? null);
	const ht = g.halftime ? getHalftime(g.halftime.id) : undefined;
	const sab = g.sabotage && g.sabotage !== 'mercy' ? getSabotage(g.sabotage) : undefined;
	const theme = getTheme(g.theme);
	const scored = g.score[0] !== null && g.score[1] !== null;
	const [replay, setReplay] = useState(false);
	const stakes = (g.stakes ?? []).map(id => getPunishment(id)?.label).filter(Boolean) as string[];
	// portal: the rivalry sheet animates with a transform, which would trap a fixed overlay inside it
	return createPortal(
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-3'>
					<div>
						<div className='text-[11px] font-black uppercase tracking-widest text-white/45'>{fmtDate(g.ts)}{g.season ? ` · ${seasonLabel(g.season)}` : ''}</div>
						<div className='text-lg font-black text-white'>
							<span style={{ color: SIDE_COLORS[g.winner] }}>{names[g.winner]}</span> won{scored ? ` ${g.score[g.winner]}–${g.score[g.winner === 0 ? 1 : 0]}` : ''}
						</div>
					</div>
					<button onClick={onClose} className='p-2 -mr-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>

				<div className='grid grid-cols-2 gap-2 mb-4'>
					<Fact icon={STYLE_META[g.style]?.icon ?? 'layers'} label='Draft'>
						{STYLE_META[g.style]?.label ?? g.style}
						{theme ? (
							<>
								{' · '}
								<Icon name={theme.icon} className='mr-0.5 text-white/60' />
								{theme.label}
							</>
						) : null}
					</Fact>
					<Fact icon='timer' label='Rules'>
						{g.quarter ? `${g.quarter}-min quarters` : '—'}
						{twist ? ` · ${twist.label}` : ''}
					</Fact>
					{g.line && (
						<Fact icon='trendUp' label='Line'>
							{names[g.line.fav]} −{g.line.spread}
							{scored ? (g.covered !== null && g.covered !== undefined ? ` · ${names[g.covered]} covered` : ` · ${names[g.line.fav]} covered`) : ''}
						</Fact>
					)}
					{ht && g.halftime && (
						<Fact icon='clock' label='Halftime'>
							{ht.label}: {halftimeText(ht.desc, names, g.halftime.leader)}
						</Fact>
					)}
					{sab && (
						<Fact icon='bomb' label='Sabotage'>
							{sab.label}
							{g.sabotageOn !== null && g.sabotageOn !== undefined ? ` on ${names[g.sabotageOn]}` : ''}
						</Fact>
					)}
					{g.reads && (
						<Fact icon='brain' label='Scouting report'>
							{([0, 1] as Side[]).map(side => `${names[side]} ${g.reads![side]}/3`).join(' · ')}
						</Fact>
					)}
					{g.powers && (g.powers[0] || g.powers[1]) && (
						<Fact icon='sparkle' label='Power-ups'>
							{([0, 1] as Side[]).map(side => {
								const pw = g.powers![side] ? POWERS[g.powers![side]!] : undefined;
								return (
									<span key={side} className='block truncate'>
										{names[side]}{' '}
										{pw ? (
											<>
												<Icon name={pw.icon} className='mx-0.5' style={{ color: pw.color }} />
												{pw.label}
											</>
										) : (
											<span className='text-white/40'>none</span>
										)}
									</span>
								);
							})}
						</Fact>
					)}
					{stakes.length > 0 && (
						<Fact icon='skull' label='Stakes'>
							{stakes.join(' · ')}
						</Fact>
					)}
					<Fact icon='target' label='Challenges'>
						{([0, 1] as Side[]).map(side => `${names[side]} ${g.challenges[side] === true ? '✓' : g.challenges[side] === false ? '✗' : '—'}`).join(' · ')}
					</Fact>
				</div>

				{!!g.draft?.length && (
					<button onClick={() => setReplay(true)} className='w-full mb-4 h-11 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 text-white text-sm font-black inline-flex items-center justify-center gap-2'>
						<Icon name='play' size={16} />
						Watch the draft
					</button>
				)}

				{g.grades && (
					<div className='mb-4'>
						<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>
							<Icon name='clipboard' />
							Draft grades
						</div>
						<GradeCards grades={g.grades} names={names} />
					</div>
				)}

				<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>Rosters</div>
				<div className='grid grid-cols-2 gap-2'>
					{([0, 1] as Side[]).map(side => {
						const lu = bestLineup(g.rosters[side] ?? []);
						return (
							<div key={side} className='rounded-2xl p-2.5 border min-w-0' style={{ borderColor: `${SIDE_COLORS[side]}55`, background: `linear-gradient(160deg, ${SIDE_COLORS[side]}18, transparent 60%)` }}>
								<div className='flex items-baseline justify-between mb-1'>
									<div className='text-xs font-black uppercase tracking-wider truncate' style={{ color: SIDE_COLORS[side] }}>
										{g.teams[side] || names[side]}
									</div>
									<div className='text-sm font-black text-white tabular-nums'>{g.teamOvr[side].toFixed(1)}</div>
								</div>
								<div className='divide-y divide-white/5'>
									{lu.starters.map(st => st.player && <Row key={st.slot} p={st.player} slot={st.slot} potg={!!g.potg?.includes(st.player.id)} />)}
									{lu.bench.map(p => (
										<Row key={p.id} p={p} slot='BN' potg={!!g.potg?.includes(p.id)} />
									))}
								</div>
							</div>
						);
					})}
				</div>
			</div>
			{replay && g.draft && (
				<div onClick={e => e.stopPropagation()}>
					<DraftReplay names={names} picks={g.draft} colors={[SIDE_COLORS[0], SIDE_COLORS[1]]} title={`${fmtDate(g.ts)}${g.season ? ` · ${seasonLabel(g.season)}` : ''}`} onClose={() => setReplay(false)} />
				</div>
			)}
		</div>,
		document.body,
	);
}
