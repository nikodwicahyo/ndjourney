# 💕 Couple Web — Implementation Task List

> **Goal:** Build a complete, production-ready couple web app with all features from PRD.
> **Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Prisma (Neon), NextAuth v5, Cloudinary, Upstash Redis, Resend
> **Design:** Romantic, modern, responsive, PWA-enabled, dark mode, smooth animations

---

## Phase 0 — Project Foundation & Configuration

### 0.1 Initialize Project Structure
- [ ] Create directory structure (app/route groups, components/, lib/, hooks/, stores/, types/, prisma/)
- [ ] Update `tsconfig.json` with proper path aliases if needed
- [ ] Configure `next.config.js`:
  - Images (Cloudinary remote patterns)
  - Content Security Policy headers
  - PWA configuration with `next-pwa` (or `@serwist/next`)
  - Experimental features (optimize package imports)
- [ ] Set up `tailwind.config.ts` with:
  - Custom font families: `Playfair Display` (headings), `Inter` (body)
  - Default color palette (Rose `#F43F5E`, Blush `#FFF1F2`)
  - Dark mode via `class` strategy (next-themes)
  - Custom border radius, shadows, animation utilities
- [ ] Configure `postcss.config.mjs` for Tailwind v4
- [ ] Create `.env.example` from PRD Section 12
- [ ] Create `.env.local` with placeholder values for local dev

### 0.2 Prisma Schema & Database
- [ ] Write full Prisma schema (`prisma/schema.prisma`) based on PRD Section 6.1:
  - `User`, `Account`, `Session`, `VerificationToken` (NextAuth)
  - `CoupleConfig` (couple metadata)
  - `Photo`, `Album` (gallery with Cloudinary fields)
  - `Milestone`, `MilestonePhoto` (timeline)
  - `Letter` with `LetterMood` enum (love letters + time capsule)
  - `DailyNote` (daily love notes)
  - `GameQuestion`, `GameScore`, `GameType` enum (games)
  - `WishItem` (wish list)
  - All indexes, relations, and cascade deletes
- [ ] Configure Prisma generator output to `../lib/generated/prisma`
- [ ] Create `prisma/seed.ts`:
  - Sample quotes for "Quote of the Day"
  - Sample game questions for Would You Rather, Trivia
  - Sample truth/dare cards
  - Sample date ideas for Spin the Wheel
  - Default CoupleConfig placeholder
- [ ] Run `prisma generate` and `prisma db push` (or initial migration)
- [ ] Create Prisma client singleton (`lib/prisma.ts`)

### 0.3 Environment & Service Setup Guides
- [ ] Create SETUP.md with step-by-step guide to configure:
  - Neon PostgreSQL (connection string, SSL)
  - Cloudinary (unsigned upload preset for dev, signed for prod)
  - Google OAuth (console.cloud.google.com setup)
  - Upstash Redis (REST URL + token)
  - Resend (API key + domain verification)
- [ ] Add `vercel.json` with cron job config

---

## Phase 1 — Auth System & Core Layout

### 1.1 NextAuth v5 Setup
- [ ] Configure `lib/auth.ts`:
  - Google OAuth provider
  - Credentials provider (email + bcrypt password, fallback)
  - Prisma adapter (`@auth/prisma-adapter`)
  - JWT session strategy (30-day expiry)
  - Custom `signIn` callback (invite-only check)
  - Custom `jwt` and `session` callbacks (add role + couple info)
- [ ] Create API route: `app/api/auth/[...nextauth]/route.ts`
- [ ] Create API route: `app/api/auth/register/route.ts` (invite-only with token)
- [ ] Create invite page: `app/(auth)/invite/[token]/page.tsx`:
  - Register form (name, email, password)
  - Validates INVITE_TOKEN env var
  - After registration, redirects to login
- [ ] Create login page: `app/(auth)/login/page.tsx`:
  - Google OAuth button
  - Email/password form fallback
  - Cute romantic styling with couple branding

### 1.2 Auth Guard & Middleware
- [ ] Create `middleware.ts`:
  - Protect all `(private)/*` routes
  - Allow public routes: `/`, `/gallery`, `/timeline`, `/api/auth/*`, `/invite/*`, `/login`
  - Redirect unauthenticated users to `/login`
  - Redirect authenticated users away from `/login`
- [ ] Create `app/(private)/layout.tsx`:
  - Auth check wrapper
  - Fetch CoupleConfig and inject into layout context
  - Inject partner info for use across private pages

### 1.3 Root Layout & Global Styles
- [ ] Create `app/layout.tsx`:
  - Google Fonts (Playfair Display + Inter)
  - `ThemeProvider` from next-themes
  - `QueryClientProvider` from TanStack React Query
  - `Toaster` from sonner
  - PWA meta tags + manifest link
