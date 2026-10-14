'use client';

import { useMemo, useState } from 'react';
import { buildCareer, coachNames } from '@/lib/versus/career';
import { loadRivalry } from '@/lib/versus/rivalry';
import { careerLink, cloudEnabled, publishCareer, unpublishCareer } from '@/lib/versus/cloud';
import { useCloud } from './AccountSheet';
import CareerCard from './CareerCard';

/** Any coach's career on this phone; your own can be published as a public link */
export default function CareerSheet({ initial, onClose }: { initial: string; onClose: () => void }) {
	const cloud = useCloud();
	const all = useMemo(() => loadRivalry(), []);
	const names = useMemo(() => coachNames(all), [all]);
	const [name, setName] = useState(() => cloud.profile?.name ?? (names.find(n => n.toLowerCase() === initial.trim().toLowerCase()) || names[0] || initial));
	const career = useMemo(() => buildCareer(name, all), [name, all]);
	const [msg, setMsg] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const mine = !!cloud.profile && cloud.profile.name.trim().toLowerCase() === name.trim().toLowerCase();
	const publish = async () => {
		setBusy(true);
		setMsg(null);
		try {
			const link = careerLink(await publishCareer(career));
			try {
				if (navigator.share) {
					await navigator.share({ title: `${career.name} on Giddey Versus`, text: `${career.wins}–${career.losses}, ${career.titles} title${career.titles === 1 ? '' : 's'}. Come get some:`, url: link });
					setMsg('✓ Published');
					return;
				}
			} catch {
				/* dismissed */
			}
			try {
				await navigator.clipboard.writeText(link);
				setMsg('✓ Published — link copied');
			} catch {
				setMsg(link);
			}
		} catch (e) {
			setMsg((e as Error).message);
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className='fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-3'>
					<div className='text-lg font-black text-white'>🎖️ Career</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
					</button>
				</div>
				{names.length > 1 && (
					<div className='flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-4 px-4 [scrollbar-width:none]'>
						{names.map(n => (
							<button key={n} onClick={() => setName(n)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black border ${n.toLowerCase() === name.toLowerCase() ? 'bg-white text-black border-white' : 'bg-white/5 text-white/70 border-white/10'}`}>
								{n}
							</button>
						))}
					</div>
				)}
				{!names.length ? <div className='text-sm text-white/55'>No games yet — your career starts with your first result.</div> : <CareerCard c={career} />}
				{cloudEnabled && names.length > 0 && (
					<div className='mt-5 rounded-2xl bg-white/[0.04] border border-white/10 p-3'>
						<div className='text-sm font-black text-white'>🌐 Public career page</div>
						{!cloud.session ? (
							<div className='text-[11px] text-white/50'>Sign in from ⋯ → Sign in to get a link anyone can open — perfect for trash talk.</div>
						) : !mine ? (
							<div className='text-[11px] text-white/50'>You can publish your own career ({cloud.profile?.name}). Pick your name above.</div>
						) : (
							<>
								<div className='text-[11px] text-white/50 mb-2'>Publishes this snapshot to a public link. Publish again to update it; nothing else about your games is shared.</div>
								<div className='flex gap-2'>
									<button disabled={busy} onClick={publish} className='flex-1 btn-primary rounded-xl py-2.5 text-sm font-black uppercase text-white disabled:opacity-40'>
										{busy ? 'Publishing…' : '📤 Publish & share'}
									</button>
									<button
										onClick={async () => {
											await unpublishCareer();
											setMsg('Unpublished — the link no longer works');
										}}
										className='rounded-xl px-3 text-xs font-bold text-white/50 bg-white/5'
									>
										Unpublish
									</button>
								</div>
							</>
						)}
						{msg && <div className='text-center text-xs text-emerald-300 mt-2 break-all'>{msg}</div>}
					</div>
				)}
			</div>
		</div>
	);
}
