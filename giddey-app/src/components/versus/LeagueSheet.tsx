'use client';

import { useMemo, useState } from 'react';
import {
	bracket,
	champion,
	DEFAULT_FORMAT,
	League,
	LEAGUE_MAX,
	LEAGUE_MIN,
	LeagueFormat,
	LeagueTag,
	leagueGames,
	loadLeagues,
	Match,
	newLeagueId,
	regularDone,
	regularMatches,
	removeLeague,
	standings,
	upNext,
	upsertLeague,
} from '@/lib/versus/league';
import { loadRivalry, matchups, RivalryGame } from '@/lib/versus/rivalry';
import { cloudEnabled, joinLeague, leaveCloudLeague, peekLeague, updateCloudLeague, uploadLeague } from '@/lib/versus/cloud';
import { useCloud } from './AccountSheet';
import GameDetail from './GameDetail';

const field = 'w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/30';

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
	return (
		<div>
			<div className='text-[10px] font-black uppercase tracking-widest text-white/45 mb-1'>{label}</div>
			<div className='flex gap-1 rounded-xl bg-white/[0.05] p-1'>
				{options.map(o => (
					<button key={String(o.v)} disabled={o.disabled} onClick={() => onChange(o.v)} className={`flex-1 rounded-lg py-1.5 text-xs font-black disabled:opacity-25 ${value === o.v ? 'bg-white text-black' : 'text-white/60'}`}>
						{o.l}
					</button>
				))}
			</div>
		</div>
	);
}

function statusOf(l: League, games: RivalryGame[]): string {
	const champ = champion(l, games);
	if (champ) return `🏆 ${champ} won it`;
	if (bracket(l, games).length) return '🔥 Playoffs';
	const played = regularMatches(l, games).filter(m => m.winner).length;
	return `${played}/${regularMatches(l, games).length} regular-season games`;
}