- [ ] Create `app/globals.css`:
  - Tailwind directives
  - CSS custom properties for theme colors (light + dark)
  - Base styles, scrollbar styling
  - Animation keyframes (fadeIn, slideUp, scaleIn, spin-wheel, envelope-flip)
  - Utility classes for romantic theme
- [ ] Create `types/index.ts`:
  - All shared TypeScript interfaces/types
  - Prisma-generated types re-exports
  - API response types
  - Component prop types

### 1.4 Core UI Components (shadcn/ui)
- [ ] Initialize shadcn/ui components:
  - `Button`, `Card`, `Dialog`, `Input`, `Label`, `Textarea`, `Toast`, `Avatar`, `Badge`, `Sheet` (mobile menu), `Tabs`, `Select`, `Separator`, `Skeleton`, `DropdownMenu`, `Popover`, `Calendar`, `Switch`, `Progress`, `Tooltip`
- [ ] Create custom UI components as needed:
  - `LoadingSpinner`, `EmptyState`, `ErrorState`, `ConfirmDialog`, `PageHeader`

### 1.5 Navigation Layout
- [ ] Create `components/layout/Navbar.tsx`:
  - Desktop: horizontal nav with logo + links + theme toggle + user avatar
  - Scroll behavior: shrink on scroll down, show on scroll up
  - Active link highlighting
  - Glassmorphism/blur background
- [ ] Create `components/layout/BottomNav.tsx`:
  - Mobile: bottom tab bar with icons
  - 5 main tabs: Home, Gallery, Timeline, Letters, Dashboard
  - Active state with animated indicator
- [ ] Create `components/layout/Sidebar.tsx`:
  - Desktop sidebar for dashboard/private section
  - Links: Dashboard, Letters, Games, Daily Note, Wish List, Settings
- [ ] Create `components/layout/MobileNav.tsx`:
  - Sheet/drawer from left for mobile secondary navigation
- [ ] Wire up navigation in `(public)` and `(private)` layouts

---

## Phase 2 — Home / Hero Page (F-01)

### 2.1 Hero Section
- [ ] Create `components/home/HeroSection.tsx`:
  - Full-width hero with gradient overlay
  - Couple photo from CoupleConfig (or default placeholder)
  - Large couple names with typewriter animation (Framer Motion)
  - Tagline display
  - Scroll-down indicator arrow
- [ ] Responsive: different height/opacity on mobile vs desktop

### 2.2 Countdown Timer
- [ ] Create `components/home/CountdownTimer.tsx`:
  - Displays "Hari ke-XXX bersama"
  - Calculated from `CoupleConfig.anniversaryDate`
  - Animated number transitions (Framer Motion)
  - Real-time update (not static)
- [ ] Create `hooks/useCountdown.ts`:
  - Returns days, hours, minutes, seconds since/until anniversary
  - Updates every second via `useInterval`

### 2.3 Quote of the Day
- [ ] Create seeded random quote selector (deterministic by date)
- [ ] Display quote with fade-in animation
- [ ] Quotes stored in seed data, fallback to hardcoded romantic quotes
- [ ] Optional: refresh button to get another quote for the day

### 2.4 Memory of the Day
- [ ] Create `components/home/MemoryOfDay.tsx`:
  - Fetch 1 random photo from gallery (seeded by date)
  - Display with caption and date taken
  - Framer Motion fade/slide animation on load
  - Fallback: "Belum ada kenangan" empty state
- [ ] Create `hooks/usePhotos.ts` wrapper with seeding logic
- [ ] Handle case: no photos yet → show cute illustration

### 2.5 Music Player (Spotify Embed)
- [ ] Create `components/home/MusicPlayer.tsx`:
  - Floating button bottom-right (desktop) / bottom-center (mobile)
  - Expandable mini-player with Spotify iframe
  - Plays playlist from `CoupleConfig.spotifyPlaylistUrl`
  - Collapsible with smooth animation
  - Persistent across page navigations (lift to layout level)

### 2.6 Navigation Cards
- [ ] Quick-link cards to Gallery, Timeline, Letters
- [ ] Each card: icon, label, subtle hover animation (scale + shadow)

### 2.7 Home Page Composition
- [ ] Wire all sections in `app/(public)/page.tsx`
- [ ] Lazy load below-fold sections (`MemoryOfDay`, `MusicPlayer`)
- [ ] Proper spacing and responsive stacking

---

## Phase 3 — Gallery (F-02)

### 3.1 API Routes — Gallery
- [ ] `app/api/upload/route.ts`:
  - Cloudinary signed upload (server-side)
  - Accept file, upload to Cloudinary, return URL + publicId
  - Rate limiting via Upstash Redis (max 20 uploads/hour/user)
  - Zod validation (file size, format)
- [ ] `app/api/photos/route.ts`:
  - GET: list photos with filters (albumId, year, isFavorite, page, limit)
  - POST: create photo record after upload
