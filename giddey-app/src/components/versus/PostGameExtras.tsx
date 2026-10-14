'use client';

import { useEffect, useMemo, useState } from 'react';
import { GameResult, other, Side, VersusState } from '@/lib/versus/engine';
import { history } from '@/lib/versus/history';
import { seasons, winsNeeded } from '@/lib/versus/seasons';
import { achievementsFor, unlockedIds } from '@/lib/versus/achievements';
import { getVersusPlayer } from '@/lib/versus/pool';
import { announce } from '@/lib/versus/announcer';
import { computeElo, eloGameKey } from '@/lib/versus/elo';
import { loadRivalry } from '@/lib/versus/rivalry';
import { champion, leagueGames, loadLeagues, standings } from '@/lib/versus/league';
import { Confetti, SIDE_COLORS } from './Fx';
import Icon, { IconTile } from './Icon';
import { belt } from '@/lib/versus/legacy';
import { BeltCutscene, BeltDefense } from './Belt';

/** Spread result for the game that just ended */
export function CoverCard({ state, last }: { state: VersusState; last: GameResult }) {
	const { names } = state.settings;
	if (!last.line) return null;
	const { fav, spread } = last.line;
	const dog = other(fav);
	const settled = last.score[0] !== null && last.score[1] !== null;
	return (
		<div className={`rounded-2xl border p-4 mb-4 ${last.covered !== null && last.covered !== undefined ? 'border-emerald-400/50 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.03]'}`}>
			<div className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-300/80 mb-1'>
				<Icon name='trendUp' />
				Line: {names[fav]} −{spread}
			</div>
			{!settled ? (
				<div className='text-sm text-white/55'>No final score entered, so the spread wasn&apos;t settled.</div>
			) : last.covered !== null && last.covered !== undefined ? (
				<div className='text-sm text-white'>
					<span className='font-black' style={{ color: SIDE_COLORS[dog] }}>
						{names[dog]}
					</span>{' '}
					covered as the underdog — <span className='font-black text-amber-300 whitespace-nowrap'>
						<Icon name='chevronsUp' className='mr-0.5' />
						Tier Up
					</span> for the next draft.
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
				<Icon name='trophy' size={60} className='text-yellow-300 drop-shadow-[0_0_18px_rgba(250,204,21,0.45)]' />
				<div className='text-[11px] font-black uppercase tracking-[0.3em] text-yellow-200/80 mt-1'>Season {summary.n} champion</div>
				<div className='text-4xl font-black' style={{ color: SIDE_COLORS[champ] }}>
					{names[champ]}
				</div>
				<div className='text-sm font-black text-white/80 mt-1'>
					Won the Finals {summary.finalsWins[champ]}–{summary.finalsWins[other(champ)]}
				</div>
				{mvp && (
					<div className='mt-2 text-sm text-yellow-200'>
						<Icon name='medal' className='mr-1' />
						Finals MVP: <span className='font-black text-white'>{mvp.firstName} {mvp.lastName}</span>
					</div>
				)}
				<div className='text-[11px] text-white/45 mt-2'>The banner hangs in the Rivalry page. Next game starts Season {summary.n + 1}.</div>
			</div>
		);
	}
	const reg = summary.regular[0] + summary.regular[1];
	const inFinals = tag.stage === 'finals' || reg >= summary.len;
	const leader: Side | null = inFinals ? (summary.finalsWins[0] === summary.finalsWins[1] ? null : summary.finalsWins[0] > summary.finalsWins[1] ? 0 : 1) : summary.regular[0] === summary.regular[1] ? null : summary.regular[0] > summary.regular[1] ? 0 : 1;
	return (
		<div className='rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.04] p-4 mb-4'>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-200/80 mb-2'>
				<Icon name='trophy' />
				Season {summary.n} {inFinals ? '· Finals' : `· ${reg}/${summary.len} games`}</div>
			<div className='flex items-center justify-center gap-6'>
				{([0, 1] as Side[]).map(side => (
					<div key={side} className='text-center'>
						<div className='inline-flex items-center gap-1 text-xs font-black uppercase' style={{ color: SIDE_COLORS[side] }}>
							{names[side]}
							{summary.seed === side && (
								<span title='Home court' aria-label='Home court' className='text-yellow-200'>
									<Icon name='home' />
								</span>
							)}
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

/** This game counted for a league: where it leaves the table */
export function LeagueResultCard({ last, onOpen }: { last: GameResult; onOpen: () => void }) {
	const info = useMemo(() => {
		if (!last.league) return null;
		const l = loadLeagues().find(x => x.id === last.league!.id);
		if (!l) return null;
		const games = leagueGames(l, loadRivalry());
		return { l, table: standings(l, games), champ: champion(l, games), playoff: last.league.match.startsWith('p:') };
	}, [last]);
	if (!info) return null;
	return (
		<div className='rounded-2xl border border-emerald-400/40 bg-emerald-500/[0.07] p-4 mb-4'>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-300 mb-2'>
				<Icon name='arena' />
				Counted for {info.l.name}
				{info.playoff ? ' · playoffs' : ''}
			</div>
			{info.champ ? (
				<div className='flex items-center justify-center gap-2 text-2xl font-black text-white mb-2'>
					<Icon name='trophy' className='text-yellow-300' />
					{info.champ} wins the league!
				</div>
			) : (
				<div className='space-y-0.5 mb-2'>
					{info.table.slice(0, 4).map((r, i) => (
						<div key={r.name} className='flex justify-between text-[13px]'>
							<span className='text-white'>
								<span className='text-white/40 mr-2'>{i + 1}</span>
								{r.name}
							</span>
							<span className='text-white/70 tabular-nums'>
								{r.wins}-{r.losses}
							</span>
						</div>
					))}
				</div>
			)}
			<button onClick={onOpen} className='w-full rounded-xl py-2 text-sm font-black text-emerald-200 bg-emerald-500/15 border border-emerald-400/30'>
				Open the league →
			</button>
		</div>
	);
}

/** Both secret picks, revealed, and who called it closer */
export function PredictionReveal({ state, last }: { state: VersusState; last: GameResult }) {
	const { names } = state.settings;
	const p = last.predictions;
	if (!p?.[0] || !p[1]) return null;
	return (
		<div className='rounded-2xl border border-violet-400/30 bg-violet-400/[0.06] p-4 mb-4'>
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-violet-300 mb-2'>
				<Icon name='sparkles' />
				Predictions
			</div>
			<div className='grid grid-cols-2 gap-2 text-center'>
				{([0, 1] as Side[]).map(side => (
					<div key={side} className={`rounded-xl p-2 ${last.oracle === side ? 'bg-violet-400/15 border border-violet-300/50' : ''}`}>
						<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
							{names[side]}
						</div>
						<div className='text-sm font-black text-white'>
							{names[p[side]!.winner]} by {p[side]!.margin}
						</div>
						{last.oracle === side && <div className='inline-flex items-center gap-1 text-[10px] text-violet-200 font-black'>
								Closest · <Icon name='userPlus' /> +1 Rotation
							</div>}
					</div>
				))}
			</div>
			{last.oracle === null || last.oracle === undefined ? <div className='text-[11px] text-white/45 text-center mt-1'>Dead heat — no bonus.</div> : null}
		</div>
	);
}

/** How tonight's result moved both coaches' power ratings */
export function EloCard({ state }: { state: VersusState }) {
	const { names } = state.settings;
	const move = useMemo(() => {
		const all = loadRivalry();
		const last = [...all].sort((a, b) => a.ts - b.ts).filter(g => g.names.map(n => n.trim().toLowerCase()).sort().join('|') === names.map(n => n.trim().toLowerCase()).sort().join('|')).pop();
		if (!last) return null;
		const m = computeElo(all).moves.get(eloGameKey(last));
		if (!m) return null;
		// seat the numbers to tonight's coach order
		const flip = last.names[0].trim().toLowerCase() !== names[0].trim().toLowerCase();
		return flip ? { before: [m.before[1], m.before[0]], after: [m.after[1], m.after[0]] } : m;
	}, [names]);
	if (!move) return null;
	return (
		<div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3 mb-4 flex items-center justify-around'>
			{([0, 1] as Side[]).map(side => {
				const d = move.after[side] - move.before[side];
				return (
					<div key={side} className='text-center'>
						<div className='text-[10px] font-black uppercase tracking-widest' style={{ color: SIDE_COLORS[side] }}>
							{names[side]}
						</div>
						<div className='text-xl font-black text-white tabular-nums'>
							{move.after[side]} <span className={`text-sm ${d >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{d >= 0 ? `+${d}` : d}</span>
						</div>
					</div>
				);
			})}
			<div className='flex flex-col items-center gap-0.5 text-[10px] text-white/40 text-center w-20 leading-tight'>
				<Icon name='gauge' size={16} className='text-white/50' />
				Power rating
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
			<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-fuchsia-300/90 mb-2'>
				<Icon name='award' />
				Badge unlocked
			</div>
			<div className='space-y-2'>
				{([0, 1] as Side[]).flatMap(side =>
					fresh[side].map(x => (
						<div key={`${side}-${x.a.id}`} className='flex items-center gap-3 vs-pop'>
							<IconTile name={x.a.icon} color={SIDE_COLORS[side]} size={40} />
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

const BELT_SEEN = 'giddey-versus-belt-seen';

/**
 * The championship belt after this game: a full-screen cutscene when it
 * changed hands (once per game, per device), otherwise a title-defense card.
 * The page logs the game to the rivalry history right after recordGame, so
 * history() already holds it — we find it by its timestamp.
 */
export function BeltMoment({ state, last }: { state: VersusState; last: GameResult }) {
	const { names } = state.settings;
	const info = useMemo(() => {
		if (last.league) return null;
		const h = history();
		const i = last.playedAt !== undefined ? h.findIndex(g => g.ts === last.playedAt) : h.length - 1;
		if (i < 0) return null;
		const b = belt(h.slice(0, i + 1));
		if (!b) return null;
		return { b, key: String(h[i].ts) };
	}, [last]);
	const [show, setShow] = useState(false);
	useEffect(() => {
		if (!info?.b.changed) return;
		try {
			if (sessionStorage.getItem(BELT_SEEN) === info.key) return;
		} catch {
			/* storage blocked — show it anyway */
		}
		// after the "Ballgame!" moment lands
		const t = setTimeout(() => {
			try {
				sessionStorage.setItem(BELT_SEEN, info.key);
			} catch {
				/* storage blocked */
			}
			setShow(true);
		}, 1400);
		return () => clearTimeout(t);
	}, [info]);
	if (!info) return null;
	const { b } = info;
	if (!b.changed) return <BeltDefense names={names} holder={b.holder} defenses={b.defenses} />;
	const from: Side | null = b.games > 1 ? other(b.holder) : null;
	return (
		<>
			{show && <BeltCutscene names={names} from={from} to={b.holder} onDone={() => setShow(false)} />}
			<div className='rounded-2xl border-2 border-yellow-400/60 p-4 mb-4 text-center vs-rise' style={{ background: `linear-gradient(170deg, rgba(250,204,21,0.16), ${SIDE_COLORS[b.holder]}18 70%)` }}>
				<div className='flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-yellow-300/90'>
					<Icon name='award' />
					{from !== null ? 'New belt champion' : 'First belt champion'}
				</div>
				<div className='text-2xl font-black mt-0.5' style={{ color: SIDE_COLORS[b.holder] }}>
					{names[b.holder]}
				</div>
				<div className='text-[12px] text-white/55'>
					{from !== null ? `Took it from ${names[from]}. ` : ''}
					Reign #{b.reigns[b.holder]}
				</div>
				<button onClick={() => setShow(true)} className='mt-2 min-h-[36px] text-xs font-bold text-yellow-200/70 underline'>
					Replay the moment
				</button>
			</div>
		</>
	);
}
