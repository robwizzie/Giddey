'use client';

import { useEffect, useState } from 'react';
import { availableFavorites, chooseFavorite, other, pickThemeParam, setTheme, themeOptions, VersusState } from '@/lib/versus/engine';
import { getTheme, themeTitle, ThemeId } from '@/lib/versus/themes';
import { getVersusPlayer } from '@/lib/versus/pool';
import Wheel from './Wheel';
import VersusCard from './VersusCard';
import { Confetti, SectionTitle, SIDE_COLORS } from './Fx';
import { TaggedCard } from './Tags';

type SetState = (s: VersusState) => void;

function BottomBar({ children }: { children: React.ReactNode }) {
	return (
		<div className='fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>
			<div className='max-w-3xl mx-auto flex gap-2'>{children}</div>
		</div>
	);
}

/** Spin the theme for this draft */
export function ThemeScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const options = themeOptions(state);
	const [landed, setLanded] = useState<{ id: ThemeId; param?: string } | null>(null);
	const [size] = useState(() => (typeof window === 'undefined' ? 300 : Math.min(330, window.innerWidth - 48)));
	const theme = landed ? getTheme(landed.id) : undefined;
	return (
		<div className='min-h-screen pb-28'>
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker={`Game ${state.gameNo} · Theme draft`} title='Spin the theme' sub='The theme decides who’s in the pool for this draft — a great way to play with guys you never pick.' />
				{!landed ? (
					<div className='flex flex-col items-center'>
						<Wheel
							items={options.map(t => ({ id: t.id, label: `${t.icon} ${t.label}`, color: t.color }))}
							size={size}
							accent='#a855f7'
							onResult={i => {
								const id = options[i].id;
								setTimeout(() => setLanded({ id, param: pickThemeParam(state, id) }), 700);
							}}
						/>
						<div className='mt-4 flex flex-wrap justify-center gap-1.5 max-w-md'>
							{options.map(t => (
								<span key={t.id} className='text-[10px] font-bold text-white/55 bg-white/5 rounded-full px-2 py-0.5'>
									{t.icon} {t.label}
								</span>
							))}
						</div>
					</div>
				) : (
					theme && (
						<div className='flex flex-col items-center text-center vs-pop'>
							<Confetti count={50} colors={[theme.color, '#ffffff']} />
							<div className='text-7xl mb-2'>{theme.icon}</div>
							<div className='text-3xl font-black text-white'>{themeTitle(landed, state.settings.names)}</div>
							<div className='text-sm text-white/65 mt-2 max-w-sm'>{theme.desc}</div>
							{landed.id === 'division' && <div className='text-sm font-black mt-2' style={{ color: theme.color }}>Tonight: the {landed.param}</div>}
						</div>
					)
				)}
			</div>
			<BottomBar>
				<button onClick={() => setState(setTheme(state, null))} className='rounded-2xl px-4 py-3.5 font-bold text-sm bg-white/10 text-white/70'>
					No theme
				</button>
				<button
					disabled={!landed}
					onClick={() => landed && setState(setTheme(state, landed.id, landed.param))}
					className='flex-1 btn-primary rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'
				>
					{landed ? 'Lock it in →' : 'Spin first'}
				</button>
			</BottomBar>
		</div>
	);
}

/** Favorites round: grab one of your pinned franchise guys before the draft */
export function FavoritesScreen({ state, setState }: { state: VersusState; setState: SetState }) {
	const side = state.favoriteTurn;
	const [chosen, setChosen] = useState<string | null>(null);
	useEffect(() => setChosen(null), [side]);
	const name = state.settings.names[side];
	const avail = availableFavorites(state, side);
	const otherPick = state.favoritePicks[other(side)];
	const pinned = state.settings.favorites?.[side] ?? [];
	const gone = pinned.filter(id => !avail.includes(id));
	return (
		<div className='min-h-screen pb-28'>
			<div className='max-w-3xl mx-auto px-4 pt-6 animate-fade-in'>
				<SectionTitle kicker='💙 Favorites round' title={`${name}, grab your franchise guy`} sub='Take one of your pinned players before the draft starts. He fills one of your rounds in his tier.' />
				{otherPick && (
					<div className='text-center text-xs text-white/55 mb-4'>
						<span className='font-black' style={{ color: SIDE_COLORS[other(side)] }}>
							{state.settings.names[other(side)]}
						</span>{' '}
						grabbed <span className='font-black text-white'>{getVersusPlayer(otherPick)?.lastName}</span>.
					</div>
				)}
				{avail.length === 0 && <div className='text-center text-sm text-white/60 my-8'>None of your franchise guys are available this draft — tap Skip.</div>}
				<div className='flex flex-wrap justify-center gap-3'>
					{avail.map(id => {
						const p = getVersusPlayer(id);
						if (!p) return null;
						return (
							<div key={id} className='vs-deal'>
								<TaggedCard state={state} side={side} id={id}>
									<VersusCard player={p} width={120} selected={chosen === id} onClick={() => setChosen(chosen === id ? null : id)} />
								</TaggedCard>
							</div>
						);
					})}
				</div>
				{gone.length > 0 && (
					<div className='text-center text-[11px] text-white/40 mt-5'>
						Not available this time:{' '}
						{gone
							.map(id => getVersusPlayer(id)?.lastName)
							.filter(Boolean)
							.join(', ')}{' '}
						(taken, retired from your side, or outside tonight&apos;s theme)
					</div>
				)}
			</div>
			<BottomBar>
				<button onClick={() => setState(chooseFavorite(state, null))} className='rounded-2xl px-4 py-3.5 font-bold text-sm bg-white/10 text-white/70'>
					Skip
				</button>
				<button
					disabled={!chosen}
					onClick={() => setState(chooseFavorite(state, chosen))}
					className='flex-1 rounded-2xl py-3.5 font-black uppercase tracking-wider text-white disabled:opacity-35'
					style={{ background: chosen ? SIDE_COLORS[side] : 'rgba(255,255,255,0.08)' }}
				>
					{chosen ? `Grab ${getVersusPlayer(chosen)?.lastName}` : 'Pick one'}
				</button>
			</BottomBar>
		</div>
	);
}
