'use client';

import { achievementsFor } from '@/lib/versus/achievements';
import { history } from '@/lib/versus/history';
import { titles } from '@/lib/versus/seasons';
import Icon from './Icon';

type Side = 0 | 1;

/** Titles + badge count next to a coach's name (trophy ×2, medal ×7), with the latest badge icons */
export function CoachBadges({ side, compact, icons = 3 }: { side: Side; compact?: boolean; icons?: number }) {
	const games = history();
	if (!games.length) return null;
	const done = achievementsFor(games, side).filter(x => x.done);
	const t = titles(games)[side];
	if (!done.length && !t) return null;
	return (
		<span className={`inline-flex items-center gap-1 align-middle ${compact ? 'text-[10px]' : 'text-[11px]'} font-black text-white/70 normal-case tracking-normal`} title={[t > 0 ? `${t} title${t === 1 ? '' : 's'}` : '', ...done.map(x => x.a.title)].filter(Boolean).join('\n')}>
			{t > 0 && (
				<span className='inline-flex items-center gap-0.5 text-yellow-300'>
					<Icon name='trophy' />
					{t > 1 ? t : ''}
				</span>
			)}
			{done.length > 0 && (
				<span className='inline-flex items-center gap-0.5'>
					<Icon name='medal' />
					{done.length}
				</span>
			)}
			{!compact && icons > 0 && (
				<span className='inline-flex items-center gap-0.5 opacity-80'>
					{done.slice(-icons).map(x => (
						<Icon key={x.a.id} name={x.a.icon} />
					))}
				</span>
			)}
		</span>
	);
}
