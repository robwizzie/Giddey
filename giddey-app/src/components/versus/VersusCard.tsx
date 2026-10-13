'use client';

import { VersusPlayer, getTeamFor } from '@/lib/versus/pool';
import { getPlayerHeadshotUrls, getTeamLogoUrl } from '@/lib/images';
import Headshot from '@/components/Headshot';

const SECTIONS: Record<string, { upper: string; lower: string; accent: string }> = {
	'dark-matter': { upper: '#1a0533', lower: '#090115', accent: '#8b5cf6' },
	'galaxy-opal': { upper: '#4a1a6b', lower: '#160828', accent: '#c084fc' },
	'pink-diamond': { upper: '#831843', lower: '#1f0416', accent: '#ec4899' },
	diamond: { upper: '#0e4963', lower: '#041318', accent: '#06b6d4' },
	amethyst: { upper: '#3b1a7a', lower: '#12082e', accent: '#a855f7' },
	ruby: { upper: '#7f1d1d', lower: '#1a0404', accent: '#ef4444' },
	sapphire: { upper: '#1e3a8a', lower: '#060f2a', accent: '#3b82f6' },
	emerald: { upper: '#064e2e', lower: '#01180d', accent: '#22c55e' },
	gold: { upper: '#713f12', lower: '#1a0c03', accent: '#eab308' },
};

export function tierAccent(tier: string): string {
	return SECTIONS[tier]?.accent ?? '#eab308';
}

interface Props {
	player: VersusPlayer;
	width?: number;
	selected?: boolean;
	dimmed?: boolean;
	faceDown?: boolean;
	onClick?: () => void;
	className?: string;
	style?: React.CSSProperties;
}

