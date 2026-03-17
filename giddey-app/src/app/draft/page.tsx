'use client';

import { useState, useCallback, useEffect } from 'react';
import { PlayerCard as PlayerCardType, GridSlot, ScoreBreakdown, TIER_CONFIG } from '@/lib/types';
import { createInitialGrid, generateOptions, placeCard, swapCards, getValidSlotsForCard } from '@/lib/draft';
import { calculateScore } from '@/lib/scoring';
import Header from '@/components/Header';
import Grid from '@/components/Grid';
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
  const [draftComplete, setDraftComplete] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [validSlots, setValidSlots] = useState<number[]>([]);
  const [swapMode, setSwapMode] = useState<number | null>(null);

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
      // Draft is complete — but do NOT auto-submit!
      // User can still rearrange cards before submitting
      setDraftComplete(true);
      setOptions([]);
    } else {
      setRound(nextRound);
      const newOpts = generateOptions(nextRound, newGrid, newUsed);
      setOptions(newOpts);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, selectedOptionIndex, options, round, usedPlayerIds]);

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
    if (selectedOptionIndex !== null) return; // Selecting an option card — ignore grid card clicks

    if (swapMode === index) {
      // Deselect
      setSwapMode(null);
    } else if (swapMode !== null) {
      // Attempt swap
      const result = swapCards(grid, swapMode, index);
      if (result) {
        setGrid(result);
      }
      setSwapMode(null);
    } else {
      // Enter swap mode
      setSwapMode(index);
    }
  }, [selectedOptionIndex, swapMode, grid]);

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
    const opts = generateOptions(1, newGrid, new Set());
    setOptions(opts);
  }, []);

  if (showResults) {
    return <ResultsScreen grid={grid} score={score} onPlayAgain={handlePlayAgain} />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0a0e17 0%, #0d1117 100%)' }}>
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-3 max-w-md mx-auto w-full">
        {/* Score display */}
        <div className="mb-3 animate-fade-in">
          <ScoreDisplay score={score} />
        </div>

        {/* Round progress bar */}
        <div className="flex items-center gap-1.5 mb-2">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < (draftComplete ? 9 : round - 1)
                  ? 'w-7 bg-orange-500'
                  : i === round - 1 && !draftComplete
                  ? 'w-7 bg-orange-500/40'
                  : 'w-5 bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Swap mode banner */}
        {swapMode !== null && (
          <div className="mb-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-[11px] text-yellow-300 font-semibold">
              Tap another card to swap
            </span>
            <button
              className="text-[10px] text-white/40 hover:text-white/70 ml-auto font-semibold uppercase"
              onClick={() => setSwapMode(null)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Grid on basketball court */}
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
          />
        </div>

        {/* Draft Options (during drafting) */}
        {!draftComplete && options.length > 0 && (
          <div className="w-full animate-slide-up" key={`round-${round}`}>
            <DraftOptions
              options={options}
              selectedIndex={selectedOptionIndex}
              onSelect={handleSelectOption}
              round={round}
            />
          </div>
        )}

        {/* Post-draft: Rearrange + Submit */}
        {draftComplete && (
          <div className="w-full text-center animate-slide-up space-y-3">
            <div>
              <p className="text-sm font-bold text-white/80">Draft Complete!</p>
              <p className="text-xs text-white/40 mt-0.5">
                Tap cards to swap positions and maximize your chemistry before submitting.
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
    </div>
  );
}
