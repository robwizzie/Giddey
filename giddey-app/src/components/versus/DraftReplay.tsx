'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { teamOvr } from '@/lib/versus/engine';
import { canRecordClip, recordReplayClip, replayPicks, ReplayPick, shareClip } from '@/lib/versus/replayClip';
import { play } from '@/lib/versus/sound';
import Icon from './Icon';

type Side = 0 | 1;

const PER_PICK = 900;
const INTRO = 900;

function Slot({ p, color, fresh }: { p: ReplayPick | undefined; color: string; fresh: boolean }) {
	if (!p) return <div className='rounded-xl border border-dashed border-white/10 min-h-0' />;
	const pl = p.player;
	return (
		<div key={p.n} className={`relative min-h-0 rounded-xl border border-white/10 bg-white/[0.05] flex items-center gap-2 lg:gap-3 pl-3 pr-1.5 lg:pr-2.5 overflow-hidden ${fresh ? 'vs-deal' : ''}`} style={fresh ? { boxShadow: `0 0 24px ${color}66`, borderColor: `${color}aa` } : undefined}>
			<div className='absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full' style={{ background: color }} />
			<div className='min-w-0 flex-1 leading-tight'>
				<div className='text-[12px] sm:text-sm lg:text-xl font-black text-white truncate'>{pl ? `${pl.firstName[0]}. ${pl.lastName}` : p.id}</div>
				<div className='text-[9px] lg:text-xs font-black uppercase tracking-widest text-white/45 truncate'>
					Pick {p.n}
					{pl ? ` · ${pl.position}` : ''}
				</div>
			</div>
			{pl && (
				<div className={`tier-${pl.tier} rounded-lg h-[80%] max-h-12 lg:max-h-14 aspect-square flex items-center justify-center text-[12px] sm:text-sm lg:text-xl font-black text-white shrink-0`} style={{ animation: 'none' }}>
					{pl.overall}
				</div>
			)}
		</div>
	);
}

/**
 * Draft-day rewind: both rosters fill pick by pick, superstars flash.
 * `picks` = the draft in order ([side, id]); "Save clip" records the same
 * replay to a video and shares it (or downloads it).
 */
