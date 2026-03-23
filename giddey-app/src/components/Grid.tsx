"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { GridSlot, ChemLine, ChemDot, ADJACENCIES } from "@/lib/types";
import PlayerCard from "./PlayerCard";

interface GridProps {
  grid: GridSlot[];
  lines: ChemLine[];
  dots: ChemDot[];
  validSlots?: number[];
  onSlotClick: (index: number) => void;
  onCardClick?: (index: number) => void;
  swapSource?: number | null;
  swapTargets?: number[];
  isComplete?: boolean;
  readOnly?: boolean;
  onDropOnSlot?: (slotIndex: number, optionIndex?: number) => void;
  onDragSwap?: (fromIndex: number, toIndex: number) => void;
  onBackgroundClick?: () => void;
  onGridCardDragStart?: (index: number) => void;
  onGridCardDragEnd?: () => void;
}

interface LineData {
  x1: number; y1: number; x2: number; y2: number;
  chemLine?: ChemLine; key: string;
}

// Which side the position label appears on
const LABEL_SIDE: Record<number, "left" | "right" | "below"> = {
  0: "left", 1: "right",
  2: "left", 3: "left", 4: "right", 5: "right",
  6: "left", 7: "right",
  8: "below",
};

function computeMatchingTraits(grid: GridSlot[]): Record<number, Set<string>> {
  const map: Record<number, Set<string>> = {};
  for (let i = 0; i < 9; i++) map[i] = new Set<string>();
  for (const [a, b] of ADJACENCIES) {
    const A = grid[a]?.card, B = grid[b]?.card;
    if (!A || !B) continue;
    if (A.teamId === B.teamId)               { map[a].add("team");     map[b].add("team"); }
    if (A.team.division === B.team.division) { map[a].add("division"); map[b].add("division"); }
    if (A.draftYear === B.draftYear)         { map[a].add("year");     map[b].add("year"); }
  }
  return map;
}

