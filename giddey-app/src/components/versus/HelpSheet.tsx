'use client';

import { RETIRE_DRAFTS, Settings } from '@/lib/versus/engine';
import { getTheme } from '@/lib/versus/themes';
import { TAG_LEGEND } from './Tags';
import { cloudEnabled } from '@/lib/versus/cloud';

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
		{ icon: '📡', title: 'Two phones (optional)', desc: 'From ⋯ → Two phones, each coach drafts on their own phone — same couch or across town — and a TV can show the draft board.', on: true },
		{ icon: '👑', title: 'Dynasty lottery', desc: 'A new Dynasty season opens with a draft lottery (worse record, more balls), then each coach keeps up to 3 players.', on: s.dynasty && s.season > 0 },
		{ icon: '🪙', title: 'Coin toss', desc: 'Winner picks first in round 1. In the Finals, the higher seed has home court and picks first instead.', on: true },
		{
			icon: '🎡',
			title: 'Theme',
			desc: s.theme === 'spin' ? 'Spin a theme for this draft (90s legends, one division, East vs West…).' : s.theme === 'off' ? 'Off — the whole pool is in play.' : `Always ${getTheme(s.theme)?.label}.`,
			on: s.theme === 'spin',
		},
		{ icon: '🔒', title: 'Keepers', desc: 'On a mid-series redraft, each coach keeps one player.', on: s.keepers },
		{ icon: '💙', title: 'Favorites round', desc: 'Each coach grabs one of their pinned franchise guys before the draft.', on: s.favoritesRound },
		{ icon: auction ? '🔨' : '🎴', title: STYLE_NAMES[s.style] ?? 'Draft', desc: 'Build your roster tier by tier. Card tags show who is fresh and who you overuse. Great value picks get stamped 💰 STEAL, bad ones 🤨 REACH.', on: true },
		{ icon: '🎙️', title: 'Announcer', desc: 'Your phone reads every pick aloud and loses it for superstars. 🔊 mutes it.', on: s.announcer },
		{ icon: '⚖️', title: 'Balance', desc: 'Equalizer swap if the teams finish far apart, then the trade window.', on: s.equalizer || s.trades },
		{ icon: '📝', title: 'Draft grades', desc: 'Each team gets a letter grade and an analyst take. They’re saved, so the rivalry page shows whether the better grade wins.', on: true },
		{ icon: '📈', title: 'Vegas line', desc: 'A point spread from the ratings and your recent games. An underdog who covers earns ⬆️ Tier Up for the next draft.', on: s.vegas },
		{ icon: '🏀', title: 'Game day', desc: 'Spin quarter length and the scoring twist, then each coach picks a challenge and a risk level.', on: true },
		{ icon: '🔮', title: 'Predictions', desc: 'Before tip-off, each coach secretly picks the winner and margin. The closer guess earns ➕ +1 Rotation player.', on: true },
		{ icon: '🕐', title: 'Halftime wheel', desc: 'Tap who leads at the half; the team that’s behind spins a second-half twist.', on: s.halftime },
		{ icon: '⭐', title: 'Result + Player of the Game', desc: 'Enter the winner and score, then each coach votes Player of the Game.', on: true },
		{
			icon: '🎖️',
			title: 'Retirements',
			desc: s.retire === 'off' ? 'Off.' : `The winner's ${s.retire === 'potg' ? 'Player of the Game' : 'starting five'} sits out the next ${RETIRE_DRAFTS} drafts for that coach.`,
			on: s.retire !== 'off',
		},
		{ icon: '📸', title: 'Night recap', desc: 'One shareable image of the whole night: results, Players of the Game, badges, standings and rating moves.', on: true },
		{ icon: '🔁', title: 'Run it back or redraft', desc: 'Challenge rewards (keepers, tier-ups, extra stars) apply to the next draft.', on: true },
		{
			icon: '🏆',
			title: 'Season & Finals',
			desc: s.season ? `${s.season}-game regular season, then a best-of-${s.finals} Finals. The champion's banner and Finals MVP go up in 📊 Rivalry.` : 'Off — games still count toward the all-time record.',
			on: s.season > 0,
		},
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
					Every game you record is saved to the 📊 Rivalry record on this device, matched by coach names, so keep your names the same each night. Tap any game to see its rosters, rules, line and grades. It also tracks
					seasons and titles, 🏅 badges, records by draft style, Player of the Game awards, the spread, who each of you leans on and who&apos;s retired.
					<div className='mt-2'>
						<span className='font-black text-white'>Accounts are optional.</span> Without one, everything lives on this phone and any number of rivalries can share it.
						{cloudEnabled && ' Sign in from 👤 to back rivalries up, invite your opponent with a code, and have games either of you logs show up for both.'}
					</div>
					<div className='mt-2'>
						<span className='font-black text-white'>No account, two phones?</span> 📊 Rivalry → 🔄 Sync phones sends your record as a QR code or link; the other phone merges whatever it&apos;s missing. Badges, seasons and
						freshness all update.
					</div>
					<div className='mt-2'>
						<span className='font-black text-white'>More in ⋯:</span> 🏟️ Leagues for 3–12 friends (round robin, standings, playoff bracket), 🏆 power rankings and the biggest upsets, 🎖️ your career (publish it as a public link when signed in), and ⚙️ Settings → 🎡 Your wheels to write and share your own challenges, sabotages and twists. Cards show 📈/📉 when 2K updates a rating.
					</div>
					<div className='mt-2'>
						<span className='font-black text-white'>📲 Install:</span> add Versus to your home screen from the setup screen. It opens full-screen and works offline.
					</div>
				</div>
			</div>
		</div>
	);
}