- [ ] `app/api/photos/[id]/route.ts`:
  - GET: single photo detail
  - PUT: update caption, album, isFavorite
  - DELETE: remove from Cloudinary + DB (cascade)
- [ ] `app/api/photos/bulk-upload/route.ts`:
  - Accept array of Cloudinary results
  - Batch insert into DB (max 10)
- [ ] `app/api/albums/route.ts`:
  - GET: list all albums
  - POST: create album
- [ ] `app/api/albums/[id]/route.ts`:
  - PUT: update album (name, description, cover)
  - DELETE: remove album (reassign or cascade photos)

### 3.2 Gallery State Management
- [ ] Create `hooks/usePhotos.ts`:
  - React Query hooks: `usePhotos`, `usePhoto`, `useAlbums`
  - Mutations: `useUploadPhoto`, `useUpdatePhoto`, `useDeletePhoto`, `useCreateAlbum`, `useUpdateAlbum`, `useDeleteAlbum`
  - Optimistic updates for favorite toggle, caption edit
  - Infinite scroll or pagination support
- [ ] Create `lib/validations/photo.ts`: Zod schemas for photo/album operations

### 3.3 Gallery UI
- [ ] Create `components/gallery/UploadButton.tsx`:
  - Drag & drop zone + click to upload
  - Progress bar for each file (smooth animation)
  - Preview thumbnails before upload
  - Max 10 files, file type/size validation
  - Upload to Cloudinary → save to DB flow
- [ ] Create `components/gallery/MasonryGrid.tsx`:
  - Responsive masonry layout with CSS columns
  - 2 cols mobile, 3 tablet, 4 desktop
  - Intersection Observer for lazy loading
  - Empty state when no photos
- [ ] Create `components/gallery/PhotoCard.tsx`:
  - Thumbnail with lazy loading (`loading="lazy"`)
  - Hover overlay: caption preview + favorite button
  - Favorite toggle (optimistic update + heart animation)
  - Click to open lightbox
  - Aspect ratio preservation from Cloudinary metadata
- [ ] Create `components/gallery/Lightbox.tsx`:
  - Fullscreen overlay
  - Swipe gestures (Swiper.js or custom touch handling)
  - Photo caption + metadata display
  - Close with Escape, click outside, or X button
  - Keyboard navigation (arrow keys)
  - Video play in lightbox if isVideo
  - Share button → copy URL
- [ ] Create `components/gallery/AlbumSelector.tsx`:
  - Filter dropdown/chips for albums
  - Year filter (extracted from photo dates)
  - Favorites filter toggle
  - Active filter badges

### 3.4 Video Support
- [ ] Video thumbnails with play icon overlay
- [ ] HTML5 video player in lightbox
- [ ] Cloudinary video transformation for optimized streaming

### 3.5 Gallery Page Layout
- [ ] Create `app/(public)/gallery/page.tsx`:
  - Header with title + upload button (if authenticated)
  - Filter bar
  - Masonry grid
  - Lightbox portal
  - Animated page transitions

---

## Phase 4 — Love Timeline (F-03)

### 4.1 API Routes — Timeline
- [ ] `app/api/milestones/route.ts`:
  - GET: list all milestones (ordered by date desc)
  - POST: create milestone with photos
- [ ] `app/api/milestones/[id]/route.ts`:
  - GET: milestone detail with photos
  - PUT: update milestone
  - DELETE: remove milestone + cascade relations
- [ ] Zod validation schemas in `lib/validations/milestone.ts`

### 4.2 Timeline State Management
- [ ] Create `hooks/useMilestones.ts`:
  - React Query: `useMilestones`, `useMilestone`
  - Mutations: `useCreateMilestone`, `useUpdateMilestone`, `useDeleteMilestone`

### 4.3 Timeline UI
- [ ] Create `components/timeline/TimelineList.tsx`:
  - Vertical timeline line (CSS pseudo-element)
  - Alternating left/right cards on desktop
  - Single column on mobile (all left)
  - Scroll-triggered stagger animation (Intersection Observer + Framer Motion)
  - Filter toggle: "Semua" / "Hanya foto"
- [ ] Create `components/timeline/MilestoneCard.tsx`:
  - Animated fade-in on scroll
  - Date display (formatted nicely, e.g. "14 Feb 2026")
  - Icon/emoji + color strip on left
  - Title, description
  - Photo thumbnails (clickable → open gallery lightbox)
  - Location with small map link
  - Edit/delete buttons (only for authenticated users)
  - Hover: subtle scale + shadow elevation
- [ ] Create `components/timeline/AddMilestoneForm.tsx`:
  - Dialog/modal form
  - Fields: title, date picker, description (textarea), location, icon/emoji picker, color picker
  - Photo selector: pick existing photos from gallery or upload new
  - Zod validation with error messages
  - Submit → optimistic add to timeline + refetch
  - Same form used for edit (pre-filled)

