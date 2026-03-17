'use client';

import { ScoreBreakdown } from '@/lib/types';

interface ScoreDisplayProps {
  score: ScoreBreakdown;
}

export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <div className="flex items-center gap-3 bg-black/40 rounded-xl px-4 py-2.5 border border-white/10">
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Talent</span>
        <span className="text-lg font-bold text-orange-400">{score.talent}</span>
      </div>

      <div className="w-px h-8 bg-white/20" />

      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Chem</span>
        <span className="text-lg font-bold text-green-400">{score.totalChem}</span>
      </div>

      <div className="w-px h-8 bg-white/20" />

      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Total</span>
        <span className="text-xl font-extrabold text-white">{score.total}</span>
      </div>
    </div>
  );
}