/** New league: name, coaches, format */
function CreateLeague({ onDone, onCancel, seedNames }: { onDone: (l: League) => void; onCancel: () => void; seedNames: string[] }) {
	const cloud = useCloud();
	const [name, setName] = useState('');
	const [names, setNames] = useState<string[]>(() => [...new Set(seedNames.filter(Boolean))].slice(0, LEAGUE_MAX));
	const [add, setAdd] = useState('');
	const [format, setFormat] = useState<LeagueFormat>(DEFAULT_FORMAT);
	const [online, setOnline] = useState(!!cloud.session);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const suggestions = useMemo(() => [...new Set(matchups().flatMap(m => m.names))].filter(n => !names.some(x => x.toLowerCase() === n.toLowerCase())).slice(0, 10), [names]);
	const addName = (n: string) => {
		const v = n.trim().slice(0, 12);
		if (!v || names.some(x => x.toLowerCase() === v.toLowerCase()) || names.length >= LEAGUE_MAX) return;
		setNames([...names, v]);
		setAdd('');
	};
	const ok = name.trim() && names.length >= LEAGUE_MIN;
	return (
		<div className='space-y-4'>
			<input className={field} maxLength={32} placeholder='League name (e.g. Couch League 2026)' value={name} onChange={e => setName(e.target.value)} />
			<div>
				<div className='text-[10px] font-black uppercase tracking-widest text-white/45 mb-1'>
					Coaches · {names.length}/{LEAGUE_MAX} (at least {LEAGUE_MIN})
				</div>
				<div className='flex flex-wrap gap-1.5 mb-2'>
					{names.map(n => (
						<button key={n} onClick={() => setNames(names.filter(x => x !== n))} className='rounded-full px-3 py-1 text-xs font-black bg-white text-black'>
							{n} ✕
						</button>
					))}
				</div>
				<div className='flex gap-2'>
					<input className={field} maxLength={12} placeholder='Add a coach' value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => e.key === 'Enter' && addName(add)} />
					<button onClick={() => addName(add)} disabled={!add.trim()} className='shrink-0 rounded-xl px-4 text-xs font-black text-white bg-white/10 border border-white/15 disabled:opacity-40'>
						Add
					</button>
				</div>
				{suggestions.length > 0 && (
					<div className='flex flex-wrap gap-1.5 mt-2'>
						{suggestions.map(n => (
							<button key={n} onClick={() => addName(n)} className='rounded-full px-2.5 py-1 text-[11px] font-bold bg-white/5 text-white/60 border border-white/10'>
								＋ {n}
							</button>
						))}
					</div>
				)}
			</div>
			<Seg label='Regular season' value={format.rounds} onChange={v => setFormat({ ...format, rounds: v })} options={[{ v: 1, l: 'Play everyone once' }, { v: 2, l: 'Twice (home & away)' }]} />
			<Seg
				label='Playoffs'
				value={format.playoff}
				onChange={v => setFormat({ ...format, playoff: v })}
				options={[
					{ v: 0, l: 'None' },
					{ v: 2, l: 'Top 2' },
					{ v: 4, l: 'Top 4', disabled: names.length < 4 },
					{ v: 8, l: 'Top 8', disabled: names.length < 8 },
				]}
			/>
			{format.playoff > 0 && <Seg label='Playoff series' value={format.bestOf} onChange={v => setFormat({ ...format, bestOf: v })} options={[{ v: 1, l: 'One game' }, { v: 3, l: 'Best of 3' }, { v: 5, l: 'Best of 5' }]} />}
			<div className='text-[11px] text-white/45'>
				{names.length >= LEAGUE_MIN
					? `${((names.length * (names.length - 1)) / 2) * format.rounds} regular-season games${format.playoff ? `, then the top ${Math.min(format.playoff, names.length)} go to the playoffs` : ' — best record wins'}.`
					: 'Add at least 3 coaches.'}
			</div>
			{cloudEnabled && (
				<button onClick={() => cloud.session && setOnline(!online)} className={`w-full flex items-center gap-3 text-left rounded-xl px-3 py-2.5 border ${online ? 'border-sky-400/40 bg-sky-500/10' : 'border-white/10 bg-white/[0.04]'}`}>
					<div className='flex-1'>
						<div className='text-sm font-black text-white'>☁️ Online league</div>
						<div className='text-[11px] text-white/50'>{cloud.session ? 'Friends join with an invite code and log games from their own phones. Standings update for everyone.' : 'Sign in from 👤 to share the league with everyone’s phones.'}</div>
					</div>
					<div className={`w-5 h-5 rounded-full border-2 ${online ? 'border-sky-400 bg-sky-400' : 'border-white/25'}`} />
				</button>
			)}
			{err && <div className='text-xs text-red-300 text-center'>{err}</div>}
			<div className='flex gap-2'>
				<button onClick={onCancel} className='rounded-2xl px-4 py-3 font-bold text-sm bg-white/10 text-white/70'>
					Cancel
				</button>
				<button
					disabled={!ok || busy}
					onClick={async () => {
						const l: League = { id: newLeagueId(), name: name.trim(), names, format: { ...format, playoff: (Math.min(format.playoff, names.length >= 8 ? 8 : names.length >= 4 ? 4 : 2) as LeagueFormat['playoff']) }, createdAt: Date.now() };
						if (online && cloud.session) {
							setBusy(true);
							try {
								onDone(await uploadLeague(l));
							} catch (e) {
								setErr((e as Error).message);
							} finally {
								setBusy(false);
							}
							return;
						}
						upsertLeague(l);
						onDone(l);
					}}
					className='flex-1 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white disabled:opacity-40'
				>
					{busy ? 'Creating…' : 'Create league'}
				</button>
			</div>
		</div>
	);
}

function JoinLeague({ code: initial, onDone }: { code?: string; onDone: () => void }) {
	const cloud = useCloud();
	const [code, setCode] = useState(initial ?? '');
	const [peek, setPeek] = useState<{ name: string; names: string[]; claimed: string[] } | null>(null);
	const [err, setErr] = useState<string | null>(null);
	if (!cloud.session) return <div className='text-sm text-white/55 rounded-xl bg-white/[0.04] border border-white/10 p-3'>Sign in from 👤 first, then join with the code your commissioner sent.</div>;
	return (
		<div className='space-y-2'>
			<div className='flex gap-2'>
				<input className={`${field} uppercase tracking-widest font-black`} maxLength={8} placeholder='INVITE CODE' value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
				<button
					disabled={code.trim().length < 6}
					onClick={async () => {
						setErr(null);
						try {
							const p = await peekLeague(code);
							if (!p) setErr('No league with that code');
							setPeek(p);
						} catch (e) {
							setErr((e as Error).message);
						}
					}}
					className='shrink-0 rounded-xl px-4 text-xs font-black text-white bg-white/10 border border-white/15 disabled:opacity-40'
				>
					Find
				</button>
			</div>
			{peek && (
				<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3'>
					<div className='text-sm font-black text-white mb-2'>
						{peek.name} — which coach are you?
					</div>
					<div className='flex flex-wrap gap-1.5'>
						{peek.names.map(n => {
							const taken = peek.claimed.some(c => c.toLowerCase() === n.toLowerCase());
							return (
								<button
									key={n}
									disabled={taken}
									onClick={async () => {
										try {
											await joinLeague(code, n);
											onDone();
										} catch (e) {
											setErr((e as Error).message);
										}
									}}
									className='rounded-full px-3 py-1.5 text-xs font-black bg-white text-black disabled:bg-white/10 disabled:text-white/30'
								>
									{n}
									{taken ? ' · taken' : ''}
								</button>
							);
						})}
					</div>
				</div>
			)}
			{err && <div className='text-xs text-red-300 text-center'>{err}</div>}
		</div>
	);
}

