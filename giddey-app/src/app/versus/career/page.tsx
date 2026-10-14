'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CareerData } from '@/lib/versus/career';
import { cloudEnabled, fetchCareer } from '@/lib/versus/cloud';
import CareerCard from '@/components/versus/CareerCard';
import Icon from '@/components/versus/Icon';

/** Public career page: /versus/career#<slug> */
export default function CareerPage() {
	const [state, setState] = useState<{ status: 'loading' | 'missing' | 'off' | 'ok'; c?: CareerData; updated?: string }>({ status: 'loading' });
	useEffect(() => {
		const slug = location.hash.slice(1);
		if (!cloudEnabled) return setState({ status: 'off' });
		if (!slug) return setState({ status: 'missing' });
		fetchCareer(slug)
			.then(r => setState(r ? { status: 'ok', c: r.data as CareerData, updated: r.updated } : { status: 'missing' }))
			.catch(() => setState({ status: 'missing' }));
	}, []);
	return (
		<div className='min-h-screen vs-bg px-4 py-8'>
			<div className='max-w-lg mx-auto'>
				{state.status === 'loading' && <div className='text-center text-white/50 py-20'>Loading…</div>}
				{(state.status === 'missing' || state.status === 'off') && (
					<div className='text-center text-white/60 py-20'>
						<Icon name='ball' size={48} className='mx-auto mb-3 text-orange-300/70' />
						{state.status === 'off' ? 'Career pages aren’t set up on this site.' : 'This career page doesn’t exist (or was unpublished).'}
					</div>
				)}
				{state.status === 'ok' && state.c && (
					<>
						<CareerCard c={state.c} />
						<div className='text-center text-[11px] text-white/35 mt-4'>Updated {new Date(state.updated ?? state.c.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
					</>
				)}
				<div className='text-center mt-8'>
					<Link href='/versus' className='btn-primary inline-block rounded-2xl px-6 py-3 font-black uppercase tracking-wider text-white no-underline'>
						Start your own rivalry →
					</Link>
				</div>
			</div>
		</div>
	);
}
