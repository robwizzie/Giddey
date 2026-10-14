'use client';

import { useState } from 'react';
import { Settings } from '@/lib/versus/engine';
import { CustomItem, CustomKind, CustomWheels, Difficulty, DIFFICULTY_INFO, EMPTY_CUSTOM, newCustomId } from '@/lib/versus/wheels';
import { encodeJson } from '@/lib/versus/sync';
import Icon from './Icon';

const KINDS: { id: CustomKind; icon: string; label: string; hint: string; example: string }[] = [
	{ id: 'challenges', icon: 'target', label: 'Challenges', hint: 'Something to pull off in the game. Pick how hard it is — harder pays a bigger draft reward.', example: 'Score with your center from three' },
	{ id: 'sabotages', icon: 'bomb', label: 'Sabotages', hint: 'What the loser can inflict on the winner next game.', example: 'You have to use the Jumbotron camera angle' },
	{ id: 'twists', icon: 'dice', label: 'Twists', hint: 'A rule for both teams, set by the game-day slot machine.', example: 'Every made three = loser does a push-up' },
	{ id: 'halftime', icon: 'clock', label: 'Halftime', hint: 'A second-half rule. Use {L} for the coach who leads at the half and {T} for the one trailing.', example: '{L} can only score in the paint in Q3' },
];

export interface SharedWheels {
	v: 1;
	from: string;
	wheels: Omit<CustomWheels, 'mode'>;
}

export async function wheelsLink(c: CustomWheels, from: string): Promise<string> {
	const code = await encodeJson({ v: 1, from, wheels: { challenges: c.challenges, sabotages: c.sabotages, twists: c.twists, halftime: c.halftime } } satisfies SharedWheels);
	return `${location.origin}${location.pathname}#wheels=${code}`;
}

/** Add someone's shared items to yours (same label in the same wheel = skipped) */
export function mergeWheels(mine: CustomWheels, theirs: Omit<CustomWheels, 'mode'>): { merged: CustomWheels; added: number } {
	const merged: CustomWheels = { ...mine };
	let added = 0;
	for (const k of ['challenges', 'sabotages', 'twists', 'halftime'] as CustomKind[]) {
		const have = new Set(mine[k].map(x => x.label.trim().toLowerCase()));
		const fresh = (theirs[k] ?? []).filter(x => x?.label && !have.has(x.label.trim().toLowerCase()));
		merged[k] = [...mine[k], ...fresh];
		added += fresh.length;
	}
	return { merged, added };
}