export default function DraftReplay({ names, picks, colors, title, onClose }: { names: [string, string]; picks: [0 | 1, string][]; colors: [string, string]; title?: string; onClose: () => void }) {
	const list = useMemo(() => replayPicks(picks), [picks]);
	// shown = picks on the board; -1 = intro
	const [shown, setShown] = useState(-1);
	const [playing, setPlaying] = useState(true);
	const [speed, setSpeed] = useState<1 | 2>(1);
	const [clip, setClip] = useState<{ state: 'idle' | 'recording' | 'done' | 'error'; p: number; msg?: string }>({ state: 'idle', p: 0 });
	const [canClip] = useState(() => canRecordClip());
	// one extra beat after the last pick, then the verdict
	const done = shown > list.length;

	useEffect(() => {
		if (!playing || done) return;
		const t = setTimeout(() => setShown(n => n + 1), (shown < 0 ? INTRO : PER_PICK) / speed);
		return () => clearTimeout(t);
	}, [playing, done, shown, speed]);

	// sound on each new pick
	useEffect(() => {
		if (shown === list.length + 1) play('crowd');
		if (shown < 1 || shown > list.length) return;
		play(list[shown - 1].superstar ? 'boom' : 'whoosh');
	}, [shown, list]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
			else if (e.key === ' ') {
				e.preventDefault();
				setPlaying(p => !p);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	const restart = () => {
		setShown(-1);
		setPlaying(true);
	};

	const saveClip = async () => {
		setClip({ state: 'recording', p: 0 });
		try {
			const blob = await recordReplayClip({ names, picks, colors, title, onProgress: p => setClip(c => (c.state === 'recording' ? { ...c, p } : c)) });
			const how = await shareClip(blob, `${names[0]}-vs-${names[1]}-draft`, title ?? `${names[0]} vs ${names[1]} draft`);
			setClip({ state: 'done', p: 1, msg: how === 'shared' ? 'Clip ready' : 'Clip saved' });
		} catch (e) {
			setClip({ state: 'error', p: 0, msg: (e as Error).message || 'Couldn’t record the clip' });
		}
	};

	const on = list.slice(0, Math.max(0, shown));
	const latest = shown > 0 && !done ? list[shown - 1] : null;
	const rows = Math.max(1, ...([0, 1] as Side[]).map(s => list.filter(p => p.side === s).length));
	const ids: [string[], string[]] = [on.filter(p => p.side === 0).map(p => p.id), on.filter(p => p.side === 1).map(p => p.id)];
	const ovr: [number, number] = [teamOvr(ids[0]), teamOvr(ids[1])];
	const lead: Side | null = Math.abs(ovr[0] - ovr[1]) < 0.05 ? null : ovr[0] > ovr[1] ? 0 : 1;

	return createPortal(
		<div className='fixed inset-0 z-[90] vs-bg flex flex-col animate-fade-in' role='dialog' aria-label='Draft replay'>
			{/* superstar flash, re-mounted per pick */}
			{latest?.superstar && <div key={`flash-${latest.n}`} className='pointer-events-none absolute inset-0 z-10 bg-white vs-flash' />}

			<div className='flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 lg:px-10 lg:pt-8'>
				<div className='flex-1 min-w-0'>
					<div className='text-[10px] lg:text-sm font-black uppercase tracking-widest text-white/45 truncate'>{title || 'Draft replay'}</div>
					<div className='text-lg lg:text-4xl font-black text-white truncate'>
						<span style={{ color: colors[0] }}>{names[0]}</span>
						<span className='text-white/40 mx-2 text-sm lg:text-2xl'>vs</span>
						<span style={{ color: colors[1] }}>{names[1]}</span>
					</div>
				</div>
				<button onClick={onClose} className='p-2 -mr-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10' aria-label='Close'>
					<Icon name='x' size={20} />
				</button>
			</div>

			{/* now picking */}
			<div className='h-16 lg:h-28 flex items-center justify-center px-4'>
				{shown < 0 ? (
					<div key='intro' className='vs-pop text-2xl lg:text-5xl font-black text-white tracking-tight'>
						{list.length} picks. Here we go.
					</div>
				) : latest ? (
					<div key={latest.n} className='vs-pop text-center'>
						<div className='text-[10px] lg:text-base font-black uppercase tracking-widest' style={{ color: colors[latest.side] }}>
							Pick {latest.n} · {names[latest.side]}
						</div>
						<div className='text-2xl lg:text-5xl font-black text-white leading-tight'>
							{latest.player ? `${latest.player.firstName} ${latest.player.lastName}` : latest.id}
							{latest.superstar && <span className='ml-2 align-middle inline-block rounded-md bg-yellow-400 text-black text-[10px] lg:text-base px-1.5 py-0.5 tracking-widest'>SUPERSTAR</span>}
						</div>
					</div>
				) : (
					<div key='end' className='vs-pop text-center'>
						<div className='text-[10px] lg:text-base font-black uppercase tracking-widest text-white/45'>Draft complete</div>
						<div className='text-2xl lg:text-5xl font-black leading-tight' style={{ color: lead === null ? '#fff' : colors[lead] }}>
							{lead === null ? 'Dead even on paper' : `${names[lead]} wins the draft on paper`}
						</div>
					</div>
				)}
			</div>

			{/* rosters */}
			<div className='flex-1 min-h-0 px-4 lg:px-10 pb-2 w-full max-w-5xl mx-auto'>
				<div className='h-full grid grid-cols-2 gap-2.5 lg:gap-6'>
					{([0, 1] as Side[]).map(side => {
						const mine = list.filter(p => p.side === side);
						return (
							<div key={side} className='min-h-0 flex flex-col'>
								<div className='flex items-baseline justify-between mb-1.5'>
									<div className='text-[11px] lg:text-lg font-black uppercase tracking-wider truncate' style={{ color: colors[side] }}>
										{names[side]}
									</div>
									<div className='text-sm lg:text-2xl font-black text-white tabular-nums'>{ovr[side] ? ovr[side].toFixed(1) : '—'}</div>
								</div>
								<div className='flex-1 min-h-0 grid gap-1.5 lg:gap-2.5' style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, maxHeight: rows * 96 }}>
									{Array.from({ length: rows }, (_, i) => {
										const p = mine[i];
										const visible = p && p.n <= shown;
										return <Slot key={i} p={visible ? p : undefined} color={colors[side]} fresh={!!visible && p.n === shown} />;
									})}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* progress + controls */}
			<div className='px-4 lg:px-10 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 w-full max-w-5xl mx-auto'>
				<div className='h-1 rounded-full bg-white/10 overflow-hidden mb-3'>
					<div className='h-full bg-white/70 transition-[width] duration-300' style={{ width: `${(Math.min(list.length, Math.max(0, shown)) / Math.max(1, list.length)) * 100}%` }} />
				</div>
				<div className='flex items-center gap-2'>
					<button onClick={restart} className='h-11 w-11 lg:h-14 lg:w-14 rounded-xl bg-white/10 text-white flex items-center justify-center' aria-label='Restart'>
						<Icon name='undo' size={20} />
					</button>
					<button onClick={() => (done ? restart() : setPlaying(p => !p))} className='h-11 w-11 lg:h-14 lg:w-14 rounded-xl bg-white text-black flex items-center justify-center' aria-label={playing && !done ? 'Pause' : 'Play'}>
						<Icon name={playing && !done ? 'pause' : 'play'} size={20} />
					</button>
					<button onClick={() => setSpeed(s => (s === 1 ? 2 : 1))} className='h-11 lg:h-14 px-3 rounded-xl bg-white/10 text-white font-black text-sm lg:text-lg tabular-nums' aria-label={`Speed ${speed}×, tap to change`}>
						{speed}×
					</button>
					<div className='flex-1' />
					{canClip && list.length > 0 && (
						<button onClick={saveClip} disabled={clip.state === 'recording'} className='btn-primary h-11 lg:h-14 px-4 rounded-xl inline-flex items-center gap-1.5 font-black text-sm lg:text-lg disabled:opacity-80'>
							<Icon name={clip.state === 'recording' ? 'film' : clip.state === 'done' ? 'check' : 'share'} size={18} />
							{clip.state === 'recording' ? `Recording ${Math.round(clip.p * 100)}%` : clip.state === 'done' ? clip.msg : 'Save clip'}
						</button>
					)}
				</div>
				{clip.state === 'error' && <div className='text-[11px] text-red-300 mt-2 text-right'>{clip.msg}</div>}
				{clip.state === 'recording' && <div className='text-[11px] text-white/50 mt-2 text-right'>Keep this screen open while it records.</div>}
			</div>
		</div>,
		document.body,
	);
}
