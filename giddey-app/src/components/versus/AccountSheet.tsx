'use client';

import { useState, useSyncExternalStore } from 'react';
import {
	cloudState,
	CloudRivalry,
	createRivalry,
	googleEnabled,
	inviteLink,
	joinRivalry,
	leaveRivalry,
	sendSignInEmail,
	signInWithGoogle,
	signOut,
	subscribeCloud,
	syncNow,
	updateProfile,
	verifyEmailCode,
} from '@/lib/versus/cloud';
import { Settings } from '@/lib/versus/engine';

export function useCloud() {
	return useSyncExternalStore(subscribeCloud, cloudState, cloudState);
}

const field = 'w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/30';

function ago(ts: number | null): string {
	if (!ts) return 'not yet';
	const s = Math.round((Date.now() - ts) / 1000);
	return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}

function SignIn() {
	const [email, setEmail] = useState('');
	const [sent, setSent] = useState(false);
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		setErr(null);
		try {
			await fn();
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className='space-y-3'>
			<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 text-[12px] text-white/65 leading-relaxed'>
				Versus works without an account — everything saves on this phone. Sign in to:
				<ul className='mt-1 space-y-0.5 text-white/80'>
					<li>☁️ back up every rivalry and see it on any phone or the installed app</li>
					<li>🤝 share one live record with your opponent — games either of you logs show up for both</li>
					<li>💙 keep your franchise guys with you</li>
				</ul>
			</div>
			{!sent ? (
				<>
					<input className={field} type='email' inputMode='email' autoComplete='email' placeholder='you@email.com' value={email} onChange={e => setEmail(e.target.value)} />
					<button
						disabled={busy || !/.+@.+\..+/.test(email)}
						onClick={() => run(async () => {
							await sendSignInEmail(email);
							setSent(true);
						})}
						className='w-full btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white disabled:opacity-40'
					>
						{busy ? 'Sending…' : '✉️ Email me a sign-in code'}
					</button>
					{googleEnabled && (
						<button disabled={busy} onClick={() => run(signInWithGoogle)} className='w-full rounded-2xl py-3 font-black text-sm text-black bg-white disabled:opacity-40'>
							Continue with Google
						</button>
					)}
					<div className='text-[10px] text-white/35 text-center'>No password. New here? This creates your account.</div>
				</>
			) : (
				<>
					<div className='text-sm text-white/75'>
						Check <span className='font-black text-white'>{email}</span>. Tap the link in the email, or type the 6-digit code here — the code also works inside the installed app.
					</div>
					<input className={`${field} text-center tracking-[0.5em] text-lg font-black`} inputMode='numeric' autoComplete='one-time-code' maxLength={6} placeholder='••••••' value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
					<button disabled={busy || code.length !== 6} onClick={() => run(() => verifyEmailCode(email, code))} className='w-full btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white disabled:opacity-40'>
						{busy ? 'Checking…' : 'Sign in'}
					</button>
					<button onClick={() => setSent(false)} className='w-full text-xs text-white/40 underline'>
						Use a different email
					</button>
				</>
			)}
			{err && <div className='text-xs text-red-300 text-center'>{err}</div>}
		</div>
	);
}

function RivalryCard({ r, onPlay, myId }: { r: CloudRivalry; onPlay: (names: [string, string]) => void; myId: string }) {
	const [msg, setMsg] = useState<string | null>(null);
	const theirs = r.members[r.mySeat === 0 ? 1 : 0];
	const share = async () => {
		const url = inviteLink(r);
		try {
			if (navigator.share) {
				await navigator.share({ title: 'Join my Versus rivalry', text: `${r.names[r.mySeat]} wants to run it on Giddey Versus. Invite code ${r.inviteCode}:`, url });
				return;
			}
		} catch {
			/* dismissed — copy instead */
		}
		try {
			await navigator.clipboard.writeText(url);
			setMsg('✓ Invite link copied');
		} catch {
			setMsg(`Code: ${r.inviteCode}`);
		}
	};
	return (
		<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
			<div className='flex items-center justify-between gap-2'>
				<div className='min-w-0'>
					<div className='text-sm font-black text-white truncate'>
						{r.names[0]} vs {r.names[1]}
					</div>
					<div className='text-[11px] text-white/50'>
						{r.games} game{r.games === 1 ? '' : 's'} ·{' '}
						{theirs ? <span className='text-emerald-300'>✓ {r.names[r.mySeat === 0 ? 1 : 0]} joined</span> : <span className='text-amber-300'>{r.names[r.mySeat === 0 ? 1 : 0]} hasn&apos;t joined yet</span>}
					</div>
				</div>
				<button onClick={() => onPlay(r.names)} className='shrink-0 btn-primary rounded-xl px-3 py-2 text-xs font-black uppercase text-white'>
					Play
				</button>
			</div>
			<div className='flex gap-2 mt-2'>
				{!theirs && (
					<button onClick={share} className='flex-1 rounded-xl py-2 text-xs font-black text-sky-200 bg-sky-500/15 border border-sky-400/30'>
						📨 Invite {r.names[r.mySeat === 0 ? 1 : 0]} · {r.inviteCode}
					</button>
				)}
				<button
					onClick={async () => {
						const owner = r.createdBy === myId;
						if (!confirm(owner ? `Delete ${r.names[0]} vs ${r.names[1]} from the cloud for both of you? Games on your phones stay.` : `Leave ${r.names[0]} vs ${r.names[1]}? Games on this phone stay.`)) return;
						try {
							await leaveRivalry(r);
						} catch (e) {
							setMsg((e as Error).message);
						}
					}}
					className='rounded-xl px-3 py-2 text-xs font-bold text-white/45 bg-white/5'
				>
					{r.createdBy === myId ? 'Delete' : 'Leave'}
				</button>
			</div>
			{msg && <div className='text-[11px] text-center text-emerald-300 mt-1.5'>{msg}</div>}
		</div>
	);
}

