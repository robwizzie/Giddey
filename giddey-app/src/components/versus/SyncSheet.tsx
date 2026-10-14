'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MAX_FAVORITES, Settings } from '@/lib/versus/engine';
import { buildPayload, decodeSync, encodeSync, mergeGames, previewMerge, qrSized, syncLink, SyncPayload } from '@/lib/versus/sync';
import { loadRivalry } from '@/lib/versus/rivalry';
import { getVersusPlayer } from '@/lib/versus/pool';
import Icon, { IconTile } from './Icon';

/** Confirm an incoming sync before merging it */
export function ImportPreview({ payload, settings, onDone, onCancel }: { payload: SyncPayload; settings: Settings; onDone: (favorites: [string[], string[]]) => void; onCancel: () => void }) {
	const prev = previewMerge(payload, settings.names, settings.favorites);
	const favCount = prev.favorites[0].length + prev.favorites[1].length;
	const nothing = !prev.added && !favCount;
	const from = [...new Set(payload.games.flatMap(g => g.names))].slice(0, 4).join(', ');
	return (
		<div className='fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onCancel}>
			<div className='w-full max-w-md bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex justify-center mb-2'>
					<IconTile name='refresh' color='#38bdf8' size={48} />
				</div>
				<div className='text-lg font-black text-white text-center'>Sync from the other phone</div>
				<div className='text-xs text-white/50 text-center mb-4'>
					{payload.games.length} game{payload.games.length === 1 ? '' : 's'} in this link{from ? ` (${from})` : ''}
				</div>
				<div className='rounded-xl bg-white/[0.05] border border-white/10 p-3 text-sm text-white/80 space-y-1 mb-4'>
					<div className='flex items-start gap-2'>
						<Icon name='ball' className='mt-0.5 shrink-0 text-orange-300' />
						<span>
						<span className='font-black text-white'>{prev.added}</span> new game{prev.added === 1 ? '' : 's'} to add
						{prev.total - prev.added > 0 && <span className='text-white/45'> · {prev.total - prev.added} already here</span>}
						</span>
					</div>
					{favCount > 0 && (
						<div className='flex items-start gap-2'>
							<Icon name='heart' className='mt-0.5 shrink-0 text-blue-400 fill-current' />
							<span>
							{favCount} franchise guy{favCount === 1 ? '' : 's'} for{' '}
							{[0, 1]
								.filter(i => prev.favorites[i].length)
								.map(i => `${settings.names[i]} (${prev.favorites[i].map(id => getVersusPlayer(id)?.lastName).join(', ')})`)
								.join(' and ')}
							</span>
						</div>
					)}
					<div className='text-[11px] text-white/45'>Seasons, badges, usage and the rivalry chart all update from the merged games. Nothing here gets deleted.</div>
				</div>
				<div className='flex gap-2'>
					<button onClick={onCancel} className='rounded-2xl px-4 py-3 font-bold text-sm bg-white/10 text-white/70'>
						Cancel
					</button>
					<button
						onClick={() => {
							mergeGames(payload);
							const favorites: [string[], string[]] = [
								[...settings.favorites[0], ...prev.favorites[0]].slice(0, MAX_FAVORITES),
								[...settings.favorites[1], ...prev.favorites[1]].slice(0, MAX_FAVORITES),
							];
							onDone(favorites);
						}}
						className='flex-1 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white'
					>
						{nothing ? 'Already synced ✓' : 'Merge'}
					</button>
				</div>
			</div>
		</div>
	);
}

