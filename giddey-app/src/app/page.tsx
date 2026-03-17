'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import { TIER_CONFIG, Tier, DRAFT_ODDS } from '@/lib/types';

const tiers: { tier: Tier; label: string }[] = [
  { tier: 'dark-matter', label: 'Dark Matter' },
  { tier: 'pink-diamond', label: 'Pink Diamond' },
  { tier: 'diamond', label: 'Diamond' },
  { tier: 'amethyst', label: 'Amethyst' },
  { tier: 'ruby', label: 'Ruby' },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0e17 0%, #111827 100%)' }}>
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in">
          {/* Logo */}
          <img
            src="/logo.svg"
            alt="Giddey"
            className="w-24 h-24 mx-auto mb-4 rounded-2xl"
            style={{ boxShadow: '0 0 40px rgba(249, 115, 22, 0.4)' }}
          />

          <h1 className="text-4xl font-black tracking-tight mb-2">
            <span className="text-orange-500">GIDDEY</span>
          </h1>
          <p className="text-lg text-white/60 font-medium">Basketball Draft Puzzle</p>
          <p className="text-sm text-white/40 mt-2 max-w-xs mx-auto">
            Draft 9 players. Build chemistry. Score big.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/draft"
          className="btn-primary text-white text-lg font-bold px-10 py-4 rounded-xl no-underline mb-8 uppercase tracking-wider"
        >
          Start Draft
        </Link>

        {/* Quick info cards */}
        <div className="grid grid-cols-3 gap-3 max-w-sm w-full mb-8">
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
            <div className="text-2xl font-black text-orange-400">9</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Rounds</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
            <div className="text-2xl font-black text-green-400">125</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Max Chem</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
            <div className="text-2xl font-black text-purple-400">5</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Card Tiers</div>
          </div>
        </div>

        {/* Tier preview */}
        <div className="w-full max-w-sm">
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold text-center mb-3">Card Tiers</h3>
          <div className="flex justify-center gap-2">
            {tiers.map(({ tier, label }) => {
              const config = TIER_CONFIG[tier];
              return (
                <div
                  key={tier}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`w-10 h-10 rounded-lg tier-${tier.replace('-', '-')} flex items-center justify-center`}
                  >
                    <span className="text-xs font-bold text-white">+{config.talent}</span>
                  </div>
                  <span className="text-[8px] text-white/50 font-semibold text-center leading-tight" style={{ maxWidth: 60 }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/how-to-play"
            className="text-sm text-white/40 hover:text-white/70 transition-colors no-underline"
          >
            How to Play →
          </Link>
        </div>
      </main>
    </div>
  );
}
