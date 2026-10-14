'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';
import { Side, VersusState } from '@/lib/versus/engine';
import { hostLock, joinRoom, leaveRoom, liveInfo, liveLock, LiveRole, newRoomCode, roomLink, setHostSide, subscribeLive } from '@/lib/versus/live';
import { SIDE_COLORS } from './Fx';

export function useLive() {
	return useSyncExternalStore(subscribeLive, liveInfo, () => null);
}

/** "Waiting for Dave on their phone…" in place of a turn's controls */
export function WaitingBar({ name, fixed = true }: { name: string; fixed?: boolean }) {
	const inner = (
		<div className='max-w-3xl mx-auto rounded-2xl py-3.5 px-4 text-center text-sm font-black text-white/70 bg-white/[0.06] border border-white/10 flex items-center justify-center gap-2'>
			<span className='inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse' />
			{name === 'the coaches' ? '📺 Watching live' : `Waiting for ${name} on their phone…`}
		</div>
	);
	if (!fixed) return inner;
	return <div className='fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>{inner}</div>;
}

/**
 * Renders its children only on the phone allowed to act. `side` = the coach
 * whose turn it is (null = either coach), `host` = only the room host.
 */
export function LiveGate({ side, host, names, children, fixed = true }: { side?: Side | null; host?: boolean; names: [string, string]; children: React.ReactNode; fixed?: boolean }) {
	useLive();
	const lock = host ? hostLock(names) ?? liveLock(null, names) : liveLock(side ?? null, names);
	if (!lock) return <>{children}</>;
	return <WaitingBar name={lock} fixed={fixed} />;
}

/** Can this phone act for `side` right now (true outside a live room) */
export function useCanAct(side: Side | null, names: [string, string], host = false): boolean {
	useLive();
	return !(host ? hostLock(names) ?? liveLock(null, names) : liveLock(side, names));
}

/** Top-bar status: who's connected */
export function LivePill({ onClick, names }: { onClick: () => void; names: [string, string] }) {
	const live = useLive();
	if (!live) return null;
	const others = live.peers.filter(p => p.role !== 'tv').length;
	const tvs = live.peers.filter(p => p.role === 'tv').length;
	const me = live.role === 'tv' ? '📺 TV' : names[live.role === 'host' ? live.hostSide : live.hostSide === 0 ? 1 : 0];
	return (
		<button onClick={onClick} className={`h-8 rounded-lg px-2 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border ${live.connected ? 'bg-sky-500/15 border-sky-400/40 text-sky-200' : 'bg-amber-500/15 border-amber-400/40 text-amber-200'}`} title='Live room'>
			<span className={`w-1.5 h-1.5 rounded-full ${live.connected && others ? 'bg-emerald-400' : 'bg-amber-300 animate-pulse'}`} />
			{me}
			{tvs ? ' · 📺' : ''}
		</button>
	);
}

function Qr({ text }: { text: string }) {
	const [url, setUrl] = useState<string | null>(null);
	useEffect(() => {
		QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: '#0b0f19', light: '#ffffff' } })
			.then(setUrl)
			.catch(() => setUrl(null));
	}, [text]);
	// eslint-disable-next-line @next/next/no-img-element
	return url ? <img src={url} alt='Room QR code' className='w-40 h-40 rounded-xl bg-white p-1 mx-auto' /> : <div className='w-40 h-40 mx-auto rounded-xl bg-white/5' />;
}

