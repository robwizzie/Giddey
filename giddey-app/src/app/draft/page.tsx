'use client';

import { useState, useCallback, useEffect } from 'react';
import { PlayerCard as PlayerCardType, GridSlot, ScoreBreakdown, TIER_CONFIG } from '@/lib/types';
import { createInitialGrid, generateOptions, placeCard, swapCards, getValidSlotsForCard } from '@/lib/draft';
import { calculateScore } from '@/lib/scoring';
import Header from '@/components/Header';
import Grid from '@/components/Grid';
import PlayerCard from '@/components/PlayerCard';
import DraftOptions from '@/components/DraftOptions';
import ScoreDisplay from '@/components/ScoreDisplay';
import ResultsScreen from '@/components/ResultsScreen';

export default function DraftPage() {
  const [grid, setGrid] = useState<GridSlot[]>(createInitialGrid());
  const [round, setRound] = useState(1);
  const [options, setOptions] = useState<PlayerCardType[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState<ScoreBreakdown>(calculateScore(createInitialGrid()));
  const [isComplete, setIsComplete] = useState(false);
  const [validSlots, setValidSlots] = useState<number[]>([]);
  const [swapMode, setSwapMode] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);

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
  }, [options, grid]);

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

    const nextRound = round + 1;
    if (nextRound > 9) {
      setIsComplete(true);
      setOptions([]);
      // Small delay before showing results
      setTimeout(() => setShowResults(true), 800);
    } else {
      setRound(nextRound);
      const newOpts = generateOptions(nextRound, newGrid, newUsed);
      setOptions(newOpts);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, selectedOptionIndex, options, round, usedPlayerIds]);

  const handleSlotClick = useCallback((index: number) => {
    if (swapMode !== null) {
      // Try to swap
      if (swapMode !== index) {
        const result = swapCards(grid, swapMode, index);
        if (result) {
          setGrid(result);
        }
      }
      setSwapMode(null);
      return;
    }

    if (selectedOptionIndex !== null && validSlots.includes(index)) {
      handlePlaceCard(index);
    }
  }, [swapMode, selectedOptionIndex, validSlots, grid, handlePlaceCard]);

  const handleCardClick = useCallback((index: number) => {
    if (selectedOptionIndex !== null) {
      // If selecting an option, ignore card clicks
      return;
    }
    // Enter swap mode
    if (swapMode === index) {
      setSwapMode(null);
    } else if (swapMode !== null) {
      // Try to swap
      const result = swapCards(grid, swapMode, index);
      if (result) {
        setGrid(result);
      }
      setSwapMode(null);
    } else {
      setSwapMode(index);
    }
  }, [selectedOptionIndex, swapMode, grid]);

  const handlePlayAgain = useCallback(() => {
    const newGrid = createInitialGrid();
    setGrid(newGrid);
    setRound(1);
    setUsedPlayerIds(new Set());
    setSelectedOptionIndex(null);
    setValidSlots([]);
    setSwapMode(null);
    setIsComplete(false);
    setShowResults(false);
    const opts = generateOptions(1, newGrid, new Set());
    setOptions(opts);
  }, []);

  if (showResults) {
    return <ResultsScreen grid={grid} score={score} onPlayAgain={handlePlayAgain} />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0e17 0%, #0d1117 100%)' }}>
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-4 max-w-lg mx-auto w-full">
        {/* Score */}
        <div className="mb-4 animate-fade-in">
          <ScoreDisplay score={score} />
        </div>

        {/* Round indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className={`w-6 h-1.5 rounded-full transition-all ${
                i < round - 1
                  ? 'bg-orange-500'
                  : i === round - 1 && !isComplete
                  ? 'bg-orange-500/50'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Swap mode indicator */}
        {swapMode !== null && (
          <div className="mb-2 text-xs text-yellow-400 font-semibold animate-fade-in">
            Tap another card to swap positions
            <button
              className="ml-2 text-white/40 hover:text-white/70"
              onClick={() => setSwapMode(null)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="court-bg rounded-2xl p-4 mb-4">
          <Grid
            grid={grid}
            lines={score.lines}
            dots={score.dots}
            validSlots={validSlots}
            onSlotClick={handleSlotClick}
            onCardClick={handleCardClick}
            dragSource={swapMode}
          />
        </div>

        {/* Draft Options */}
        {!isComplete && (
          <div className="w-full animate-slide-up">
            <DraftOptions
              options={options}
              selectedIndex={selectedOptionIndex}
              onSelect={handleSelectOption}
              round={round}
            />
          </div>
        )}

        {/* Completion message */}
        {isComplete && !showResults && (
          <div className="text-center animate-fade-in">
            <p className="text-lg font-bold text-green-400">Draft Complete!</p>
            <p className="text-sm text-white/50">Calculating results...</p>
          </div>
        )}
      </main>
    </div>
  );
}
