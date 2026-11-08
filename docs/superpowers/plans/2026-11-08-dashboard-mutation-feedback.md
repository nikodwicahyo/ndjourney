# Dashboard Mutation Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard create/update/delete operations give immediate user feedback (loading toast + pending spinner/disabled state), prevent double-operation race conditions, and settle to an info toast only after sync — consistent across all dashboard entities and layers.

**Architecture:** Central mutation-feedback toast helper (`toast.loading` keyed by id → settled via `toast.success`/`toast.error` on the same id) + TanStack Query mutation `isPending` as the single pending source where a mutation exists, plus handler-level pending guards. Local pending state retained only where no mutation object exists (settings/profile direct `api.put`).

**Tech Stack:** Next.js 16 (App Router) + React 19 + @tanstack/react-query v5 + sonner + Tailwind + vitest + testing-library.

**Spec:** none (bug-fix / UX improvement plan)

## Global Constraints

- Every dashboard create/update/delete/toggle action flows: `startMutationToast` → `mutateAsync` → settle success/error with same toast id.
- Pending source: TanStack `isPending` where mutation exists; local state only where it does not.
- Double-op prevention: handler-level `if (mutation.isPending) return;` guards + disabled buttons while pending.
- Write mutations never get retries enabled (TanStack default `retry: 0` stays).

## Review Focus

1. Any create/update/delete flow that still toasts success without a pre-settled loading toast.
2. Any action button enabled while its mutation is pending.
3. Toast id lifecycle: loading toast settled exactly once (success|error), no orphan loading toasts.
4. WishCard toggle using local `animating` instead of mutation pending.
5. Settings/profile saves without loading→settle toast.

---

## Task 1: Mutation feedback helper + tests

**Files:**
- Create: `lib/mutation-feedback.ts`
- Test: `tests/unit/mutation-feedback.test.tsx`

**Interfaces:**
- Consumes: sonner `toast` API (`toast.loading`, `toast.success`, `toast.error` with `{ id }`).
- Produces: `startMutationToast(message: string): string | number`, `settleMutationToast(id, type: "success" | "error", message: string): void`.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { startMutationToast, settleMutationToast } from "@/lib/mutation-feedback";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "t1"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("mutation feedback helper", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("starts a loading toast and returns its id", () => {
    expect(startMutationToast("Menyimpan...")).toBe("t1");
    expect(toast.loading).toHaveBeenCalledWith("Menyimpan...", expect.objectContaining({ duration: Infinity }));
  });

  it("settles the loading toast with success on success", () => {
    settleMutationToast("t1", "success", "Wish ditambahkan!");
    expect(toast.success).toHaveBeenCalledWith("Wish ditambahkan!", expect.objectContaining({ id: "t1" }));
  });

  it("settles the loading toast with error on failure", () => {
    settleMutationToast("t1", "error", "Gagal menambahkan wish");
    expect(toast.error).toHaveBeenCalledWith("Gagal menambahkan wish", expect.objectContaining({ id: "t1" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/mutation-feedback.test.tsx`
Expected: FAIL (module `@/lib/mutation-feedback` does not exist)

- [ ] **Step 3: Implement `lib/mutation-feedback.ts`**

```ts
import { toast } from "sonner";

const TOAST_DURATION = 4000;

export function startMutationToast(message: string): string | number {
  return toast.loading(message, { duration: Infinity });
}

export function settleMutationToast(id: string | number, type: "success" | "error", message: string): void {
  if (type === "error") {
    toast.error(message, { id, duration: TOAST_DURATION });
    return;
  }
  toast.success(message, { id, duration: TOAST_DURATION });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/mutation-feedback.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/mutation-feedback.ts tests/unit/mutation-feedback.test.tsx
git commit -m "feat: add mutation feedback toast helper (loading -> success/error)"
```

## Task 2: QueryProvider mutation retry pin + error handler consistency

**Files:**
- Modify: `components/QueryProvider.tsx`

- [ ] **Step 1: Update mutation defaults**

Add explicit `retry: 0` under `mutations` (keep global error handler for backstop).

- [ ] **Step 2: Verify** — typecheck

- [ ] **Step 3: Commit**

## Task 3: Wishlist mutations (create/update/delete/toggle) feedback + pending guards

**Files:**
- Modify: `components/wishlist/WishCard.tsx`
- Modify: `components/wishlist/WishForm.tsx`
- Modify: `hooks/useWishes.ts` (no change expected; keep invalidation)

- [ ] **Step 1: WishCard toggle** — use `toggleWish.isPending` instead of local `animating`.
- [ ] **Step 2: WishForm** — create/update: start/settle loading toast; delete: pending via `deleteWish.isPending`.

## Task 4: Notes feedback + pending guards

**Files:**
- Modify: `components/notes/NoteForm.tsx`
- Modify: `components/dashboard/NotesManager.tsx`

## Task 5: Timeline feedback + pending guards

**Files:**
- Modify: `components/timeline/AddMilestoneForm.tsx`
- Modify: `components/timeline/TimelineList.tsx`
- Modify: `components/dashboard/TimelineManager.tsx`
- Modify: `components/timeline/MilestoneCard.tsx` (pending on delete button)

## Task 6: Gallery mutations feedback

**Files:**
- Modify: `components/dashboard/GalleryManager.tsx`
- Modify: `components/gallery/AlbumMoveDropdown.tsx`

## Task 7: Albums + games question mutations feedback

**Files:**
- Modify: `components/dashboard/AlbumManager.tsx`
- Modify: `components/dashboard/GameManager.tsx`

## Task 8: Settings + profile save flows feedback

**Files:**
- Modify: `components/dashboard/SettingsForm.tsx`
- Modify: `components/dashboard/ProfileContent.tsx`

## Task 9: Letters mutations feedback

**Files:**
- Modify: `components/letters/NewLetterForm.tsx`
- Modify: `components/letters/LetterList.tsx`
- Modify: `components/letters/LetterViewer.tsx`

## Task 10: Consistency sweep, typecheck, full unit suite, final review

**Files:**
- Modify: all above as needed

- [ ] Final sweep: every dashboard create/update/delete/toggle op uses loading→settle; pending-gated buttons + handler guards.
- [ ] Run typecheck + unit tests.
- [ ] Final whole-branch review (fresh reviewer if subagent tool available; else self-review per executing-plans).
- [ ] Finish via superpowers:finishing-a-development-branch.