export default function Grid({
  grid, lines, dots, validSlots = [], onSlotClick, onCardClick,
  swapSource, swapTargets = [], isComplete = false, readOnly = false,
  onDropOnSlot, onDragSwap, onBackgroundClick,
  onGridCardDragStart, onGridCardDragEnd,
}: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs     = useRef<(HTMLDivElement | null)[]>(Array(9).fill(null));
  const [cardW, setCardW]       = useState(72);
  const [containerW, setContainerW] = useState(400);
  const [svgSize, setSvgSize]   = useState({ w: 0, h: 0 });
  const [svgLines, setSvgLines] = useState<LineData[]>([]);
  const [dragSource, setDragSource]         = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<number | null>(null);

  const matchingTraits = computeMatchingTraits(grid);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const W = el.offsetWidth;
    const H = el.offsetHeight;
    if (W < 80) return;
    setContainerW(W);
    // Width-based: fit 4 cards + gaps across the row
    const cwByWidth = Math.floor(W / 5.2);
    // Height-based: fit ~5 rows of cards vertically
    const cwByHeight = H > 40 ? Math.floor(((H - 16) / 4.8) / 1.4) : cwByWidth;
    const cw = Math.min(cwByWidth, cwByHeight, 160);
    setCardW(Math.max(cw, 54));
  }, []);

  const drawLines = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setSvgSize({ w: rect.width, h: rect.height });

    const centers: Record<number, { x: number; y: number }> = {};
    slotRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const r = ref.getBoundingClientRect();
      centers[i] = {
        x: r.left + r.width  / 2 - rect.left,
        y: r.top  + r.height     - rect.top,
      };
    });

    setSvgLines(
      ADJACENCIES
        .filter(([a, b]) => centers[a] && centers[b])
        .map(([a, b]) => ({
          x1: centers[a].x, y1: centers[a].y,
          x2: centers[b].x, y2: centers[b].y,
          chemLine: lines.find((l) => l.from === a && l.to === b),
          key: `${a}-${b}`,
        }))
    );
  }, [lines]);

  const refresh = useCallback(() => {
    measure();
    requestAnimationFrame(drawLines);
  }, [measure, drawLines]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    refresh();
    return () => ro.disconnect();
  }, [refresh]);

  useEffect(() => { requestAnimationFrame(drawLines); }, [grid, lines, drawLines]);

  const cardH     = Math.round(cardW * 1.4);
  const dotW      = Math.round(cardW * 0.42);       // ~28px at 68px card (matches reference)
  const dotH      = Math.round(dotW  / 2.8);        // 2.8:1 ratio = reference's 28×10px oval
  const labelSize = Math.max(10, Math.round(cardW * 0.165)); // ~11px at 68px (matches reference 0.7rem)

  // Diamond-pattern transforms (proportional to card height, matching reference ratios)
  const topShift = Math.round(cardH * 0.29);   // row-1 shifted down
  const pgShift  = Math.round(cardH * 0.57);   // PG slots shifted further down within row-2
  const cLift    = Math.round(cardH * 0.48);   // row-4 center lifted up

  // Row max-width: scale with card size, cap for very wide screens
  const rowMaxW = Math.min(containerW - 4, cardW * 6.5);

  // ── Magnetic snap: find nearest slot to cursor ──────────────────
  const nearestSlotRef = useRef<number | null>(null);
  const SNAP_RADIUS = cardW * 1.8; // snap when cursor is within 1.8× card width

  const findNearestSlot = useCallback((clientX: number, clientY: number): number | null => {
    let best: number | null = null;
    let bestDist = SNAP_RADIUS;
    slotRefs.current.forEach((ref, i) => {
      if (!ref || i === dragSource) return;
      const r = ref.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }, [dragSource, SNAP_RADIUS]);

  // ── Drag handlers ──────────────────────────────────────────────
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    const nearest = findNearestSlot(e.clientX, e.clientY);
    nearestSlotRef.current = nearest;
    setDragOverTarget(nearest);
  }, [findNearestSlot]);

  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const targetIdx = nearestSlotRef.current;
    setDragOverTarget(null);
    nearestSlotRef.current = null;
    if (targetIdx === null) { setDragSource(null); return; }

    const st = e.dataTransfer.getData("source-type");
    if (st === "grid-card" && onDragSwap) {
      const from = parseInt(e.dataTransfer.getData("grid-index"), 10);
      if (!isNaN(from) && from !== targetIdx) onDragSwap(from, targetIdx);
      setDragSource(null); return;
    }
    if (st === "option-card" && onDropOnSlot) {
      const optIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
      onDropOnSlot(targetIdx, isNaN(optIdx) ? undefined : optIdx);
      return;
    }
    if (onDropOnSlot) onDropOnSlot(targetIdx);
  }, [onDragSwap, onDropOnSlot]);

  const handleGridCardDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData("source-type", "grid-card");
    e.dataTransfer.setData("grid-index", String(idx));
    e.dataTransfer.effectAllowed = "move";
    setDragSource(idx); onGridCardDragStart?.(idx);
  };
  const handleGridCardDragEnd = () => { setDragSource(null); setDragOverTarget(null); nearestSlotRef.current = null; onGridCardDragEnd?.(); };

  // ── Render one slot wrapper ────────────────────────────────────
  function renderSlot(i: number) {
    const slot  = grid[i];
    const dot   = dots.find((d) => d.slotIndex === i);
    const valid = validSlots.includes(i);
    const isSrc    = swapSource === i;
    const isTgt    = swapTargets.includes(i);
    const inactive = swapSource != null && !isSrc && !isTgt && slot.card !== null;
    const isDragSrc = dragSource === i;
    const isDragTgt = dragOverTarget === i;
    const side = LABEL_SIDE[i];

    const labelStyle: React.CSSProperties = {
      position: "absolute",
      fontSize: labelSize,
      fontWeight: 700,
      color: isSrc ? "rgba(234,179,8,1)" : valid ? "rgba(74,222,128,1)" : "rgba(255,255,255,0.5)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      whiteSpace: "nowrap",
      fontFamily: "-apple-system, sans-serif",
      textShadow: "0 1px 3px rgba(0,0,0,0.6)",
      ...(side === "left"  && { right: `calc(50% + ${Math.round(cardW * 0.265)}px)`, top: Math.round(cardH * 0.895) }),
      ...(side === "right" && { left:  `calc(50% + ${Math.round(cardW * 0.265)}px)`, top: Math.round(cardH * 0.895) }),
      ...(side === "below" && { top: cardH + Math.round(dotH / 2) + 3, left: "50%", transform: "translateX(-50%)" }),
    };

    return (
      <div key={i} style={{ position: "relative", width: cardW, height: cardH, flexShrink: 0 }}>
        {slot.card ? (
          <div
            ref={(el) => { slotRefs.current[i] = el; }}
            className={`grid-slot-filled rounded-[10px] w-full h-full
              ${isSrc    ? "swap-source"      : ""}
              ${isTgt    ? "swap-target"       : ""}
              ${inactive ? "swap-inactive"     : ""}
              ${isDragSrc ? "dragging-source"  : ""}
              ${isDragTgt ? "drag-swap-target" : ""}`}
            style={readOnly ? { cursor: "default" } : undefined}
            onClick={(e) => { e.stopPropagation(); if (!readOnly) { onCardClick ? onCardClick(i) : onSlotClick(i); } }}
          >
            <PlayerCard
              card={slot.card} size="grid"
              cardSize={{ w: cardW, h: cardH }}
              showDot={false}
              matchingTraits={matchingTraits[i]}
              className={isComplete || isDragSrc || isSrc ? "" : "animate-card-place"}
              draggable={!readOnly}
              onDragStart={readOnly ? undefined : (e) => handleGridCardDragStart(e, i)}
              onDragEnd={readOnly ? undefined : handleGridCardDragEnd}
            />
          </div>
        ) : (
          <div
            ref={(el) => { slotRefs.current[i] = el; }}
            className={`grid-slot-empty flex items-center justify-center w-full h-full ${valid ? "valid-target" : ""} ${isDragTgt ? "drag-swap-target" : ""}`}
            onClick={(e) => { e.stopPropagation(); onSlotClick(i); }}
          >
            <img src="/logo.png" alt="" style={{ width: Math.round(cardW * 0.38), height: Math.round(cardW * 0.38), objectFit: "contain", opacity: valid ? 0.55 : 0.35, pointerEvents: "none" }} draggable={false} />
          </div>
        )}

        {/* Dot — overlaps card bottom exactly like reference (top: cardH - dotH/2, z-index: -1) */}
        <div
          className={`chem-dot-${dot?.level ?? "white"}`}
          style={{ position: "absolute", top: cardH - Math.round(dotH / 2), left: "50%", transform: "translateX(-50%)", width: dotW, height: dotH, borderRadius: 999, zIndex: -1 }}
        />

        {/* Position label */}
        <span style={labelStyle}>{slot.label}</span>
      </div>
    );
  }

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: rowMaxW,
    padding: "0 2px",
    position: "relative",
    zIndex: 10,
    flexShrink: 0,
  };

  return (
    <div
      ref={containerRef}
      className="court-container w-full h-full relative"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-evenly",
        padding: "0.75rem 0.5rem",
        overflow: "hidden",
        borderRadius: 0,
        border: "none",
        boxShadow: "none",
        background: "linear-gradient(180deg, #c4651f 0%, #b5570f 30%, #a84e18 60%, #b5570f 85%, #c4651f 100%)",
      }}
      onClick={onBackgroundClick}
      onDragOver={readOnly ? undefined : handleContainerDragOver}
      onDrop={readOnly ? undefined : handleContainerDrop}
      onDragLeave={() => { setDragOverTarget(null); nearestSlotRef.current = null; }}
    >
      {/* Decorative court lines */}
      {svgSize.w > 0 && <CourtLines w={svgSize.w} h={svgSize.h} />}

      {/* Chemistry + formation SVG */}
      {svgSize.w > 0 && (
        <svg className="absolute inset-0 pointer-events-none"
          viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
          style={{ width: "100%", height: "100%", zIndex: 5, overflow: "visible" }}>
          {svgLines.map((l) => {
            const hasChem = l.chemLine && grid[l.chemLine.from]?.card && grid[l.chemLine.to]?.card;
            return hasChem && l.chemLine ? (
              <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                className={`chem-line-${l.chemLine.level}`}
                strokeWidth={l.chemLine.level === "green" ? 4.5 : l.chemLine.level === "yellow" ? 4 : 3}
                strokeOpacity={0.85} strokeLinecap="round" />
            ) : (
              <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" strokeLinecap="round" />
            );
          })}
        </svg>
      )}

      {/* Row 1: [spacer][0:SG][1:SF][spacer] — shifted down */}
      <div style={{ ...rowStyle, transform: `translateY(${topShift}px)` }}>
        <div style={{ width: cardW, flexShrink: 0, visibility: "hidden" }} />
        {renderSlot(0)}
        {renderSlot(1)}
        <div style={{ width: cardW, flexShrink: 0, visibility: "hidden" }} />
      </div>

      {/* Row 2: [2:UTIL][3:PG][4:PG][5:UTIL] — narrower so UTIL is inward from wings */}
      <div style={{ ...rowStyle, maxWidth: Math.round(rowMaxW * 0.82) }}>
        {renderSlot(2)}
        <div style={{ transform: `translateY(${pgShift}px)` }}>{renderSlot(3)}</div>
        <div style={{ transform: `translateY(${pgShift}px)` }}>{renderSlot(4)}</div>
        {renderSlot(5)}
      </div>

      {/* Row 3: [6:SF-bottom][7:SG-bottom] — full width so wings are outside UTIL */}
      <div style={rowStyle}>
        {renderSlot(6)}
        {renderSlot(7)}
      </div>

      {/* Row 4: [8:C] — lifted up */}
      <div style={{ display: "flex", justifyContent: "center", position: "relative", zIndex: 10, flexShrink: 0, transform: `translateY(-${cLift}px)` }}>
        {renderSlot(8)}
      </div>
    </div>
  );
}

