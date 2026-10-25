import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { GALLERY_GRID_CLASSES, GALLERY_TILE_CLASSES } from "@/lib/utils";

// The gallery order bug was a drift bug: the grid used CSS multi-column (which
// flows DOWN each column), a JS transpose tried to compensate per device, and
// the skeletons spelled out their own columns — so the layers disagreed and the
// reading order changed with the viewport, the page count and the last upload.
// The invariant worth guarding is therefore structural: every layer renders the
// same grid and the same tile, and nothing reorders the photos.
const SURFACES = [
  "components/gallery/MasonryGrid.tsx",
  "components/dashboard/GalleryManager.tsx",
  "components/gallery/PhotoCard.tsx",
  "app/(private)/dashboard/gallery/page.tsx",
];

// Everything that lays out more than one tile; PhotoCard only owns the tile.
const GRID_SURFACES = SURFACES.filter((file) => !file.endsWith("PhotoCard.tsx"));

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf-8");
}

describe("gallery grid", () => {
  it("is a uniform square tile in a left-to-right CSS grid", () => {
    expect(GALLERY_GRID_CLASSES).toBe("grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4");
    expect(GALLERY_TILE_CLASSES).toBe("aspect-square w-full");
  });

  it.each(SURFACES)("%s has no multi-column or transposed layout left", (file) => {
    const src = source(file);
    expect(src).not.toContain("columns-");
    expect(src).not.toContain("break-inside");
    expect(src).not.toContain("toReadingOrder");
    expect(src).not.toContain("colCount");
  });

  it.each(SURFACES)("%s renders the shared square tile", (file) => {
    const src = source(file);
    expect(src).toContain("GALLERY_TILE_CLASSES");
    // A hand-rolled ratio here is exactly how the layers drifted apart.
    expect(src).not.toMatch(/aspect-\[/);
  });

  it.each(GRID_SURFACES)("%s renders the shared grid", (file) => {
    expect(source(file)).toContain("GALLERY_GRID_CLASSES");
  });

  it("maps photos in the order the API returned them", () => {
    const admin = source("components/dashboard/GalleryManager.tsx");
    expect(admin).toContain("photos.map((photo, index) =>");
    expect(admin).not.toContain("orderedPhotos");
  });
});