/** Host or join a two-phone room, and get the TV link */
export default function LiveSheet({ state, onClose }: { state: VersusState; onClose: () => void }) {
	const live = useLive();
	const { names } = state.settings;
	const [code, setCode] = useState('');
	const [msg, setMsg] = useState<string | null>(null);
	const copy = async (text: string, label: string) => {
		try {
			if (navigator.share) return void (await navigator.share({ title: 'Giddey Versus live room', url: text }));
		} catch {
			/* dismissed */
		}
		try {
			await navigator.clipboard.writeText(text);
			setMsg(`✓ ${label} copied`);
		} catch {
			setMsg(text);
		}
	};
	const start = async (role: LiveRole, c: string, side: Side = 0) => {
		try {
			await joinRoom(c.toUpperCase(), role, side, role === 'host' ? state : undefined);
		} catch (e) {
			setMsg((e as Error).message);
		}
	};
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-1'>
					<div className='text-lg font-black text-white'>📡 Two phones · live</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
					</button>
				</div>
				<div className='text-xs text-white/50 mb-4'>Each coach drafts on their own phone — on the same couch or across town. Blind bids stay secret, and a TV can show the draft board. No account needed.</div>

				{!live ? (
					<div className='space-y-4'>
						<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
							<div className='text-sm font-black text-white mb-1'>Host on this phone</div>
							<div className='text-[11px] text-white/50 mb-2'>Your settings and current draft carry over. Which coach are you?</div>
							<div className='grid grid-cols-2 gap-2'>
								{([0, 1] as Side[]).map(side => (
									<button key={side} disabled={!names[0] || !names[1]} onClick={() => start('host', newRoomCode(), side)} className='rounded-xl py-3 font-black border disabled:opacity-40' style={{ borderColor: `${SIDE_COLORS[side]}66`, color: SIDE_COLORS[side], background: `${SIDE_COLORS[side]}14` }}>
										I&apos;m {names[side] || `Coach ${side + 1}`}
									</button>
								))}
							</div>
							{(!names[0] || !names[1]) && <div className='text-[11px] text-amber-300 mt-2'>Enter both coach names first.</div>}
						</div>
						<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
							<div className='text-sm font-black text-white mb-2'>Join a room</div>
							<div className='flex gap-2'>
								<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder='ROOM CODE' className='w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white outline-none uppercase tracking-widest font-black placeholder:text-white/30' />
								<button disabled={code.length !== 6} onClick={() => start('guest', code)} className='shrink-0 rounded-xl px-4 text-xs font-black text-white bg-white/10 border border-white/15 disabled:opacity-40'>
									Join
								</button>
								<button disabled={code.length !== 6} onClick={() => start('tv', code)} className='shrink-0 rounded-xl px-3 text-xs font-black text-white/70 bg-white/5 border border-white/10 disabled:opacity-40' title='Watch on a TV or laptop'>
									📺
								</button>
							</div>
						</div>
					</div>
				) : (
					<div className='space-y-4'>
						<div className='text-center'>
							<div className='text-[11px] font-black uppercase tracking-widest text-white/45'>Room</div>
							<div className='text-4xl font-black tracking-[0.3em] text-white'>{live.code}</div>
							<div className={`text-xs font-bold ${live.connected ? 'text-emerald-300' : 'text-amber-300'}`}>
								{live.error ?? (live.connected ? `${live.peers.filter(p => p.role !== 'tv').length ? 'Both coaches connected' : 'Waiting for the other coach…'}${live.peers.some(p => p.role === 'tv') ? ' · 📺 TV on' : ''}` : 'Connecting…')}
							</div>
						</div>
						{live.role === 'host' && (
							<>
								<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3 text-center'>
									<div className='text-sm font-black text-white mb-2'>{names[live.hostSide === 0 ? 1 : 0]}, scan to join</div>
									<Qr text={roomLink(live.code, 'guest')} />
									<button onClick={() => copy(roomLink(live.code, 'guest'), 'Join link')} className='mt-2 w-full rounded-xl py-2 text-sm font-black text-sky-200 bg-sky-500/15 border border-sky-400/30'>
										📤 Send the join link
									</button>
								</div>
								<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
									<div className='text-sm font-black text-white'>📺 TV mode</div>
									<div className='text-[11px] text-white/50 mb-2'>Open this on a TV browser, laptop or tablet (or cast a tab) for a big-screen draft board.</div>
									<button onClick={() => copy(roomLink(live.code, 'tv'), 'TV link')} className='w-full rounded-xl py-2 text-sm font-black text-white bg-white/10 border border-white/15'>
										Copy TV link
									</button>
								</div>
								<div className='flex gap-2 text-xs'>
									<span className='text-white/50 self-center'>I&apos;m playing as</span>
									{([0, 1] as Side[]).map(side => (
										<button key={side} onClick={() => setHostSide(side)} className={`flex-1 rounded-lg py-1.5 font-black border ${live.hostSide === side ? 'bg-white text-black border-white' : 'text-white/60 border-white/10'}`}>
											{names[side]}
										</button>
									))}
								</div>
							</>
						)}
						{live.role === 'guest' && <div className='text-sm text-white/70 text-center'>You&apos;re {names[live.hostSide === 0 ? 1 : 0] || 'in'}. Your turns light up on this phone; the rest of the time you&apos;ll see the other coach working.</div>}
						<button
							onClick={() => {
								void leaveRoom();
								onClose();
							}}
							className='w-full text-xs font-bold text-red-300/70 py-2'
						>
							Leave the room
						</button>
					</div>
				)}
				{msg && <div className='text-center text-xs text-emerald-300 mt-3 break-all'>{msg}</div>}
			</div>
		</div>
	);
}
