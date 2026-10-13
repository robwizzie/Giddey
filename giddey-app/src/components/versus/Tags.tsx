'use client';

import { freshNeeded, ineligibleReason, other, Side, VersusState } from '@/lib/versus/engine';
import { hotHand, isFreshFor, neverDrafted, timesUsed, usage } from '@/lib/versus/usage';
import { SIDE_COLORS } from './Fx';

export interface Tag {
	icon: string;
	text: string;
	color: string;
	/** longer explanation (tooltip / legend) */
	title: string;
}

function ordinal(n: number) {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** What's notable about this player for the coach looking at him (most important first) */
export function playerTags(state: VersusState, side: Side, id: string, max = 2): Tag[] {
	const tags: Tag[] = [];
	const names = state.settings.names;
	const favs = state.settings.favorites ?? [[], []];
	if (favs[side]?.includes(id)) tags.push({ icon: '💙', text: 'Your guy', color: SIDE_COLORS[side], title: 'One of your pinned franchise guys' });
	else if (favs[other(side)]?.includes(id)) tags.push({ icon: '🎯', text: `${names[other(side)]}'s guy`, color: SIDE_COLORS[other(side)], title: `One of ${names[other(side)]}'s franchise guys — take him first?` });
	// with no history yet every card would read "never drafted" — skip until there is some
	const hasHistory = usage().any.size > 0;
	if (!hasHistory) {
		if (freshNeeded(state, side) > 0) tags.push({ icon: '🌱', text: 'Fresh face', color: '#4ade80', title: 'You have never used him — counts toward Fresh Faces' });
	} else if (neverDrafted(id)) tags.push({ icon: '🆕', text: 'Never drafted', color: '#22c55e', title: 'Neither of you has ever played with him' });
	else {
		const used = timesUsed(side, id);
		if (used >= 2) tags.push({ icon: '🔥', text: `Your ${ordinal(used + 1)} time`, color: '#f97316', title: `You've played ${used} games with him` });
		else if (freshNeeded(state, side) > 0 && isFreshFor(side, id)) tags.push({ icon: '🌱', text: 'Fresh face', color: '#4ade80', title: 'You have never used him — counts toward Fresh Faces' });
	}
	const hot = hotHand(id);
	if (hot) tags.push({ icon: '⭐', text: hot > 1 ? `Hot hand ×${hot}` : 'Hot hand', color: '#facc15', title: `Player of the Game ${hot} time${hot === 1 ? '' : 's'}` });
	return tags.slice(0, max);
}

export function TagChip({ tag, small }: { tag: Tag; small?: boolean }) {
	return (
		<span
			title={tag.title}
			className={`inline-flex items-center gap-0.5 rounded-full font-black uppercase whitespace-nowrap shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${small ? 'text-[8px] px-1.5 py-[1px]' : 'text-[9px] px-1.5 py-0.5'}`}
			style={{ background: '#0b0f19', color: tag.color, border: `1px solid ${tag.color}88` }}
		>
			{tag.icon} {tag.text}
		</span>
	);
}

/**
 * Card wrapper: usage tags along the bottom edge and a lock overlay when
 * this coach can't take the player (retired, Fresh Faces, one per franchise).
 */
export function TaggedCard({ state, side, id, children, hideTags }: { state: VersusState; side: Side; id: string; children: React.ReactNode; hideTags?: boolean }) {
	const lock = ineligibleReason(state, side, id);
	const tags = hideTags ? [] : playerTags(state, side, id);
	return (
		<div className={`relative ${tags.length ? 'mb-2' : ''}`}>
			<div style={lock ? { opacity: 0.35, filter: 'grayscale(0.8)' } : undefined}>{children}</div>
			{lock && (
				<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-30'>
					<span className='text-[10px] font-black uppercase tracking-wide text-white bg-black/85 border border-white/20 rounded-lg px-2 py-1 text-center leading-tight max-w-[90%]'>🔒 {lock}</span>
				</div>
			)}
			{tags.length > 0 && (
				<div className='absolute -bottom-2 left-0 right-0 flex justify-center gap-1 z-30 pointer-events-none flex-wrap px-1'>
					{tags.map(t => (
						<TagChip key={t.text} tag={t} small />
					))}
				</div>
			)}
		</div>
	);
}

/** Legend explaining every tag — shown in the help sheet and on draft screens */
export const TAG_LEGEND: { icon: string; label: string; desc: string }[] = [
	{ icon: '🆕', label: 'Never drafted', desc: 'Neither of you has ever played with him. Freshness boost makes these come up more.' },
	{ icon: '🔥', label: 'Your Nth time', desc: 'You keep taking him. Overused players come up less often.' },
	{ icon: '🌱', label: 'Fresh face', desc: 'You personally have never used him — counts toward the Fresh Faces rule.' },
	{ icon: '⭐', label: 'Hot hand', desc: 'He has won Player of the Game before.' },
	{ icon: '💙', label: 'Your guy / 🎯 their guy', desc: 'A pinned franchise guy — yours, or your opponent’s (steal him first?).' },
	{ icon: '🔒', label: 'Locked', desc: 'You can’t take him right now: retired from your side, a second player from one franchise, or you still owe Fresh Faces.' },
];
