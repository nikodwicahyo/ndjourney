# Make Letter Editor Toolbar Single Row on Mobile

## Problem
The toolbar in the letter editor (bold, italic, heading, lists, quote, undo, redo) wraps to multiple rows on mobile devices. The user wants it to stay in 1 row for mobile devices.

## Current Implementation
In `components/letters/LetterEditor.tsx` line 142:
```tsx
<div
  role="toolbar"
  aria-label="Format surat"
  className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted/40 p-1"
>
```

## Solution
Change from `flex-wrap` to `flex-nowrap` with horizontal scrolling on mobile/smaller screens.

## Changes Required
- Edit `components/letters/LetterEditor.tsx` line 142

## Implementation
```tsx
<div
  role="toolbar"
  aria-label="Format surat"
  className="flex flex-nowrap items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1 [-webkit-overflow-scrolling:touch]"
>
```

This keeps all buttons in one row with horizontal scroll on overflow. Add `[-webkit-overflow-scrolling:touch]` for smooth iOS scrolling.
