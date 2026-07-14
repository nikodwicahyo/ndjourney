/**
 * Block Blast — Block Shape Definitions & Helpers
 *
 * Every shape is defined as a set of relative { row, col } offsets from its origin.
 * The grid is 8×8, each cell is 50px.
 */

export type CellCoord = { row: number; col: number };

export type BlockShape = {
  id: string;
  label: string;
  cells: CellCoord[];
  width: number;  // span in columns
  height: number; // span in rows
};

// ── Shape Library ─────────────────────────────────────────────────

const SHAPES: BlockShape[] = [
  // 1×1
  {
    id: "1x1",
    label: "⬜",
    cells: [{ row: 0, col: 0 }],
    width: 1,
    height: 1,
  },
  // 1×2 horizontal
  {
    id: "1x2",
    label: "⬜⬜",
    cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    width: 2,
    height: 1,
  },
  // 2×1 vertical
  {
    id: "2x1",
    label: "⬜\n⬜",
    cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }],
    width: 1,
    height: 2,
  },
  // 2×2 square
  {
    id: "2x2",
    label: "⬜⬜\n⬜⬜",
    cells: [
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ],
    width: 2,
    height: 2,
  },
  // L-shape (corner bottom-right)
  {
    id: "l-corner-br",
    label: "⬜.\n⬜⬜",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ],
    width: 2,
    height: 2,
  },
  // L-shape (corner bottom-left)
  {
    id: "l-corner-bl",
    label: ".⬜\n⬜⬜",
    cells: [
      { row: 0, col: 1 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ],
    width: 2,
    height: 2,
  },
  // L-shape (corner top-left)
  {
    id: "l-corner-tl",
    label: "⬜⬜\n⬜.",
    cells: [
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 0 },
    ],
    width: 2,
    height: 2,
  },
  // L-shape (corner top-right)
  {
    id: "l-corner-tr",
    label: "⬜⬜\n.⬜",
    cells: [
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 1 },
    ],
    width: 2,
    height: 2,
  },
  // 1×3 horizontal line
  {
    id: "1x3",
    label: "⬜⬜⬜",
    cells: [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
    ],
    width: 3,
    height: 1,
  },
  // 3×1 vertical line
  {
    id: "3x1",
    label: "⬜\n⬜\n⬜",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ],
    width: 1,
    height: 3,
  },
  // Z-shape
  {
    id: "z-shape",
    label: "⬜⬜.\n.⬜⬜",
    cells: [
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 1 }, { row: 1, col: 2 },
    ],
    width: 3,
    height: 2,
  },
  // T-shape
  {
    id: "t-shape",
    label: "⬜⬜⬜\n.⬜.",
    cells: [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 1 },
    ],
    width: 3,
    height: 2,
  },
];

// ── Public API ────────────────────────────────────────────────────

/**
 * Returns a clone of the full shape library.
 */
export function getAllShapes(): BlockShape[] {
  return SHAPES.map((s) => ({ ...s, cells: [...s.cells] }));
}

/**
 * Returns `count` random shapes from the library (no duplicates in one pick).
 */
export function getRandomShapes(count: number): BlockShape[] {
  const shuffled = [...SHAPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((s) => ({
    ...s,
    cells: [...s.cells],
  }));
}

/**
 * Given a block shape and a top-left anchor (row, col) on an 8×8 grid,
 * returns the absolute cell coordinates, or null if out of bounds.
 */
export function getAbsoluteCells(
  shape: BlockShape,
  anchorRow: number,
  anchorCol: number,
): CellCoord[] | null {
  const cells: CellCoord[] = [];
  for (const rel of shape.cells) {
    const r = anchorRow + rel.row;
    const c = anchorCol + rel.col;
    if (r < 0 || r >= 8 || c < 0 || c >= 8) return null;
    cells.push({ row: r, col: c });
  }
  return cells;
}

/**
 * Checks if all given absolute cells are empty in the grid.
 * Grid is a flat Boolean[] of length 64 (row-major).
 */
export function canPlace(
  grid: boolean[],
  cells: CellCoord[],
): boolean {
  for (const { row, col } of cells) {
    const idx = row * 8 + col;
    if (grid[idx]) return false;
  }
  return true;
}

/**
 * Places the block onto the grid by marking cells as filled.
 * Returns a new grid array.
 */
export function placeBlock(
  grid: boolean[],
  cells: CellCoord[],
): boolean[] {
  const next = [...grid];
  for (const { row, col } of cells) {
    next[row * 8 + col] = true;
  }
  return next;
}

/**
 * Checks if a row is completely filled.
 */
export function isRowFull(grid: boolean[], row: number): boolean {
  for (let c = 0; c < 8; c++) {
    if (!grid[row * 8 + c]) return false;
  }
  return true;
}

/**
 * Checks if a column is completely filled.
 */
export function isColFull(grid: boolean[], col: number): boolean {
  for (let r = 0; r < 8; r++) {
    if (!grid[r * 8 + col]) return false;
  }
  return true;
}

/**
 * Clears a full row (sets cells to false).
 */
export function clearRow(grid: boolean[], row: number): boolean[] {
  const next = [...grid];
  for (let c = 0; c < 8; c++) {
    next[row * 8 + c] = false;
  }
  return next;
}

/**
 * Clears a full column (sets cells to false).
 */
export function clearCol(grid: boolean[], col: number): boolean[] {
  const next = [...grid];
  for (let r = 0; r < 8; r++) {
    next[r * 8 + col] = false;
  }
  return next;
}

/**
 * Finds all full rows and columns, returns their indices.
 */
export function findFullLines(grid: boolean[]): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (isRowFull(grid, i)) rows.push(i);
    if (isColFull(grid, i)) cols.push(i);
  }
  return { rows, cols };
}

/**
 * Counts how many cells are filled.
 */
export function countFilled(grid: boolean[]): number {
  return grid.filter(Boolean).length;
}

/**
 * Counts how many cells have been revealed at least once (cumulative).
 * Used for the "reveal 100% of the photo" victory condition, which is
 * independent of whether those cells have since been cleared by a line blast.
 */
export function countRevealed(revealed: boolean[]): number {
  return revealed.filter(Boolean).length;
}

/**
 * Checks if any of the given shapes can still fit on the grid.
 * If none can, the game is over.
 */
export function canAnyShapeFit(
  grid: boolean[],
  shapes: BlockShape[],
): boolean {
  for (const shape of shapes) {
    for (let r = 0; r <= 8 - shape.height; r++) {
      for (let c = 0; c <= 8 - shape.width; c++) {
        const cells = getAbsoluteCells(shape, r, c);
        if (cells && canPlace(grid, cells)) return true;
      }
    }
  }
  return false;
}

/**
 * Returns a CSS background-position value for a grid cell at (col, row)
 * within a 400×400 image divided into 8×8 50px cells.
 */
export function cellBackgroundPosition(col: number, row: number): string {
  return `-${col * 50}px -${row * 50}px`;
}