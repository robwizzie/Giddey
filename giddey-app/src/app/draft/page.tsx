'use client';

import { useState, useCallback, useEffect } from 'react';
import { PlayerCard as PlayerCardType, GridSlot, ScoreBreakdown, DRAFT_ODDS, TIER_CONFIG } from '@/lib/types';
import { createInitialGrid, generateOptions, placeCard, swapCards, getValidSlotsForCard } from '@/lib/draft';
import { calculateScore } from '@/lib/scoring';
import Header from '@/components/Header';
import Grid from '@/components/Grid';
import DraftOptions from '@/components/DraftOptions';
import ScoreDisplay from '@/components/ScoreDisplay';
import ResultsScreen from '@/components/ResultsScreen';

// --- Odds Modal ---
function OddsModal({ onClose }: { onClose: () => void }) {
  const tiers = ['dark-matter', 'pink-diamond', 'diamond', 'amethyst', 'ruby'] as const;
  const tierLabels: Record<string, string> = {
    'dark-matter': 'DM',
    'pink-diamond': 'PD',
    'diamond': 'DIA',
    'amethyst': 'AME',
    'ruby': 'RBY',
  };
  const tierColors: Record<string, string> = {
    'dark-matter': '#a78bfa',
    'pink-diamond': '#f472b6',
    'diamond': '#22d3ee',
    'amethyst': '#a78bfa',
    'ruby': '#f87171',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-2xl border border-white/10 p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Draft Odds</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">&times;</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 text-left text-white/50 font-semibold">RND</th>
                {tiers.map((t) => (
                  <th key={t} className="py-2 text-center font-bold" style={{ color: tierColors[t] }}>
                    {tierLabels[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((round) => (
                <tr key={round} className="border-b border-white/5">
                  <td className="py-1.5 text-white/70 font-semibold">{round}</td>
                  {tiers.map((t) => (
                    <td key={t} className="py-1.5 text-center text-white/60">
                      {DRAFT_ODDS[round][t]}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Achievements Modal ---
function AchievementsModal({ onClose }: { onClose: () => void }) {
  const achievements = [
    { name: 'Green Machine', desc: 'Get 10+ green chemistry lines', icon: '🟢' },
    { name: 'All-Star Lineup', desc: 'Draft 3+ Dark Matter cards', icon: '⭐' },
    { name: 'Division Rivals', desc: 'Have 4+ players from the same division', icon: '🏆' },
    { name: 'Draft Class', desc: 'Have 3+ players from the same draft year', icon: '📋' },
    { name: 'Full Chemistry', desc: 'Achieve 100+ chemistry score', icon: '🔥' },
    { name: 'Perfect Dots', desc: 'All 9 players have green chemistry dots', icon: '💎' },
    { name: 'Hometown Heroes', desc: 'Have 3+ players from the same team', icon: '🏠' },
    { name: 'Rising Stars', desc: 'Draft 5+ Ruby or Amethyst cards and score 80+', icon: '🌟' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-2xl border border-white/10 p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Achievements</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">&times;</button>
        </div>

        <div className="space-y-3">
          {achievements.map((a) => (
            <div key={a.name} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <span className="text-xl">{a.icon}</span>
              <div>
                <div className="text-xs font-bold text-white">{a.name}</div>
                <div className="text-[10px] text-white/50">{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DraftPage() {
  const [grid, setGrid] = useState<GridSlot[]>(createInitialGrid());
  const [round, setRound] = useState(1);
  const [options, setOptions] = useState<PlayerCardType[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState<ScoreBreakdown>(calculateScore(createInitialGrid()));
  const [draftComplete, setDraftComplete] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [validSlots, setValidSlots] = useState<number[]>([]);
  const [swapMode, setSwapMode] = useState<number | null>(null);
  const [cardPlacedThisRound, setCardPlacedThisRound] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  // Generate initial options
  useEffect(() => {
    const opts = generateOptions(1, grid, usedPlayerIds);
    setOptions(opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update score whenever grid changes
  useEffect(() => {
    setScore(calculateScore(grid));
  }, [grid]);

  const handleSelectOption = useCallback((index: number) => {
    if (cardPlacedThisRound) return; // Already placed a card this round
    setSelectedOptionIndex(index);
    const card = options[index];
    if (card) {
      const slots = getValidSlotsForCard(grid, card);
      setValidSlots(slots);
      // Auto-place if only one valid slot
      if (slots.length === 1) {
        handlePlaceCard(slots[0], card);
      }
    }
    setSwapMode(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, grid, cardPlacedThisRound]);

  const handlePlaceCard = useCallback((slotIndex: number, card?: PlayerCardType) => {
    const cardToPlace = card || (selectedOptionIndex !== null ? options[selectedOptionIndex] : null);
    if (!cardToPlace) return;

    const newGrid = placeCard(grid, slotIndex, cardToPlace);
    setGrid(newGrid);

    const newUsed = new Set(usedPlayerIds);
    newUsed.add(cardToPlace.id);
    setUsedPlayerIds(newUsed);

    setSelectedOptionIndex(null);
    setValidSlots([]);
    setCardPlacedThisRound(true);

    // Check if this is the last round
    if (round >= 9) {
      setDraftComplete(true);
      setOptions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, selectedOptionIndex, options, round, usedPlayerIds]);

  const handleNextRound = useCallback(() => {
    if (!cardPlacedThisRound) return;
    const nextRound = round + 1;
    if (nextRound > 9) {
      setDraftComplete(true);
      setOptions([]);
      return;
    }
    setRound(nextRound);
    setCardPlacedThisRound(false);
    const newOpts = generateOptions(nextRound, grid, usedPlayerIds);
    setOptions(newOpts);
  }, [cardPlacedThisRound, round, grid, usedPlayerIds]);

  const handleSlotClick = useCallback((index: number) => {
    // In swap mode — swap two cards
    if (swapMode !== null) {
      if (swapMode !== index) {
        const result = swapCards(grid, swapMode, index);
        if (result) {
          setGrid(result);
        }
      }
      setSwapMode(null);
      return;
    }

    // Placing a drafted card
    if (selectedOptionIndex !== null && validSlots.includes(index)) {
      handlePlaceCard(index);
    }
  }, [swapMode, selectedOptionIndex, validSlots, grid, handlePlaceCard]);

  const handleCardClick = useCallback((index: number) => {
    if (selectedOptionIndex !== null) return;

    if (swapMode === index) {
      setSwapMode(null);
    } else if (swapMode !== null) {
      const result = swapCards(grid, swapMode, index);
      if (result) {
        setGrid(result);
      }
      setSwapMode(null);
    } else {
      setSwapMode(index);
    }
  }, [selectedOptionIndex, swapMode, grid]);

  // Handle drag-and-drop from options to grid
  const handleDropOnSlot = useCallback((slotIndex: number) => {
    if (selectedOptionIndex !== null && validSlots.includes(slotIndex)) {
      handlePlaceCard(slotIndex);
    }
  }, [selectedOptionIndex, validSlots, handlePlaceCard]);

  // Handle drag-and-drop swap between grid cards
  const handleDragSwap = useCallback((fromIndex: number, toIndex: number) => {
    const result = swapCards(grid, fromIndex, toIndex);
    if (result) {
      setGrid(result);
    }
  }, [grid]);

  const handleDragStartOption = useCallback((index: number) => {
    if (cardPlacedThisRound) return;
    setSelectedOptionIndex(index);
    const card = options[index];
    if (card) {
      const slots = getValidSlotsForCard(grid, card);
      setValidSlots(slots);
    }
    setSwapMode(null);
  }, [options, grid, cardPlacedThisRound]);

  const handleSubmit = useCallback(() => {
    setShowResults(true);
  }, []);

  const handlePlayAgain = useCallback(() => {
    const newGrid = createInitialGrid();
    setGrid(newGrid);
    setRound(1);
    setUsedPlayerIds(new Set());
    setSelectedOptionIndex(null);
    setValidSlots([]);
    setSwapMode(null);
    setDraftComplete(false);
    setShowResults(false);
    setCardPlacedThisRound(false);
    const opts = generateOptions(1, newGrid, new Set());
    setOptions(opts);
  }, []);

  if (showResults) {
    return <ResultsScreen grid={grid} score={score} onPlayAgain={handlePlayAgain} />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0e17 0%, #0d1117 100%)' }}>
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-3 w-full">
        {/* Score display */}
        <div className="mb-3 animate-fade-in">
          <ScoreDisplay score={score} />
        </div>

        {/* Round info + Achvs/Odds buttons */}
        <div className="flex items-center gap-3 mb-3 w-full max-w-md justify-center">
          <button
            onClick={() => setShowAchievements(true)}
            className="text-[10px] font-bold text-white/50 hover:text-white/80 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            Achvs.
          </button>

          {/* Round progress */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < (draftComplete ? 9 : round - (cardPlacedThisRound ? 0 : 1))
                    ? 'w-6 bg-orange-500'
                    : i === round - 1 && !draftComplete && !cardPlacedThisRound
                    ? 'w-6 bg-orange-500/40'
                    : 'w-4 bg-white/10'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setShowOdds(true)}
            className="text-[10px] font-bold text-white/50 hover:text-white/80 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            Odds
          </button>
        </div>

        {/* Swap mode banner */}
        {swapMode !== null && (
          <div className="mb-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-[11px] text-yellow-300 font-semibold">
              Tap or drag to another card to swap
            </span>
            <button
              className="text-[10px] text-white/40 hover:text-white/70 ml-auto font-semibold uppercase"
              onClick={() => setSwapMode(null)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="mb-3 flex justify-center">
          <Grid
            grid={grid}
            lines={score.lines}
            dots={score.dots}
            validSlots={validSlots}
            onSlotClick={handleSlotClick}
            onCardClick={handleCardClick}
            swapSource={swapMode}
            isComplete={draftComplete}
            onDropOnSlot={handleDropOnSlot}
            onDragSwap={handleDragSwap}
          />
        </div>

        {/* Draft Options + Next Round (during drafting) */}
        {!draftComplete && options.length > 0 && (
          <div className="w-full max-w-md animate-slide-up" key={`round-${round}`}>
            {!cardPlacedThisRound ? (
              <>
                <div className="text-center mb-3">
                  <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">
                    Round {round} of 9 &mdash; Select a player
                  </span>
                </div>
                <DraftOptions
                  options={options}
                  selectedIndex={selectedOptionIndex}
                  onSelect={handleSelectOption}
                  round={round}
                  onDragStart={handleDragStartOption}
                />
              </>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-xs text-white/40">
                  Card placed! Drag or tap cards to rearrange, then continue.
                </p>
                <button
                  onClick={handleNextRound}
                  className="btn-primary text-white text-sm font-bold px-8 py-3 rounded-xl uppercase tracking-wider"
                >
                  {round >= 9 ? 'Finish Draft' : 'Next Round'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Post-draft: Rearrange + Submit */}
        {draftComplete && (
          <div className="w-full text-center animate-slide-up space-y-3 max-w-md">
            <div>
              <p className="text-sm font-bold text-white/80">Draft Complete!</p>
              <p className="text-xs text-white/40 mt-0.5">
                Drag or tap cards to swap positions and maximize chemistry.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              className="btn-green text-white text-sm font-bold px-8 py-3 rounded-xl uppercase tracking-wider w-full max-w-[240px]"
            >
              Submit Lineup
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {showOdds && <OddsModal onClose={() => setShowOdds(false)} />}
      {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}
    </div>
  );
}