### 4.4 Timeline Page
- [ ] Create `app/(public)/timeline/page.tsx`:
  - "Add Milestone" FAB (desktop: top-right, mobile: bottom-right)
  - Timeline list
  - Empty state: "Belum ada milestone. Tambah kenangan pertama!"
  - Smooth page transition

---

## Phase 5 — Love Letters & Time Capsule (F-04)

### 5.1 API Routes — Letters
- [ ] `app/api/letters/route.ts`:
  - GET: list letters (query: `type=inbox|sent`) — only own letters
  - POST: create letter (author = current user, recipient determined)
- [ ] `app/api/letters/[id]/route.ts`:
  - GET: read letter (check unlock date for time capsules)
  - DELETE: soft or hard delete
- [ ] `app/api/letters/[id]/open/route.ts`:
  - PUT: mark as opened, record openedAt timestamp
  - Trigger email notification via Resend (if time capsule just unlocked)
- [ ] `app/api/cron/time-capsule/route.ts`:
  - Vercel Cron: daily check for time capsules to unlock
  - Query letters where `isTimeCapsule = true` AND `unlockAt <= now()` AND `isOpened = false`
  - Send Resend email notification to recipient
  - Return summary of unlocked letters
- [ ] Zod validation schemas in `lib/validations/letter.ts`

### 5.2 Email Integration
- [ ] Create `lib/resend.ts`:
  - Resend client singleton
  - Email templates: new letter notification, time capsule unlocked
  - Romantic email HTML templates
- [ ] Send emails on: new letter sent, time capsule unlocked

### 5.3 Letter State Management
- [ ] Create `hooks/useLetters.ts`:
  - React Query: `useLetters` (with type param), `useLetter`
  - Mutations: `useSendLetter`, `useOpenLetter`, `useDeleteLetter`

### 5.4 Letter Editor — Tiptap
- [ ] Create `components/letters/LetterEditor.tsx`:
  - Tiptap editor with extensions:
    - StarterKit (bold, italic, heading, bullet list, ordered list)
    - Emoji picker integration
    - Placeholder text: "Tulis surat untuk [nama pasangan]..."
  - Title input field
  - Mood selector: LOVE, GRATEFUL, MISSING, HAPPY, APOLOGY, SURPRISE
    - Each mood has an emoji + color
  - Time capsule toggle:
    - Switch on/off
    - Date picker for unlockAt (must be future date)
  - Preview mode before sending
  - Send button with confirmation

### 5.5 Envelope Animation
- [ ] Create `components/letters/EnvelopeAnimation.tsx`:
  - CSS-only envelope flip animation
  - States: closed (locked) → opening → open (reveal letter)
  - Shows letter title, mood, date, and "from [name]" on envelope front
  - Time capsule: shows lock icon + unlock date instead of content
  - Click/tap to open animation (Framer Motion for smoothness)
  - Responsive sizing

### 5.6 Time Capsule Lock
- [ ] Create `components/letters/TimeCapsuleLock.tsx`:
  - Visual indicator for locked letters
  - Shows countdown to unlock date
  - Lock icon overlay
  - Cannot open before date — shows "Terkunci hingga [date]"

### 5.7 Letter List & Inbox
- [ ] Create `components/letters/LetterCard.tsx`:
  - Preview card: title, mood emoji, date, author/recipient avatar, read/unread indicator
  - Time capsule badge if applicable
  - Click → navigate to letter detail
- [ ] Create `components/letters/LetterList.tsx`:
  - Tab switcher: Inbox / Sent / Time Capsules
  - List of LetterCards
  - Empty states for each tab
  - Pull-to-refresh on mobile

### 5.8 Letter Pages
- [ ] `app/(private)/letters/page.tsx`:
  - Inbox/Sent/Time Capsule tabs
  - "Tulis Surat" button → navigate to `/letters/new`
  - Letter list
- [ ] `app/(private)/letters/new/page.tsx`:
  - Full-page letter editor
  - Back navigation
  - Confirm send dialog
- [ ] `app/(private)/letters/[id]/page.tsx`:
  - Envelope animation on load
  - Letter content rendered (HTML from Tiptap)
  - Mood + metadata display
  - "Tandai sudah dibaca" for new letters
  - Delete button
  - Share romantic quote/animation on读完

---

## Phase 6 — Dashboard (F-06)

### 6.1 API Routes — Dashboard
- [ ] `app/api/couple/route.ts`:
  - GET: fetch CoupleConfig
  - PUT: update CoupleConfig (authenticated)
- [ ] `app/api/notes/route.ts`:
  - GET: list daily notes (query: date range)
  - POST: create daily note
- [ ] `app/api/wishes/route.ts`:
  - GET: list wish items
  - POST: create wish item
- [ ] `app/api/wishes/[id]/route.ts`:
  - PUT: update wish item (title, description, image, link, isDone, category)
  - DELETE: remove wish item