/** Send this phone's record (link / QR) or paste one from the other phone */
export default function SyncSheet({ settings, onClose, onImported }: { settings: Settings; onClose: () => void; onImported: (favorites: [string[], string[]]) => void }) {
	const [qr, setQr] = useState<{ url: string; count: number } | null>(null);
	const [link, setLink] = useState<string | null>(null);
	const [msg, setMsg] = useState<string | null>(null);
	const [paste, setPaste] = useState('');
	const [pasteMsg, setPasteMsg] = useState<string | null>(null);
	const [incoming, setIncoming] = useState<SyncPayload | null>(null);
	const total = loadRivalry().length;

	useEffect(() => {
		let live = true;
		(async () => {
			const payload = buildPayload(settings.names, settings.favorites);
			const full = syncLink(await encodeSync(payload));
			const sized = await qrSized(payload);
			const url = await QRCode.toDataURL(sized.link, { margin: 1, width: 560, errorCorrectionLevel: 'L', color: { dark: '#0b0f19', light: '#ffffff' } });
			if (!live) return;
			setLink(full);
			setQr({ url, count: sized.count });
		})().catch(() => setMsg('Couldn’t build the sync code on this browser.'));
		return () => {
			live = false;
		};
	}, [settings.names, settings.favorites]);

	const flash = (m: string) => {
		setMsg(m);
		setTimeout(() => setMsg(null), 2200);
	};

	const share = async () => {
		if (!link) return;
		try {
			if (navigator.share) {
				await navigator.share({ title: 'Giddey Versus sync', text: `Rivalry sync — ${total} games. Open on the other phone:`, url: link });
				return;
			}
		} catch {
			/* share sheet dismissed — fall through to copy */
		}
		try {
			await navigator.clipboard.writeText(link);
			flash('Link copied — text it to the other phone');
		} catch {
			flash('Couldn’t copy — long-press the box below instead');
		}
	};

	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-1'>
					<div className='flex items-center gap-2 text-lg font-black text-white'>
						<Icon name='refresh' className='text-sky-300' /> Sync phones
					</div>
					<button onClick={onClose} className='p-2 -mr-2 text-white/50 hover:text-white' aria-label='Close'>
						<Icon name='x' size={20} />
					</button>
				</div>
				<div className='text-xs text-white/50 mb-4'>
					Your record lives on the phone you play on. Send it to the other phone to merge — games either phone is missing get added, nothing gets overwritten. Do it both ways and you&apos;re
					even.
				</div>

				<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>1 · Send from this phone</div>
				<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-4 mb-5'>
					<div className='flex flex-col items-center'>
						{qr ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={qr.url} alt='Sync QR code' className='w-56 h-56 rounded-xl bg-white p-1' />
						) : (
							<div className='w-56 h-56 rounded-xl bg-white/5 flex items-center justify-center text-white/40 text-sm'>{msg ?? 'Building…'}</div>
						)}
						<div className='text-[11px] text-white/55 text-center mt-2'>
							Scan with the other phone&apos;s camera.
							{qr && qr.count < total ? ` The QR holds your newest ${qr.count} of ${total} games — use the link for all of them.` : qr ? ` Holds all ${total} games.` : ''}
						</div>
					</div>
					<button onClick={share} disabled={!link} className='mt-3 w-full inline-flex items-center justify-center gap-2 btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white disabled:opacity-40'>
						<Icon name='share' /> Share sync link
					</button>
					{msg && qr && <div className='text-center text-xs text-green-300 mt-2'>{msg}</div>}
				</div>

				<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>2 · Or receive on this phone</div>
				<div className='rounded-2xl bg-white/[0.04] border border-white/10 p-4'>
					<textarea
						value={paste}
						onChange={e => {
							setPaste(e.target.value);
							setPasteMsg(null);
						}}
						placeholder='Paste the sync link from the other phone…'
						rows={3}
						className='w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30 font-mono'
					/>
					<button
						disabled={!paste.trim()}
						onClick={async () => {
							const p = await decodeSync(paste);
							if (!p) setPasteMsg('That doesn’t look like a sync link.');
							else setIncoming(p);
						}}
						className='mt-2 w-full rounded-2xl py-3 font-black uppercase tracking-wider text-white bg-white/10 border border-white/15 disabled:opacity-40'
					>
						Import
					</button>
					{pasteMsg && <div className='text-center text-xs text-amber-300 mt-2'>{pasteMsg}</div>}
					<div className='text-[10px] text-white/40 mt-2 leading-snug'>
						Using Versus from your home screen? iPhones keep the home-screen app&apos;s data separate from Safari, so a scanned link opens in Safari. Copy the link and paste it here instead.
					</div>
				</div>

				{incoming && (
					<ImportPreview
						payload={incoming}
						settings={settings}
						onCancel={() => setIncoming(null)}
						onDone={favs => {
							setIncoming(null);
							setPaste('');
							onImported(favs);
							setPasteMsg('✓ Synced');
						}}
					/>
				)}
			</div>
		</div>
	);
}
