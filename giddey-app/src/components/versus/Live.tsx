'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';
import { Side, VersusState } from '@/lib/versus/engine';
import { hostLock, joinRoom, leaveRoom, liveInfo, LiveFx, liveLock, newRoomCode, onLiveFx, roomLink, subscribeLive, takenSeats } from '@/lib/versus/live';
import Wheel from './Wheel';
import SlotMachine from './SlotMachine';
import { CoinFlip, SIDE_COLORS } from './Fx';
import Icon from './Icon';
import { disableTurnNotifications, enableTurnNotifications, pushEnabled, useNotifyStatus } from '@/lib/versus/notify';

export function useLive() {
	return useSyncExternalStore(subscribeLive, liveInfo, () => null);
}

/** "Waiting for Dave on their phone…" in place of a turn's controls */
export function WaitingBar({ name, fixed = true, what }: { name: string; fixed?: boolean; what?: string }) {
	const inner = (
		<div className='max-w-3xl mx-auto rounded-2xl py-3.5 px-4 text-center text-sm font-bold text-white/75 bg-white/[0.06] border border-white/10 flex items-center justify-center gap-2.5'>
			<span className='relative flex w-2.5 h-2.5'>
				<span className='absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60 animate-ping' />
				<span className='relative inline-flex rounded-full w-2.5 h-2.5 bg-sky-400' />
			</span>
			{name === 'the coaches' ? 'The coaches are on it…' : `${name} ${what ?? 'is up'} on their ${name === 'the main screen' ? 'screen' : 'phone'}…`}
		</div>
	);
	if (!fixed) return inner;
	return <div className='fixed bottom-0 left-0 right-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/95 to-transparent'>{inner}</div>;
}

/**
 * Renders its children only on the device allowed to act. `side` = the coach
 * whose turn it is (null = either coach), `host` = only the room host.
 */
export function LiveGate({ side, host, names, children, fixed = true, what }: { side?: Side | null; host?: boolean; names: [string, string]; children: React.ReactNode; fixed?: boolean; what?: string }) {
	useLive();
	const lock = host ? hostLock(names) : liveLock(side ?? null, names);
	if (!lock) return <>{children}</>;
	return <WaitingBar name={lock} fixed={fixed} what={what} />;
}

/** Can this device act for `side` right now (true outside a live room) */
export function useCanAct(side: Side | null, names: [string, string], host = false): boolean {
	useLive();
	return !(host ? hostLock(names) : liveLock(side, names));
}

/** Top-bar status: this device's seat and who's connected */
export function LivePill({ onClick, names }: { onClick: () => void; names: [string, string] }) {
	const live = useLive();
	if (!live) return null;
	const seats = takenSeats();
	const coaches = (live.role === 'coach' ? 1 : 0) + seats.coach.filter(Boolean).length;
	const me = live.role === 'screen' ? 'Main screen' : names[live.side ?? 0] || `Coach ${(live.side ?? 0) + 1}`;
	return (
		<button
			onClick={onClick}
			className={`h-8 rounded-full px-3 text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border ${live.connected ? 'bg-sky-500/15 border-sky-400/40 text-sky-100' : 'bg-amber-500/15 border-amber-400/40 text-amber-100'}`}
			title='Live room'
		>
			<span className={`w-2 h-2 rounded-full ${live.connected && coaches === 2 ? 'bg-emerald-400' : 'bg-amber-300 animate-pulse'}`} />
			<Icon name={live.role === 'screen' ? 'tv' : 'phone'} />
			{me}
			<span className='text-white/50 normal-case tracking-normal font-bold'>
				· {coaches}/2{seats.screens + (live.role === 'screen' ? 1 : 0) ? ' + screen' : ''}
			</span>
		</button>
	);
}

function Qr({ text, size = 'w-36 h-36' }: { text: string; size?: string }) {
	const [url, setUrl] = useState<string | null>(null);
	useEffect(() => {
		QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: '#0b0f19', light: '#ffffff' } })
			.then(setUrl)
			.catch(() => setUrl(null));
	}, [text]);
	// eslint-disable-next-line @next/next/no-img-element
	return url ? <img src={url} alt='Join QR code' className={`${size} rounded-xl bg-white p-1 mx-auto`} /> : <div className={`${size} mx-auto rounded-xl bg-white/5`} />;
}

type Seat = Side | 'screen';