- [ ] Dashboard stats: aggregate queries for photos, milestones, letters, days together

### 6.2 Dashboard UI
- [ ] Create `components/dashboard/StatsCard.tsx`:
  - Animated counter numbers (Framer Motion)
  - Icons per stat (photo, heart, milestone, calendar)
  - Grid layout: 2 cols mobile, 4 cols desktop
- [ ] Create `components/dashboard/QuickActions.tsx`:
  - Action cards: Upload Foto, Tulis Surat, Tambah Milestone, Daily Note
  - Icon + label + subtle hover effect
  - Each navigates to relevant page or opens modal
- [ ] Create `components/dashboard/RecentActivity.tsx`:
  - Feed of recent actions (photos uploaded, letters sent, milestones added)
  - Each item: icon, description, relative time ("2 jam lalu")
  - Skeleton loading state
- [ ] Create `components/dashboard/DailyNoteWidget.tsx`:
  - Banner/reminder: "Kirim note ke [pasangan] hari ini?"
  - Quick input (max 280 chars) with character counter
  - Show today's note if already sent
  - History expandable per date

### 6.3 Dashboard Page
- [ ] `app/(private)/dashboard/page.tsx`:
  - Welcome header with couple names
  - Stats cards row
  - Quick actions grid
  - Recent activity feed
  - Daily note widget

### 6.4 Settings Page
- [ ] `app/(private)/dashboard/settings/page.tsx`:
  - **Couple Config:**
    - Edit couple names (name1, name2)
    - Edit anniversary date (date picker)
    - Edit tagline
    - Upload couple hero photo (Cloudinary)
    - Spotify playlist URL input
  - **Profile:**
    - Edit display name
    - Change avatar
    - Change password (if credential user)
  - **Invite:**
    - Show invite link
    - Regenerate invite token
  - Save button with confirmation toast
  - Form validation with Zod

### 6.5 Album Management
- [ ] Create album CRUD modal in dashboard
- [ ] List all albums with photo count
- [ ] Edit name, description, cover photo
- [ ] Delete album (with photo reassignment option)

### 6.6 Wish List Management
- [ ] Create `components/dashboard/WishListManager.tsx`:
  - Grid/list view of wish items
  - Add wish dialog: title, description, link, category selector, image upload
  - Edit/delete per item
  - Mark as done with date + optional photo
  - Category filter tabs: All / Date Ideas / Gifts / Travel / Other
  - Progress bar: "X of Y wishes fulfilled"

### 6.7 Game Management
- [ ] Created embedded game question admin in dashboard
- [ ] CRUD for Would You Rather questions, Trivia questions, Truth/Dare cards, Spin Wheel ideas
- [ ] Category management

---

## Phase 7 — Fun Games (F-05)

### 7.1 API Routes — Games
- [ ] `app/api/games/questions/route.ts`:
  - GET: list questions (query: type, category, random N)
  - POST: create custom question
- [ ] `app/api/games/questions/[id]/route.ts`:
  - PUT: update question
  - DELETE: delete question
- [ ] `app/api/games/score/route.ts`:
  - POST: save game score
- [ ] `app/api/games/leaderboard/route.ts`:
  - GET: leaderboard for both partners (aggregated scores)
- [ ] Zod schemas in `lib/validations/game.ts`

### 7.2 Game Hub Page
- [ ] `app/(private)/games/page.tsx`:
  - 4 game cards with illustrations/icons
  - Score summary / leaderboard preview
  - Smooth page transition

### 7.3 Would You Rather
- [ ] Create `components/games/WouldYouRather.tsx`:
  - Show random WYR question
  - Option A and Option B cards (tap to choose)
  - After both partners answer → reveal animation
  - Show who chose what with cute comparison
  - "Next Question" button
  - Track stats: categories answered, preferences
  - Add custom question button

### 7.4 Trivia — "Seberapa Kenal Kamu"
- [ ] Create `components/games/TriviaGame.tsx`:
  - Question card with multiple choice (A/B/C/D)
  - Timer per question (30 seconds)
  - Both partners answer independently
  - After both answer → reveal correct answer + scores
  - Show who answered correctly/wrongly
  - End screen with scores and winner crown animation
  - Question categories: Makanan, Film, Tempat, Random
  - Add custom trivia question flow

### 7.5 Spin the Wheel
- [ ] Create `components/games/SpinWheel.tsx`:
  - Canvas-based spinning wheel (or CSS with segments)
  - Segments: date ideas from DB + custom entries
  - Spin animation: `ease-out` deceleration (CSS keyframes or Framer Motion)
  - Needle indicator at top
  - Result popup with confetti animation
  - "Spin Again" button
  - Responsive: wheel size adapts to viewport
  - Add custom date idea

