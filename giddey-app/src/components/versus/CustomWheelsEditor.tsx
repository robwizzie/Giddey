'use client';

import { useState } from 'react';
import { Settings } from '@/lib/versus/engine';
import { builtIns, CUSTOM_KINDS, CustomItem, CustomKind, CustomWheels, Difficulty, DIFFICULTY_INFO, EMPTY_CUSTOM, newCustomId } from '@/lib/versus/wheels';
import { encodeJson } from '@/lib/versus/sync';
import Icon from './Icon';

const KINDS: { id: CustomKind; icon: string; label: string; hint: string; example: string }[] = [
	{ id: 'challenges', icon: 'target', label: 'Challenges', hint: 'Each coach spins one before tip-off. Pull it off and you earn a reward for the next draft — harder pays more.', example: 'Score with your center from three' },
	{ id: 'twists', icon: 'dice', label: 'Twists', hint: 'The game-day slot machine sets one rule for both teams.', example: 'Every made three = loser does a push-up' },
	{ id: 'halftime', icon: 'clock', label: 'Halftime', hint: 'With the Halftime wheel on, the trailing coach spins a second-half rule. Use {L} for the coach leading at the half and {T} for the one trailing.', example: '{L} can only score in the paint in Q3' },
	{ id: 'sabotages', icon: 'bomb', label: 'Sabotages', hint: 'After a game, the loser spins one the winner has to live with next game.', example: 'You have to use the Jumbotron camera angle' },
	{ id: 'punishments', icon: 'skull', label: 'Punishments', hint: 'With Stakes on, the loser spins this after the game. Make them hurt (a little).', example: 'Loser buys the next pizza' },
];

export interface SharedWheels {
	v: 1;
	from: string;
	wheels: Omit<CustomWheels, 'mode' | 'off'>;
}

export async function wheelsLink(c: CustomWheels, from: string): Promise<string> {
	const code = await encodeJson({ v: 1, from, wheels: { challenges: c.challenges, sabotages: c.sabotages, twists: c.twists, halftime: c.halftime, punishments: c.punishments ?? [] } } satisfies SharedWheels);
	return `${location.origin}${location.pathname}#wheels=${code}`;
}

/** Add someone's shared items to yours (same label in the same wheel = skipped) */
export function mergeWheels(mine: CustomWheels, theirs: Omit<CustomWheels, 'mode' | 'off'>): { merged: CustomWheels; added: number } {
	const merged: CustomWheels = { ...mine };
	let added = 0;
	for (const k of CUSTOM_KINDS) {
		const have = new Set((mine[k] ?? []).map(x => x.label.trim().toLowerCase()));
		const fresh = (theirs[k] ?? []).filter(x => x?.label && !have.has(x.label.trim().toLowerCase()));
		merged[k] = [...(mine[k] ?? []), ...fresh];
		added += fresh.length;
	}
	return { merged, added };
}

/** On/off switch */
function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
	return (
		<button onClick={onChange} role='switch' aria-checked={on} aria-label={label} className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-green-500' : 'bg-white/15'}`}>
			<span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
		</button>
	);
}

/**
 * Settings section: every game-night wheel, with each built-in item
 * switched on or off, your own items added on top, and a share link.
 */