function MatchRow({ m, onPlay, onOpen }: { m: Match; onPlay?: () => void; onOpen?: (g: RivalryGame) => void }) {
	return (
		<div className='flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px]'>
			<div className='text-[10px] text-white/40 w-20 shrink-0'>{m.label}</div>
			<div className='flex-1 min-w-0 truncate text-white'>
				<span className={m.winner && m.winner === m.names[0] ? 'font-black' : m.winner ? 'text-white/45' : 'font-bold'}>{m.names[0]}</span>
				<span className='text-white/35'> {m.stage === 'playoff' && m.games.length ? `${m.wins[0]}–${m.wins[1]}` : 'vs'} </span>
				<span className={m.winner && m.winner === m.names[1] ? 'font-black' : m.winner ? 'text-white/45' : 'font-bold'}>{m.names[1]}</span>
			</div>
			{m.games.length > 0 && onOpen && m.stage === 'regular' && (
				<button onClick={() => onOpen(m.games[m.games.length - 1])} className='text-white/40 shrink-0'>
					{m.games[0].score[0] !== null ? `${m.games[0].score[0]}–${m.games[0].score[1]}` : '✓'} ›
				</button>
			)}
			{onPlay && !m.winner && !m.names.includes('TBD') && (
				<button onClick={onPlay} className='shrink-0 btn-primary rounded-lg px-2.5 py-1 text-[10px] font-black uppercase text-white'>
					▶ Play
				</button>
			)}
		</div>
	);
}

