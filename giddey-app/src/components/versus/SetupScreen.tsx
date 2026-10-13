'use client';

import { useState } from 'react';
import { BLUEPRINTS, BAND_INFO, DraftStyle, Settings } from '@/lib/versus/engine';
import { ALLTIME_PLAYERS, MODERN_PLAYERS, PoolMode } from '@/lib/versus/pool';
import { SIDE_COLORS } from './Fx';

const POOLS: { id: PoolMode; title: string; sub: string; icon: string }[] = [
	{ id: 'modern', title: 'Modern', sub: 'Current 2K27 rosters', icon: '🏀' },
	{ id: 'alltime', title: 'All-Time', sub: '2K27 All-Time teams', icon: '👑' },
	{ id: 'mixed', title: 'Both', sub: 'Legends meet today', icon: '⚡' },
];

const STYLES: { id: DraftStyle; title: string; icon: string; desc: string }[] = [
	{ id: 'snake', title: 'Pack Snake', icon: '🐍', desc: 'Each round a pack drops from that round’s tier. Pick, then they pick from what’s left.' },
	{ id: 'cut', title: 'I Cut, You Choose', icon: '✂️', desc: 'One coach splits 2 cards from the pack, the other takes one. Cutter gets the leftover. Perfectly fair.' },
	{ id: 'franchise', title: 'Franchise Wheel', icon: '🎡', desc: 'Spin a franchise every round — the pack comes only from that team. Chaos with guardrails.' },
];

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
	return (
		<div>
			<div className='text-[11px] font-bold uppercase tracking-wider text-white/45 mb-1.5'>{label}</div>
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

export default function SetupScreen({ initial, onStart, seriesActive }: { initial: Settings; onStart: (s: Settings) => void; seriesActive: boolean }) {
	const [s, setS] = useState<Settings>(initial);
	const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS(prev => ({ ...prev, [k]: v }));
	const counts: Record<PoolMode, number> = { modern: MODERN_PLAYERS.length, alltime: ALLTIME_PLAYERS.length, mixed: MODERN_PLAYERS.length + ALLTIME_PLAYERS.length };
	const blueprint = BLUEPRINTS[s.rosterSize];
	const valid = s.names[0].trim() && s.names[1].trim() && s.names[0].trim() !== s.names[1].trim();

	return (
		<div className='w-full max-w-2xl mx-auto px-4 pb-28 animate-fade-in'>
			{/* Hero */}
			<div className='text-center pt-6 pb-6'>
				<div className='inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/50 mb-2'>
					<span className='w-6 h-px bg-white/30' /> NBA 2K27 Draft Night <span className='w-6 h-px bg-white/30' />
				</div>
				<h1 className='text-4xl sm:text-5xl font-black tracking-tight leading-none'>
					<span style={{ color: SIDE_COLORS[0] }}>{s.names[0] || 'P1'}</span>
					<span className='text-white/30 mx-3 text-3xl align-middle'>vs</span>
					<span style={{ color: SIDE_COLORS[1] }}>{s.names[1] || 'P2'}</span>
				</h1>
				<p className='text-sm text-white/50 mt-3 max-w-md mx-auto'>Draft two balanced squads from real 2K27 ratings, spin for the rules, then settle it on the sticks.</p>
			</div>

			{/* Names */}
			<div className='grid grid-cols-2 gap-3 mb-6'>
				{[0, 1].map(i => (
					<div key={i} className='rounded-2xl p-3 border' style={{ borderColor: `${SIDE_COLORS[i]}55`, background: `linear-gradient(135deg, ${SIDE_COLORS[i]}22, transparent)` }}>
						<div className='text-[10px] font-black uppercase tracking-widest mb-1' style={{ color: SIDE_COLORS[i] }}>
							Coach {i + 1}
						</div>
						<input
							value={s.names[i]}
							maxLength={12}
							onChange={e => {
								const names: [string, string] = [...s.names];
								names[i] = e.target.value;
								set('names', names);
							}}
							className='w-full bg-transparent text-xl font-black text-white outline-none placeholder:text-white/20'
							placeholder={i ? 'Dave' : 'Rob'}
						/>
					</div>
				))}
			</div>

			{/* Pool */}
			<div className='text-[11px] font-bold uppercase tracking-wider text-white/45 mb-1.5'>Player Pool</div>
			<div className='grid grid-cols-3 gap-2 mb-6'>
				{POOLS.map(p => {
					const on = s.pool === p.id;
					return (
						<button
							key={p.id}
							onClick={() => set('pool', p.id)}
							className={`rounded-2xl p-3 text-center border transition-all ${on ? 'border-orange-400 bg-orange-500/15 scale-[1.02]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
						>
							<div className='text-2xl mb-1'>{p.icon}</div>
							<div className='text-sm font-black text-white'>{p.title}</div>
							<div className='text-[10px] text-white/45 leading-tight'>{p.sub}</div>
							<div className='text-[10px] font-bold text-orange-300/80 mt-1'>{counts[p.id]} players</div>
						</button>
					);
				})}
			</div>

			{/* Style */}
			<div className='text-[11px] font-bold uppercase tracking-wider text-white/45 mb-1.5'>Draft Style</div>
			<div className='space-y-2 mb-6'>
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

			{/* Numbers */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4'>
				<Seg label='Roster size' value={s.rosterSize} onChange={v => set('rosterSize', v)} options={[{ v: 5, l: '5' }, { v: 8, l: '8' }, { v: 10, l: '10' }]} />
				<Seg label='Cards per pack' value={s.packSize} onChange={v => set('packSize', v)} options={[{ v: 3, l: '3' }, { v: 4, l: '4' }, { v: 5, l: '5' }]} />
				<Seg label='Rerolls each' value={s.rerolls} onChange={v => set('rerolls', v)} options={[{ v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }]} />
			</div>

			{/* Blueprint preview */}
			<div className='rounded-2xl border border-white/10 bg-black/30 p-3 mb-6'>
				<div className='flex items-center justify-between mb-2'>
					<div className='text-[11px] font-bold uppercase tracking-wider text-white/45'>Round blueprint</div>
					<div className='text-[10px] text-white/35'>Both coaches draft from the same tier each round</div>
				</div>
				<div className='flex gap-1'>
					{blueprint.map((b, i) => (
						<div key={i} className='flex-1 min-w-0'>
							<div className='h-2 rounded-full' style={{ background: BAND_INFO[b].color }} />
							<div className='text-[9px] font-bold text-center mt-1 truncate' style={{ color: BAND_INFO[b].color }}>
								R{i + 1}
							</div>
						</div>
					))}
				</div>
				<div className='flex flex-wrap gap-x-3 gap-y-1 mt-2'>
					{[...new Set(blueprint)].map(b => (
						<span key={b} className='text-[10px] font-semibold text-white/55 flex items-center gap-1'>
							<span className='w-2 h-2 rounded-full' style={{ background: BAND_INFO[b].color }} /> {BAND_INFO[b].label}
						</span>
					))}
				</div>
			</div>

			{/* Toggles */}
			<div className='text-[11px] font-bold uppercase tracking-wider text-white/45 mb-1.5'>Balance &amp; chaos</div>
			<div className='space-y-2 mb-8'>
				<Toggle on={s.underdogFirst} onChange={v => set('underdogFirst', v)} title='Underdog picks first' desc='Whoever has the lower team OVR gets first dibs each round. Keeps it tight.' />
				<Toggle on={s.blind} onChange={v => set('blind', v)} title='Mystery packs' desc='Cards are face-down — you only see tier and position until you draft.' />
				<Toggle on={s.trades} onChange={v => set('trades', v)} title='Trade window' desc='After the draft, each coach gets one 1-for-1 trade offer.' />
				<div className='flex items-center gap-2 text-[11px] text-white/45 px-1 pt-1'>
					<span className='text-green-400'>⚖️</span> Always on: if teams finish 1.5+ OVR apart, the underdog gets an Equalizer pick.
				</div>
			</div>

			{/* CTA */}
			<div className='fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent z-30'>
				<button
					disabled={!valid}
					onClick={() => onStart({ ...s, names: [s.names[0].trim(), s.names[1].trim()] })}
					className='btn-primary w-full max-w-2xl mx-auto block text-white text-lg font-black uppercase tracking-wider py-4 rounded-2xl disabled:opacity-40'
				>
					{seriesActive ? 'Save & Back' : 'To the Coin Toss →'}
				</button>
			</div>
		</div>
	);
}