### 7.6 Truth or Dare
- [ ] Create `components/games/TruthOrDare.tsx`:
  - Deck of cards UI (stack with slight offset)
  - Draw: tap to flip card with CSS 3D flip animation
  - Truth or Dare selection screen first
  - Card flip reveal animation (Framer Motion)
  - Card content with romantic/ fun prompts
  - "Draw Again" button
  - Add custom card flow
  - Shuffle animation on new deck

### 7.7 Score Tracking
- [ ] Score persistence for Trivia
- [ ] Simple win/loss display per game
- [ ] All-time stats: total games played, accuracy (for trivia)

---

## Phase 8 — Daily Love Note (F-07)

### 8.1 API Routes — Daily Notes
- [ ] `app/api/notes/route.ts`:
  - GET: list notes (query: year, month, date — for history)
  - POST: create daily note (max 280 chars)
- [ ] Rate limit: 1 note per user per day

### 8.2 Daily Note UI
- [ ] Create DailyNotePrompt component (banner on dashboard + home):
  - Shows at most once per day
  - "Kirim note ke [pasangan] hari ini?"
  - Quick textarea with 280 char counter
  - Submit with heart animation
- [ ] Create DailyNoteHistory component:
  - Calendar view or scrollable list per month
  - Each note card: date, author, content
  - Color-coded by author
  - Empty state per date
- [ ] Daily note notification: email/ in-app banner when partner sends a note

### 8.3 Daily Note Page
- [ ] Integrate into dashboard main page
- [ ] Dedicated notes page for full history

---

## Phase 9 — Wish List (F-08)

### 9.1 API Routes — Wish List
- [ ] `app/api/wishes/route.ts`:
  - GET: list wishes (sorted: not done first, then by createdAt desc)
  - POST: create wish
- [ ] `app/api/wishes/[id]/route.ts`:
  - PUT: update (title, description, link, category, isDone, image)
  - DELETE: remove
- [ ] Zod schemas in `lib/validations/wish.ts`

### 9.2 Wish List UI
- [ ] Create WishListGrid component:
  - Grid layout: 2 cols mobile, 3 cols desktop
  - Category filter tabs
  - Progress header: "X/Y wishes fulfilled ❤️"
  - Each wish card: title, description, link button, category badge, done checkbox
  - Done animation: checkmark + sparkle
  - Image gallery for fulfilled wishes
- [ ] Create AddWishDialog:
  - Form: title, description, link, category select, image upload
  - Validation
- [ ] Empty state: "Belum ada wish list. Ayo tambah impian kalian!"

### 9.3 Wish List Page
- [ ] `app/(private)/dashboard/wishlist/page.tsx` (or in dashboard tab)
- [ ] Or integrate into dashboard directly

---

## Phase 10 — PWA Support (F-09)

### 10.1 PWA Configuration
- [ ] Create/update `public/manifest.json`:
  - Name: "Niko & Dzikria"
  - Short name: "ndjourney"
  - Theme color: rose pink
  - Background color: blush
  - Display: standalone
  - Icons: 192x192, 512x512 (generate from couple photo or default)
  - Start URL: /
- [ ] Generate PWA icons in `public/icons/`
- [ ] Add meta tags in root layout:
  - `apple-touch-icon`
  - `theme-color` meta tag
  - `mobile-web-app-capable`

### 10.2 Service Worker
- [ ] Install and configure `@serwist/next` (modern replacement for next-pwa):
  - Cache strategies: Stale-While-Revalidate for pages, Cache-First for static assets
  - Offline fallback page with cute message
  - Precaching of critical assets
- [ ] Register service worker in layout

### 10.3 Install Prompt
- [ ] Custom install button for browsers that support beforeinstallprompt
- [ ] Show install banner on mobile after 2 visits
- [ ] Track if already installed (display: standalone check)

### 10.4 Push Notifications (Optional)
- [ ] Web Push API setup
- [ ] Permission request with nice UI (not aggressive)
- [ ] Push notifications for: new daily note, time capsule unlocked, new letter

---

## Phase 11 — API Layer & State Management

### 11.1 Zustand Global Store
- [ ] Create `stores/useAppStore.ts`:
  - `coupleConfig` slice (current couple info, fetched once)
  - `user` slice (current user info, role)
  - `ui` slice (sidebar open, theme, modals)
  - Actions: `setCoupleConfig`, `setUser`, `toggleSidebar`, `openModal`, `closeModal`

### 11.2 React Query Configuration
- [ ] Configure `QueryClient` in root layout:
  - Default stale times (30s for lists, 5min for config)
  - Retry logic (3 retries, exponential backoff)
  - Error handling (global error toast)
- [ ] Create query key factory for consistency:
  - `['photos', filters]`, `['albums']`, `['milestones']`, `['letters', type]`, etc.

