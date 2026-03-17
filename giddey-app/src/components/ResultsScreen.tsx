'use client';

import { useState, useMemo } from 'react';
import { GridSlot, ScoreBreakdown } from '@/lib/types';
import { findOptimalLineup } from '@/lib/scoring';
import Grid from './Grid';
import Link from 'next/link';

interface ResultsScreenProps {
  grid: GridSlot[];
  score: ScoreBreakdown;
  onPlayAgain: () => void;
}

export default function ResultsScreen({ grid, score, onPlayAgain }: ResultsScreenProps) {
  const [activeTab, setActiveTab] = useState<'myteam' | 'solution'>('myteam');

  const optimal = useMemo(() => findOptimalLineup(grid), [grid]);
  const hasSolution = optimal.bestScore.total > score.total;
  const accuracy = optimal.bestScore.total > 0
    ? Math.round((score.total / optimal.bestScore.total) * 100)
    : 100;

  const displayGrid  = activeTab === 'solution' ? optimal.bestGrid  : grid;
  const displayScore = activeTab === 'solution' ? optimal.bestScore : score;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0e17' }}>

      {/* ── TABS ── */}
      <div className="flex gap-2 px-4 pt-4 pb-0 w-full max-w-xl mx-auto">
        <button
          onClick={() => setActiveTab('myteam')}
          className="flex-1 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition-all"
          style={{
            background: activeTab === 'myteam' ? '#22c55e' : 'rgba(255,255,255,0.08)',
            color: activeTab === 'myteam' ? '#fff' : 'rgba(255,255,255,0.4)',
          }}
        >
          My Team
        </button>
        {hasSolution && (
          <button
            onClick={() => setActiveTab('solution')}
            className="flex-1 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition-all"
            style={{
              background: activeTab === 'solution' ? '#22c55e' : 'rgba(255,255,255,0.08)',
              color: activeTab === 'solution' ? '#fff' : 'rgba(255,255,255,0.4)',
            }}
          >
            Solution ⓘ
          </button>
        )}
      </div>

      {/* ── ACCURACY + MAX SCORE ── */}
      <div className="flex items-center justify-between px-4 py-2 w-full max-w-xl mx-auto">
        <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Accuracy{' '}
          <span style={{ color: '#facc15' }}>{accuracy}% ⭐</span>
        </span>
        <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Max Score{' '}
          <span style={{ color: '#4ade80' }}>{optimal.bestScore.total} 🏆</span>
        </span>
      </div>

      {/* ── COURT ── */}
      <div className="w-full flex justify-center">
        <Grid
          grid={displayGrid}
          lines={displayScore.lines}
          dots={displayScore.dots}
          onSlotClick={() => {}}
          isComplete={true}
        />
      </div>

      {/* ── TALENT / CHEM / TOTAL ── */}
      <div className="flex gap-2 px-4 pt-3 pb-2 w-full max-w-xl mx-auto">
        {[
          { label: 'Talent', value: displayScore.talent,   color: '#fb923c' },
          { label: 'Chem',   value: displayScore.totalChem, color: '#4ade80' },
          { label: 'Total',  value: displayScore.total,    color: '#ffffff' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex-1 rounded-2xl text-center py-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <div className="font-black leading-none" style={{ fontSize: 32, color }}>{value}</div>
            <div className="uppercase tracking-wider font-bold mt-1" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── CHEMISTRY DETAIL ── */}
      <div className="px-4 pb-2 w-full max-w-xl mx-auto">
        <div
          className="rounded-2xl px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {[
            { label: `Green Lines (${displayScore.lines.filter(l => l.level === 'green').length})`,  value: `+${displayScore.lines.filter(l => l.level === 'green').length * 3}`,   color: '#4ade80' },
            { label: `Yellow Lines (${displayScore.lines.filter(l => l.level === 'yellow').length})`, value: `+${displayScore.lines.filter(l => l.level === 'yellow').length}`, color: '#facc15' },
            { label: `Green Dots (${displayScore.dots.filter(d => d.level === 'green').length})`,    value: `+${displayScore.dots.filter(d => d.level === 'green').length * 11}`,  color: '#4ade80' },
            { label: `Yellow Dots (${displayScore.dots.filter(d => d.level === 'yellow').length})`,  value: `+${displayScore.dots.filter(d => d.level === 'yellow').length * 6}`,  color: '#facc15' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BUTTONS ── */}
      <div className="flex gap-2 px-4 pb-8 pt-1 w-full max-w-xl mx-auto mt-auto">
        <Link
          href="/"
          className="flex-1 py-3 rounded-2xl text-center no-underline font-black text-sm uppercase tracking-wide transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          Back
        </Link>
        <button
          onClick={onPlayAgain}
          className="flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-wide text-white"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
        >
          Draft Again
        </button>
      </div>
    </div>
  );
}
