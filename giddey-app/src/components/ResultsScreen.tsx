'use client';

import { GridSlot, ScoreBreakdown, TIER_CONFIG } from '@/lib/types';
import { calculateScore } from '@/lib/scoring';
import Header from './Header';
import Grid from './Grid';
import Link from 'next/link';

interface ResultsScreenProps {
  grid: GridSlot[];
  score: ScoreBreakdown;
  onPlayAgain: () => void;
}

function getGrade(total: number): { grade: string; color: string } {
  if (total >= 200) return { grade: 'S+', color: '#ff00ff' };
  if (total >= 180) return { grade: 'S', color: '#8b5cf6' };
  if (total >= 160) return { grade: 'A+', color: '#22c55e' };
  if (total >= 140) return { grade: 'A', color: '#22c55e' };
  if (total >= 120) return { grade: 'B+', color: '#eab308' };
  if (total >= 100) return { grade: 'B', color: '#eab308' };
  if (total >= 80) return { grade: 'C+', color: '#f97316' };
  if (total >= 60) return { grade: 'C', color: '#f97316' };
  return { grade: 'D', color: '#ef4444' };
}

export default function ResultsScreen({ grid, score, onPlayAgain }: ResultsScreenProps) {
  const { grade, color } = getGrade(score.total);

  // Count tiers
  const tierCounts: Record<string, number> = {};
  grid.forEach((slot) => {
    if (slot.card) {
      const tier = slot.card.tier;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
  });

  // Count chemistry connections
  const greenLines = score.lines.filter((l) => l.level === 'green').length;
  const yellowLines = score.lines.filter((l) => l.level === 'yellow').length;
  const greenDots = score.dots.filter((d) => d.level === 'green').length;
  const yellowDots = score.dots.filter((d) => d.level === 'yellow').length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0e17 0%, #0d1117 100%)' }}>
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-lg mx-auto w-full">
        {/* Draft Grade */}
        <div className="text-center mb-6 animate-slide-up">
          <h2 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-2">Draft Grade</h2>
          <div
            className="text-7xl font-black mb-2 animate-score-pop"
            style={{ color, textShadow: `0 0 40px ${color}40` }}
          >
            {grade}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="w-full bg-black/40 rounded-2xl border border-white/10 p-4 mb-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-2xl font-black text-orange-400">{score.talent}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Talent</div>
            </div>
            <div>
              <div className="text-2xl font-black text-green-400">{score.totalChem}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Chemistry</div>
            </div>
            <div className="col-span-2">
              <div className="text-3xl font-black text-white">{score.total}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Total Score</div>
            </div>
          </div>
        </div>

        {/* Chemistry details */}
        <div className="w-full bg-black/40 rounded-2xl border border-white/10 p-4 mb-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">Chemistry Breakdown</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 bg-green-500 rounded" />
                <span className="text-xs text-white/70">Green Lines ({greenLines})</span>
              </div>
              <span className="text-xs font-bold text-green-400">+{greenLines * 2}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 bg-yellow-500 rounded" />
                <span className="text-xs text-white/70">Yellow Lines ({yellowLines})</span>
              </div>
              <span className="text-xs font-bold text-yellow-400">+{yellowLines}</span>
            </div>

            <div className="w-full h-px bg-white/10 my-1" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-white/70">Green Dots ({greenDots})</span>
              </div>
              <span className="text-xs font-bold text-green-400">+{greenDots * 11}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-white/70">Yellow Dots ({yellowDots})</span>
              </div>
              <span className="text-xs font-bold text-yellow-400">+{yellowDots * 6}</span>
            </div>

            {score.hasFullCourt && (
              <>
                <div className="w-full h-px bg-white/10 my-1" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">🏀</span>
                    <span className="text-xs text-green-400 font-semibold">Full Court Bonus</span>
                  </div>
                  <span className="text-xs font-bold text-green-400">+2</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Final grid */}
        <div className="court-bg rounded-2xl p-4 mb-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <Grid
            grid={grid}
            lines={score.lines}
            dots={score.dots}
            onSlotClick={() => {}}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full max-w-xs animate-slide-up" style={{ animationDelay: '400ms' }}>
          <button
            onClick={onPlayAgain}
            className="btn-primary flex-1 text-white font-bold py-3 rounded-xl uppercase tracking-wider text-sm"
          >
            Draft Again
          </button>
          <Link
            href="/"
            className="flex-1 bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl text-center no-underline uppercase tracking-wider text-sm transition-colors"
          >
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
