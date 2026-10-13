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
} from '@/lib/versus/engine';
import { ALLTIME_PLAYERS, MODERN_PLAYERS } from '@/lib/versus/pool';

const POOLS: { id: PoolSetting; title: string; sub: string; icon: string }[] = [
	{ id: 'modern', title: 'Modern', sub: 'Current 2K27 rosters', icon: '🏀' },
	{ id: 'alltime', title: 'All-Time', sub: '2K27 All-Time teams', icon: '👑' },
	{ id: 'mixed', title: 'Both', sub: 'Legends meet today', icon: '⚡' },
	{ id: 'erawars', title: 'Era Wars', sub: 'Modern vs Legends', icon: '⚔️' },
];

const STYLES: { id: DraftStyle; title: string; icon: string; desc: string }[] = [
	{ id: 'snake', title: 'Pack Snake', icon: '🐍', desc: 'Each round a pack drops from that round’s tier. Pick, then they pick from what’s left.' },
	{ id: 'cut', title: 'I Cut, You Choose', icon: '✂️', desc: 'One coach splits 2 cards from the pack, the other takes one. Cutter gets the leftover. Perfectly fair.' },
	{ id: 'franchise', title: 'Franchise Wheel', icon: '🎡', desc: 'Spin a franchise every round — the pack comes only from that team. Chaos with guardrails.' },
	{ id: 'auction', title: 'Auction', icon: '💰', desc: 'Salary cap draft. Nominate anyone in the pool and bid it out. Most strategic way to draft.' },
];