export default function VersusCard({ player: p, width = 120, selected, dimmed, faceDown, onClick, className = '', style }: Props) {
	const team = getTeamFor(p);
	const sec = SECTIONS[p.tier];
	const h = Math.round(width * 1.4);
	const headshots = getPlayerHeadshotUrls(p.id.replace(/^at_/, ''), p.firstName, p.lastName, p.era);
	const nameFont = Math.max(9, Math.round(width * 0.105));
	const lastName = p.lastName.toUpperCase();
	const scaledName = lastName.length > 10 ? Math.round(nameFont * Math.max(0.68, 10 / lastName.length)) : nameFont;

	const ring = selected ? '0 0 0 3px #fff, 0 0 30px rgba(255,255,255,0.45)' : undefined;

	if (faceDown) {
		return (
			<div
				onClick={onClick}
				className={`relative select-none cursor-pointer card-2k tier-${p.tier} vs-card-back ${className}`}
				style={{ width, height: h, borderRadius: 12, boxShadow: ring, ...style }}
			>
				<div className='absolute inset-0 flex flex-col items-center justify-center gap-2'>
					<div className='font-black text-white/90' style={{ fontSize: width * 0.38, lineHeight: 1 }}>?</div>
					<div className='px-2 py-0.5 rounded text-white font-extrabold' style={{ background: sec.accent, fontSize: Math.max(9, width * 0.09) }}>
						{p.position} / {p.secondaryPosition}
					</div>
					<div className='text-white/60 font-bold uppercase tracking-widest' style={{ fontSize: Math.max(8, width * 0.07) }}>
						{p.era === 'alltime' ? 'Legend' : 'Mystery'}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			onClick={onClick}
			className={`relative select-none shrink-0 card-2k tier-${p.tier} ${onClick ? 'cursor-pointer' : ''} ${className}`}
			style={{ width, height: h, borderRadius: 12, opacity: dimmed ? 0.35 : 1, boxShadow: ring, transform: selected ? 'translateY(-6px) scale(1.04)' : undefined, ...style }}
		>
			{(p.tier === 'dark-matter' || p.tier === 'galaxy-opal') && <div className='absolute inset-0 dark-matter-shimmer z-20 pointer-events-none' />}

			{/* Upper: logo + headshot */}
			<div className='absolute left-0 right-0 top-0 overflow-hidden' style={{ height: '58%', background: sec.upper }}>
				<img
					src={getTeamLogoUrl(team.abbreviation)}
					alt=''
					referrerPolicy='no-referrer'
					draggable={false}
					onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
					className='absolute pointer-events-none'
					style={{ left: '4%', top: '28%', width: '36%', height: '50%', objectFit: 'contain', opacity: 0.85 }}
				/>
				<Headshot
					urls={headshots}
					alt={`${p.firstName} ${p.lastName}`}
					className='absolute right-0 bottom-0 pointer-events-none'
					style={{ width: '66%', height: '92%', objectFit: 'cover', objectPosition: 'top center', filter: 'drop-shadow(-3px 2px 8px rgba(0,0,0,0.7))' }}
					fallback={
						<div
							className='absolute right-[6%] bottom-[8%] rounded-full flex items-center justify-center font-black text-white'
							style={{ width: '52%', aspectRatio: '1', background: `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor})`, fontSize: width * 0.16, border: '2px solid rgba(255,255,255,0.25)' }}
						>
							{p.firstName[0]}
							{p.lastName[0]}
						</div>
					}
				/>
				{/* OVR */}
				<div className='absolute top-1.5 left-1.5 z-10 flex flex-col items-center'>
					<div
						className='rounded-md font-black text-white flex items-center justify-center'
						style={{
							width: width * 0.27,
							height: width * 0.27,
							fontSize: width * 0.15,
							background: `linear-gradient(135deg, ${sec.accent}, ${sec.upper})`,
							border: `1.5px solid ${sec.accent}`,
							boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
						}}
					>
						{p.overall}
					</div>
				</div>
				{p.era === 'alltime' && (
					<div className='absolute top-1.5 right-1.5 z-10 rounded px-1 font-black text-black' style={{ background: '#fbbf24', fontSize: Math.max(7, width * 0.07) }}>
						{p.eraLabel ?? 'LEGEND'}
					</div>
				)}
			</div>

			{/* Position pill on divider */}
			<div className='absolute left-0 right-0 z-10' style={{ top: '58%', height: 1, background: sec.accent }}>
				<div
					className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded font-extrabold text-white whitespace-nowrap'
					style={{ background: sec.accent, fontSize: Math.max(8, width * 0.075), padding: '1px 6px' }}
				>
					{p.position} / {p.secondaryPosition}
				</div>
			</div>

			{/* Lower: name + team */}
			<div className='absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center px-1' style={{ top: '58%', background: sec.lower, paddingTop: width * 0.06 }}>
				<div className='text-white/70 font-semibold leading-none' style={{ fontSize: Math.max(8, width * 0.075) }}>
					{p.firstName}
				</div>
				<div className='text-white font-black leading-tight whitespace-nowrap' style={{ fontSize: scaledName }}>
					{lastName}
				</div>
				<div className='font-bold uppercase leading-none mt-0.5 tracking-wide' style={{ fontSize: Math.max(7, width * 0.065), color: sec.accent }}>
					{p.era === 'alltime' ? `All-Time ${team.abbreviation}` : team.abbreviation}
				</div>
			</div>
		</div>
	);
}

/** Compact one-line row for rosters */
export function RosterRow({ player: p, tag, tagColor, highlight, compact }: { player: VersusPlayer; tag?: string; tagColor?: string; highlight?: boolean; compact?: boolean }) {
	const team = getTeamFor(p);
	return (
		<div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${highlight ? 'bg-white/15' : 'bg-white/[0.04]'}`}>
			<div className={`tier-${p.tier} rounded-md w-8 h-8 flex items-center justify-center text-[13px] font-black text-white shrink-0`} style={{ animation: 'none' }}>
				{p.overall}
			</div>
			<div className='min-w-0 flex-1'>
				<div className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-bold text-white truncate leading-tight`}>{compact ? p.lastName : `${p.firstName[0]}. ${p.lastName}`}</div>
				<div className='text-[10px] text-white/45 leading-tight truncate'>
					{compact ? `${p.position}/${p.secondaryPosition} · ${p.era === 'alltime' ? `'${(p.eraLabel ?? '').replace(/s$/, '')}` : team.abbreviation}` : `${p.position}/${p.secondaryPosition} · ${p.era === 'alltime' ? `${p.eraLabel ?? ''} ${team.name}`.trim() : team.abbreviation}`}
				</div>
			</div>
			{tag && (
				<span className={`text-[9px] font-black uppercase rounded shrink-0 ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'}`} style={{ background: tagColor ?? 'rgba(255,255,255,0.1)', color: '#fff' }}>
					{tag}
				</span>
			)}
		</div>
	);
}