function LeagueView({ l, onBack, onPlay }: { l: League; onBack: () => void; onPlay: (names: [string, string], tag: LeagueTag) => void }) {
	const [tab, setTab] = useState<'standings' | 'schedule' | 'playoffs'>('standings');
	const [open, setOpen] = useState<RivalryGame | null>(null);
	const [msg, setMsg] = useState<string | null>(null);
	const [version, setVersion] = useState(0);
	const cloud = useCloud();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const games = useMemo(() => leagueGames(l, loadRivalry()), [l, version, cloud.lastSync]);
	const table = standings(l, games);
	const reg = regularMatches(l, games);
	const br = bracket(l, games);
	const champ = champion(l, games);
	const next = upNext(l, games);
	const play = (m: Match) => onPlay(m.names, { id: l.id, match: m.key });
	const share = async () => {
		if (!l.cloud) return;
		const url = `${location.origin}${location.pathname}#league=${l.cloud.inviteCode}`;
		try {
			if (navigator.share) return void (await navigator.share({ title: `Join ${l.name}`, text: `Join ${l.name} on Giddey Versus — code ${l.cloud.inviteCode}`, url }));
		} catch {
			/* dismissed */
		}
		try {
			await navigator.clipboard.writeText(url);
			setMsg('✓ Invite link copied');
		} catch {
			setMsg(`Code: ${l.cloud.inviteCode}`);
		}
	};
	return (
		<div>
			<button onClick={onBack} className='text-xs text-white/45 mb-2'>
				← All leagues
			</button>
			<div className='text-xl font-black text-white'>{l.name}</div>
			<div className='text-[11px] text-white/45 mb-3'>
				{l.names.length} coaches · {l.format.rounds === 2 ? 'home & away' : 'play everyone once'}
				{l.format.playoff ? ` · top ${l.format.playoff} playoffs${l.format.bestOf > 1 ? `, best of ${l.format.bestOf}` : ''}` : ''}
				{l.cloud ? ' · ☁️ online' : ' · on this phone'}
			</div>
			{champ && (
				<div className='rounded-2xl border-2 border-yellow-400/60 bg-yellow-400/10 p-4 text-center mb-4 vs-pop'>
					<div className='text-5xl'>🏆</div>
					<div className='text-[11px] font-black uppercase tracking-[0.3em] text-yellow-200/80'>{l.name} champion</div>
					<div className='text-3xl font-black text-white'>{champ}</div>
				</div>
			)}
			{!champ && next.length > 0 && (
				<div className='mb-4'>
					<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1.5'>▶ Up next</div>
					<div className='space-y-1'>
						{next.slice(0, 4).map(m => (
							<MatchRow key={m.key} m={m} onPlay={() => play(m)} />
						))}
					</div>
					<div className='text-[10px] text-white/35 mt-1'>Tap ▶ Play: the two coaches are set and the next game you finish counts for the league.</div>
				</div>
			)}
			<div className='flex gap-1 rounded-xl bg-white/[0.05] p-1 mb-3'>
				{(['standings', 'schedule', 'playoffs'] as const).map(t => (
					<button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-xs font-black capitalize ${tab === t ? 'bg-white text-black' : 'text-white/60'}`}>
						{t === 'standings' ? '📋 Standings' : t === 'schedule' ? '🗓️ Schedule' : '🏆 Playoffs'}
					</button>
				))}
			</div>
			{tab === 'standings' && (
				<div className='rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden mb-4'>
					<div className='grid grid-cols-[1.5rem_1fr_3rem_3rem_3rem] gap-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/40'>
						<div>#</div>
						<div>Coach</div>
						<div className='text-right'>W-L</div>
						<div className='text-right'>Diff</div>
						<div className='text-right'>Strk</div>
					</div>
					{table.map((r, i) => (
						<div key={r.name} className={`grid grid-cols-[1.5rem_1fr_3rem_3rem_3rem] gap-1 px-3 py-2 text-[13px] border-t border-white/5 ${l.format.playoff && i < l.format.playoff ? '' : 'opacity-60'}`}>
							<div className='text-white/50 font-black'>{i + 1}</div>
							<div className='text-white font-black truncate'>
								{r.name}
								{l.format.playoff > 0 && i === Math.min(l.format.playoff, l.names.length) - 1 && <span className='ml-1 text-[9px] text-white/35'>— playoff line</span>}
							</div>
							<div className='text-right text-white tabular-nums'>
								{r.wins}-{r.losses}
							</div>
							<div className={`text-right tabular-nums ${r.pf - r.pa > 0 ? 'text-emerald-300' : r.pf - r.pa < 0 ? 'text-red-300' : 'text-white/50'}`}>{r.pf - r.pa > 0 ? `+${r.pf - r.pa}` : r.pf - r.pa}</div>
							<div className='text-right text-white/60'>{r.streak}</div>
						</div>
					))}
				</div>
			)}
			{tab === 'schedule' && (
				<div className='space-y-1 mb-4'>
					{reg.map(m => (
						<MatchRow key={m.key} m={m} onPlay={champ || br.length ? undefined : () => play(m)} onOpen={setOpen} />
					))}
				</div>
			)}
			{tab === 'playoffs' && (
				<div className='mb-4'>
					{!l.format.playoff ? (
						<div className='text-sm text-white/55'>No playoffs — the best regular-season record wins the league.</div>
					) : !br.length ? (
						<div className='text-sm text-white/55 rounded-xl bg-white/[0.04] border border-white/10 p-3'>
							The top {Math.min(l.format.playoff, l.names.length)} make the bracket once all {reg.length} regular-season games are played ({reg.filter(m => m.winner).length} so far).
							{(!l.cloud || l.cloud.isCommissioner) && !regularDone(l, games) && (
								<button
									onClick={async () => {
										if (!confirm('Start the playoffs now with the current standings?')) return;
										if (l.cloud) await updateCloudLeague(l.id, { playoffs_early: true });
										else upsertLeague({ ...l, playoffsEarly: true });
										setVersion(v => v + 1);
										Object.assign(l, { playoffsEarly: true });
									}}
									className='block mt-2 text-xs font-black text-amber-300 underline'
								>
									Commissioner: start the playoffs now
								</button>
							)}
						</div>
					) : (
						<div className='space-y-3'>
							{br.map((round, i) => (
								<div key={i}>
									<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1'>{round[0]?.label}</div>
									<div className='space-y-1'>
										{round.map(m => (
											<MatchRow key={m.key} m={m} onPlay={() => play(m)} />
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
			{l.cloud ? (
				<button onClick={share} className='w-full rounded-xl py-2.5 text-sm font-black text-sky-200 bg-sky-500/15 border border-sky-400/30 mb-2'>
					📨 Invite coaches · {l.cloud.inviteCode}
				</button>
			) : (
				cloud.session && (
					<button
						onClick={async () => {
							try {
								await uploadLeague(l);
								onBack();
							} catch (e) {
								setMsg((e as Error).message);
							}
						}}
						className='w-full rounded-xl py-2.5 text-sm font-black text-sky-200 bg-sky-500/15 border border-sky-400/30 mb-2'
					>
						☁️ Put this league online
					</button>
				)
			)}
			{msg && <div className='text-center text-xs text-emerald-300 mb-2'>{msg}</div>}
			<button
				onClick={async () => {
					const owner = !l.cloud || l.cloud.isCommissioner;
					if (!confirm(owner ? `Delete ${l.name}? Its games stay in your rivalry records.` : `Leave ${l.name}?`)) return;
					if (l.cloud) await leaveCloudLeague(l);
					else removeLeague(l.id);
					onBack();
				}}
				className='w-full text-xs font-bold text-red-300/60 py-2'
			>
				{!l.cloud || l.cloud.isCommissioner ? 'Delete league' : 'Leave league'}
			</button>
			{open && <GameDetail g={open} names={open.names} onClose={() => setOpen(null)} />}
		</div>
	);
}

/** Leagues for 3+ coaches: list, create, join, and each league's table */
export default function LeagueSheet({ onClose, onPlay, seedNames, joinCode }: { onClose: () => void; onPlay: (names: [string, string], tag: LeagueTag) => void; seedNames: string[]; joinCode?: string | null }) {
	const cloud = useCloud();
	const [view, setView] = useState<'list' | 'new' | 'join' | string>(joinCode ? 'join' : 'list');
	const [version, setVersion] = useState(0);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const leagues = useMemo(() => loadLeagues().sort((a, b) => b.createdAt - a.createdAt), [version, view, cloud.lastSync]);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const all = useMemo(() => loadRivalry(), [version, view, cloud.lastSync]);
	const current = leagues.find(l => l.id === view);
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-3'>
					<div className='text-lg font-black text-white'>🏟️ Leagues</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
					</button>
				</div>
				{current ? (
					<LeagueView l={current} onBack={() => setView('list')} onPlay={onPlay} />
				) : view === 'new' ? (
					<CreateLeague
						seedNames={seedNames}
						onCancel={() => setView('list')}
						onDone={l => {
							setVersion(v => v + 1);
							setView(l.id);
						}}
					/>
				) : view === 'join' ? (
					<>
						<button onClick={() => setView('list')} className='text-xs text-white/45 mb-2'>
							← All leagues
						</button>
						<JoinLeague code={joinCode ?? undefined} onDone={() => setView('list')} />
					</>
				) : (
					<div className='space-y-3'>
						<div className='text-xs text-white/50'>A league for 3 to 12 coaches: everyone plays everyone, the standings decide the playoff seeds, and the bracket crowns a champion. Each game is a normal Versus game between two of you.</div>
						{leagues.map(l => (
							<button key={l.id} onClick={() => setView(l.id)} className='w-full text-left rounded-2xl bg-white/[0.04] border border-white/10 p-3 hover:bg-white/[0.07]'>
								<div className='flex items-center justify-between'>
									<div className='text-sm font-black text-white truncate'>{l.name}</div>
									<div className='text-[10px] text-white/40 shrink-0'>{l.cloud ? '☁️ online' : 'this phone'}</div>
								</div>
								<div className='text-[11px] text-white/55'>
									{l.names.length} coaches · {statusOf(l, leagueGames(l, all))}
								</div>
							</button>
						))}
						<div className='flex gap-2'>
							<button onClick={() => setView('new')} className='flex-1 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white'>
								＋ New league
							</button>
							{cloudEnabled && (
								<button onClick={() => setView('join')} className='rounded-2xl px-4 py-3 font-black text-sm text-white bg-white/10 border border-white/15'>
									Join
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
