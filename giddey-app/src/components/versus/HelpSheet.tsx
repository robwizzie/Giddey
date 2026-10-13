'use client';

import { RETIRE_DRAFTS, Settings } from '@/lib/versus/engine';
import { getTheme } from '@/lib/versus/themes';
import { TAG_LEGEND } from './Tags';

const STYLE_NAMES: Record<string, string> = {
	snake: 'Snake draft',
	cut: 'You Cut, I Choose',
	franchise: 'Franchise wheel',
	auction: 'Auction',
	block: 'Auction Block',
};

/** The night, in order — each step says whether it's on with the current settings */
function steps(s: Settings): { icon: string; title: string; desc: string; on: boolean }[] {
	const auction = s.style === 'auction' || s.style === 'block';
	return [
		{ icon: '⚙️', title: 'Set up', desc: 'Pick a quick setup or customize. Pin your franchise guys in Coaches.', on: true },
		{ icon: '🪙', title: 'Coin toss', desc: 'Winner picks first in round 1.', on: true },
		{
			icon: '🎡',
			title: 'Theme',
			desc: s.theme === 'spin' ? 'Spin a theme for this draft (90s legends, one division, East vs West…).' : s.theme === 'off' ? 'Off — the whole pool is in play.' : `Always ${getTheme(s.theme)?.label}.`,
			on: s.theme === 'spin',
		},
		{ icon: '🔒', title: 'Keepers', desc: 'On a mid-series redraft, each coach keeps one player.', on: s.keepers },
		{ icon: '💙', title: 'Favorites round', desc: 'Each coach grabs one of their pinned franchise guys before the draft.', on: s.favoritesRound },
		{ icon: auction ? '🔨' : '🎴', title: STYLE_NAMES[s.style] ?? 'Draft', desc: 'Build your roster tier by tier. Card tags show who is fresh and who you overuse.', on: true },
		{ icon: '⚖️', title: 'Balance', desc: 'Equalizer swap if the teams finish far apart, then the trade window.', on: s.equalizer || s.trades },
		{ icon: '🏀', title: 'Game day', desc: 'Spin quarter length and the scoring twist, then each coach picks a challenge and a risk level.', on: true },
		{ icon: '⭐', title: 'Result + Player of the Game', desc: 'Enter the winner and score, then each coach votes Player of the Game.', on: true },
		{
			icon: '🎖️',
			title: 'Retirements',
			desc: s.retire === 'off' ? 'Off.' : `The winner's ${s.retire === 'potg' ? 'Player of the Game' : 'starting five'} sits out the next ${RETIRE_DRAFTS} drafts for that coach.`,
			on: s.retire !== 'off',
		},
		{ icon: '🔁', title: 'Run it back or redraft', desc: 'Challenge rewards (keepers, tier-ups, extra stars) apply to the next draft.', on: true },
	];
}

export default function HelpSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
	return (
		<div className='fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center' onClick={onClose}>
			<div className='w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0d1220] border border-white/10 rounded-t-3xl sm:rounded-3xl px-4 pt-4 pb-8 animate-slide-up' onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between mb-1'>
					<div className='text-lg font-black text-white'>❓ How Versus works</div>
					<button onClick={onClose} className='text-white/50 hover:text-white text-2xl leading-none px-2' aria-label='Close'>
						&times;
					</button>
				</div>
				<div className='text-xs text-white/50 mb-4'>A night of Versus, step by step. Greyed steps are off with your current settings — turn them on in ⚙️ Settings.</div>

				<ol className='space-y-1.5 mb-6'>
					{steps(settings).map((st, i) => (
						<li key={st.title} className={`flex gap-3 rounded-xl p-2.5 border ${st.on ? 'bg-white/[0.05] border-white/10' : 'border-white/5 opacity-45'}`}>
							<div className='w-6 h-6 rounded-full bg-white/10 text-[11px] font-black text-white flex items-center justify-center shrink-0'>{i + 1}</div>
							<div className='min-w-0'>
								<div className='text-sm font-black text-white'>
									{st.icon} {st.title}
									{!st.on && <span className='ml-1.5 text-[9px] uppercase tracking-widest text-white/50'>off</span>}
								</div>
								<div className='text-[12px] text-white/55 leading-snug'>{st.desc}</div>
							</div>
						</li>
					))}
				</ol>

				<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>Card tags</div>
				<div className='grid sm:grid-cols-2 gap-1.5 mb-6'>
					{TAG_LEGEND.map(t => (
						<div key={t.label} className='rounded-xl bg-white/[0.04] border border-white/10 p-2.5'>
							<div className='text-sm font-black text-white'>
								{t.icon} {t.label}
							</div>
							<div className='text-[11px] text-white/50 leading-snug'>{t.desc}</div>
						</div>
					))}
				</div>

				<div className='text-[11px] font-black uppercase tracking-widest text-white/45 mb-2'>What gets tracked</div>
				<div className='rounded-xl bg-white/[0.04] border border-white/10 p-3 text-[12px] text-white/60 leading-relaxed'>
					Every game you record is saved to the 📊 Rivalry record on this device, matched by coach names, so it survives new series. It tracks wins, the head-to-head swing, records by draft style, Player of the Game
					awards, who each of you leans on, the best players you&apos;ve never used, and who is retired. Usage only counts games between the two coaches playing now, so keep your names the same each night.
				</div>
			</div>
		</div>
	);
}