export default function CustomWheelsEditor({ s, setS }: { s: Settings; setS: (fn: (prev: Settings) => Settings) => void }) {
	const c = s.custom ?? EMPTY_CUSTOM;
	const off = new Set(c.off ?? []);
	const [kind, setKind] = useState<CustomKind>('challenges');
	const [adding, setAdding] = useState(false);
	const [label, setLabel] = useState('');
	const [desc, setDesc] = useState('');
	const [dif, setDif] = useState<Difficulty>('medium');
	const [msg, setMsg] = useState<string | null>(null);
	const info = KINDS.find(k => k.id === kind)!;
	const update = (fn: (w: CustomWheels) => CustomWheels) => setS(prev => ({ ...prev, custom: fn({ ...EMPTY_CUSTOM, ...(prev.custom ?? {}) }) }));
	const mine = (k: CustomKind) => c[k] ?? [];
	const all = (k: CustomKind) => [...builtIns(k), ...mine(k)];
	const onCount = (k: CustomKind) => all(k).filter(x => !off.has(x.id)).length;
	const toggle = (id: string) => update(w => ({ ...w, mode: 'mix', off: (w.off ?? []).includes(id) ? (w.off ?? []).filter(x => x !== id) : [...(w.off ?? []), id] }));
	const setAll = (k: CustomKind, on: boolean) => {
		const ids = new Set(builtIns(k).map(x => x.id));
		update(w => ({ ...w, mode: 'mix', off: on ? (w.off ?? []).filter(x => !ids.has(x)) : [...new Set([...(w.off ?? []), ...ids])] }));
	};
	const add = () => {
		const item: CustomItem = { id: newCustomId(), label: label.trim().slice(0, 28), desc: desc.trim().slice(0, 160) || label.trim(), ...(kind === 'challenges' ? { difficulty: dif } : {}) };
		update(w => ({ ...w, [kind]: [...(w[kind] ?? []), item] }));
		setLabel('');
		setDesc('');
		setAdding(false);
	};
	const share = async () => {
		const total = CUSTOM_KINDS.reduce((n, k) => n + mine(k).length, 0);
		if (!total) return setMsg('Add one of your own first — built-ins are already on their phone');
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
	const builtInOn = builtIns(kind).filter(x => !off.has(x.id)).length;
	const lowOn = onCount(kind) < 2;
	const row = (x: { id: string; label: string; desc: string; difficulty?: Difficulty }, own: boolean) => {
		const isOn = !off.has(x.id);
		return (
			<div key={x.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-opacity ${isOn ? 'bg-white/[0.05]' : 'bg-white/[0.02] opacity-55'}`}>
				<div className='min-w-0 flex-1'>
					<div className='text-[13px] font-black text-white leading-tight'>
						{x.label}
						{x.difficulty && (
							<span className='ml-1.5 text-[9px] uppercase tracking-wider' style={{ color: DIFFICULTY_INFO[x.difficulty].color }}>
								{DIFFICULTY_INFO[x.difficulty].label}
							</span>
						)}
						{own && <span className='ml-1.5 text-[9px] uppercase tracking-wider text-sky-300'>Yours</span>}
					</div>
					{x.desc !== x.label && <div className='text-[11px] text-white/50 leading-snug'>{x.desc.replace('{L}', 'the leader').replace('{T}', 'the trailing coach')}</div>}
				</div>
				{own && (
					<button onClick={() => update(w => ({ ...w, [kind]: (w[kind] ?? []).filter(y => y.id !== x.id), off: (w.off ?? []).filter(y => y !== x.id) }))} className='p-2 -m-1 text-white/35 hover:text-white' aria-label={`Delete ${x.label}`}>
						<Icon name='trash' size={15} />
					</button>
				)}
				<Switch on={isOn} onChange={() => toggle(x.id)} label={`${x.label} ${isOn ? 'on' : 'off'}`} />
			</div>
		);
	};
	return (
		<div className='space-y-3'>
			<div className='flex gap-1 rounded-xl bg-white/[0.05] p-1 overflow-x-auto [scrollbar-width:none]'>
				{KINDS.map(k => (
					<button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className={`shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-black ${kind === k.id ? 'bg-white text-black' : 'text-white/60'}`}>
						<Icon name={k.icon} size={13} /> {k.label}
						<span className={kind === k.id ? 'text-black/45' : 'text-white/35'}>
							{onCount(k.id)}/{all(k.id).length}
						</span>
					</button>
				))}
			</div>
			<div className='text-[12px] text-white/55 leading-snug'>{info.hint}</div>
			{kind === 'challenges' && s.rosterChallenges && <div className='text-[11px] text-white/40 -mt-1'>Roster challenges (about the players you drafted, like “Your best player scores 20”) are mixed in too — turn them off under Game night.</div>}

			<div className='flex items-center justify-between'>
				<div className='text-[10px] font-black uppercase tracking-widest text-white/40'>
					Built-in · {builtInOn} of {builtIns(kind).length} on
				</div>
				<div className='flex gap-3 text-[11px] font-bold'>
					<button onClick={() => setAll(kind, true)} className='text-white/55 hover:text-white'>
						All on
					</button>
					<button onClick={() => setAll(kind, false)} className='text-white/55 hover:text-white'>
						All off
					</button>
				</div>
			</div>
			{lowOn && <div className='rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-200 text-[11px] px-3 py-2'>A wheel needs at least 2 items, so with fewer than 2 on it uses everything. Turn a couple back on or add your own.</div>}
			<div className='space-y-1'>{builtIns(kind).map(x => row(x, false))}</div>

			<div className='text-[10px] font-black uppercase tracking-widest text-white/40 pt-1'>Yours · {mine(kind).length}</div>
			{mine(kind).length > 0 && <div className='space-y-1'>{mine(kind).map(x => row(x, true))}</div>}
			{adding ? (
				<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-2 animate-fade-in'>
					<input className={field} autoFocus maxLength={28} placeholder={`Name — e.g. ${info.example.slice(0, 26)}`} value={label} onChange={e => setLabel(e.target.value)} />
					<input className={field} maxLength={160} placeholder='The rule, in a sentence (optional)' value={desc} onChange={e => setDesc(e.target.value)} />
					{kind === 'challenges' && (
						<div className='grid grid-cols-3 gap-1.5'>
							{(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
								<button key={d} onClick={() => setDif(d)} className='rounded-lg py-2 text-xs font-black border' style={{ borderColor: dif === d ? DIFFICULTY_INFO[d].color : 'rgba(255,255,255,0.1)', color: DIFFICULTY_INFO[d].color, background: dif === d ? `${DIFFICULTY_INFO[d].color}22` : 'transparent' }}>
									{DIFFICULTY_INFO[d].label}
								</button>
							))}
						</div>
					)}
					<div className='flex gap-2'>
						<button onClick={() => setAdding(false)} className='rounded-xl px-4 py-2.5 text-sm font-bold text-white/60 bg-white/5'>
							Cancel
						</button>
						<button disabled={!label.trim()} onClick={add} className='flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black text-white btn-primary disabled:opacity-40'>
							<Icon name='plus' size={16} /> Add to {info.label.toLowerCase()}
						</button>
					</div>
				</div>
			) : (
				<button onClick={() => setAdding(true)} className='w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black text-white bg-white/[0.06] border border-dashed border-white/20 hover:bg-white/10'>
					<Icon name='plus' size={16} /> Add your own {info.label.toLowerCase().replace(/s$/, '')}
				</button>
			)}
			<button onClick={share} className='w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black text-sky-200 bg-sky-500/15 border border-sky-400/30'>
				<Icon name='share' size={16} /> Share my items with my rival
			</button>
			{msg && <div className='text-center text-xs text-emerald-300'>{msg}</div>}
		</div>
	);
}