/** Settings section: build your own wheel items and share them */
export default function CustomWheelsEditor({ s, setS }: { s: Settings; setS: (fn: (prev: Settings) => Settings) => void }) {
	const c = s.custom ?? EMPTY_CUSTOM;
	const [kind, setKind] = useState<CustomKind>('challenges');
	const [label, setLabel] = useState('');
	const [desc, setDesc] = useState('');
	const [dif, setDif] = useState<Difficulty>('medium');
	const [msg, setMsg] = useState<string | null>(null);
	const info = KINDS.find(k => k.id === kind)!;
	const update = (fn: (w: CustomWheels) => CustomWheels) => setS(prev => ({ ...prev, custom: fn(prev.custom ?? EMPTY_CUSTOM) }));
	const add = () => {
		const item: CustomItem = { id: newCustomId(), label: label.trim().slice(0, 28), desc: desc.trim().slice(0, 160) || label.trim(), ...(kind === 'challenges' ? { difficulty: dif } : {}) };
		update(w => ({ ...w, [kind]: [...w[kind], item] }));
		setLabel('');
		setDesc('');
	};
	const share = async () => {
		const total = c.challenges.length + c.sabotages.length + c.twists.length + c.halftime.length;
		if (!total) return setMsg('Add something first');
		const link = await wheelsLink(c, s.names.filter(Boolean).join(' & ') || 'A friend');
		try {
			if (navigator.share) {
				await navigator.share({ title: 'My Versus wheels', text: `${total} custom wheel items for Giddey Versus:`, url: link });
				return;
			}
		} catch {
			/* dismissed */
		}
		try {
			await navigator.clipboard.writeText(link);
			setMsg('Link copied — send it to your rival');
		} catch {
			setMsg('Couldn’t copy the link');
		}
		setTimeout(() => setMsg(null), 2500);
	};
	const field = 'w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/25';
	return (
		<div className='space-y-3'>
			<div className='flex gap-1 rounded-xl bg-white/[0.05] p-1 overflow-x-auto [scrollbar-width:none]'>
				{KINDS.map(k => (
					<button key={k.id} onClick={() => setKind(k.id)} className={`flex-1 shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-[11px] font-black ${kind === k.id ? 'bg-white text-black' : 'text-white/60'}`}>
						<Icon name={k.icon} size={13} /> {k.label} {c[k.id].length ? `· ${c[k.id].length}` : ''}
					</button>
				))}
			</div>
			<div className='text-[11px] text-white/45'>{info.hint}</div>
			{c[kind].length > 0 && (
				<div className='space-y-1'>
					{c[kind].map(x => (
						<div key={x.id} className='flex items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2'>
							<div className='min-w-0 flex-1'>
								<div className='text-[12px] font-black text-white'>
									{x.label}
									{x.difficulty && (
										<span className='ml-1.5 text-[9px] uppercase' style={{ color: DIFFICULTY_INFO[x.difficulty].color }}>
											{DIFFICULTY_INFO[x.difficulty].label}
										</span>
									)}
								</div>
								{x.desc !== x.label && <div className='text-[11px] text-white/50 leading-snug'>{x.desc}</div>}
							</div>
							<button onClick={() => update(w => ({ ...w, [kind]: w[kind].filter(y => y.id !== x.id) }))} className='-my-1 -mr-2 p-2 text-white/35 hover:text-white' aria-label={`Remove ${x.label}`}>
								<Icon name='x' size={16} />
							</button>
						</div>
					))}
				</div>
			)}
			<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-2'>
				<input className={field} maxLength={28} placeholder={`Name — e.g. ${info.example.slice(0, 26)}`} value={label} onChange={e => setLabel(e.target.value)} />
				<input className={field} maxLength={160} placeholder='The rule, in a sentence (optional)' value={desc} onChange={e => setDesc(e.target.value)} />
				{kind === 'challenges' && (
					<div className='grid grid-cols-3 gap-1.5'>
						{(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
							<button key={d} onClick={() => setDif(d)} className='rounded-lg py-1.5 text-xs font-black border' style={{ borderColor: dif === d ? DIFFICULTY_INFO[d].color : 'rgba(255,255,255,0.1)', color: DIFFICULTY_INFO[d].color, background: dif === d ? `${DIFFICULTY_INFO[d].color}22` : 'transparent' }}>
								{DIFFICULTY_INFO[d].label}
							</button>
						))}
					</div>
				)}
				<button disabled={!label.trim()} onClick={add} className='w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black text-white bg-white/10 border border-white/15 disabled:opacity-40'>
					<Icon name='plus' size={16} /> Add to {info.label.toLowerCase()}
				</button>
			</div>
			<div className='flex gap-2'>
				{(['mix', 'only'] as const).map(m => (
					<button key={m} onClick={() => update(w => ({ ...w, mode: m }))} className={`flex-1 rounded-xl py-2 text-xs font-black border ${c.mode === m ? 'bg-white text-black border-white' : 'bg-white/5 text-white/70 border-white/10'}`}>
						{m === 'mix' ? 'Mix with built-ins' : 'Only mine'}
					</button>
				))}
			</div>
			<div className='text-[10px] text-white/35 -mt-1'>“Only mine” replaces a wheel once it has at least 2 of your items (challenges: per difficulty).</div>
			<button onClick={share} className='w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black text-sky-200 bg-sky-500/15 border border-sky-400/30'>
				<Icon name='share' size={16} /> Share my wheels
			</button>
			{msg && <div className='text-center text-xs text-emerald-300'>{msg}</div>}
		</div>
	);
}
