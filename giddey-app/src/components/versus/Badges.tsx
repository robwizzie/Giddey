'use client';

import { achievementsFor } from '@/lib/versus/achievements';
import { history } from '@/lib/versus/history';
import { titles } from '@/lib/versus/seasons';

type Side = 0 | 1;

/** Titles + badge count next to a coach's name ("🏆2 🏅7"), with the latest badge icons */
export function CoachBadges({ side, compact, icons = 3 }: { side: Side; compact?: boolean; icons?: number }) {
	const games = history();
	if (!games.length) return null;
	const done = achievementsFor(games, side).filter(x => x.done);
	const t = titles(games)[side];
	if (!done.length && !t) return null;
	return (
		<span className={`inline-flex items-center gap-1 align-middle ${compact ? 'text-[10px]' : 'text-[11px]'} font-black text-white/70 normal-case tracking-normal`} title={done.map(x => `${x.a.icon} ${x.a.title}`).join('\n')}>
			{t > 0 && <span className='text-yellow-300'>🏆{t > 1 ? t : ''}</span>}
			{done.length > 0 && <span>🏅{done.length}</span>}
			{!compact && icons > 0 && <span className='opacity-80'>{done.slice(-icons).map(x => x.a.icon).join('')}</span>}
		</span>
	);
}