/** Sign in, manage your profile and cloud rivalries */
export default function AccountSheet({ settings, onClose, onPlay, joinCode }: { settings: Settings; onClose: () => void; onPlay: (names: [string, string]) => void; joinCode?: string | null }) {
	const cloud = useCloud();
	const me = cloud.profile;
	const [name, setName] = useState<string | null>(null);
	const [opp, setOpp] = useState(() => settings.names.find(n => n && n.toLowerCase() !== me?.name.toLowerCase()) ?? '');
	const [code, setCode] = useState(joinCode ?? '');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		setErr(null);
		try {
			await fn();
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-3'>
					<div className='text-lg font-black text-white'>👤 {cloud.session ? 'Your account' : 'Sign in (optional)'}</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
					</button>
				</div>

				{!cloud.ready ? (
					<div className='text-center text-white/50 py-10'>Loading…</div>
				) : !cloud.session ? (
					<>
						{joinCode && <div className='rounded-xl bg-sky-500/10 border border-sky-400/30 text-sky-100 text-sm p-3 mb-3'>📨 You&apos;ve been invited to a rivalry. Sign in and you&apos;ll join it automatically.</div>}
						<SignIn />
					</>
				) : (
					<div className='space-y-5'>
						{/* profile */}
						<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
							<div className='text-[10px] font-black uppercase tracking-widest text-white/45 mb-1'>Your name</div>
							<div className='flex gap-2'>
								<input className={field} maxLength={12} value={name ?? me?.name ?? ''} onChange={e => setName(e.target.value)} />
								{name !== null && name.trim() && name.trim() !== me?.name && (
									<button disabled={busy} onClick={() => run(async () => { await updateProfile({ name: name.trim() }); setName(null); })} className='shrink-0 btn-primary rounded-xl px-3 text-xs font-black uppercase text-white'>
										Save
									</button>
								)}
							</div>
							<div className='flex items-center justify-between mt-2 text-[11px] text-white/45'>
								<span className='truncate'>{cloud.session.user.email}</span>
								<button onClick={() => void signOut()} className='shrink-0 underline'>
									Sign out
								</button>
							</div>
						</div>

						{/* rivalries */}
						<div>
							<div className='flex items-center justify-between mb-2'>
								<div className='text-[11px] font-black uppercase tracking-widest text-white/45'>☁️ Your rivalries</div>
								<button onClick={() => void syncNow()} className='text-[11px] text-white/45'>
									{cloud.syncing ? 'Syncing…' : `Synced ${ago(cloud.lastSync)} · ↻`}
								</button>
							</div>
							{cloud.rivalries.length ? (
								<div className='space-y-2'>
									{cloud.rivalries.map(r => (
										<RivalryCard key={r.id} r={r} myId={cloud.session!.user.id} onPlay={onPlay} />
									))}
								</div>
							) : (
								<div className='text-sm text-white/50 rounded-xl bg-white/[0.03] border border-white/10 p-3'>No cloud rivalries yet. Start one below, or join with your opponent&apos;s code.</div>
							)}
						</div>

						{/* new */}
						<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
							<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-1'>➕ Start a rivalry</div>
							<div className='text-[11px] text-white/45 mb-2'>
								You&apos;re <span className='font-black text-white'>{me?.name}</span>. Games you&apos;ve already played against this name on this phone upload automatically.
							</div>
							<div className='flex gap-2'>
								<input className={field} maxLength={12} placeholder='Opponent’s name' value={opp} onChange={e => setOpp(e.target.value)} />
								<button disabled={busy || !opp.trim() || !me} onClick={() => run(() => createRivalry(me!.name, opp))} className='shrink-0 btn-primary rounded-xl px-4 text-xs font-black uppercase text-white disabled:opacity-40'>
									Create
								</button>
							</div>
						</div>

						{/* join */}
						<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
							<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>🤝 Join with a code</div>
							<div className='flex gap-2'>
								<input className={`${field} uppercase tracking-widest font-black`} maxLength={8} placeholder='A1B2C3D4' value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
								<button disabled={busy || code.trim().length < 6} onClick={() => run(async () => { await joinRivalry(code); setCode(''); })} className='shrink-0 rounded-xl px-4 text-xs font-black uppercase text-white bg-white/10 border border-white/15 disabled:opacity-40'>
									Join
								</button>
							</div>
						</div>

						{(err || cloud.error) && <div className='text-xs text-red-300 text-center'>{err ?? cloud.error}</div>}
					</div>
				)}
			</div>
		</div>
	);
}