function ago(ms: number): string {
	const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
	if (s < 45) return 'just now';
	const m = Math.round(s / 60);
	if (m < 60) return `${m} min ago`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h} hr ago`;
	const d = Math.round(h / 24);
	return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** Re-render every so often so "saved 3 min ago" stays true */
function useTick(ms: number) {
	const [, setN] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setN(n => n + 1), ms);
		return () => clearInterval(t);
	}, [ms]);
}

/** "Draft now, play later" + the turn-alert opt-in */
function PlayLater({ coach, savedAt }: { coach: boolean; savedAt: number | null | undefined }) {
	const status = useNotifyStatus();
	const [busy, setBusy] = useState(false);
	useTick(30000);
	const toggle = async () => {
		if (status === 'on') return disableTurnNotifications();
		setBusy(true);
		await enableTurnNotifications();
		setBusy(false);
	};
	return (
		<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-4'>
			<div className='flex items-center gap-2 text-sm font-black text-white'>
				<Icon name='hourglass' className='text-amber-300' /> Draft now, play later
			</div>
			<p className='text-[12px] text-white/55 mt-1 leading-snug'>
				You can close the app mid-draft. Open the same link later and you pick up right where you left off — no need for both of you to be online at once.
				{coach ? ' Turn on alerts to get a ping when it’s your pick.' : ''}
			</p>
			{savedAt ? (
				<div className='text-[11px] font-bold text-emerald-300/80 mt-2 inline-flex items-center gap-1.5'>
					<Icon name='save' size={13} /> Room saved {ago(savedAt)}
				</div>
			) : null}
			{coach && (
				<div className='mt-3'>
					{status === 'install' ? (
						<div className='text-[12px] text-amber-200/90 leading-snug'>On iPhone, add Giddey to your Home Screen (Share → Add to Home Screen) and open it from there to get turn alerts.</div>
					) : status === 'unsupported' ? (
						<div className='text-[12px] text-white/45'>This browser can’t show alerts.</div>
					) : status === 'denied' ? (
						<div className='text-[12px] text-amber-200/90 leading-snug'>Alerts are blocked for this site. Allow notifications in your browser settings, then come back.</div>
					) : (
						<button
							onClick={toggle}
							disabled={busy}
							aria-pressed={status === 'on'}
							className={`w-full min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-black border flex items-center gap-3 text-left disabled:opacity-60 ${status === 'on' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100' : 'bg-white/[0.05] border-white/15 text-white'}`}
						>
							<Icon name='bell' size={18} className={status === 'on' ? 'text-emerald-300' : 'text-white/60'} />
							<span className='flex-1'>
								Notify me when it’s my turn
								<span className='block text-[11px] font-bold text-white/45'>
									{status === 'on' ? (pushEnabled ? 'On — even with the app closed' : 'On — while the app is open in the background') : 'Off'}
								</span>
							</span>
							<span className={`w-10 h-6 rounded-full p-0.5 flex transition-colors ${status === 'on' ? 'bg-emerald-400 justify-end' : 'bg-white/15 justify-start'}`}>
								<span className='w-5 h-5 rounded-full bg-white' />
							</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
}

function seatLabel(seat: Seat, names: [string, string]) {
	return seat === 'screen' ? 'Main screen' : names[seat] || `Coach ${seat + 1}`;
}