### 11.3 Generic API Helpers
- [ ] Create `lib/api-client.ts`:
  - `api.get<T>('/path')`, `api.post<T>('/path', body)`, etc.
  - Automatic auth token injection
  - Error response parsing
  - AbortController support

### 11.4 Rate Limiting
- [ ] Create `lib/redis.ts`:
  - Upstash Redis client singleton
  - Rate limit helper: `checkRateLimit(key, maxRequests, windowSec)`
  - Apply to: photo upload, note creation, letter sending

---

## Phase 12 — UI Polish & Animations

### 12.1 Page Transitions
- [ ] Framer Motion `AnimatePresence` in root layout
- [ ] Page-level: fade + slide-up (duration 0.3s, easeOut)
- [ ] Custom transition variants for each route group

### 12.2 Component Animations
- [ ] Card hover: scale(1.02) + shadow elevation (CSS transition)
- [ ] Photo upload: progress bar with smooth gradient animation
- [ ] Timeline scroll: stagger fade-in (Intersection Observer + Framer Motion)
- [ ] Letter open: envelope flip + unfold CSS animation
- [ ] Spin wheel: CSS @keyframes rotate with ease-out cubic-bezier
- [ ] Favorite toggle: heart beat/pop animation
- [ ] Counter numbers: count-up animation (Framer Motion useSpring)
- [ ] Like/love reactions: floating hearts

### 12.3 Dark Mode
- [ ] Theme toggle in navbar
- [ ] Complete dark mode color palette:
  - Background: slate-950 or rose-950 base
  - Cards: slate-900/rose-900
  - Text: rose-50/slate-50
  - Accent: rose-400
  - Borders: slate-800
- [ ] Smooth transition between themes (CSS transition on colors)

### 12.4 Loading States
- [ ] Skeleton components for:
  - Photo grid (shimmer placeholders)
  - Timeline (card outlines)
  - Letter list (card skeletons)
  - Dashboard stats (pulse placeholders)
- [ ] Full-page spinner for auth-protected route checks
- [ ] Button loading states (spinner + disabled)
- [ ] Image loading blur placeholder (low quality placeholder or blur hash)

### 12.5 Error Handling
- [ ] Error boundaries per route group
- [ ] API error toast notifications (sonner)
- [ ] Retry buttons on failed data fetch
- [ ] Graceful degradation when services are down
- [ ] 404 page with cute illustration
- [ ] 500 page with retry + contact message

### 12.6 Responsive Design
- [ ] Mobile-first approach for all components
- [ ] Tested breakpoints: 375px, 768px, 1024px, 1440px
- [ ] Bottom navigation on mobile, top navbar on desktop
- [ ] Sidebar on desktop for dashboard
- [ ] Touch-friendly targets (min 44px) for mobile
- [ ] Safe area insets for notched devices

---

## Phase 13 — Performance & Optimization

### 13.1 Image Optimization
- [ ] Cloudinary image transformations (optimized format, quality, size)
- [ ] Next.js `<Image>` component with Cloudinary remote patterns
- [ ] Lazy loading below-fold images (`loading="lazy"`)
- [ ] Responsive image sizes (srcSet via Cloudinary)
- [ ] Blur placeholder or low-quality previews

### 13.2 Code Splitting
- [ ] Dynamic imports for heavy components:
  - Tiptap editor
  - Lightbox
  - Swiper
  - Games (especially SpinWheel canvas)
  - MusicPlayer (Spotify iframe)
- [ ] Route group splitting (public vs private)
- [ ] Lazy load non-critical sections

### 13.3 Caching Strategy
- [ ] React Query stale times:
  - CoupleConfig: 5 min
  - Photo list: 30 sec
  - Albums: 1 min
  - Milestones: 1 min
  - Letters: 30 sec
  - Notes: 30 sec
  - Game questions: 5 min
- [ ] Upstash Redis caching for:
  - Quote of the day (cached per date)
  - Memory of the day (cached per date)
  - Dashboard stats (cached 1 min)
  - Rate limit counters

### 13.4 Bundle Optimization
- [ ] Analyze bundle with `@next/bundle-analyzer`
- [ ] Tree-shake unused icons from lucide-react
- [ ] Optimize font loading (swap strategy, preload)

### 13.5 Lighthouse Targets
- [ ] Performance > 90
- [ ] Accessibility > 95
- [ ] Best Practices > 90
- [ ] SEO > 90
- [ ] PWA > pass all checks

---

## Phase 14 — Security & Hardening

### 14.1 API Security
- [ ] All API routes check authentication (NextAuth getServerSession)
- [ ] Input validation with Zod on every endpoint
- [ ] Rate limiting on upload, auth, note creation
- [ ] CORS headers only for own domain
- [ ] CSRF protection via NextAuth

### 14.2 Content Security
- [ ] CSP headers in next.config.js:
  - Restrict script sources
  - Allow Cloudinary, Google Fonts, Resend
  - Report-only mode initially
