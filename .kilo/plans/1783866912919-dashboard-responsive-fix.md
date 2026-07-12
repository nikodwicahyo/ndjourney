# Dashboard Responsive Layout Fix Plan

## Problem Analysis

The `/dashboard` and `/dashboard/settings` pages (and other dashboard sub-pages) are not responsive on small mobile and mobile devices because:

1. **StatsCards.tsx** - Uses `grid-cols-2` as base (no prefix), causing 2 columns even on very small screens (< 375px) where cards overflow
2. **QuickActions.tsx** - Uses `grid-cols-2` as base, same overflow issue
3. **GalleryManager.tsx** - Uses CSS `columns-2` as base which doesn't constrain properly on small screens
4. **SettingsForm.tsx** - Has `max-w-xl` but Settings page wrapper lacks responsive padding
5. **Settings page** - Plain `<div>` wrapper without responsive container padding
6. **Skeleton fallbacks** - Multiple pages use non-responsive grid/columns in loading states

## Files to Fix

### 1. `components/dashboard/StatsCards.tsx`
- Line 91: Skeleton grid - change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Line 104: Main grid - change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

### 2. `components/dashboard/QuickActions.tsx`
- Line 47: Change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5`

### 3. `components/dashboard/GalleryManager.tsx`
- Line 386: Skeleton fallback - change `columns-2` to `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (use grid instead of CSS columns)
- Line 398: Main media grid - change `columns-2` to `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

### 4. `components/dashboard/SettingsForm.tsx`
- Line 166: Form container - ensure responsive behavior within max-width constraint

### 5. `app/(private)/dashboard/settings/page.tsx`
- Lines 12-31: Add responsive container wrapper with proper padding matching layout

### 6. `app/(private)/dashboard/gallery/page.tsx`
- Line 24: Skeleton fallback - change `columns-2` to responsive grid

### 7. `app/(private)/dashboard/wishlist/page.tsx`
- Line 21: Skeleton fallback - already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` ✓ (good)

### 8. `components/dashboard/WishlistManager.tsx`
- Line 37: Skeleton - already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` ✓ (good)
- Line 143: Main grid - already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` ✓ (good)

## Breakpoint Strategy

Using Tailwind's default breakpoints:
- **Base (0px+)**: 1 column (small mobile: 320px-639px)
- **sm (640px+)**: 2 columns (mobile: 640px-767px)
- **md (768px+)**: 3 columns (tablet: 768px-1023px)
- **lg (1024px+)**: 4-5 columns (laptop: 1024px-1279px)
- **xl (1280px+)**: constrained by `max-w-7xl` in layout

## Validation Steps

1. Test on viewport widths: 320px, 375px, 480px, 640px, 768px, 1024px, 1280px, 1440px
2. Verify no horizontal overflow on any breakpoint
3. Verify StatsCards, QuickActions, Gallery grids stack properly
4. Verify Settings form fits within viewport on small mobile
5. Verify skeleton loaders match final layout