'use client';

import { useEffect, useRef, useState } from 'react';
import { weightedIndex } from '@/lib/versus/wheels';
import { buzz, play } from '@/lib/versus/sound';
import { broadcastFx } from '@/lib/versus/live';
import Icon from './Icon';

export interface WheelItem {
	id: string;
	label: string;
	color: string;
	weight?: number;
}

interface Props {
	items: WheelItem[];
	size?: number;
	/** called once the wheel settles */
	onResult: (index: number) => void;
	disabled?: boolean;
	spinLabel?: string;
	/** shown in the hub once landed */
	accent?: string;
	/** replay a spin that happened on another device (spins on mount, lands here) */
	forced?: number;
	/** live room: send this spin to the other devices under this title */
	mirror?: string;
}

const SPIN_MS = 4600;

function shade(hex: string, amt: number): string {
	const n = parseInt(hex.replace('#', ''), 16);
	const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
	const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
	const b = Math.max(0, Math.min(255, (n & 255) + amt));
	return `rgb(${r},${g},${b})`;
}

export default function Wheel({ items, size = 300, onResult, disabled, spinLabel = 'SPIN', accent = '#f97316', forced, mirror }: Props) {
	const [rotation, setRotation] = useState(0);
	const [spinning, setSpinning] = useState(false);
	const [landed, setLanded] = useState<number | null>(null);
	const [tick, setTick] = useState(0);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

	const n = items.length;
	const seg = 360 / n;
	const r = size / 2;
	const fontSize = n > 24 ? 9 : n > 14 ? 10.5 : n > 8 ? 12 : 15;

	const spin = (replay?: number) => {
		if (spinning || landed !== null || (disabled && replay === undefined)) return;
		const idx = replay ?? weightedIndex(items.map(i => ({ weight: i.weight ?? 1 })));
		if (replay === undefined && mirror) broadcastFx({ kind: 'wheel', title: mirror, items: items.map(({ id, label, color }) => ({ id, label, color })), index: idx, accent });
		// Pointer is at the top (−90°). Segment i spans [i*seg, (i+1)*seg] clockwise from the top.
		const jitter = (Math.random() - 0.5) * seg * 0.7;
		const target = 360 - (idx * seg + seg / 2) + jitter;
		const base = rotation - (rotation % 360);
		const final = base + 360 * 6 + target;
		setSpinning(true);
		setRotation(final);
		// pointer flicks while the wheel is fast
		let t = 0;
		const flick = () => {
			t++;
			setTick(x => x + 1);
			play('tick');
			buzz(6);
			const delay = 40 + t * t * 1.6;
			if (delay < SPIN_MS * 0.5) timer.current = setTimeout(flick, delay);
		};
		flick();
		setTimeout(() => {
			setSpinning(false);
			play('reveal');
			buzz([40, 30, 80]);
			setLanded(idx);
			onResult(idx);
		}, SPIN_MS + 80);
	};

	// replaying another device's spin
	useEffect(() => {
		if (forced !== undefined) spin(forced);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const arc = (i: number) => {
		const a0 = ((i * seg - 90) * Math.PI) / 180;
		const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
		const large = seg > 180 ? 1 : 0;
		return `M ${r} ${r} L ${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
	};

	return (
		<div className='relative mx-auto select-none' style={{ width: size, height: size + 14 }}>
			{/* pointer */}
			<div
				className='absolute left-1/2 z-20'
				style={{
					top: -4,
					transform: `translateX(-50%) rotate(${spinning && tick % 2 ? -14 : 0}deg)`,
					transformOrigin: '50% 0%',
					transition: 'transform 60ms',
				}}
			>
				<svg width='30' height='36' viewBox='0 0 30 36'>
					<path d='M15 36 L2 6 Q15 -4 28 6 Z' fill='#fff' stroke='#0a0e17' strokeWidth='2' />
				</svg>
			</div>

			<div
				className='absolute left-0 rounded-full'
				style={{
					top: 14,
					width: size,
					height: size,
					boxShadow: `0 0 0 6px #1f2937, 0 0 0 9px ${accent}55, 0 18px 50px rgba(0,0,0,0.6)`,
				}}
			>
				<svg
					width={size}
					height={size}
					viewBox={`0 0 ${size} ${size}`}
					style={{
						transform: `rotate(${rotation}deg)`,
						transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.1, 1)` : 'none',
						borderRadius: '50%',
					}}
				>
					{items.map((it, i) => {
						const mid = i * seg + seg / 2 - 90;
						const lr = r * 0.6;
						const x = r + lr * Math.cos((mid * Math.PI) / 180);
						const y = r + lr * Math.sin((mid * Math.PI) / 180);
						const isWin = landed === i;
						let textRot = mid + (n > 8 ? 0 : 90);
						const norm = ((textRot % 360) + 360) % 360;
						if (norm > 90 && norm < 270) textRot += 180;
						return (
							<g key={`${it.id}-${i}`}>
								<path d={arc(i)} fill={i % 2 ? shade(it.color, -28) : it.color} stroke='rgba(0,0,0,0.35)' strokeWidth='1' opacity={landed !== null && !isWin ? 0.45 : 1} />
								<text
									x={x}
									y={y}
									fill='#fff'
									fontSize={fontSize}
									fontWeight={900}
									textAnchor='middle'
									dominantBaseline='middle'
									transform={`rotate(${textRot}, ${x}, ${y})`}
									style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: 3 }}
								>
									{it.label.length > 14 ? it.label.slice(0, 13) + '…' : it.label}
								</text>
							</g>
						);
					})}
				</svg>

				{/* hub */}
				<button
					onClick={() => spin()}
					disabled={spinning || disabled || landed !== null || forced !== undefined}
					className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full font-black text-white tracking-wider flex items-center justify-center transition-transform active:scale-95 disabled:cursor-default'
					style={{
						width: size * 0.26,
						height: size * 0.26,
						fontSize: Math.max(12, size * 0.05),
						background: landed !== null ? '#111827' : `radial-gradient(circle at 35% 30%, ${shade(accent, 50)}, ${accent})`,
						border: '4px solid #0a0e17',
						boxShadow: spinning ? 'none' : `0 0 24px ${accent}aa`,
						animation: !spinning && landed === null && !disabled ? 'vsHubPulse 1.4s ease-in-out infinite' : 'none',
					}}
				>
					{landed !== null ? <Icon name='check' size='1.6em' /> : spinning || forced !== undefined ? '' : spinLabel}
				</button>
			</div>
		</div>
	);
}
