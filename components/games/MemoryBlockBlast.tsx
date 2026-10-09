"use client";

import { useState, useCallback, useEffect, useRef, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubmitArcadeScore } from "@/hooks/useGames";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, RotateCcw, Trophy, Sparkles, ImageIcon, Blocks, Info, Play } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { cn, selectPublicPhotos } from "@/lib/utils";
import {
  getRandomShapes,
  getAbsoluteCells,
  canPlace,
  placeBlock,
  findFullLines,
  clearRow,
  clearCol,
  canAnyShapeFit,
  countRevealed,
  cellBackgroundPosition,
  type BlockShape,
  type CellCoord,
} from "@/lib/game-block-shapes";
import type { Photo } from "@/types";

// ── Constants ─────────────────────────────────────────────────────

const GRID_SIZE = 8;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const BLOCKS_PER_ROUND = 3;
const POINTS_PER_LINE = 100;
const COMBO_MULTIPLIER = 1.5;
const TRAY_CELL = 34; // block cell size inside the tray

// ── Types ─────────────────────────────────────────────────────────

type Phase = "loading" | "ready" | "playing" | "gameOver" | "victory";

type HeartParticle = {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

type ClearedLine = {
  id: number;
  type: "row" | "col";
  index: number;
};

type ScorePop = {
  id: number;
  x: number;
  y: number;
  points: number;
  combo: number;
};

type StatusTone = "neutral" | "good" | "warn";

type StatusInfo = {
  key: number;
  text: string;
  tone: StatusTone;
};

type MemoryBlockBlastProps = {
  playerName?: string;
  onExit?: () => void;
};

// ── Static sub-components (module scope for stable identity) ──────

type BlockPreviewProps = {
  block: BlockShape;
  photoUrl: string;
  cellPx: number;
  imageDim?: number;
};

const BlockPreview = memo(function BlockPreview({ block, photoUrl, cellPx, imageDim }: BlockPreviewProps) {
  const dim = imageDim ?? GRID_SIZE * cellPx;
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${block.width}, ${cellPx}px)`,
        gridTemplateRows: `repeat(${block.height}, ${cellPx}px)`,
      }}
    >
      {Array.from({ length: block.height * block.width }, (_, i) => {
        const r = Math.floor(i / block.width);
        const c = i % block.width;
        const isPart = block.cells.some((cell) => cell.row === r && cell.col === c);
        return (
          <div
            key={i}
            className="rounded-sm border border-rose-300/60 dark:border-rose-700/50"
            style={{
              width: cellPx,
              height: cellPx,
              backgroundImage: isPart && photoUrl ? `url(${photoUrl})` : undefined,
              backgroundSize: `${dim}px ${dim}px`,
              backgroundPosition: isPart ? cellBackgroundPosition(c, r, cellPx) : undefined,
              backgroundRepeat: "no-repeat",
              opacity: isPart ? 1 : 0,
            }}
          />
        );
      })}
    </div>
  );
});

type GridCellProps = {
  row: number;
  col: number;
  filled: boolean;
  revealed: boolean;
  hovered: boolean;
  valid: boolean;
  clearing: boolean;
  photoUrl: string;
  cellPx: number;
  imageDim: number;
};

const GridCell = memo(function GridCell({
  row,
  col,
  filled,
  revealed,
  hovered,
  valid,
  clearing,
  photoUrl,
  cellPx,
  imageDim,
}: GridCellProps) {
  const showFragment = filled || hovered || revealed;
  return (
    <motion.div
      className={cn(
        "relative flex items-center justify-center border",
        "border-rose-300/70 dark:border-rose-600/60",
        filled ? "bg-transparent" : "bg-rose-50/50 dark:bg-rose-950/50",
        hovered && valid && "bg-rose-300/70 dark:bg-rose-600/50",
        hovered && !valid && "bg-red-300/60 dark:bg-red-800/50",
        clearing && "bg-yellow-300/70 dark:bg-yellow-500/50",
      )}
      style={{
        width: cellPx,
        height: cellPx,
        backgroundImage: showFragment && photoUrl ? `url(${photoUrl})` : undefined,
        backgroundSize: `${imageDim}px ${imageDim}px`,
        backgroundPosition: showFragment ? cellBackgroundPosition(col, row, cellPx) : undefined,
        backgroundRepeat: "no-repeat",
        opacity: filled ? 1 : revealed ? 0.4 : hovered ? 0.85 : undefined,
      }}
      animate={
        clearing
          ? { scale: [1, 1.15, 0.6, 0], opacity: [1, 0.8, 0.3, 0] }
          : filled
            ? { scale: 1, opacity: 1 }
            : { scale: 1 }
      }
      transition={clearing ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.18 }}
    >
      {hovered && valid && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute inset-0 rounded-sm border-2 border-rose-400"
        />
      )}
    </motion.div>
  );
});

// ── Main component ────────────────────────────────────────────────

export default function MemoryBlockBlast({ playerName, onExit }: MemoryBlockBlastProps) {
  const submitScore = useSubmitArcadeScore();

  // Core state
  const [phase, setPhase] = useState<Phase>("loading");
  const [grid, setGrid] = useState<boolean[]>(() => Array(TOTAL_CELLS).fill(false));
  const [revealed, setRevealed] = useState<boolean[]>(() => Array(TOTAL_CELLS).fill(false));
  const [blocks, setBlocks] = useState<BlockShape[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [randomPhoto, setRandomPhoto] = useState<Photo | null>(null);

  // Drag state
  const [draggedBlock, setDraggedBlock] = useState<BlockShape | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverCells, setHoverCells] = useState<CellCoord[] | null>(null);
  const [isValidDrop, setIsValidDrop] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  // Animation state
  const [heartParticles, setHeartParticles] = useState<HeartParticle[]>([]);
  const [clearedLines, setClearedLines] = useState<ClearedLine[]>([]);
  const [scorePops, setScorePops] = useState<ScorePop[]>([]);
  const [shakeBlocks, setShakeBlocks] = useState(false);
  const [status, setStatus] = useState<StatusInfo>({
    key: 0,
    text: "Tarik blok ke papan untuk mulai!",
    tone: "neutral",
  });
  const [linesCleared, setLinesCleared] = useState(0);
  const statusKeyRef = useRef(0);

  // Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  // Measured board width (fallback 343 ≈ 375px viewport minus padding).
  // Cell = floor(width / 8) so the 8×8 grid never overflows narrow screens.
  const [boardWidth, setBoardWidth] = useState(343);
  const cell = Math.floor(boardWidth / GRID_SIZE);
  const imageDim = cell * GRID_SIZE;
  const cellRef = useRef(cell);
  cellRef.current = cell;
  const particleIdRef = useRef(0);
  const clearedLineIdRef = useRef(0);
  const scorePopIdRef = useRef(0);
  const gridRefForDrag = useRef(grid);
  const blocksRef = useRef(blocks);
  const revealedRef = useRef(revealed);
  const scoreRef = useRef(score);
  const comboRef = useRef(combo);
  const phaseRef = useRef(phase);
  const photosRef = useRef<Photo[]>([]);
  const dragRef = useRef<{
    block: BlockShape;
    index: number;
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const isClearingRef = useRef(false);
  // One-shot submit guard (see submit effect below). A ref — never state —
  // so the guard itself never triggers renders or cascading updates.
  const submitSentRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { gridRefForDrag.current = grid; }, [grid]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Measure the board container so the cell size scales down on narrow screens.
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setBoardWidth(w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [phase]);

  // ── Fetch a random photo ──────────────────────────────────────

  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ["photos", "list", { mediaType: "foto", limit: 50, visibility: "public" }],
    queryFn: async () => {
      const res = await fetch("/api/photos?limit=50&mediaType=foto&visibility=public");
      if (!res.ok) return [] as Photo[];
      const json = await res.json().catch(() => null);
      return selectPublicPhotos((json?.data ?? []) as Photo[]);
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (photosData) photosRef.current = photosData;
  }, [photosData]);

  const pickRandomPhoto = useCallback((list: Photo[] = photosRef.current) => {
    if (list.length > 0) {
      setRandomPhoto(list[Math.floor(Math.random() * list.length)]);
    }
  }, []);

  // Pick a random photo when data arrives, then show the start screen.
  // Blocks are only dealt when the player explicitly starts the game.
  // Render-time adjustment (React-endorsed): the pick itself lives in the
  // event-style pickRandomPhoto callback, so render stays pure.
  if (!photosLoading && photosData && photosData.length > 0 && !randomPhoto) {
    pickRandomPhoto(photosData);
  }
  if (phase === "loading" && !photosLoading) {
    setPhase("ready");
  }

  // Build the 400×400 image URL using Cloudinary
  const { photoUrl, blurredPhotoUrl } = useMemo(() => {
    const rawUrl = randomPhoto?.thumbnailUrl || randomPhoto?.url || "";
    if (!rawUrl) return { photoUrl: "", blurredPhotoUrl: "" };
    const isCloudinary = rawUrl.includes("res.cloudinary.com");
    return {
      photoUrl: isCloudinary
        ? rawUrl.replace("/upload/", "/upload/c_fill,g_center,w_400,h_400/")
        : rawUrl,
      blurredPhotoUrl: isCloudinary
        ? rawUrl.replace("/upload/", "/upload/w_24,h_24,c_fill,q_1,e_blur:1000/")
        : "",
    };
  }, [randomPhoto]);

  // ── Start / Reset game ────────────────────────────────────────

  const startGame = useCallback(() => {
    pickRandomPhoto();
    setGrid(Array(TOTAL_CELLS).fill(false));
    setRevealed(Array(TOTAL_CELLS).fill(false));
    setBlocks(getRandomShapes(BLOCKS_PER_ROUND));
    setScore(0);
    setCombo(0);
    submitSentRef.current = false;
    setDisplayScore(0);
    setHeartParticles([]);
    setClearedLines([]);
    setScorePops([]);
    setLinesCleared(0);
    setStatus({ key: statusKeyRef.current += 1, text: "Tarik blok ke papan untuk mulai!", tone: "neutral" });
    setDraggedBlock(null);
    setDragIndex(null);
    setHoverCells(null);
    setIsValidDrop(false);
    setGhost(null);
    lastTargetRef.current = null;
    dragRef.current = null;
    setPhase("playing");
  }, [pickRandomPhoto]);

  // ── Score animation ───────────────────────────────────────────

  useEffect(() => {
    if (phase !== "victory" && phase !== "gameOver") return;
    // Capture the final score once; the scoreRef sync effect runs before this
    // one, so scoreRef.current already holds the complete end-of-game score.
    // (No sync reset needed: the first animation frame below sets ~0.)
    const finalScore = scoreRef.current;
    const duration = 1200;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * finalScore));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // ── Submit score on game end ──────────────────────────────────
  // Guard lives in submitSentRef above (written inside the effect, never
  // during render) so a slow network can't double-submit and StrictMode
  // remounts can't either — replacing the old submitted-state sync set.

  useEffect(() => {
    if ((phase === "victory" || phase === "gameOver") && !submitSentRef.current && scoreRef.current > 0) {
      submitSentRef.current = true;
      submitScore.mutate({
        gameType: "MEMORY_BLOCK_BLAST",
        score: scoreRef.current,
        playerName,
      });
    }
  }, [phase, submitScore, playerName]);

  // ── Live status banner (updates on every move) ───────────────
  // Declared before the effects that call it (used before declaration
  // breaks the stale-closure guarantee the linter enforces).

  const setStatusMsg = useCallback((text: string, tone: StatusTone = "neutral") => {
    statusKeyRef.current += 1;
    setStatus({ key: statusKeyRef.current, text, tone });
  }, []);

  // ── Proactive game-over check ─────────────────────────────────
  // Runs whenever the tray or grid changes during play. This catches the
  // "no remaining block fits anywhere" state even when the player can't (or
  // hasn't) placed a block, so the game reliably ends instead of getting stuck.
  // Suppressed while a line-clear animation is mid-flight (the grid hasn't
  // been emptied yet, which would cause a false game-over).

  useEffect(() => {
    if (phase !== "playing") return;
    if (isClearingRef.current) return;
    if (blocks.length > 0 && !canAnyShapeFit(grid, blocks)) {
      setStatusMsg("Tidak ada ruang lagi 😢", "warn");
      setPhase("gameOver");
    }
  }, [blocks, grid, phase, setStatusMsg]);

  // ── Spawn heart particles ─────────────────────────────────────

  const spawnHeartParticles = useCallback((x: number, y: number, count: number) => {
    const newParticles: HeartParticle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        delay: Math.random() * 0.2,
        duration: 0.8 + Math.random() * 0.6,
        offsetX: (Math.random() - 0.5) * 80,
        offsetY: -(Math.random() * 60 + 20),
        scale: 0.6 + Math.random() * 0.8,
      });
    }
    setHeartParticles((prev) => [...prev, ...newParticles]);
    const ids = newParticles.map((p) => p.id);
    setTimeout(() => {
      setHeartParticles((prev) => prev.filter((p) => !ids.includes(p.id)));
    }, 1600);
  }, []);

  // ── Handle line clearing & victory / game-over ───────────────

  const processLineClears = useCallback(
    (
      currentGrid: boolean[],
      currentRevealed: boolean[],
      currentScore: number,
      currentCombo: number,
      currentBlocks: BlockShape[],
    ) => {
      const { rows, cols } = findFullLines(currentGrid);
      const totalLines = rows.length + cols.length;

      // Score any lines formed. This also runs on the winning move, so the
      // final line's points are counted and the end score stays consistent
      // with the live header and the leaderboard submission.
      if (totalLines > 0) {
        // Lines will clear after a short animation; suppress the proactive
        // game-over check until the grid has actually been cleared.
        isClearingRef.current = true;

        const newCombo = currentCombo + 1;
        const linePoints = totalLines * POINTS_PER_LINE;
        const comboBonus = Math.round(linePoints * (newCombo - 1) * (COMBO_MULTIPLIER - 1));
        const totalPoints = linePoints + comboBonus;

        setCombo(newCombo);
        setScore((s) => s + totalPoints);
        setLinesCleared((prev) => prev + totalLines);
        setStatusMsg(
          `🔥 ${totalLines} baris terungkap! +${totalPoints}${newCombo > 1 ? ` · Kombo x${newCombo}` : ""}`,
          "good",
        );

        const gridRect = gridRef.current?.getBoundingClientRect();
        if (gridRect) {
          const centers: { x: number; y: number }[] = [];
          const cs = cellRef.current;
          for (const row of rows) {
            spawnHeartParticles(gridRect.width / 2, row * cs + cs / 2, 12);
            centers.push({ x: gridRect.width / 2, y: row * cs + cs / 2 });
          }
          for (const col of cols) {
            spawnHeartParticles(col * cs + cs / 2, gridRect.height / 2, 12);
            centers.push({ x: col * cs + cs / 2, y: gridRect.height / 2 });
          }

          // Floating "+points" pop at the centroid of the cleared lines.
          const cx = centers.reduce((a, p) => a + p.x, 0) / centers.length;
          const cy = centers.reduce((a, p) => a + p.y, 0) / centers.length;
          const popId = scorePopIdRef.current++;
          setScorePops((prev) => [...prev, { id: popId, x: cx, y: cy, points: totalPoints, combo: newCombo }]);
          setTimeout(() => {
            setScorePops((prev) => prev.filter((p) => p.id !== popId));
          }, 1000);
        }

        const newClearedLines: ClearedLine[] = [
          ...rows.map((r) => ({ id: clearedLineIdRef.current++, type: "row" as const, index: r })),
          ...cols.map((c) => ({ id: clearedLineIdRef.current++, type: "col" as const, index: c })),
        ];
        setClearedLines((prev) => [...prev, ...newClearedLines]);
        setTimeout(() => {
          setClearedLines((prev) => prev.filter((cl) => !newClearedLines.find((ncl) => ncl.id === cl.id)));
        }, 600);

        setTimeout(() => {
          let nextGrid = [...currentGrid];
          for (const row of rows) nextGrid = clearRow(nextGrid, row);
          for (const col of cols) nextGrid = clearCol(nextGrid, col);
          setGrid(nextGrid);
          isClearingRef.current = false;

          // If the game already ended (e.g. victory on this move), don't
          // override it with a game-over decision.
          if (phaseRef.current !== "playing") return;

          if (currentBlocks.length === 0) {
            const freshBlocks = getRandomShapes(BLOCKS_PER_ROUND);
            setBlocks(freshBlocks);
            if (!canAnyShapeFit(nextGrid, freshBlocks)) {
              setStatusMsg("Tidak ada ruang lagi 😢", "warn");
              setPhase("gameOver");
            }
          } else if (!canAnyShapeFit(nextGrid, currentBlocks)) {
            setStatusMsg("Tidak ada ruang lagi 😢", "warn");
            setPhase("gameOver");
          }
        }, 400);
      }

      // Victory: every cell has been revealed at least once (cumulative).
      // Checked after scoring so the final line still counts.
      if (countRevealed(currentRevealed) >= TOTAL_CELLS) {
        setPhase("victory");
        return;
      }

      // No line formed and the game isn't won: if none of the remaining
      // blocks fit anywhere, the game is over.
      if (totalLines === 0) {
        if (!canAnyShapeFit(currentGrid, currentBlocks)) {
          setStatusMsg("Tidak ada ruang lagi 😢", "warn");
          setPhase("gameOver");
        } else {
          setStatusMsg("Blok dipasang", "neutral");
        }
      }
    },
    [spawnHeartParticles, setStatusMsg],
  );

  // ── Handle a block being dropped onto the grid ────────────────

  const handleDrop = useCallback(
    (targetRow: number, targetCol: number, block: BlockShape, index: number) => {
      const cells = getAbsoluteCells(block, targetRow, targetCol);
      if (!cells) {
        setStatusMsg("Blok keluar dari papan 😅", "warn");
        setShakeBlocks(true);
        setTimeout(() => setShakeBlocks(false), 400);
        return;
      }

      const currentGrid = gridRefForDrag.current;
      if (!canPlace(currentGrid, cells)) {
        setStatusMsg("Tidak bisa ditaruh di sana 😅", "warn");
        setShakeBlocks(true);
        setTimeout(() => setShakeBlocks(false), 400);
        return;
      }

      const nextGrid = placeBlock(currentGrid, cells);
      const currentRevealed = revealedRef.current;
      const nextRevealed = [...currentRevealed];
      for (const { row, col } of cells) nextRevealed[row * GRID_SIZE + col] = true;

      setGrid(nextGrid);
      setRevealed(nextRevealed);

      // Remove the placed block, refilling the tray with a fresh set when the
      // round's last block is used. This is the authoritative "current blocks"
      // state that processLineClears must use for the game-over check.
      let newBlocks = blocksRef.current.filter((_, i) => i !== index);
      if (newBlocks.length === 0) {
        newBlocks = getRandomShapes(BLOCKS_PER_ROUND);
      }
      setBlocks(newBlocks);

      // processLineClears checks victory first, then clears any full lines
      // (scoring + heart bursts + floating +points), then detects game-over
      // against the freshly drawn remaining blocks.
      processLineClears(nextGrid, nextRevealed, scoreRef.current, comboRef.current, newBlocks);
    },
    [processLineClears, setStatusMsg],
  );

  // ── Pointer-based drag (mouse + touch) with Framer Motion ghost ─

  const resetDragVisuals = useCallback(() => {
    setDraggedBlock(null);
    setDragIndex(null);
    setHoverCells(null);
    setIsValidDrop(false);
    setGhost(null);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (phaseRef.current !== "playing") return;

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) {
      setGhost({ x: e.clientX - drag.grabOffsetX, y: e.clientY - drag.grabOffsetY });
      return;
    }

    // The block's top-left in viewport space, accounting for where it was grabbed.
    const originX = e.clientX - drag.grabOffsetX;
    const originY = e.clientY - drag.grabOffsetY;
    const cs = cellRef.current;
    const col = Math.floor((originX - rect.left) / cs);
    const row = Math.floor((originY - rect.top) / cs);

    const inBounds = col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE;
    const cells = inBounds ? getAbsoluteCells(drag.block, row, col) : null;
    const valid = !!cells && canPlace(gridRefForDrag.current, cells);

    // Snap the ghost to the exact cell origin when the drop is valid so the
    // preview lines up pixel-perfectly with where the block will land.
    const ghostX = inBounds && valid ? rect.left + col * cs : originX;
    const ghostY = inBounds && valid ? rect.top + row * cs : originY;
    setGhost({ x: ghostX, y: ghostY });

    if (!inBounds) {
      if (lastTargetRef.current !== null) {
        lastTargetRef.current = null;
        setHoverCells(null);
        setIsValidDrop(false);
      }
      return;
    }

    const key = `${row},${col},${valid}`;
    if (lastTargetRef.current !== key) {
      lastTargetRef.current = key;
      setHoverCells(cells);
      setIsValidDrop(valid);
    }
  }, []);

  // Stable mirror for self-removal inside onPointerUp below (referencing the
  // callback inside its own body breaks the stale-closure guarantee).
  const onPointerUpRef = useRef<(e: PointerEvent) => void>(() => {});

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUpRef.current);
      window.removeEventListener("pointercancel", onPointerUpRef.current);
      lastTargetRef.current = null;
      dragRef.current = null;
      setGhost(null);

      if (!drag || phaseRef.current !== "playing") {
        resetDragVisuals();
        return;
      }

      const rect = gridRef.current?.getBoundingClientRect();
      if (rect) {
        const cs = cellRef.current;
        const col = Math.floor((e.clientX - drag.grabOffsetX - rect.left) / cs);
        const row = Math.floor((e.clientY - drag.grabOffsetY - rect.top) / cs);
        if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
          handleDrop(row, col, drag.block, drag.index);
          return;
        }
      }
      resetDragVisuals();
    },
    [onPointerMove, handleDrop, resetDragVisuals],
  );

  // Keep the mirror current without re-subscribing listeners.
  useEffect(() => {
    onPointerUpRef.current = onPointerUp;
  });

  const onBlockPointerDown = useCallback(
    (e: React.PointerEvent, block: BlockShape, index: number) => {
      if (phaseRef.current !== "playing") return;
      e.preventDefault();
      // Measure the grab point relative to the block preview, then scale it to
      // the grid cell size so the ghost mirrors the block's real footprint.
      const inner = (e.currentTarget.firstElementChild as HTMLElement | null) ?? (e.currentTarget as HTMLElement);
      const blockRect = inner.getBoundingClientRect();
      const grabOffsetX = (e.clientX - blockRect.left) * (cellRef.current / TRAY_CELL);
      const grabOffsetY = (e.clientY - blockRect.top) * (cellRef.current / TRAY_CELL);
      dragRef.current = { block, index, grabOffsetX, grabOffsetY };
      setDraggedBlock(block);
      setDragIndex(index);
      setGhost({ x: e.clientX - grabOffsetX, y: e.clientY - grabOffsetY });
      setHoverCells(null);
      setIsValidDrop(false);
      lastTargetRef.current = null;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  // Clean up listeners if the component unmounts mid-drag
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // ── Derived render helpers ────────────────────────────────────

  const isCellHovered = (row: number, col: number) =>
    hoverCells ? hoverCells.some((c) => c.row === row && c.col === col) : false;

  const isCellClearing = (row: number, col: number) =>
    clearedLines.some(
      (cl) => (cl.type === "row" && cl.index === row) || (cl.type === "col" && cl.index === col),
    );

  const revealedCount = countRevealed(revealed);
  const revealPct = Math.round((revealedCount / TOTAL_CELLS) * 100);

  // ── Loading / empty states ────────────────────────────────────

  if (photosLoading || phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Skeleton className="aspect-square h-auto w-full max-w-[400px] rounded-2xl" />
        <Skeleton className="h-20 w-full max-w-[400px] rounded-xl" />
      </div>
    );
  }

  if (!randomPhoto) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/30">
          <ImageIcon className="h-8 w-8 text-rose-400" aria-hidden="true" />
        </div>
        <h3 className="font-heading text-lg font-semibold">Belum Ada Foto</h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          Upload foto bersama pasangan dulu yuk, biar bisa main Block Blast!
        </p>
      </div>
    );
  }

  // ── Start screen (shown before the player begins) ────────────
  if (phase === "ready") {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="relative aspect-square h-auto w-full max-w-[400px] overflow-hidden rounded-2xl shadow-xl ring-2 ring-rose-200/60 dark:ring-rose-800/60">
          {blurredPhotoUrl && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${blurredPhotoUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 p-6">
            <Blocks className="h-12 w-12 text-white drop-shadow" aria-hidden="true" />
            <h2 className="font-heading text-2xl font-bold text-white drop-shadow">Block Blast</h2>
            <p className="max-w-[260px] text-sm text-white/90">
              Susun blok untuk mengungkap foto, satu baris demi satu baris!
            </p>
            <Button onClick={startGame} className="mt-2 gap-2">
              <Play className="h-4 w-4" aria-hidden="true" />
              Mulai Bermain
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-6">
      {/* ── Header: Score, combo & reveal progress ───────────── */}
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-400" aria-hidden="true" />
            <motion.span
              key={score}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="font-heading text-xl font-bold text-rose-500"
            >
              {score}
            </motion.span>
          </div>
          <div className="flex items-center gap-2">
            {combo > 1 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 dark:bg-rose-950/30"
              >
                <Heart className="h-4 w-4 fill-rose-400 text-rose-400" aria-hidden="true" />
                <span className="text-sm font-bold text-rose-500">x{combo}</span>
              </motion.div>
            )}
            <button
              onClick={startGame}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent"
              aria-label="Mulai ulang"
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Reveal progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Blocks className="h-3.5 w-3.5" aria-hidden="true" /> Foto terungkap
            </span>
            <span className="font-semibold text-rose-500">{revealPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-rose-200/70 dark:bg-rose-800/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500"
              initial={false}
              animate={{ width: `${revealPct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          {/* Live status banner — updates on every move */}
          <div className="mt-3 flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={status.key}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  status.tone === "good" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                  status.tone === "warn" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                  status.tone === "neutral" && "bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300",
                )}
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{status.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Grid ──────────────────────────────────────────────── */}
      <div ref={boardWrapRef} className="w-full max-w-[400px]">
      <div
        ref={gridRef}
        className="relative select-none rounded-2xl shadow-xl ring-2 ring-rose-200/60 dark:ring-rose-800/60"
        style={{ width: imageDim, height: imageDim, maxWidth: "100%" }}
      >
        {/* Blurred background preview */}
        {blurredPhotoUrl && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-30"
            style={{
              backgroundImage: `url(${blurredPhotoUrl})`,
              backgroundSize: `${imageDim}px ${imageDim}px`,
              backgroundPosition: "0 0",
            }}
          />
        )}

        {/* Grid cells */}
        <div
          className="relative z-10 grid rounded-2xl"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${cell}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${cell}px)`,
          }}
        >
          {Array.from({ length: GRID_SIZE }, (_, row) =>
            Array.from({ length: GRID_SIZE }, (_, col) => {
              const idx = row * GRID_SIZE + col;
              return (
                <GridCell
                  key={idx}
                  row={row}
                  col={col}
                  filled={grid[idx]}
                  revealed={revealed[idx]}
                  hovered={isCellHovered(row, col)}
                  valid={isValidDrop}
                  clearing={isCellClearing(row, col)}
                  photoUrl={photoUrl}
                  cellPx={cell}
                  imageDim={imageDim}
                />
              );
            }),
          )}
        </div>

        {/* Heart particles overlay */}
        <AnimatePresence>
          {heartParticles.map((p) => (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute z-20"
              style={{ left: p.x, top: p.y }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
              animate={{ opacity: 0, x: p.offsetX, y: p.offsetY, scale: [p.scale, 0], rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
            >
              <span className="text-lg">❤️</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Floating "+points" pop on line reveal */}
        <AnimatePresence>
          {scorePops.map((p) => (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: p.x, top: p.y }}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -44, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <span className="font-heading text-2xl font-bold text-yellow-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]">
                +{p.points}
              </span>
              {p.combo > 1 && (
                <span className="text-xs font-extrabold text-rose-400 drop-shadow">COMBO x{p.combo}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div className="flex w-full max-w-[400px] items-center justify-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Blocks className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
          <span className="font-semibold text-rose-500">{blocks.length}</span>
          blok tersisa
        </span>
        <span className="h-3 w-px bg-border" />
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
          <span className="font-semibold text-rose-500">{linesCleared}</span>
          baris terungkap
        </span>
      </div>

      {/* ── Block Tray ────────────────────────────────────────── */}
      <div
        className={cn(
          "flex w-full max-w-[400px] items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-rose-300 bg-rose-100/50 p-4 dark:border-rose-700 dark:bg-rose-950/30",
          shakeBlocks && "animate-shake",
        )}
      >
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua blok terpasang! Tunggu...</p>
        ) : (
          blocks.map((block, index) => {
            const fits = canAnyShapeFit(grid, [block]);
            return (
              <div
                key={`${block.id}-${index}`}
                onPointerDown={(e) => onBlockPointerDown(e, block, index)}
                className={cn(
                  "relative cursor-grab rounded-lg border-2 bg-white p-1 shadow-sm transition-all hover:shadow-md active:cursor-grabbing dark:bg-rose-950/20",
                  fits
                    ? "border-rose-200 dark:border-rose-800/40"
                    : "border-red-400 dark:border-red-700",
                  draggedBlock === block && "opacity-40",
                )}
                style={{ touchAction: "none" }}
                title={fits ? undefined : "Blok ini tidak muat di papan"}
              >
                <BlockPreview
                  block={block}
                  photoUrl={photoUrl}
                  cellPx={TRAY_CELL}
                />
                {!fits && (
                  <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                    ✕
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Dragging ghost (follows pointer) ─────────────────── */}
      <AnimatePresence>
        {ghost && draggedBlock && (
          <motion.div
            className="pointer-events-none fixed z-50 rounded-lg shadow-2xl ring-2 ring-rose-300/70 dark:ring-rose-500/50"
            style={{ left: ghost.x, top: ghost.y }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.95 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <BlockPreview block={draggedBlock} photoUrl={photoUrl} cellPx={cell} imageDim={imageDim} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game Over Overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {phase === "gameOver" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/30">
                <Heart className="h-8 w-8 text-rose-400" aria-hidden="true" />
              </div>
              <h2 className="font-heading text-2xl font-bold">Game Over</h2>
              <p className="text-muted-foreground">
                Skor akhir: <span className="font-bold text-rose-500">{displayScore}</span>
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button onClick={startGame} className="gap-2">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Main Lagi
                </Button>
                {onExit && (
                  <Button variant="outline" onClick={onExit} className="gap-2">
                    Keluar
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Victory Overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {phase === "victory" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Trophy className="h-16 w-16 text-yellow-400" aria-hidden="true" />
              </motion.div>
              <h2 className="font-heading text-2xl font-bold text-rose-500">Selamat! 🎉</h2>
              <p className="text-muted-foreground">Kamu berhasil mengungkap seluruh foto!</p>
              <p className="text-lg">
                Skor akhir: <span className="font-bold text-rose-500">{displayScore}</span>
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button onClick={startGame} className="gap-2">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Main Lagi
                </Button>
                {onExit && (
                  <Button variant="outline" onClick={onExit} className="gap-2">
                    Keluar
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