- [ ] XSS prevention: sanitize all HTML content (especially Tiptap output)
- [ ] SQL injection: prevented by Prisma parameterized queries

### 14.3 File Upload Security
- [ ] Server-side file type validation (not just client-side)
- [ ] File size limits enforced server-side
- [ ] Cloudinary signed uploads (no unsigned preset in production)
- [ ] Scan for malware (Cloudinary has built-in moderation)

### 14.4 Environment & Secrets
- [ ] `.env.local` in `.gitignore`
- [ ] All secrets in Vercel Environment Variables (not in code)
- [ ] No console.log of sensitive data
- [ ] Regular dependency audits (`npm audit`)

---

## Phase 15 — Seed Data & Content

### 15.1 Seed Script Completion
- [ ] `prisma/seed.ts`:
  - Romantic quotes (50+ unique quotes in Indonesian/English mix)
  - Would You Rather questions (30+ couple-themed)
  - Trivia question templates (10+ per category)
  - Truth cards (20+ romantic truths)
  - Dare cards (20+ romantic dares)
  - Date ideas for spin wheel (20+ ideas)
  - Default CoupleConfig placeholder
  - Initial user (admin) creation script
- [ ] Add `"prisma": { "seed": "tsx prisma/seed.ts" }` to package.json

### 15.2 Default Assets
- [ ] Placeholder hero couple image (illustration or gradient)
- [ ] Empty state illustrations for each feature
- [ ] App logo (heart/ couple-themed SVG)
- [ ] PWA icons (generated from logo)
- [ ] Favicon (SVG)

---

## Phase 16 — Deployment & DevOps

### 16.1 Vercel Configuration
- [ ] `vercel.json`:
  - Cron job: `0 7 * * *` → `/api/cron/time-capsule`
  - Headers (CSP, security headers)
  - Redirects (HTTP → HTTPS)
- [ ] `next.config.js` Vercel-specific optimizations

### 16.2 CI/CD
- [ ] GitHub Actions workflow:
  - Lint on PR
  - Type check on PR
  - Build check on PR
  - Auto-deploy on main push (Vercel integration)

### 16.3 Monitoring
- [ ] Vercel Analytics setup (optional, free)
- [ ] Error logging (console + optional Sentry free tier)
- [ ] Uptime monitoring (optional, free services)

### 16.4 Production Checklist
- [ ] All environment variables set in Vercel
- [ ] Google OAuth redirect URIs updated for production
- [ ] Cloudinary signed upload configured
- [ ] Resend domain verified
- [ ] Neon production connection string (SSL required)
- [ ] `NEXTAUTH_URL` set to production URL
- [ ] `INVITE_TOKEN` set and shared with partner
- [ ] Custom domain DNS configured (optional)
- [ ] Lighthouse audit passed

---

## Implementation Order Summary

| Phase | Features | Priority | Est. Effort |
|-------|----------|----------|-------------|
| 0 | Project Foundation & Config | 🔴 P0 | 2 days |
| 1 | Auth System & Core Layout | 🔴 P0 | 3 days |
| 2 | Home / Hero Page | 🔴 P0 | 2 days |
| 3 | Gallery (Photo & Video) | 🔴 P0 | 4 days |
| 4 | Love Timeline | 🔴 P0 | 3 days |
| 5 | Love Letters & Time Capsule | 🔴 P0 | 4 days |
| 6 | Dashboard | 🔴 P0 | 3 days |
| 11 | API & State Management | 🔴 P0 | 1 day |
| 7 | Fun Games | 🟡 P1 | 5 days |
| 8 | Daily Love Note | 🟡 P1 | 2 days |
| 10 | PWA Support | 🟡 P1 | 2 days |
| 12 | UI Polish & Animations | 🟡 P1 | 3 days |
| 13 | Performance & Optimization | 🟡 P1 | 2 days |
| 14 | Security & Hardening | 🟡 P1 | 1 day |
| 9 | Wish List | 🟢 P2 | 1 day |
| 15 | Seed Data & Content | 🟢 P2 | 1 day |
| 16 | Deployment & DevOps | 🔴 P0 | 1 day |

**Total estimated effort:** ~40 days (8 weeks) — aligns with PRD milestones.

---

## Key Principles

1. **TypeScript strict mode** — no `any`, no unsafe assertions
2. **Server Components by default** — minimize client components
3. **Optimistic updates** — all toggles, favorites, daily notes
4. **Mobile-first responsive** — test at 375px before desktop
5. **Progressive enhancement** — works without JS (basic), better with JS
6. **Accessible** — proper ARIA labels, keyboard nav, focus management
7. **Consistent error handling** — sonner toasts, error boundaries, retry
8. **No secrets in code** — all via env vars, never committed
9. **PRD alignment** — every feature maps to PRD section
10. **Incremental delivery** — each phase is self-contained and testable
