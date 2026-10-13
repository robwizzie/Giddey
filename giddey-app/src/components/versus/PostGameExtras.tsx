'use client';

import { useEffect, useMemo } from 'react';
import { GameResult, other, Side, VersusState } from '@/lib/versus/engine';
import { history } from '@/lib/versus/history';
import { seasons, winsNeeded } from '@/lib/versus/seasons';
import { achievementsFor, unlockedIds } from '@/lib/versus/achievements';
import { getVersusPlayer } from '@/lib/versus/pool';
import { announce } from '@/lib/versus/announcer';
import { Confetti, SIDE_COLORS } from './Fx';

/** Spread result for the game that just ended */
export function CoverCard({ state, last }: { state: VersusState; last: GameResult }) {
	const { names } = state.settings;
	if (!last.line) return null;
	const { fav, spread } = last.line;
	const dog = other(fav);
	const settled = last.score[0] !== null && last.score[1] !== null;
	return (
		<div className={`rounded-2xl border p-4 mb-4 ${last.covered !== null && last.covered !== undefined ? 'border-emerald-400/50 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.03]'}`}>
			<div className='text-[11px] font-black uppercase tracking-widest text-emerald-300/80 mb-1'>
				📈 Line: {names[fav]} −{spread}
			</div>
			{!settled ? (
				<div className='text-sm text-white/55'>No final score entered, so the spread wasn&apos;t settled.</div>
			) : last.covered !== null && last.covered !== undefined ? (
				<div className='text-sm text-white'>
					<span className='font-black' style={{ color: SIDE_COLORS[dog] }}>
						{names[dog]}
					</span>{' '}
					covered as the underdog — <span className='font-black text-amber-300'>⬆️ Tier Up</span> for the next draft.
				</div>
			) : (
				<div className='text-sm text-white/75'>
					<span className='font-black' style={{ color: SIDE_COLORS[fav] }}>
						{names[fav]}
					</span>{' '}
					covered as the favorite.
				</div>
			)}
		</div>
	);
}

/** Season standings, or the championship banner when this game clinched it */
export function SeasonCard({ state, last }: { state: VersusState; last: GameResult }) {
	const { names } = state.settings;
	const tag = last.season;
	const summary = useMemo(() => (tag ? seasons(history()).find(x => x.n === tag.n) : undefined), [tag]);
	const clinched = !!summary && summary.champion !== null && tag?.stage === 'finals' && summary.finalsWins[summary.champion] === winsNeeded(summary.finals) && last.winner === summary.champion;
	useEffect(() => {
		// after the "Ballgame!" call
		if (!clinched || !summary) return;
		const t = setTimeout(() => announce(`And that's the title! ${names[summary.champion!]} are your Season ${summary.n} champions!`, { hype: true, interrupt: false }), 600);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	if (!tag || !summary) return null;
	if (clinched) {
		const champ = summary.champion!;
		const mvp = summary.finalsMvp ? getVersusPlayer(summary.finalsMvp) : null;
		return (
			<div className='relative rounded-3xl border-2 p-5 mb-4 text-center overflow-hidden vs-pop' style={{ borderColor: '#facc15', background: `linear-gradient(170deg, ${SIDE_COLORS[champ]}40, #facc1522 60%, transparent)` }}>
				<Confetti count={140} colors={['#facc15', SIDE_COLORS[champ], '#ffffff']} />
				<div className='text-6xl'>🏆</div>
				<div className='text-[11px] font-black uppercase tracking-[0.3em] text-yellow-200/80 mt-1'>Season {summary.n} champion</div>
				<div className='text-4xl font-black' style={{ color: SIDE_COLORS[champ] }}>
					{names[champ]}
				</div>
				<div className='text-sm font-black text-white/80 mt-1'>
					Won the Finals {summary.finalsWins[champ]}–{summary.finalsWins[other(champ)]}
				</div>
				{mvp && (
					<div className='mt-2 text-sm text-yellow-200'>
						🏅 Finals MVP: <span className='font-black text-white'>{mvp.firstName} {mvp.lastName}</span>
					</div>
				)}
				<div className='text-[11px] text-white/45 mt-2'>The banner hangs in the 📊 Rivalry page. Next game starts Season {summary.n + 1}.</div>
			</div>
		);
	}
	const reg = summary.regular[0] + summary.regular[1];
	const inFinals = tag.stage === 'finals' || reg >= summary.len;
	const leader: Side | null = inFinals ? (summary.finalsWins[0] === summary.finalsWins[1] ? null : summary.finalsWins[0] > summary.finalsWins[1] ? 0 : 1) : summary.regular[0] === summary.regular[1] ? null : summary.regular[0] > summary.regular[1] ? 0 : 1;
	return (
		<div className='rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.04] p-4 mb-4'>
			<div className='text-[11px] font-black uppercase tracking-widest text-yellow-200/80 mb-2 text-center'>🏆 Season {summary.n} {inFinals ? '· Finals' : `· ${reg}/${summary.len} games`}</div>
			<div className='flex items-center justify-center gap-6'>
				{([0, 1] as Side[]).map(side => (
					<div key={side} className='text-center'>
						<div className='text-xs font-black uppercase' style={{ color: SIDE_COLORS[side] }}>
							{names[side]}
							{summary.seed === side && <span title='Home court'> 🏠</span>}
						</div>
						<div className='text-3xl font-black text-white tabular-nums'>{inFinals ? summary.finalsWins[side] : summary.regular[side]}</div>
					</div>
				))}
			</div>
			<div className='text-center text-[11px] text-white/55 mt-1'>
				{inFinals
					? `Best of ${summary.finals} — first to ${winsNeeded(summary.finals)}. ${summary.seed !== null ? `${names[summary.seed]} has home court and picks first in every Finals draft.` : ''}`
					: reg >= summary.len
						? 'Regular season over — the Finals start next game.'
						: `${summary.len - reg} regular-season game${summary.len - reg === 1 ? '' : 's'} left${leader !== null ? ` · ${names[leader]} leads for home court` : ''}.`}
			</div>
		</div>
	);
}

/** Badges this game unlocked */
export function NewBadges({ state }: { state: VersusState }) {
	const { names } = state.settings;
	const fresh = useMemo(() => {
		const all = history();
		const before = all.slice(0, -1);
		return ([0, 1] as Side[]).map(side => {
			const had = unlockedIds(before, side);
			return achievementsFor(all, side).filter(x => x.done && !had.has(x.a.id));
		});
	}, []);
	if (!fresh[0].length && !fresh[1].length) return null;
	return (
		<div className='rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/[0.06] p-4 mb-4'>
			<div className='text-[11px] font-black uppercase tracking-widest text-fuchsia-300/90 mb-2 text-center'>🏅 Badge unlocked</div>
			<div className='space-y-2'>
				{([0, 1] as Side[]).flatMap(side =>
					fresh[side].map(x => (
						<div key={`${side}-${x.a.id}`} className='flex items-center gap-3 vs-pop'>
							<div className='text-3xl'>{x.a.icon}</div>
							<div className='min-w-0'>
								<div className='text-sm font-black text-white'>
									<span style={{ color: SIDE_COLORS[side] }}>{names[side]}</span> · {x.a.title}
								</div>
								<div className='text-[11px] text-white/55'>{x.a.desc}</div>
							</div>
						</div>
					)),
				)}
			</div>
		</div>
	);
}
