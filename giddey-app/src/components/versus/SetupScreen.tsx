'use client';

import { useState } from 'react';
import {
	BAND_INFO,
	BANDS,
	Band,
	bandOvrRange,
	DraftStyle,
	MAX_PER_TIER,
	MAX_ROSTER,
	MIN_ROSTER,
	normalizeSettings,
	PoolSetting,
	rosterTotal,
	Settings,
	Side,
	SIDE_PALETTE,
	TIER_PRESETS,
	MAX_FAVORITES,
	RETIRE_DRAFTS,
} from '@/lib/versus/engine';
import { ALLTIME_PLAYERS, getPool, getVersusPlayer, MODERN_PLAYERS } from '@/lib/versus/pool';
import { THEMES } from '@/lib/versus/themes';
import { matchups } from '@/lib/versus/rivalry';
import { loadLeagues } from '@/lib/versus/league';
import { cloudEnabled } from '@/lib/versus/cloud';
import { CoachBadges } from './Badges';
import InstallButton from './InstallButton';
import RatingsSheet from './RatingsSheet';
import PowerRankings from './PowerRankings';
import CustomWheelsEditor from './CustomWheelsEditor';
import { fmtDate, lastRatingUpdate } from '@/lib/versus/ratingChanges';
import { TEAM_ICONS } from '@/lib/versus/engine';
import Icon from './Icon';

const POOLS: { id: PoolSetting; title: string; sub: string; icon: string }[] = [
	{ id: 'modern', title: 'Modern', sub: 'Current 2K27 rosters', icon: 'ball' },
	{ id: 'alltime', title: 'All-Time', sub: '2K27 All-Time teams', icon: 'crown' },
	{ id: 'mixed', title: 'Both', sub: 'Legends meet today', icon: 'zap' },
	{ id: 'erawars', title: 'Era Wars', sub: 'Modern vs Legends', icon: 'swords' },
];

const STYLES: { id: DraftStyle; title: string; icon: string; desc: string }[] = [
	{ id: 'snake', title: 'Pack Snake', icon: 'layers', desc: 'Each round a pack drops from that round’s tier. Pick, then they pick from what’s left.' },
	{ id: 'cut', title: 'I Cut, You Choose', icon: 'scissors', desc: 'One coach splits 2 cards from the pack, the other takes one. Cutter gets the leftover. Perfectly fair.' },
	{ id: 'franchise', title: 'Franchise Wheel', icon: 'wheel', desc: 'Spin a franchise every round — the pack comes only from that team. Chaos with guardrails.' },
	{ id: 'auction', title: 'Auction', icon: 'coins', desc: 'Salary cap draft. Nominate anyone in the pool and bid it out. Most strategic way to draft.' },
	{ id: 'block', title: 'Auction Block', icon: 'gavel', desc: 'Players hit the block on their own — stars first, the next 3 lots in view. Bid or pass; tier slots keep it fair.' },
];

function Label({ children }: { children: React.ReactNode }) {
	return <div className='text-[11px] font-bold uppercase tracking-wider text-white/45 mb-1.5'>{children}</div>;
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
	return (
		<div>
			<Label>{label}</Label>
			<div className='flex bg-white/5 rounded-xl p-1 border border-white/10'>
				{options.map(o => (
					<button
						key={String(o.v)}
						onClick={() => onChange(o.v)}
						className={`flex-1 text-sm font-bold py-1.5 rounded-lg transition-all ${value === o.v ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'}`}
					>
						{o.l}
					</button>
				))}
			</div>
		</div>
	);
}

