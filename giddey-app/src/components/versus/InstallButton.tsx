'use client';

import { useEffect, useState } from 'react';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', e => {
		e.preventDefault();
		deferred = e as PromptEvent;
		listeners.forEach(fn => fn());
	});
	window.addEventListener('appinstalled', () => {
		deferred = null;
		listeners.forEach(fn => fn());
	});
}

/** Register the offline service worker once */
export function registerVersusSW(): void {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	navigator.serviceWorker.register('/versus-sw.js', { scope: '/versus' }).catch(() => {
		/* offline support is best-effort */
	});
}

const standalone = () =>
	typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/** "📲 Install app" — native prompt on Android/Chrome, step-by-step on iPhone */
export default function InstallButton({ className }: { className?: string }) {
	const [, force] = useState(0);
	const [installed, setInstalled] = useState(true);
	const [showIOS, setShowIOS] = useState(false);
	useEffect(() => {
		setInstalled(standalone());
		const fn = () => force(n => n + 1);
		listeners.add(fn);
		return () => {
			listeners.delete(fn);
		};
	}, []);
	if (installed) return null;
	if (!deferred && !isIOS()) return null;
	return (
		<>
			<button
				onClick={async () => {
					if (deferred) {
						await deferred.prompt();
						const choice = await deferred.userChoice.catch(() => null);
						if (choice?.outcome === 'accepted') setInstalled(true);
						deferred = null;
						force(n => n + 1);
					} else setShowIOS(true);
				}}
				className={className ?? 'text-xs font-black uppercase tracking-widest text-white/80 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-full px-4 py-2 border border-emerald-400/40'}
			>
				📲 Install app
			</button>
			{showIOS && (
				<div className='fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-end justify-center' onClick={() => setShowIOS(false)}>
					<div className='w-full max-w-md bg-[#0d1220] border border-white/10 rounded-t-3xl p-5 pb-10 animate-slide-up text-left normal-case tracking-normal' onClick={e => e.stopPropagation()}>
						<div className='text-lg font-black text-white mb-1'>📲 Put Versus on your home screen</div>
						<div className='text-xs text-white/50 mb-4'>It opens full-screen like an app and works without a connection.</div>
						<ol className='space-y-3 text-sm text-white/85'>
							<li>
								<span className='font-black text-white'>1.</span> Tap the <span className='font-black'>Share</span> button <span className='inline-block px-1.5 rounded bg-white/10'>⎋ ↑</span> in Safari&apos;s toolbar.
							</li>
							<li>
								<span className='font-black text-white'>2.</span> Scroll and tap <span className='font-black'>Add to Home Screen</span>.
							</li>
							<li>
								<span className='font-black text-white'>3.</span> Tap <span className='font-black'>Add</span>, then open Versus from your home screen.
							</li>
						</ol>
						<div className='text-[11px] text-white/45 mt-4 leading-snug'>
							Heads up: the home-screen app keeps its own data, separate from Safari. If you&apos;ve already played in Safari, use 📊 Rivalry → 🔄 Sync phones to copy your record over.
						</div>
						<button onClick={() => setShowIOS(false)} className='mt-5 w-full btn-primary rounded-2xl py-3 font-black uppercase tracking-wider text-white'>
							Got it
						</button>
					</div>
				</div>
			)}
		</>
	);
}
