'use client';

import { useState, useCallback, useEffect } from 'react';
import { Player, PlayerCard as PlayerCardType, GridSlot, ScoreBreakdown, DRAFT_ODDS } from '@/lib/types';
import { createInitialGrid, generateOptions, placeCard, swapCards, getValidSlotsForCard, getValidSwapTargets } from '@/lib/draft';
import { calculateScore } from '@/lib/scoring';
import { loadPlayers } from '@/lib/player-loader';
import { EXAMPLE_CARDS, TIER_DISPLAY } from '@/lib/example-cards';
import Header from '@/components/Header';
import Grid from '@/components/Grid';
import PlayerCard from '@/components/PlayerCard';
import MiniGridDiagram from '@/components/MiniGridDiagram';
import DraftOptions from '@/components/DraftOptions';
import ResultsScreen from '@/components/ResultsScreen';

// --- How To Play Modal ---
const tierColors: Record<string, string> = {
  'dark-matter': '#8b5cf6', 'galaxy-opal': '#f0abfc', 'pink-diamond': '#ec4899',
  'diamond': '#06b6d4', 'amethyst': '#a855f7', 'ruby': '#ef4444',
  'sapphire': '#3b82f6', 'emerald': '#22c55e', 'gold': '#eab308',
};

function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-2xl border border-white/10 p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">How To Play</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">&times;</button>
        </div>

        {/* Welcome */}
        <div className="mb-6">
          <h3 className="text-base font-black text-orange-500 uppercase tracking-wider mb-2">Welcome to Giddey</h3>
          <p className="text-xs text-white/70 leading-relaxed">
            Draft the highest graded team possible. Your draft grade is based on two scores: <strong className="text-white">Talent</strong> and <strong className="text-white">Chem</strong>.
          </p>
        </div>

        {/* Talent */}
        <div className="mb-6">
          <h3 className="text-base font-black text-orange-500 uppercase tracking-wider mb-2">Talent</h3>
          <p className="text-xs text-white/70 leading-relaxed mb-3">
            Each card&apos;s tier earns fixed talent points:
          </p>
          <div className="bg-black/40 rounded-xl p-3 border border-white/10 overflow-x-auto">
            <div className="flex gap-2.5 min-w-max pb-1">
              {EXAMPLE_CARDS.map(({ card, talent }) => {
                const display = TIER_DISPLAY.find(t => t.tier === card.tier);
                return (
                  <div key={card.tier} className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-bold leading-tight text-center" style={{ color: display?.color }}>
                      {display?.label}
                    </span>
                    <PlayerCard card={card} size="option" cardSize={{ w: 56, h: 78 }} />
                    <span className="text-[9px] font-black text-orange-400">+{talent}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chemistry */}
        <div className="mb-6">
          <h3 className="text-base font-black text-green-500 uppercase tracking-wider mb-2">Chemistry</h3>
          <p className="text-xs text-white/70 leading-relaxed mb-3">
            Connect players from the same <strong className="text-white">team</strong>, <strong className="text-white">division</strong>, or <strong className="text-white">draft year</strong> to earn chem:
          </p>
          <div className="bg-black/40 rounded-xl p-3 border border-white/10 space-y-2 mb-3">
            {[
              { color: 'bg-green-500', label: 'Green Line', desc: 'Same team OR division + year' },
              { color: 'bg-yellow-500', label: 'Yellow Line', desc: 'Same division OR draft year' },
              { color: 'bg-red-500', label: 'Red Line', desc: 'No matching traits' },
            ].map(({ color, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-5 h-1.5 rounded ${color} shrink-0`} />
                <span className="text-xs font-bold text-white/80 w-24 shrink-0">{label}</span>
                <span className="text-xs text-white/50">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/70 leading-relaxed mb-3">
            The dot under each card earns bonus chem based on total connections:
          </p>
          <div className="bg-black/40 rounded-xl p-3 border border-white/10 space-y-2">
            {[
              { color: 'bg-green-500', label: 'Green Dot', desc: '+11 Chem — 4+ line chem' },
              { color: 'bg-yellow-500', label: 'Yellow Dot', desc: '+6 Chem — 2+ line chem' },
              { color: 'bg-red-500', label: 'Red Dot', desc: 'No bonus' },
            ].map(({ color, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${color} shrink-0`} />
                <span className="text-xs font-bold text-white/80 w-24 shrink-0">{label}</span>
                <span className="text-xs text-white/50">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="mb-6">
          <h3 className="text-base font-black text-orange-500 uppercase tracking-wider mb-2">The Grid</h3>
          <p className="text-xs text-white/70 leading-relaxed mb-3">
            9 positions, 15 connections. The <strong className="text-white">Center (C)</strong> connects to 4 players — the most important spot.
          </p>
          <MiniGridDiagram />
        </div>

        {/* Rules */}
        <div className="mb-6">
          <h3 className="text-base font-black text-orange-500 uppercase tracking-wider mb-2">Rules</h3>
          <div className="space-y-2">
            {[
              'Once a player is placed, you cannot swap them for a different card option that round.',
              'Drag cards on the grid to rearrange positions at any time.',
              'Players can be placed at their primary or secondary position (shown on card).',
              'UTIL spots accept any position.',
            ].map((rule) => (
              <div key={rule} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1 shrink-0" />
                <p className="text-xs text-white/70">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Draft Odds */}
        <div className="mb-2">
          <h3 className="text-base font-black text-orange-500 uppercase tracking-wider mb-2">Draft Odds</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-1.5 text-left text-white/50 font-semibold">Rnd</th>
                  {(['dark-matter','galaxy-opal','pink-diamond','diamond','amethyst','ruby','sapphire','emerald','gold'] as const).map((t) => (
                    <th key={t} className="py-1.5 text-center font-bold px-0.5" style={{ color: tierColors[t] }}>
                      {t === 'dark-matter' ? 'DM' : t === 'galaxy-opal' ? 'GO' : t === 'pink-diamond' ? 'PD' : t.substring(0,3).toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((round) => (
                  <tr key={round} className="border-b border-white/5">
                    <td className="py-1 text-white/70 font-semibold">{round}</td>
                    {(['dark-matter','galaxy-opal','pink-diamond','diamond','amethyst','ruby','sapphire','emerald','gold'] as const).map((t) => (
                      <td key={t} className="py-1 text-center px-0.5" style={{ color: DRAFT_ODDS[round][t] === 0 ? '#374151' : tierColors[t] }}>
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
    </div>
  );
}

// --- Odds Modal ---
function OddsModal({ onClose }: { onClose: () => void }) {
  const tiers = ['dark-matter', 'galaxy-opal', 'pink-diamond', 'diamond', 'amethyst', 'ruby', 'sapphire', 'emerald', 'gold'] as const;
  const tierLabels: Record<string, string> = {
    'dark-matter': 'DM', 'galaxy-opal': 'GO', 'pink-diamond': 'PD',
    'diamond': 'DIA', 'amethyst': 'AME', 'ruby': 'RBY',
    'sapphire': 'SAP', 'emerald': 'EME', 'gold': 'GLD',
  };
  const tierColors: Record<string, string> = {
    'dark-matter': '#a78bfa', 'galaxy-opal': '#f0abfc', 'pink-diamond': '#f472b6',
    'diamond': '#22d3ee', 'amethyst': '#a78bfa', 'ruby': '#f87171',
    'sapphire': '#60a5fa', 'emerald': '#4ade80', 'gold': '#facc15',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-2xl border border-white/10 p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Draft Odds</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">&times;</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 text-left text-white/50 font-semibold">RND</th>
                {tiers.map((t) => (
                  <th key={t} className="py-2 text-center font-bold px-0.5" style={{ color: tierColors[t] }}>
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
                    <td key={t} className="py-1.5 text-center text-white/60 px-0.5">
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
  const [placedOptionIndex, setPlacedOptionIndex] = useState<number | null>(null);
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState<ScoreBreakdown>(calculateScore(createInitialGrid()));
  const [draftComplete, setDraftComplete] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [validSlots, setValidSlots] = useState<number[]>([]);
  const [swapMode, setSwapMode] = useState<number | null>(null);
  const [cardPlacedThisRound, setCardPlacedThisRound] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [playerPool, setPlayerPool] = useState<Player[]>([]);

  // Load players dynamically on mount, then generate first round options
  useEffect(() => {
    loadPlayers().then((players) => {
      setPlayerPool(players);
      const opts = generateOptions(1, createInitialGrid(), new Set(), players);
      setOptions(opts);
    });
  }, []);

  useEffect(() => {
    setScore(calculateScore(grid));
  }, [grid]);

  const handleSelectOption = useCallback((index: number) => {
    if (cardPlacedThisRound) return;
    // Toggle: clicking the already-selected card deselects it
    if (selectedOptionIndex === index) {
      setSelectedOptionIndex(null);
      setValidSlots([]);
      return;
    }
    setSelectedOptionIndex(index);
    const card = options[index];
    if (card) {
      const slots = getValidSlotsForCard(grid, card);
      setValidSlots(slots);
    }
    setSwapMode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, grid, cardPlacedThisRound, selectedOptionIndex]);

  const handlePlaceCard = useCallback((slotIndex: number, card?: PlayerCardType) => {
    const cardToPlace = card || (selectedOptionIndex !== null ? options[selectedOptionIndex] : null);
    if (!cardToPlace) return;

    // Determine which option index was placed
    const optIdx = card
      ? options.findIndex((o) => o.id === cardToPlace.id)
      : selectedOptionIndex;

    const newGrid = placeCard(grid, slotIndex, cardToPlace);
    setGrid(newGrid);

    const newUsed = new Set(usedPlayerIds);
    newUsed.add(cardToPlace.id);
    setUsedPlayerIds(newUsed);

    if (optIdx !== null && optIdx !== -1) setPlacedOptionIndex(optIdx);
    setSelectedOptionIndex(null);
    setValidSlots([]);
    setCardPlacedThisRound(true);

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
    setPlacedOptionIndex(null);
    const newOpts = generateOptions(nextRound, grid, usedPlayerIds, playerPool);
    setOptions(newOpts);
  }, [cardPlacedThisRound, round, grid, usedPlayerIds, playerPool]);

  const handleSlotClick = useCallback((index: number) => {
    if (swapMode !== null) {
      if (validSlots.includes(index)) {
        // Move the card from swapMode slot to this empty valid slot
        const sourceCard = grid[swapMode]?.card;
        if (sourceCard) {
          const newGrid = grid.map((slot, i) => {
            if (i === swapMode) return { ...slot, card: null };
            if (i === index) return { ...slot, card: sourceCard };
            return slot;
          });
          setGrid(newGrid);
        }
      } else if (swapMode !== index) {
        const result = swapCards(grid, swapMode, index);
        if (result) setGrid(result);
      }
      setSwapMode(null);
      setValidSlots([]);
      return;
    }
    if (selectedOptionIndex !== null && validSlots.includes(index)) {
      handlePlaceCard(index);
    }
  }, [swapMode, selectedOptionIndex, validSlots, grid, handlePlaceCard]);

  const handleCardClick = useCallback((index: number) => {
    if (selectedOptionIndex !== null) return;
    if (swapMode === index) {
      // Cancel swap
      setSwapMode(null);
      setValidSlots([]);
    } else if (swapMode !== null) {
      // Swap with another filled card
      const result = swapCards(grid, swapMode, index);
      if (result) setGrid(result);
      setSwapMode(null);
      setValidSlots([]);
    } else {
      // Enter swap mode — also highlight valid empty destination slots
      setSwapMode(index);
      const card = grid[index]?.card;
      if (card) {
        const emptySlots = getValidSlotsForCard(grid, card);
        setValidSlots(emptySlots);
      }
    }
  }, [selectedOptionIndex, swapMode, grid]);

  const handleDropOnSlot = useCallback((slotIndex: number, optionIndex?: number) => {
    // Use optionIndex from drag data if available, fallback to selectedOptionIndex
    const idx = optionIndex ?? selectedOptionIndex;
    if (idx === null || idx === undefined) return;
    const card = options[idx];
    if (!card) return;
    // Validate slot is compatible with this card's position
    const valid = getValidSlotsForCard(grid, card);
    if (valid.includes(slotIndex)) {
      handlePlaceCard(slotIndex, card);
    }
  }, [selectedOptionIndex, options, grid, handlePlaceCard]);

  const handleDragSwap = useCallback((fromIndex: number, toIndex: number) => {
    // If target slot is empty, move the card there (if position valid)
    if (!grid[toIndex]?.card && grid[fromIndex]?.card) {
      const card = grid[fromIndex].card!;
      const toSlot = grid[toIndex];
      const posValid = toSlot.position === 'UTIL' || toSlot.position === card.position || toSlot.position === card.secondaryPosition;
      if (posValid) {
        const newGrid = grid.map((slot, i) => {
          if (i === fromIndex) return { ...slot, card: null };
          if (i === toIndex) return { ...slot, card };
          return slot;
        });
        setGrid(newGrid);
        setSwapMode(null);
        setValidSlots([]);
        return;
      }
    }
    // Otherwise try a swap between two filled slots
    const result = swapCards(grid, fromIndex, toIndex);
    if (result) setGrid(result);
    setSwapMode(null);
    setValidSlots([]);
  }, [grid]);

  const handleGridCardDragStart = useCallback((index: number) => {
    setSwapMode(index);
    const card = grid[index]?.card;
    if (card) {
      const emptySlots = getValidSlotsForCard(grid, card);
      setValidSlots(emptySlots);
    }
  }, [grid]);

  const handleGridCardDragEnd = useCallback(() => {
    setSwapMode(null);
    setValidSlots([]);
  }, []);

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

  const handleSubmit = useCallback(() => setShowResults(true), []);

  const handlePlayAgain = useCallback(() => {
    const newGrid = createInitialGrid();
    setGrid(newGrid);
    setRound(1);
    setUsedPlayerIds(new Set());
    setSelectedOptionIndex(null);
    setPlacedOptionIndex(null);
    setValidSlots([]);
    setSwapMode(null);
    setDraftComplete(false);
    setShowResults(false);
    setCardPlacedThisRound(false);
    const opts = generateOptions(1, newGrid, new Set(), playerPool);
    setOptions(opts);
  }, [playerPool]);

  if (showResults) {
    return <ResultsScreen grid={grid} score={score} onPlayAgain={handlePlayAgain} />;
  }

  const clearSelection = () => {
    if (selectedOptionIndex !== null && !cardPlacedThisRound) { setSelectedOptionIndex(null); setValidSlots([]); }
    if (swapMode !== null) { setSwapMode(null); setValidSlots([]); }
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#1a1a1a' }}>
      <Header talent={score.talent} chem={score.totalChem} total={score.total} />

      {/* ── COURT (flex-1 = fills remaining space) ── */}
      <div className="flex-1 min-h-0 w-full" onClick={clearSelection}>
        <Grid
          grid={grid}
          lines={score.lines}
          dots={score.dots}
          validSlots={validSlots}
          onSlotClick={handleSlotClick}
          onCardClick={handleCardClick}
          swapSource={swapMode}
          swapTargets={swapMode !== null ? getValidSwapTargets(grid, swapMode) : []}
          isComplete={draftComplete}
          onDropOnSlot={handleDropOnSlot}
          onDragSwap={handleDragSwap}
          onGridCardDragStart={handleGridCardDragStart}
          onGridCardDragEnd={handleGridCardDragEnd}
          onBackgroundClick={clearSelection}
        />
      </div>

      {/* ── DRAFT AREA (dark section at bottom, consistent height) ── */}
      <div
        className="shrink-0 w-full flex flex-col items-center gap-2 px-3 pt-2 pb-3"
        style={{ background: '#111827', borderTop: '3px solid #1f2937', minHeight: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top row: achvs + round dots + odds */}
        <div className="flex items-center justify-between w-full max-w-lg">
          <button
            onClick={() => setShowAchievements(true)}
            className="text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors"
          >
            Achvs.
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i < (draftComplete ? 9 : cardPlacedThisRound ? round : round - 1)
                    ? 'w-4 h-1.5 bg-orange-500'
                    : i === round - 1 && !draftComplete && !cardPlacedThisRound
                    ? 'w-4 h-1.5 bg-orange-500/40'
                    : 'w-3 h-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setShowOdds(true)}
            className="text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors"
          >
            Odds
          </button>
        </div>

        {/* Round label */}
        {!draftComplete && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-white/60 font-black">
              Round {round} of 9
            </span>
            {!cardPlacedThisRound && <span className="text-[10px] text-white/30">— Select a player</span>}
          </div>
        )}
        {draftComplete && (
          <div className="text-center">
            <p className="text-sm font-bold text-white/80">Draft Complete!</p>
            <p className="text-[10px] text-white/40">Drag cards to swap and maximize chemistry.</p>
          </div>
        )}

        {/* Draft option cards */}
        {!draftComplete && options.length > 0 && (
          <div className="animate-slide-up" key={`round-${round}`}>
            <DraftOptions
              options={options}
              selectedIndex={selectedOptionIndex}
              onSelect={handleSelectOption}
              round={round}
              onDragStart={handleDragStartOption}
              placedIndex={placedOptionIndex}
              cardSize={{ w: 78, h: 109 }}
            />
          </div>
        )}

        {/* Footer: help + next round / submit */}
        <div className="flex items-center justify-between w-full max-w-lg">
          <button
            onClick={() => setShowHowToPlay(true)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/60 hover:text-white text-sm font-black border border-white/15"
          >
            ?
          </button>

          {!draftComplete && cardPlacedThisRound && (
            <button onClick={handleNextRound} className="btn-primary text-white text-sm font-bold px-5 py-2 rounded-xl uppercase tracking-wide">
              {round >= 9 ? 'Finish Draft' : 'Next Round →'}
            </button>
          )}
          {draftComplete && (
            <button onClick={handleSubmit} className="btn-green text-white text-sm font-bold px-6 py-2.5 rounded-xl uppercase tracking-wide">
              Submit Lineup
            </button>
          )}
          {!draftComplete && !cardPlacedThisRound && <div className="w-9" />}
        </div>
      </div>

      {showOdds && <OddsModal onClose={() => setShowOdds(false)} />}
      {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </div>
  );
}