function Toggle({ on, onChange, title, desc }: { on: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
	return (
		<button onClick={() => onChange(!on)} className='w-full flex items-center gap-3 text-left bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2.5 transition-colors'>
			<div className='flex-1 min-w-0'>
				<div className='text-sm font-bold text-white'>{title}</div>
				<div className='text-[11px] text-white/45 leading-snug'>{desc}</div>
			</div>
			<div className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-green-500' : 'bg-white/15'}`}>
				<div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
			</div>
		</button>
	);
}

type SetS = React.Dispatch<React.SetStateAction<Settings>>;

/** Tier counts for one coach (`field` = tiers or tiers2) */
export function TierBuilder({ s, setS, field = 'tiers', title, color }: { s: Settings; setS: SetS; field?: 'tiers' | 'tiers2'; title?: string; color?: string }) {
	const tiers = s[field];
	const total = rosterTotal(tiers);
	const setTier = (b: Band, n: number) => setS(prev => normalizeSettings({ ...prev, [field]: { ...prev[field], [b]: n } }));
	const preset = TIER_PRESETS.find(p => BANDS.every(b => p.tiers[b] === tiers[b]));
	const rangePool = s.pool === 'erawars' ? 'modern' : s.pool;
	return (
		<div className='mb-4'>
			<div className='flex items-baseline justify-between mb-1.5'>
				<div className='text-[11px] font-bold uppercase tracking-wider' style={{ color: color ?? 'rgba(255,255,255,0.45)' }}>
					{title ?? 'Roster build · per coach'}
				</div>
				<div className={`text-[11px] font-black ${total < MIN_ROSTER ? 'text-red-400' : 'text-white/60'}`}>
					{total} players{total < MIN_ROSTER ? ` · need ${MIN_ROSTER}+` : ''}
				</div>
			</div>
			<div className='flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-1 [scrollbar-width:none]'>
				{TIER_PRESETS.map(p => {
					const on = preset?.id === p.id;
					return (
						<button
							key={p.id}
							onClick={() => setS(prev => normalizeSettings({ ...prev, [field]: { ...p.tiers } }))}
							className={`shrink-0 rounded-xl px-3 py-2 text-left border transition-all ${on ? 'border-orange-400 bg-orange-500/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
						>
							<div className='text-sm font-black text-white whitespace-nowrap'>
								<Icon name={p.icon} className='mr-1 text-orange-300' />
								{p.label}
							</div>
							<div className='text-[10px] text-white/45 whitespace-nowrap'>{p.desc}</div>
						</button>
					);
				})}
			</div>
			<div className='rounded-2xl border border-white/10 bg-black/30 divide-y divide-white/5'>
				{BANDS.map(b => {
					const n = tiers[b];
					const [lo, hi] = bandOvrRange(rangePool, b);
					return (
						<div key={b} className='flex items-center gap-3 px-3 py-2'>
							<div className='w-2.5 h-8 rounded-full shrink-0' style={{ background: BAND_INFO[b].color }} />
							<div className='flex-1 min-w-0'>
								<div className='text-sm font-black text-white'>{BAND_INFO[b].label}</div>
								<div className='text-[10px] text-white/45'>{lo === hi ? `${hi}` : `${lo}–${hi}`} OVR</div>
							</div>
							<button onClick={() => setTier(b, Math.max(0, n - 1))} disabled={n <= 0} className='w-9 h-9 rounded-xl bg-white/10 text-white text-lg font-black disabled:opacity-25 active:scale-95' aria-label={`Fewer ${BAND_INFO[b].label}`}>
								−
							</button>
							<div className='w-6 text-center text-xl font-black text-white tabular-nums'>{n}</div>
							<button
								onClick={() => setTier(b, n + 1)}
								disabled={n >= MAX_PER_TIER || total >= MAX_ROSTER}
								className='w-9 h-9 rounded-xl bg-white/10 text-white text-lg font-black disabled:opacity-25 active:scale-95'
								aria-label={`More ${BAND_INFO[b].label}`}
							>
								+
							</button>
						</div>
					);
				})}
			</div>
			<div className='flex gap-0.5 mt-2'>
				{BANDS.flatMap(b => Array.from({ length: tiers[b] }, (_, i) => <div key={`${b}${i}`} className='flex-1 h-1.5 rounded-full' style={{ background: BAND_INFO[b].color }} />))}
			</div>
		</div>
	);
}

function IdentityEditor({ s, setS, side }: { s: Settings; setS: SetS; side: Side }) {
	const id = s.identity[side];
	const otherColor = s.identity[side ? 0 : 1].color;
	const set = (patch: Partial<typeof id>) =>
		setS(prev => {
			const identity: Settings['identity'] = [{ ...prev.identity[0] }, { ...prev.identity[1] }];
			identity[side] = { ...identity[side], ...patch };
			return { ...prev, identity };
		});
	const [open, setOpen] = useState(false);
	return (
		<div className='rounded-2xl p-3 border' style={{ borderColor: `${id.color}66`, background: `linear-gradient(135deg, ${id.color}22, transparent)` }}>
			<div className='flex items-center justify-between'>
				<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: id.color }}>
					Coach {side + 1}
				</div>
				<button onClick={() => setOpen(o => !o)} className='text-[10px] font-bold text-white/50 hover:text-white'>
					{open ? 'Done' : 'Customize'}
				</button>
			</div>
			<input
				value={s.names[side]}
				maxLength={12}
				onChange={e => {
					const v = e.target.value;
					setS(prev => {
						const names: [string, string] = [...prev.names];
						names[side] = v;
						return { ...prev, names };
					});
				}}
				className='w-full bg-transparent text-xl font-black text-white outline-none placeholder:text-white/20'
				placeholder={side ? 'Coach 2' : 'Coach 1'}
				aria-label={`Coach ${side + 1} name`}
			/>
			<div className='text-[11px] text-white/55 truncate flex items-center gap-1'>
				<Icon name={id.icon} style={{ color: id.color }} /> {id.team || 'Name your team'}
			</div>
			{open && (
				<div className='mt-3 space-y-2.5 animate-fade-in'>
					<input
						value={id.team}
						maxLength={20}
						onChange={e => set({ team: e.target.value })}
						placeholder='Team name (e.g. Mamba Mentality)'
						className='w-full rounded-lg bg-black/30 border border-white/10 px-2.5 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/25'
					/>
					<div className='flex flex-wrap gap-1'>
						{TEAM_ICONS.map(ic => (
							<button
								key={ic}
								onClick={() => set({ icon: ic })}
								aria-label={`Team logo ${ic}`}
								aria-pressed={id.icon === ic}
								className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${id.icon === ic ? 'ring-2 ring-white/70 text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}
								style={id.icon === ic ? { background: `${id.color}55` } : undefined}
							>
								<Icon name={ic} size={16} />
							</button>
						))}
					</div>
					<div className='flex flex-wrap gap-1.5'>
						{SIDE_PALETTE.map(c => (
							<button
								key={c}
								disabled={c === otherColor}
								onClick={() => set({ color: c })}
								className={`w-7 h-7 rounded-full disabled:opacity-20 ${id.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e17]' : ''}`}
								style={{ background: c }}
								aria-label={`Color ${c}`}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function settingsValid(s: Settings): boolean {
	const a = s.names[0].trim();
	const b = s.names[1].trim();
	return !!a && !!b && a.toLowerCase() !== b.toLowerCase() && rosterTotal(s.tiers) >= MIN_ROSTER && (!s.handicap || rosterTotal(s.tiers2) >= MIN_ROSTER);
}

/** One-tap chips for pairs who've played on this device */
function RecentMatchups({ s, setS }: { s: Settings; setS: SetS }) {
	const [list] = useState(() => matchups().slice(0, 6));
	if (!list.length) return null;
	const cur = s.names.map(n => n.trim().toLowerCase()).sort().join('|');
	return (
		<div className='mb-3'>
			<div className='text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5'>Recent matchups on this phone</div>
			<div className='flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none]'>
				{list.map(m => {
					const on = m.names.map(n => n.trim().toLowerCase()).sort().join('|') === cur;
					return (
						<button
							key={m.names.join('|')}
							onClick={() => setS(prev => ({ ...prev, names: [m.names[0], m.names[1]] }))}
							className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black border ${on ? 'bg-white text-black border-white' : 'bg-white/5 text-white/75 border-white/10'}`}
						>
							{m.names[0]} vs {m.names[1]} <span className={on ? 'text-black/50' : 'text-white/40'}>· {m.wins[0]}–{m.wins[1]}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

/** A numbered settings section with a one-line explanation */
function Section({ n, icon, title, desc, children, locked }: { n: number; icon: string; title: string; desc: string; children: React.ReactNode; locked?: boolean }) {
	return (
		<section className={`mb-7 ${locked ? 'opacity-40 pointer-events-none' : ''}`}>
			<div className='flex items-start gap-3 mb-3'>
				<div className='w-7 h-7 rounded-full bg-white/10 border border-white/15 text-xs font-black text-white flex items-center justify-center shrink-0'>{n}</div>
				<div className='min-w-0'>
					<div className='text-base font-black text-white leading-tight flex items-center gap-1.5'>
						<Icon name={icon} className='text-orange-300' /> {title}
					</div>
					<div className='text-[12px] text-white/50 leading-snug'>{desc}</div>
				</div>
			</div>
			{children}
		</section>
	);
}

/** One-tap setups that set many options at once (names, colors and favorites are kept) */
const QUICK_SETUPS: { id: string; icon: string; title: string; desc: string; patch: Partial<Settings> }[] = [
	{
		id: 'classic',
		icon: 'ball',
		title: 'Classic',
		desc: 'Balanced snake draft, no extras',
		patch: { style: 'snake', pool: 'mixed', theme: 'off', freshness: 'light', freshFaces: 0, favoritesRound: false, retire: 'off', blindBid: false, blind: false, keepers: false, equalizer: true, underdogFirst: true, handicap: false },
	},
	{
		id: 'variety',
		icon: 'rainbow',
		title: 'Variety Night',
		desc: 'New faces every draft',
		patch: { style: 'snake', pool: 'mixed', theme: 'spin', freshness: 'strong', freshFaces: 2, favoritesRound: true, retire: 'potg', equalizer: true, underdogFirst: true, handicap: false },
	},
	{
		id: 'money',
		icon: 'gavel',
		title: 'Money Night',
		desc: 'Auction Block, $200 each',
		patch: { style: 'block', pool: 'mixed', theme: 'off', freshness: 'light', budget: 200, budget2: 200, handicap: false },
	},
	{
		id: 'chaos',
		icon: 'bomb',
		title: 'Chaos',
		desc: 'Franchise wheel, blind bids, mystery packs',
		patch: { style: 'franchise', pool: 'mixed', theme: 'spin', blindBid: true, blind: true, shuffleRounds: true, freshness: 'strong', handicap: false },
	},
];

/** Search every player and pin up to 5 franchise guys per coach */
function FavoritesPicker({ s, setS, side, onClose }: { s: Settings; setS: SetS; side: Side; onClose: () => void }) {
	const [q, setQ] = useState('');
	const pinned = s.favorites[side];
	const all = getPool('mixed');
	const list = q.trim() ? all.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40) : all.slice(0, 40);
	const toggle = (id: string) =>
		setS(prev => {
			const favorites: Settings['favorites'] = [[...prev.favorites[0]], [...prev.favorites[1]]];
			const mine = favorites[side];
			favorites[side] = mine.includes(id) ? mine.filter(x => x !== id) : mine.length >= MAX_FAVORITES ? mine : [...mine, id];
			return { ...prev, favorites };
		});
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[88vh] flex flex-col bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl p-4 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-1'>
					<div className='text-lg font-black text-white flex items-center gap-2'><Icon name='heart' className='text-sky-400' /> {s.names[side] || `Coach ${side + 1}`}&apos;s franchise guys</div>
					<button onClick={onClose} className='text-white/50 hover:text-white p-2 -mr-2' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>
				<div className='text-xs text-white/50 mb-3'>
					Pin up to {MAX_FAVORITES} players you love. They get a heart tag, and with the Favorites round on you grab one before every draft. ({pinned.length}/{MAX_FAVORITES})
				</div>
				{pinned.length > 0 && (
					<div className='flex flex-wrap gap-1.5 mb-3'>
						{pinned.map(id => {
							const p = getVersusPlayer(id);
							return p ? (
								<button key={id} onClick={() => toggle(id)} className='text-xs font-bold text-white rounded-full px-2.5 py-1 border' style={{ borderColor: s.identity[side].color, background: `${s.identity[side].color}22` }}>
									{p.firstName} {p.lastName} <Icon name='x' size={12} className='ml-0.5 opacity-60' />
								</button>
							) : null;
						})}
					</div>
				)}
				<input
					value={q}
					onChange={e => setQ(e.target.value)}
					placeholder='Search all 345 players…'
					className='w-full rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/30 mb-2'
				/>
				<div className='overflow-y-auto space-y-1 flex-1 min-h-0'>
					{list.map(p => {
						const on = pinned.includes(p.id);
						return (
							<button key={p.id} onClick={() => toggle(p.id)} disabled={!on && pinned.length >= MAX_FAVORITES} className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left disabled:opacity-30 ${on ? 'bg-white/15' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}>
								<div className={`tier-${p.tier} rounded-md w-8 h-8 flex items-center justify-center text-[13px] font-black text-white shrink-0`} style={{ animation: 'none' }}>
									{p.overall}
								</div>
								<div className='min-w-0 flex-1'>
									<div className='text-sm font-bold text-white truncate'>
										{p.firstName} {p.lastName}
									</div>
									<div className='text-[10px] text-white/45'>
										{p.position}/{p.secondaryPosition} · {p.era === 'alltime' ? `${p.eraLabel} legend` : p.teamId}
									</div>
								</div>
								<Icon name={on ? 'heart' : 'plus'} size={18} className={on ? 'text-sky-400 fill-sky-400' : 'text-white/40'} />
							</button>
						);
					})}
				</div>
				<button onClick={onClose} className='mt-3 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white'>
					Done
				</button>
			</div>
		</div>
	);
}

/**
 * Every Versus setting, in the order you'd set them up. Used by the setup
 * screen and the in-series settings sheet. `lockDraft` greys out draft
 * settings while a draft is running (names, colors and favorites stay editable).
 */
export function SettingsForm({ s, setS, lockDraft }: { s: Settings; setS: SetS; lockDraft?: boolean }) {
	const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS(prev => normalizeSettings({ ...prev, [k]: v }));
	const [favFor, setFavFor] = useState<Side | null>(null);
	const counts: Record<PoolSetting, string> = {
		modern: `${MODERN_PLAYERS.length} players`,
		alltime: `${ALLTIME_PLAYERS.length} players`,
		mixed: `${MODERN_PLAYERS.length + ALLTIME_PLAYERS.length} players`,
		erawars: 'Split pools',
	};
	const auction = s.style === 'auction' || s.style === 'block';
	const activeQuick = QUICK_SETUPS.find(q => Object.entries(q.patch).every(([k, v]) => (s as unknown as Record<string, unknown>)[k] === v));
	return (
		<>
			{lockDraft && (
				<div className='rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs p-3 mb-4'>
					A draft is in progress — draft settings unlock once it&apos;s over and apply to the next draft. Names, colors and franchise guys update right away.
				</div>
			)}

			{/* Quick setups */}
			<div className={`mb-7 ${lockDraft ? 'opacity-40 pointer-events-none' : ''}`}>
				<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-2 flex items-center gap-1.5'><Icon name='zap' className='text-orange-300' /> Quick setup — or customize everything below</div>
				<div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
					{QUICK_SETUPS.map(q => (
						<button
							key={q.id}
							onClick={() => setS(prev => normalizeSettings({ ...prev, ...q.patch }))}
							className={`rounded-2xl p-3 text-left border transition-all ${activeQuick?.id === q.id ? 'border-orange-400 bg-orange-500/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
						>
							<Icon name={q.icon} size={24} className='text-orange-300 mb-1' />
							<div className='text-sm font-black text-white'>{q.title}</div>
							<div className='text-[10px] text-white/45 leading-tight'>{q.desc}</div>
						</button>
					))}
				</div>
			</div>

			<Section n={1} icon='users' title='Coaches' desc='Who’s playing tonight. Your record is saved by these names, so use the same ones every time.'>
				<RecentMatchups s={s} setS={setS} />
				<div className='grid grid-cols-2 gap-3'>
					{([0, 1] as Side[]).map(side => (
						<div key={side} className='space-y-2'>
							<IdentityEditor s={s} setS={setS} side={side} />
							<button onClick={() => setFavFor(side)} className='w-full rounded-xl px-3 py-2 text-left bg-white/[0.04] border border-white/10 hover:bg-white/[0.07]'>
								<div className='text-[10px] font-black uppercase tracking-widest text-white/50 flex items-center gap-1'><Icon name='heart' className='text-sky-400' /> Fav guys {s.favorites[side].length}/{MAX_FAVORITES}</div>
								<div className='text-[11px] text-white/75 truncate'>
									{s.favorites[side].length
										? s.favorites[side]
												.map(id => getVersusPlayer(id)?.lastName)
												.filter(Boolean)
												.join(', ')
										: 'Tap to pin your favorites'}
								</div>
							</button>
						</div>
					))}
				</div>
			</Section>
			{favFor !== null && <FavoritesPicker s={s} setS={setS} side={favFor} onClose={() => setFavFor(null)} />}

			<Section n={2} icon='ball' title='Player pool' desc='Who can be drafted. Themes narrow it down further for one draft.' locked={lockDraft}>
				<div className='grid grid-cols-4 gap-2 mb-2'>
					{POOLS.map(p => {
						const on = s.pool === p.id;
						const disabled = p.id === 'erawars' && auction;
						return (
							<button
								key={p.id}
								disabled={disabled}
								onClick={() => set('pool', p.id)}
								className={`rounded-2xl px-1.5 py-3 text-center border transition-all disabled:opacity-30 ${on ? 'border-orange-400 bg-orange-500/15 scale-[1.02]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
							>
								<Icon name={p.icon} size={24} className={`mb-1 ${on ? 'text-orange-300' : 'text-white/70'}`} />
								<div className='text-[13px] font-black text-white leading-tight'>{p.title}</div>
								<div className='text-[9px] text-white/45 leading-tight mt-0.5'>{p.sub}</div>
								<div className='text-[9px] font-bold text-orange-300/80 mt-1'>{counts[p.id]}</div>
							</button>
						);
					})}
				</div>
				{s.pool === 'erawars' && (
					<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 mb-2 animate-fade-in'>
						<div className='text-xs text-white/60 mb-2'>Who drafts today&apos;s players? The other coach gets the legends. Tiers use the same OVR ranges on both sides.</div>
						<div className='grid grid-cols-2 gap-2'>
							{([0, 1] as Side[]).map(side => (
								<button
									key={side}
									onClick={() => set('eraWarsModern', side)}
									className={`rounded-xl py-2 text-sm font-black border ${s.eraWarsModern === side ? 'bg-white text-black border-white' : 'bg-white/5 text-white/70 border-white/10'}`}
								>
									<Icon name='ball' className='mr-1' /> {s.names[side] || `Coach ${side + 1}`}
								</button>
							))}
						</div>
					</div>
				)}
				<div className='mt-3'>
					<Label>Theme drafts</Label>
					<div className='flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none]'>
						{[{ id: 'off', icon: 'ban', label: 'Off' }, { id: 'spin', icon: 'wheel', label: 'Spin each draft' }, ...THEMES.map(t => ({ id: t.id, icon: t.icon, label: t.label }))].map(o => (
							<button
								key={o.id}
								onClick={() => set('theme', o.id as Settings['theme'])}
								className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black border ${s.theme === o.id ? 'bg-white text-black border-white' : 'bg-white/5 text-white/70 border-white/10'}`}
							>
								<Icon name={o.icon} className='mr-1' />
								{o.label}
							</button>
						))}
					</div>
					<div className='text-[11px] text-white/45 mt-1.5'>
						{s.theme === 'off'
							? 'Every draft uses the whole pool.'
							: s.theme === 'spin'
								? 'Before each draft you spin a theme wheel — 90s legends only, one division, East vs West, nobody over 95… Only themes with enough players for your roster size land.'
								: `Every draft: ${THEMES.find(t => t.id === s.theme)?.desc}`}
					</div>
				</div>
			</Section>

			<Section n={3} icon='layers' title='Draft style' desc='How players get onto your rosters.' locked={lockDraft}>
				<div className='space-y-2 mb-2'>
					{STYLES.map(st => {
						const on = s.style === st.id;
						return (
							<button
								key={st.id}
								onClick={() => set('style', st.id)}
								className={`w-full flex items-center gap-3 text-left rounded-2xl p-3 border transition-all ${on ? 'border-orange-400 bg-orange-500/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
							>
								<span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-orange-500/25 text-orange-200' : 'bg-white/[0.06] text-white/70'}`}>
									<Icon name={st.icon} size={22} />
								</span>
								<div className='min-w-0'>
									<div className='text-base font-black text-white'>{st.title}</div>
									<div className='text-xs text-white/50 leading-snug'>{st.desc}</div>
								</div>
								<div className={`ml-auto w-5 h-5 rounded-full border-2 shrink-0 ${on ? 'border-orange-400 bg-orange-400' : 'border-white/25'}`} />
							</button>
						);
					})}
				</div>
				{auction && (
					<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 animate-fade-in space-y-3'>
						<Seg label={s.handicap ? `${s.names[0] || 'Coach 1'}'s budget` : 'Budget per coach'} value={s.budget} onChange={v => set('budget', v)} options={[100, 150, 200, 300].map(v => ({ v, l: `$${v}` }))} />
						{s.handicap && <Seg label={`${s.names[1] || 'Coach 2'}'s budget`} value={s.budget2} onChange={v => set('budget2', v)} options={[100, 150, 200, 300].map(v => ({ v, l: `$${v}` }))} />}
						<div className='text-[11px] text-white/45'>
							{s.style === 'block'
								? 'Lots come from your roster build, stars first, built around the positions you both need. You can only win as many players of a tier as you have slots for. Every coach keeps $1 per open slot; unsold players are gone, and late lots that must sell go for $1.'
								: 'Roster size comes from your roster build; tiers don’t restrict who you can nominate. Every coach keeps $1 per open slot.'}
						</div>
					</div>
				)}
				<div className='grid grid-cols-3 gap-2 mt-3'>
					<Seg label='Cards / pack' value={s.packSize} onChange={v => set('packSize', v)} options={[{ v: 3, l: '3' }, { v: 4, l: '4' }, { v: 5, l: '5' }]} />
					<Seg label='Rerolls' value={s.rerolls} onChange={v => set('rerolls', v)} options={[{ v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }]} />
					<Seg label='Shot clock (s)' value={s.shotClock} onChange={v => set('shotClock', v)} options={[{ v: 0, l: 'Off' }, { v: 20, l: '20' }, { v: 30, l: '30' }, { v: 45, l: '45' }]} />
				</div>
			</Section>

			<Section n={4} icon='clipboard' title='Roster build' desc='How many players of each tier each coach drafts — this is how stacked the teams are.' locked={lockDraft}>
				<div className='mb-2'>
					<Toggle
						on={s.handicap}
						onChange={v => setS(prev => normalizeSettings({ ...prev, handicap: v, tiers2: v ? { ...prev.tiers } : prev.tiers2, budget2: v ? prev.budget : prev.budget2 }))}
						title='Handicap mode'
						desc='Give each coach their own roster build (and auction budget). Turns off the Equalizer and underdog-first so the handicap sticks.'
					/>
				</div>
				{s.handicap ? (
					<>
						<TierBuilder s={s} setS={setS} field='tiers' title={`${s.names[0] || 'Coach 1'}'s roster`} color={s.identity[0].color} />
						<TierBuilder s={s} setS={setS} field='tiers2' title={`${s.names[1] || 'Coach 2'}'s roster`} color={s.identity[1].color} />
					</>
				) : (
					<TierBuilder s={s} setS={setS} />
				)}
				<div className='text-[10px] text-white/35 -mt-2'>
					One round per player. Both coaches draft from the same tier each round{s.shuffleRounds ? ', in shuffled order' : ', stars first'}.
				</div>
			</Section>

			<Section n={5} icon='rainbow' title='Player variety' desc='Keep the same guys from showing up every night — and track who you lean on.' locked={lockDraft}>
				<div className='space-y-3'>
					<div>
						<Seg label='Freshness boost' value={s.freshness} onChange={v => set('freshness', v)} options={[{ v: 'off', l: 'Off' }, { v: 'light', l: 'Light' }, { v: 'strong', l: 'Strong' }]} />
						<div className='text-[11px] text-white/45 mt-1'>Players neither of you has used come up more often; the ones you keep taking come up less. Cards are tagged “Never drafted” or “Your 4th time”.</div>
					</div>
					<div>
						<Seg label='Fresh faces per roster' value={s.freshFaces} onChange={v => set('freshFaces', v)} options={[{ v: 0, l: 'Off' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }]} />
						<div className='text-[11px] text-white/45 mt-1'>Each roster must include this many players that coach has never used. Once your remaining picks run short, only fresh faces can be taken.</div>
					</div>
					<div>
						<Seg label='Retire winners' value={s.retire} onChange={v => set('retire', v)} options={[{ v: 'off', l: 'Off' }, { v: 'potg', l: 'Player of Game' }, { v: 'starters', l: 'Winning 5' }]} />
						<div className='text-[11px] text-white/45 mt-1'>
							{s.retire === 'off' ? 'Winners can be drafted again right away.' : `After a win, ${s.retire === 'potg' ? 'your Player of the Game' : 'your starting five'} can't be drafted by you for the next ${RETIRE_DRAFTS} drafts — your opponent still can.`}
						</div>
					</div>
					<Toggle on={s.favoritesRound} onChange={v => set('favoritesRound', v)} title='Favorites round' desc='Before every draft, each coach grabs one of their pinned franchise guys (if he’s still available). Pin them in section 1.' />
				</div>
			</Section>

			<Section n={6} icon='scale' title='Balance' desc='Keep the teams close so it comes down to the sticks.' locked={lockDraft}>
				<div className='space-y-2'>
					<Toggle on={s.underdogFirst} onChange={v => set('underdogFirst', v)} title='Underdog picks first' desc='Whoever has the lower team OVR gets first dibs each round.' />
					<Toggle on={s.equalizer} onChange={v => set('equalizer', v)} title='Equalizer' desc='If the teams finish 1.5+ OVR apart, the underdog swaps their weakest player for a better free agent.' />
					<Toggle on={s.trades} onChange={v => set('trades', v)} title='Trade window' desc='After the draft, each coach gets one 1-for-1 trade offer.' />
				</div>
			</Section>

			<Section n={7} icon='bomb' title='Chaos' desc='Extra twists for draft night. All optional.' locked={lockDraft}>
				<div className='space-y-2'>
					<Toggle on={s.blindBid} onChange={v => set('blindBid', v)} title='Blind bid round' desc='One random round where you both pick in secret from the same pack. Pick the same guy and nobody gets him.' />
					<Toggle on={s.keepers} onChange={v => set('keepers', v)} title='Keepers' desc='When you redraft mid-series, each coach keeps one player from their last team.' />
					<Toggle on={s.blind} onChange={v => set('blind', v)} title='Mystery packs' desc='Cards are face-down — you only see tier and position until you draft.' />
					<Toggle on={s.shuffleRounds} onChange={v => set('shuffleRounds', v)} title='Shuffle round order' desc='Tier rounds come in random order instead of superstars first.' />
				</div>
			</Section>

			<Section n={8} icon='mic' title='Game night' desc='The broadcast around the draft and the game. Change these anytime.'>
				<div className='space-y-2'>
					<Toggle on={s.announcer} onChange={v => set('announcer', v)} title='Announcer' desc={`Your phone reads every pick aloud — “With the 4th pick, ${s.names[1] || 'Coach 2'} selects…” — and goes wild for superstars. Uses the phone’s built-in voice; the speaker button mutes it.`} />
					<Toggle on={s.vegas} onChange={v => set('vegas', v)} title='Vegas line' desc='A point spread before tip-off from the team ratings and your recent games. Enter the score to settle it — an underdog who covers earns a Tier Up for the next draft.' />
					<Toggle on={s.halftime} onChange={v => set('halftime', v)} title='Halftime wheel' desc='At halftime, tap who’s leading and the trailing team spins a second-half twist — bonus points, the leader benches their best player, and more.' />
				</div>
			</Section>

			<Section n={9} icon='trophy' title='Season' desc='Play a regular season, then a best-of Finals for the title. Standings live in Rivalry.'>
				<div className='space-y-3'>
					<Seg label='Regular season' value={s.season} onChange={v => set('season', v)} options={[{ v: 0, l: 'Off' }, { v: 6, l: '6 games' }, { v: 10, l: '10 games' }, { v: 16, l: '16 games' }]} />
					{s.season > 0 && <Seg label='Finals' value={s.finals} onChange={v => set('finals', v)} options={[{ v: 3, l: 'Best of 3' }, { v: 5, l: 'Best of 5' }, { v: 7, l: 'Best of 7' }]} />}
					{s.season > 0 && (
						<Toggle
							on={s.dynasty}
							onChange={v => set('dynasty', v)}
							title='Dynasty'
							desc={`Squads carry through the season (run it back between games). Each new season opens with a draft lottery — the worse record gets 3 of 4 ping-pong balls — then you each keep up to 3 players. A one-time trade deadline opens at mid-season.`}
						/>
					)}
					<div className='text-[11px] text-white/45'>
						{s.season > 0
							? `Every game counts toward the season. After ${s.season} games, the better record gets home court (picks first in every Finals draft), then it's first to ${Math.floor(s.finals / 2) + 1} wins. A new length starts with the next season.`
							: 'Games still count toward the all-time rivalry record — just no standings or titles.'}
					</div>
				</div>
			</Section>

			<Section n={10} icon='wheel' title='Your wheels' desc='Write your own challenges, sabotages, twists and halftime rules, and share them with your rival.'>
				<CustomWheelsEditor s={s} setS={setS} />
			</Section>
		</>
	);
}

export default function SetupScreen({ initial, onStart, onRivalry, onHelp, onLeagues }: { initial: Settings; onStart: (s: Settings) => void; onRivalry: () => void; onHelp: () => void; onLeagues: () => void }) {
	const [s, setS] = useState<Settings>(() => normalizeSettings(initial));
	const [showRatings, setShowRatings] = useState(false);
	const [showRankings, setShowRankings] = useState(false);
	const [firstTime] = useState(() => !matchups().length && !initial.names[0] && !initial.names[1]);
	const a = s.names[0].trim();
	const b = s.names[1].trim();
	const why = !a || !b ? 'Enter both coach names to start' : a.toLowerCase() === b.toLowerCase() ? 'The two coaches need different names' : !settingsValid(s) ? 'Each roster needs at least 5 players' : null;
	return (
		<div className='w-full max-w-2xl mx-auto px-4 pb-28 animate-fade-in'>
			{/* Hero */}
			<div className='text-center pt-6 pb-6'>
				<div className='inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/50 mb-2'>
					<span className='w-6 h-px bg-white/30' /> NBA 2K27 Draft Night <span className='w-6 h-px bg-white/30' />
				</div>
				<h1 className='text-4xl sm:text-5xl font-black tracking-tight leading-none'>
					<span style={{ color: s.identity[0].color, opacity: s.names[0] ? 1 : 0.45 }}>{s.names[0] || 'Coach 1'}</span>
					<span className='text-white/30 mx-3 text-3xl align-middle'>vs</span>
					<span style={{ color: s.identity[1].color, opacity: s.names[1] ? 1 : 0.45 }}>{s.names[1] || 'Coach 2'}</span>
				</h1>
				<div className='flex justify-center gap-6 mt-1.5 min-h-[18px]'>
					<CoachBadges side={0} />
					<CoachBadges side={1} />
				</div>
				<p className='text-sm text-white/50 mt-3 max-w-md mx-auto'>Draft two squads from real 2K27 ratings — as balanced or as broken as you like — spin for the rules, then settle it on the sticks.</p>
				<div className='mt-4 flex flex-wrap justify-center gap-2'>
					<button onClick={onHelp} className='inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/85 bg-orange-500/20 hover:bg-orange-500/30 rounded-full px-4 py-2 border border-orange-400/40'>
						<Icon name='help' /> How it works
					</button>
					<button onClick={onRivalry} className='inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/70 bg-white/10 hover:bg-white/15 rounded-full px-4 py-2 border border-white/10'>
						<Icon name='chart' /> Rivalry record
					</button>
					<button onClick={onLeagues} className='inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/70 bg-white/10 hover:bg-white/15 rounded-full px-4 py-2 border border-white/10'>
						<Icon name='arena' /> Leagues
					</button>
					<button onClick={() => setShowRankings(true)} className='inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/70 bg-white/10 hover:bg-white/15 rounded-full px-4 py-2 border border-white/10'>
						<Icon name='trophy' /> Rankings
					</button>
					<InstallButton />
				</div>
				{showRankings && <PowerRankings onClose={() => setShowRankings(false)} highlight={s.names} />}
				<button onClick={() => setShowRatings(true)} className='mt-3 text-[11px] font-bold text-white/45 underline decoration-white/20'>
					{lastRatingUpdate() ? (
						<>
							<Icon name='trendUp' className='mr-1' />
							Ratings updated {fmtDate(lastRatingUpdate()!.date)} — see who moved
						</>
					) : (
						'2K27 launch ratings'
					)}
				</button>
				{showRatings && <RatingsSheet onClose={() => setShowRatings(false)} />}
			</div>

			{s.league &&
				(() => {
					const l = loadLeagues().find(x => x.id === s.league!.id);
					return (
						<div className='rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3 mb-6 flex items-center gap-3'>
							<Icon name='arena' size={28} className='text-emerald-300 shrink-0' />
							<div className='flex-1 min-w-0 text-[13px] text-white/80'>
								<div className='font-black text-white'>League match{l ? ` · ${l.name}` : ''}</div>
								The next game you finish counts for the league{s.league!.match.startsWith('p:') ? ' playoffs' : ''}.
							</div>
							<button onClick={() => setS(prev => ({ ...prev, league: null }))} className='text-[11px] text-white/50 underline shrink-0'>
								Make it a friendly
							</button>
						</div>
					);
				})()}

			{firstTime && (
				<div className='rounded-2xl border border-orange-400/30 bg-orange-500/[0.08] p-4 mb-6 animate-fade-in'>
					<div className='text-base font-black text-white mb-1'>Welcome to Versus</div>
					<ol className='text-[13px] text-white/70 space-y-1 list-decimal pl-5'>
						<li>Two people, one phone: type both names in section 1.</li>
						<li>Pick a quick setup (Classic is a great first night) or customize anything.</li>
						<li>Hit the coin toss, draft, then play the game in NBA 2K and come back for the result.</li>
					</ol>
					<div className='text-[11px] text-white/45 mt-2'>
						No account needed — every game saves on this phone under your names.{cloudEnabled ? ' Want it backed up and shared with your opponent? Sign in from the ⋯ menu → Account (optional).' : ''}
					</div>
				</div>
			)}

			<SettingsForm s={s} setS={setS} />

			{/* CTA */}
			<div className='fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent z-30'>
				<button
					disabled={!settingsValid(s)}
					onClick={() => onStart(normalizeSettings({ ...s, names: [s.names[0].trim(), s.names[1].trim()] }))}
					className='btn-primary w-full max-w-2xl mx-auto block text-white text-lg font-black uppercase tracking-wider py-4 rounded-2xl disabled:opacity-40'
				>
					{why ?? 'To the Coin Toss →'}
				</button>
			</div>
		</div>
	);
}
