'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { TIER_CONFIG, Tier, DRAFT_ODDS } from '@/lib/types';

const tiers: { tier: Tier; label: string; talent: number }[] = [
  { tier: 'dark-matter', label: 'Dark Matter', talent: 15 },
  { tier: 'pink-diamond', label: 'Pink Diamond', talent: 11 },
  { tier: 'diamond', label: 'Diamond', talent: 8 },
  { tier: 'amethyst', label: 'Amethyst', talent: 5 },
  { tier: 'ruby', label: 'Ruby', talent: 3 },
];

const tierColors: Record<string, string> = {
  'dark-matter': '#8b5cf6',
  'pink-diamond': '#ec4899',
  'diamond': '#06b6d4',
  'amethyst': '#a855f7',
  'ruby': '#ef4444',
};

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0e17 0%, #111827 100%)' }}>
      <Header />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          <div className="flex-1 text-center pb-2 border-b-2 border-orange-500">
            <span className="text-sm font-bold text-white">How To Play</span>
          </div>
        </div>

        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-wider mb-3">Welcome to Giddey</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Giddey is a daily basketball draft puzzle where your goal is to draft the highest graded team possible. Your draft grade is based on two scores: <strong className="text-white">Talent</strong> and <strong className="text-white">Chem</strong>.
          </p>

          {/* Draft Grade example */}
          <div className="bg-black/40 rounded-xl p-4 mt-4 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-wider text-white/80">Draft Grade</span>
              <div className="flex gap-3">
                <div className="text-center">
                  <div className="text-lg font-black text-orange-400">50</div>
                  <div className="text-[9px] text-white/40 uppercase">Talent</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-green-400">70</div>
                  <div className="text-[9px] text-white/40 uppercase">Chem</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-white">120</div>
                  <div className="text-[9px] text-white/40 uppercase">Total</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Talent */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-wider mb-3">Talent</h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            Player cards increase your team&apos;s talent grade. Draft one player card each round from three randomly generated options. Cards are ranked into <strong className="text-white">five tiers</strong> based on their value and rarity:
          </p>

          <div className="bg-black/40 rounded-xl p-4 border border-white/10">
            <div className="grid grid-cols-5 gap-2">
              {tiers.map(({ tier, label, talent }) => (
                <div key={tier} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: tierColors[tier] }}>
                    {tier === 'dark-matter' ? '✦ ' : ''}{label.split(' ').map(w => w[0]).join('')}
                  </span>
                  <span className="text-sm font-black" style={{ color: tierColors[tier] }}>
                    +{talent}
                  </span>
                  <div className={`w-10 h-12 rounded-lg tier-${tier}`} />
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/50 mt-3 leading-relaxed">
            ✦ Dark Matter cards are a rare version of Pink Diamond and Diamond cards. The top players in the NBA will have a Dark Matter card and a standard Pink Diamond or Diamond card.
          </p>
        </div>

        {/* Chemistry */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-green-500 uppercase tracking-wider mb-3">Chem</h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            Increase your team&apos;s chem grade by connecting players on the grid from the same <strong className="text-white">team</strong>, <strong className="text-white">division</strong>, or <strong className="text-white">draft year</strong>. There are three levels of chemistry between players:
          </p>

          <div className="bg-black/40 rounded-xl p-4 border border-white/10 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="w-5 h-1 rounded bg-green-500" />
                <span className="text-xs font-bold text-green-400">Green Line</span>
              </div>
              <div>
                <span className="text-xs font-bold text-green-400">(+2 Chem)</span>
                <p className="text-xs text-white/60 mt-0.5">Same team <strong className="text-white/80">OR</strong> same division + draft year</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="w-5 h-1 rounded bg-yellow-500" />
                <span className="text-xs font-bold text-yellow-400">Yellow Line</span>
              </div>
              <div>
                <span className="text-xs font-bold text-yellow-400">(+1 Chem)</span>
                <p className="text-xs text-white/60 mt-0.5">Same division <strong className="text-white/80">OR</strong> same draft year</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="w-5 h-1 rounded bg-red-500" />
                <span className="text-xs font-bold text-red-400">Red Line</span>
              </div>
              <div>
                <span className="text-xs font-bold text-red-400">(0 Chem)</span>
                <p className="text-xs text-white/60 mt-0.5">No matching traits</p>
              </div>
            </div>
          </div>

          {/* Dot bonuses */}
          <p className="text-sm text-white/70 leading-relaxed mt-4 mb-3">
            As a player creates connections, <strong className="text-white">the dot under their player card</strong> will change colors to represent additional boosts to your chem grade:
          </p>

          <div className="bg-black/40 rounded-xl p-4 border border-white/10 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                <span className="text-xs font-bold text-green-400">Green Dot</span>
              </div>
              <div>
                <span className="text-xs font-bold text-green-400">(+11 Chem)</span>
                <p className="text-xs text-white/60 mt-0.5">Bonus given to players with 4+ Chem</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                <span className="text-xs font-bold text-yellow-400">Yellow Dot</span>
              </div>
              <div>
                <span className="text-xs font-bold text-yellow-400">(+6 Chem)</span>
                <p className="text-xs text-white/60 mt-0.5">Bonus given to players with 2+ Chem</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                <span className="text-xs font-bold text-red-400">Red Dot</span>
              </div>
              <div>
                <span className="text-xs font-bold text-red-400">(0 Chem)</span>
                <p className="text-xs text-white/60 mt-0.5">No bonus</p>
              </div>
            </div>
          </div>

          {/* Full Court Bonus */}
          <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/20 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🏀</span>
              <span className="text-xs font-bold text-green-400">Full Court Bonus (+2 Chem)</span>
            </div>
            <p className="text-xs text-white/60">
              Awarded when ALL 9 players have at least a Yellow Dot. Max chemistry = 125.
            </p>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-wider mb-3">The Grid</h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            Your lineup is arranged in a 3×3 grid with specific basketball positions. The <strong className="text-white">Center (C)</strong> sits at the heart of the grid, connecting to 4 adjacent players — making it the most important piece of the puzzle.
          </p>

          <div className="bg-black/40 rounded-xl p-4 border border-white/10">
            <div className="grid grid-cols-3 gap-2 text-center">
              {['SG', 'PG', 'SF', 'UTIL', 'C', 'UTIL', 'SG', 'PF', 'SF'].map((pos, i) => (
                <div
                  key={i}
                  className={`py-3 rounded-lg text-xs font-bold ${
                    pos === 'C'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : pos === 'UTIL'
                      ? 'bg-green-500/10 text-green-400/70 border border-green-500/20'
                      : 'bg-white/5 text-white/50 border border-white/10'
                  }`}
                >
                  {pos}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Other Rules */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-wider mb-3">Other Rules</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <p className="text-sm text-white/70">
                Once you add a player to your team, you <strong className="text-white">cannot swap them</strong> for a different player card option from that round.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <p className="text-sm text-white/70">
                You will only be dealt player cards for <strong className="text-white">open positions</strong> on your grid (e.g. if your only open slot is C, you&apos;ll only be shown Center cards).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <p className="text-sm text-white/70">
                The <strong className="text-white">UTIL (Utility)</strong> spots are open to <strong className="text-white">PG, SG, SF, PF, C</strong> — any position.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <p className="text-sm text-white/70">
                You can <strong className="text-white">move player cards</strong> around the grid at any point during a draft. Try re-arranging your cards to maximize your chem grade.
              </p>
            </div>
          </div>
        </div>

        {/* Draft Odds */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-wider mb-3">Draft Odds</h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            Each player card is randomly generated using the probabilities below:
          </p>

          <div className="bg-black/40 rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-6 gap-0 p-2 border-b border-white/10">
              <div className="text-[10px] font-bold text-white/60 text-center">Round</div>
              {tiers.map(({ tier, label }) => (
                <div key={tier} className="text-[9px] font-bold text-center" style={{ color: tierColors[tier] }}>
                  {label.split(' ').map(w => w.substring(0, 3)).join(' ')}
                </div>
              ))}
            </div>

            {/* Rows */}
            {Array.from({ length: 9 }, (_, i) => i + 1).map((round) => (
              <div
                key={round}
                className={`grid grid-cols-6 gap-0 p-2 ${round % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
              >
                <div className="text-xs font-bold text-white/80 text-center">{round}</div>
                {tiers.map(({ tier }) => {
                  const pct = DRAFT_ODDS[round][tier];
                  return (
                    <div
                      key={tier}
                      className="text-[11px] font-bold text-center"
                      style={{ color: pct === 0 ? '#374151' : tierColors[tier] }}
                    >
                      {pct}%
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-8">
          <Link
            href="/draft"
            className="btn-primary inline-block text-white font-bold px-8 py-3 rounded-xl no-underline uppercase tracking-wider text-sm"
          >
            Start Draft
          </Link>
        </div>
      </main>
    </div>
  );
}
