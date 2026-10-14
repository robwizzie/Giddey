'use client';

import { belt } from '@/lib/versus/legacy';
import { history } from '@/lib/versus/history';
import Icon from './Icon';

/**
 * Small gold belt next to the holder's name. `side` = the coach this name
 * belongs to; renders nothing unless they hold the belt right now.
 * Reads the head-to-head history (re-seated to the current names).
 */
export function BeltBadge({ side, size = 'sm', showDefenses = false }: { side: 0 | 1; size?: 'sm' | 'lg'; showDefenses?: boolean }) {
	const b = belt(history());
	if (!b || b.holder !== side) return null;
	const lg = size === 'lg';
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wider align-middle ${lg ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[9px]'}`}
			style={{ background: 'linear-gradient(135deg, #facc15, #b45309)', color: '#1c1206', boxShadow: '0 0 12px rgba(250,204,21,0.35)' }}
			title={`Belt holder · ${b.defenses} straight defense${b.defenses === 1 ? '' : 's'}`}
		>
			<Icon name='award' size={lg ? 14 : 10} strokeWidth={2.75} />
			{showDefenses || lg ? `Belt${b.defenses ? ` · ${b.defenses}` : ''}` : 'Belt'}
		</span>
	);
}