/** Host a room or join one; share a join code per seat */
export default function LiveSheet({ state, onClose }: { state: VersusState; onClose: () => void }) {
	const live = useLive();
	const { names } = state.settings;
	const [code, setCode] = useState('');
	const [joinSeat, setJoinSeat] = useState<Seat>(1);
	const [msg, setMsg] = useState<string | null>(null);
	const copy = async (text: string, label: string) => {
		try {
			if (navigator.share) return void (await navigator.share({ title: 'Giddey Versus live room', url: text }));
		} catch {
			/* dismissed */
		}
		try {
			await navigator.clipboard.writeText(text);
			setMsg(`${label} copied`);
		} catch {
			setMsg(text);
		}
	};
	const host = async (seat: Seat) => {
		try {
			await joinRoom(newRoomCode(), { role: seat === 'screen' ? 'screen' : 'coach', side: seat === 'screen' ? null : seat, host: true }, state);
		} catch (e) {
			setMsg((e as Error).message);
		}
	};
	const join = async () => {
		try {
			await joinRoom(code.toUpperCase(), { role: joinSeat === 'screen' ? 'screen' : 'coach', side: joinSeat === 'screen' ? null : joinSeat, host: false });
		} catch (e) {
			setMsg((e as Error).message);
		}
	};
	const seats = takenSeats();
	const mySeat: Seat | null = live ? (live.role === 'screen' ? 'screen' : live.side) : null;
	const open: Seat[] = live ? ([0, 1, 'screen'] as Seat[]).filter(s => s !== mySeat && (s === 'screen' || !seats.coach[s])) : [];
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-5 pt-5 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-1'>
					<div className='flex items-center gap-2 text-lg font-black text-white'>
						<Icon name='radio' className='text-sky-300' /> Play on separate devices
					</div>
					<button onClick={onClose} className='text-white/50 hover:text-white p-1' aria-label='Close'>
						<Icon name='x' size={22} />
					</button>
				</div>
				<p className='text-[13px] text-white/55 mb-5 leading-snug'>
					Each coach drafts, spins and votes on their own phone. A main screen (TV, laptop or tablet) shows the night for everyone. Private choices — your own pack, blind bids, predictions, votes — stay on your phone. No account needed, and you don’t both have to be online at once: close the app mid-draft and pick it up later.
				</p>

				{!live ? (
					<div className='space-y-4'>
						<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-4'>
							<div className='text-sm font-black text-white'>Start a room on this device</div>
							<div className='text-[12px] text-white/50 mb-3'>This device runs the shared steps — setup, coin toss, rules and the result. Your current settings carry over.</div>
							<div className='grid grid-cols-3 gap-2'>
								{([0, 1, 'screen'] as Seat[]).map(seat => (
									<button
										key={String(seat)}
										disabled={!names[0] || !names[1]}
										onClick={() => host(seat)}
										className='rounded-xl py-3 px-2 font-black text-sm border disabled:opacity-40 flex flex-col items-center gap-1'
										style={seat === 'screen' ? { borderColor: 'rgba(255,255,255,0.15)', color: '#fff', background: 'rgba(255,255,255,0.05)' } : { borderColor: `${SIDE_COLORS[seat]}66`, color: SIDE_COLORS[seat], background: `${SIDE_COLORS[seat]}14` }}
									>
										<Icon name={seat === 'screen' ? 'tv' : 'phone'} size={20} />
										<span className='truncate max-w-full'>{seat === 'screen' ? 'Main screen' : `I'm ${names[seat] || `Coach ${seat + 1}`}`}</span>
									</button>
								))}
							</div>
							{(!names[0] || !names[1]) && <div className='text-[12px] text-amber-300 mt-2'>Enter both coach names in setup first.</div>}
						</div>
						<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-4'>
							<div className='text-sm font-black text-white mb-2'>Join a room</div>
							<input
								value={code}
								onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
								maxLength={6}
								placeholder='ROOM CODE'
								className='w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-lg text-white text-center outline-none uppercase tracking-[0.4em] font-black placeholder:text-white/25 placeholder:tracking-widest focus:border-sky-400/60'
							/>
							<div className='grid grid-cols-3 gap-2 mt-2'>
								{([0, 1, 'screen'] as Seat[]).map(seat => (
									<button key={String(seat)} onClick={() => setJoinSeat(seat)} className={`rounded-xl py-2 text-xs font-black border ${joinSeat === seat ? 'bg-white text-black border-white' : 'text-white/60 border-white/10'}`}>
										{seat === 'screen' ? 'Main screen' : `Coach ${seat + 1}`}
									</button>
								))}
							</div>
							<button disabled={code.length !== 6} onClick={join} className='mt-3 w-full rounded-xl py-3 text-sm font-black text-white bg-sky-600 disabled:opacity-40'>
								Join as {joinSeat === 'screen' ? 'main screen' : `Coach ${joinSeat + 1}`}
							</button>
						</div>
					</div>
				) : (
					<div className='space-y-4'>
						<div className='text-center'>
							<div className='text-[11px] font-black uppercase tracking-widest text-white/45'>Room code</div>
							<div className='text-4xl font-black tracking-[0.3em] text-white pl-[0.3em]'>{live.code}</div>
							<div className={`text-sm font-bold mt-1 ${live.connected ? 'text-emerald-300' : 'text-amber-300'}`}>
								{live.error ?? (live.connected ? `You're ${seatLabel(mySeat!, names)}${live.host ? ' · host' : ''}` : 'Connecting…')}
							</div>
						</div>
						<div className='grid grid-cols-3 gap-2 text-center'>
							{([0, 1, 'screen'] as Seat[]).map(seat => {
								const here = seat === mySeat || (seat === 'screen' ? seats.screens > 0 : seats.coach[seat]);
								return (
									<div key={String(seat)} className={`rounded-xl border p-2 ${here ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
										<Icon name={seat === 'screen' ? 'tv' : 'phone'} size={18} className={here ? 'text-emerald-300' : 'text-white/30'} />
										<div className='text-[11px] font-black text-white truncate'>{seatLabel(seat, names)}</div>
										<div className={`text-[10px] font-bold ${here ? 'text-emerald-300' : 'text-white/35'}`}>{seat === mySeat ? 'this device' : here ? 'connected' : seat === 'screen' ? 'optional' : 'open'}</div>
									</div>
								);
							})}
						</div>
						<PlayLater coach={live.role === 'coach'} savedAt={live.savedAt} />
						{open.length > 0 && (
							<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-4'>
								<div className='text-sm font-black text-white'>Invite the other devices</div>
								{open.map(seat => (
									<div key={String(seat)} className='flex items-center gap-3'>
										<Qr text={roomLink(live.code, seat)} size='w-24 h-24' />
										<div className='flex-1 min-w-0'>
											<div className='text-sm font-black text-white'>{seat === 'screen' ? 'Main screen' : `${seatLabel(seat, names)}'s phone`}</div>
											<div className='text-[11px] text-white/50 mb-2'>{seat === 'screen' ? 'Open on a TV browser, laptop or tablet — or cast this tab.' : 'Scan with the phone camera, or send the link.'}</div>
											<button onClick={() => copy(roomLink(live.code, seat), 'Link')} className='rounded-lg px-3 py-1.5 text-xs font-black text-sky-100 bg-sky-500/20 border border-sky-400/30 inline-flex items-center gap-1.5'>
												<Icon name='share' /> Send link
											</button>
										</div>
									</div>
								))}
							</div>
						)}
						<button
							onClick={() => {
								void leaveRoom();
								onClose();
							}}
							className='w-full text-sm font-bold text-red-300/80 py-2 inline-flex items-center justify-center gap-2'
						>
							<Icon name='logOut' /> Leave the room
						</button>
					</div>
				)}
				{msg && <div className='text-center text-xs text-emerald-300 mt-3 break-all'>{msg}</div>}
			</div>
		</div>
	);
}