function CourtLines({ w, h }: { w: number; h: number }) {
  const cx = w / 2, cy = h / 2;
  const lc = "rgba(255,255,255,0.18)", lw = 1.4;
  // Use the smaller dimension so circle & paint stay proportional at any court size
  const base = Math.min(w, h);
  const circleR = base * 0.13;
  const paintW  = base * 0.30;
  const paintH  = base * 0.22;
  return (
    <svg className="absolute inset-0 pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", height: "100%", zIndex: 1 }}>
      <rect x="8" y="8" width={w - 16} height={h - 16} rx="6" fill="none" stroke={lc} strokeWidth="2" />
      <line x1="8" y1={cy} x2={w - 8} y2={cy} stroke={lc} strokeWidth={lw} />
      <circle cx={cx} cy={cy} r={circleR} fill="none" stroke={lc} strokeWidth={lw} />
      <circle cx={cx} cy={cy} r={base * 0.008} fill="rgba(255,255,255,0.08)" />
      <rect x={cx - paintW / 2} y="8" width={paintW} height={paintH} rx="3" fill="none" stroke={lc} strokeWidth="1.2" />
      <rect x={cx - paintW / 2} y={h - paintH - 8} width={paintW} height={paintH} rx="3" fill="none" stroke={lc} strokeWidth="1.2" />
    </svg>
  );
}