const EMOJIS = ['🔥', '🧊', '🐍', '👑', '⚡', '🦅', '🐐', '💎', '🚀', '🐺', '🦁', '🌪️', '☠️', '🎯', '🏆', '🍀'];

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
								{p.icon} {p.label}
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
				placeholder={side ? 'Dave' : 'Rob'}
				aria-label={`Coach ${side + 1} name`}
			/>
			<div className='text-[11px] text-white/55 truncate'>
				{id.emoji} {id.team || 'Name your team'}
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
						{EMOJIS.map(e => (
							<button key={e} onClick={() => set({ emoji: e })} className={`w-8 h-8 rounded-lg text-lg ${id.emoji === e ? 'bg-white/25 ring-2 ring-white/60' : 'bg-white/5'}`}>
								{e}
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

/**
 * Every Versus setting. Used by the setup screen and the in-series settings sheet.
 * `lockDraft` greys out draft settings while a draft is running (names stay editable).
 */
export function SettingsForm({ s, setS, lockDraft }: { s: Settings; setS: SetS; lockDraft?: boolean }) {
	const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS(prev => normalizeSettings({ ...prev, [k]: v }));
	const counts: Record<PoolSetting, string> = {
		modern: `${MODERN_PLAYERS.length} players`,
		alltime: `${ALLTIME_PLAYERS.length} players`,
		mixed: `${MODERN_PLAYERS.length + ALLTIME_PLAYERS.length} players`,
		erawars: 'Split pools',
	};
	const lock = lockDraft ? 'opacity-40 pointer-events-none' : '';
	return (
		<>
			{/* Coaches */}
			<div className='grid grid-cols-2 gap-3 mb-6'>
				<IdentityEditor s={s} setS={setS} side={0} />
				<IdentityEditor s={s} setS={setS} side={1} />
			</div>

			{lockDraft && (
				<div className='rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs p-3 mb-4'>
					A draft is in progress — draft settings unlock once it&apos;s over and apply to the next draft. Names and colors update right away.
				</div>
			)}

			<div className={lock}>
				{/* Pool */}
				<Label>Player pool</Label>
				<div className='grid grid-cols-4 gap-2 mb-2'>
					{POOLS.map(p => {
						const on = s.pool === p.id;
						const disabled = p.id === 'erawars' && s.style === 'auction';
						return (
							<button
								key={p.id}
								disabled={disabled}
								onClick={() => set('pool', p.id)}
								className={`rounded-2xl px-1.5 py-3 text-center border transition-all disabled:opacity-30 ${on ? 'border-orange-400 bg-orange-500/15 scale-[1.02]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
							>
								<div className='text-2xl mb-1'>{p.icon}</div>
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
									🏀 {s.names[side] || `Coach ${side + 1}`}
								</button>
							))}
						</div>
					</div>
				)}
				<div className='mb-6' />

				{/* Style */}
				<Label>Draft style</Label>
				<div className='space-y-2 mb-2'>
					{STYLES.map(st => {
						const on = s.style === st.id;
						return (
							<button
								key={st.id}
								onClick={() => set('style', st.id)}
								className={`w-full flex items-center gap-3 text-left rounded-2xl p-3 border transition-all ${on ? 'border-orange-400 bg-orange-500/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
							>
								<div className='text-3xl w-10 text-center shrink-0'>{st.icon}</div>
								<div className='min-w-0'>
									<div className='text-base font-black text-white'>{st.title}</div>
									<div className='text-xs text-white/50 leading-snug'>{st.desc}</div>
								</div>
								<div className={`ml-auto w-5 h-5 rounded-full border-2 shrink-0 ${on ? 'border-orange-400 bg-orange-400' : 'border-white/25'}`} />
							</button>
						);
					})}
				</div>
				{s.style === 'auction' && (
					<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 mb-2 animate-fade-in space-y-3'>
						<Seg label={s.handicap ? `${s.names[0] || 'Coach 1'}'s budget` : 'Budget per coach'} value={s.budget} onChange={v => set('budget', v)} options={[100, 150, 200, 300].map(v => ({ v, l: `$${v}` }))} />
						{s.handicap && <Seg label={`${s.names[1] || 'Coach 2'}'s budget`} value={s.budget2} onChange={v => set('budget2', v)} options={[100, 150, 200, 300].map(v => ({ v, l: `$${v}` }))} />}
						<div className='text-[11px] text-white/45'>Roster size comes from the roster build below; tiers don&apos;t restrict who you can nominate. Every coach keeps $1 per open slot.</div>
					</div>
				)}
				<div className='mb-6' />
			</div>

			{/* Tier builder(s) */}
			<div className={lock}>
				<div className='mb-2'>
					<Toggle
						on={s.handicap}
						onChange={v => setS(prev => normalizeSettings({ ...prev, handicap: v, tiers2: v ? { ...prev.tiers } : prev.tiers2, budget2: v ? prev.budget : prev.budget2 }))}
						title='⚖️ Handicap mode'
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
				<div className='text-[10px] text-white/35 -mt-2 mb-6'>
					One round per player. Both coaches draft from the same tier each round{s.shuffleRounds ? ', in shuffled order' : ', stars first'}. Big superstar counts thin out the top tier, so later rounds dip into the next-best players.
				</div>

				{/* Numbers */}
				<div className='grid grid-cols-3 gap-2 mb-6'>
					<Seg label='Pack' value={s.packSize} onChange={v => set('packSize', v)} options={[{ v: 3, l: '3' }, { v: 4, l: '4' }, { v: 5, l: '5' }]} />
					<Seg label='Rerolls' value={s.rerolls} onChange={v => set('rerolls', v)} options={[{ v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }]} />
					<Seg label='Shot clock' value={s.shotClock} onChange={v => set('shotClock', v)} options={[{ v: 0, l: 'Off' }, { v: 20, l: '20' }, { v: 30, l: '30' }, { v: 45, l: '45' }]} />
				</div>

				{/* Toggles */}
				<Label>Balance &amp; chaos</Label>
				<div className='space-y-2'>
					<Toggle on={s.underdogFirst} onChange={v => set('underdogFirst', v)} title='Underdog picks first' desc='Whoever has the lower team OVR gets first dibs each round. Keeps it tight.' />
					<Toggle on={s.equalizer} onChange={v => set('equalizer', v)} title='Equalizer' desc='If the teams finish 1.5+ OVR apart, the underdog swaps their weakest player for a better free agent.' />
					<Toggle on={s.blindBid} onChange={v => set('blindBid', v)} title='🙈 Blind bid round' desc='One random round where you both pick in secret from the same pack. Pick the same guy and nobody gets him.' />
					<Toggle on={s.keepers} onChange={v => set('keepers', v)} title='🔒 Keepers' desc='When you redraft mid-series, each coach keeps one player from their last team.' />
					<Toggle on={s.blind} onChange={v => set('blind', v)} title='Mystery packs' desc='Cards are face-down — you only see tier and position until you draft.' />
					<Toggle on={s.shuffleRounds} onChange={v => set('shuffleRounds', v)} title='Shuffle round order' desc='Tier rounds come in random order instead of superstars first.' />
					<Toggle on={s.trades} onChange={v => set('trades', v)} title='Trade window' desc='After the draft, each coach gets one 1-for-1 trade offer.' />
				</div>
			</div>
		</>
	);
}

export default function SetupScreen({ initial, onStart, onRivalry }: { initial: Settings; onStart: (s: Settings) => void; onRivalry: () => void }) {
	const [s, setS] = useState<Settings>(() => normalizeSettings(initial));
	return (
		<div className='w-full max-w-2xl mx-auto px-4 pb-28 animate-fade-in'>
			{/* Hero */}
			<div className='text-center pt-6 pb-6'>
				<div className='inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/50 mb-2'>
					<span className='w-6 h-px bg-white/30' /> NBA 2K27 Draft Night <span className='w-6 h-px bg-white/30' />
				</div>
				<h1 className='text-4xl sm:text-5xl font-black tracking-tight leading-none'>
					<span style={{ color: s.identity[0].color }}>{s.names[0] || 'P1'}</span>
					<span className='text-white/30 mx-3 text-3xl align-middle'>vs</span>
					<span style={{ color: s.identity[1].color }}>{s.names[1] || 'P2'}</span>
				</h1>
				<p className='text-sm text-white/50 mt-3 max-w-md mx-auto'>Draft two squads from real 2K27 ratings — as balanced or as broken as you like — spin for the rules, then settle it on the sticks.</p>
				<button onClick={onRivalry} className='mt-4 text-xs font-black uppercase tracking-widest text-white/70 bg-white/10 hover:bg-white/15 rounded-full px-4 py-2 border border-white/10'>
					📊 Rivalry record
				</button>
			</div>

			<SettingsForm s={s} setS={setS} />

			{/* CTA */}
			<div className='fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent z-30'>
				<button
					disabled={!settingsValid(s)}
					onClick={() => onStart(normalizeSettings({ ...s, names: [s.names[0].trim(), s.names[1].trim()] }))}
					className='btn-primary w-full max-w-2xl mx-auto block text-white text-lg font-black uppercase tracking-wider py-4 rounded-2xl disabled:opacity-40'
				>
					To the Coin Toss →
				</button>
			</div>
		</div>
	);
}