/** Replays spins from the other devices (wheel, slot machine, coin, lottery) */
export function FxMirror() {
	const [fx, setFx] = useState<(LiveFx & { key: number }) | null>(null);
	useEffect(
		() =>
			onLiveFx(f => {
				setFx({ ...f, key: Date.now() });
			}),
		[],
	);
	useEffect(() => {
		if (!fx) return;
		const t = setTimeout(() => setFx(null), fx.kind === 'slot' ? 6200 : 6500);
		return () => clearTimeout(t);
	}, [fx]);
	if (!fx) return null;
	const size = typeof window === 'undefined' ? 300 : Math.min(window.innerWidth < 700 ? 300 : 460, window.innerWidth - 48);
	return (
		<div className='fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center px-4' onClick={() => setFx(null)}>
			{fx.kind === 'wheel' && (
				<>
					<div className='text-sm font-black uppercase tracking-[0.3em] text-white/60 mb-4 text-center'>{fx.title}</div>
					<Wheel key={fx.key} items={fx.items} size={size} forced={fx.index} accent={fx.accent} onResult={() => undefined} />
				</>
			)}
			{fx.kind === 'slot' && (
				<>
					<div className='text-sm font-black uppercase tracking-[0.3em] text-white/60 mb-4 text-center'>{fx.title}</div>
					<div className='w-full max-w-md'>
						<SlotMachine key={fx.key} reels={fx.reels} forced={fx.picks} onDone={() => undefined} />
					</div>
				</>
			)}
			{fx.kind === 'coin' && (
				<>
					<div className='text-sm font-black uppercase tracking-[0.3em] text-white/60 mb-6'>Coin toss</div>
					<CoinFlip key={fx.key} names={fx.names} forced={fx.winner} onResult={() => undefined} />
				</>
			)}
			{fx.kind === 'lottery' && (
				<div className='text-center vs-pop'>
					<div className='text-sm font-black uppercase tracking-[0.3em] text-white/60 mb-3'>Draft lottery</div>
					<Icon name='ticket' size={64} className='mx-auto mb-3' style={{ color: SIDE_COLORS[fx.winner] }} />
					<div className='text-4xl font-black' style={{ color: SIDE_COLORS[fx.winner] }}>
						{fx.names[fx.winner]} wins the lottery
					</div>
				</div>
			)}
			<div className='text-[11px] text-white/35 mt-6'>Tap to close</div>
		</div>
	);
}
