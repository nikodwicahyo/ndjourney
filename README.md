# NDjourney

> Tempat semua cerita kita tersimpan selamanya.  
> A private couple's web application for sharing memories, love letters, photos, milestones, and more.

Built for two. Powered by Next.js.

---

## ✨ Features

### 🏠 Home
- Hero section with parallax photo/video, typewriter couple names, and tagline
- Days-together countdown since anniversary
- Daily romantic quote of the day
- Birthday countdowns for both partners
- Love Meter — fun stats gauge based on photos, letters, milestones, wishes
- Memory of the Day — random photo from the gallery
- Bottle Letter — floating animated love note
- Click Hearts — floating hearts on tap/click
- Floating Spotify / background music player

### 🖼️ Gallery
- Photo & video upload to Cloudinary CDN
- Responsive masonry grid (2→3→4 columns)
- Albums, favorites, year/media-type filters
- Fullscreen lightbox with swipe gestures & keyboard navigation
- Cursor-based infinite pagination

### 📅 Love Timeline
- Vertical milestone timeline with alternating left/right cards
- Icons, color coding, photos, and location for each milestone
- Scroll-triggered fade-in animations

### 💌 Love Letters
- Rich text editor (Tiptap) with mood selector (love, grateful, missing, happy, apology, surprise)
- Time capsule support — schedule delivery with envelope unlock animation
- Email notification on send (via SMTP/Gmail)
- Inbox / Sent management

### 🎮 Games
- **Would You Rather** — A/B card pick with reveal animation
- **Trivia Quiz** — Multiple choice with timer
- **Spin the Wheel** — Canvas spinning wheel with date ideas + confetti
- **Truth or Dare** — Card flip with romantic truths/dares
- Score tracking and leaderboard

### 📝 Daily Love Notes
- Short daily notes (max 280 characters)
- Rate-limited to 1 per user per day
- History view grouped by date, color-coded by author

### 🎯 Wish List
- Shared couple wishlist with categories
- Progress bar and done marking
- Link and image support for each wish

### 📊 Dashboard
- Full CRUD management for all features
- Stats overview (photos, videos, letters, milestones, days)
- Quick actions grid
- Recent activity feed
- Settings (couple config, hero photo, Spotify URL)
- Profile editor (avatar, password)

### 📱 PWA
- Installable (standalone mode, portrait orientation)
- Offline support with custom service worker
- Cache-first for Cloudinary images
- Stale-while-revalidate for public API routes

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js](https://nextjs.org) 16 (App Router) |
| **UI Library** | [React](https://react.dev) 19, [TypeScript](https://www.typescriptlang.org) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) v4, [shadcn/ui](https://ui.shadcn.com), [Framer Motion](https://www.framer.com/motion) |
| **Icons** | [Lucide](https://lucide.dev) |
| **Auth** | [NextAuth.js](https://next-auth.js.org) v5 — Google OAuth + Credentials |
| **Database** | [Neon](https://neon.tech) Serverless PostgreSQL + [Prisma](https://www.prisma.io) ORM |
| **Media** | [Cloudinary](https://cloudinary.com) — upload, transform, CDN, blur placeholders |
| **Cache & Rate Limit** | [Upstash Redis](https://upstash.com) |
| **Email** | [Nodemailer](https://nodemailer.com) + SMTP (Gmail) — transactional emails, time capsule notifications |
| **Editor** | [Tiptap](https://tiptap.dev) — rich text for love letters |
| **Validation** | [Zod](https://zod.dev) — schema validation |
| **State** | [TanStack React Query](https://tanstack.com/query) (server), [Zustand](https://github.com/pmndrs/zustand) (client) |
| **Deployment** | [Vercel](https://vercel.com) — standalone output, serverless |

---

## ⚙️ Prerequisites

Before you begin, you'll need accounts for these services:

| Service | Required | Free Tier |
|---------|----------|-----------|
| [Neon](https://neon.tech) | Yes | Serverless Postgres |
| [Cloudinary](https://cloudinary.com) | Yes | 25 GB storage |
| [Google Cloud Console](https://console.cloud.google.com) | Yes | OAuth 2.0 credentials |
| [Upstash](https://upstash.com) | No | 10K req/day (optional: caching + rate limiting) |
| — | — | Email via SMTP (Gmail App Password or any provider) |

---

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url> couple-web
cd couple-web
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all required values — see [Environment Variables](#-environment-variables) below.

### 3. Set up the database

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Start development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Register accounts

1. Set `INVITE_TOKEN` in your `.env.local`
2. Visit `http://localhost:3000/invite/<YOUR_TOKEN>`
3. Register the first partner account
4. Register the second partner account (same link)
5. Change `INVITE_TOKEN` after both accounts are created

---

## 📁 Project Structure

```
app/
├── (auth)/           # Login, invite, auth-error pages
├── (public)/         # Public pages (home, gallery, timeline, letters, etc.)
├── (private)/        # Dashboard (auth required)
└── api/              # REST API routes (auth, photos, letters, milestones, games, etc.)

components/
├── auth/             # LoginForm, RegisterForm
├── dashboard/        # DashboardClient, SettingsForm, GalleryManager, etc.
├── games/            # WouldYouRather, TriviaQuiz, SpinTheWheel, TruthOrDare
├── home/             # HeroSection, CountdownTimer, GallerySlideshow, etc.
├── layout/           # Navbar, BottomNav, Sidebar, MusicPlayer
├── letters/          # NewLetterForm, LetterEditor, LetterViewer, EnvelopeAnimation
├── notes/            # NoteForm, NoteList
├── timeline/         # AddMilestoneForm, MilestoneCard, TimelineList
├── ui/               # shadcn/ui primitives (Button, Card, Dialog, Input, etc.)
└── wishlist/         # WishCard, WishForm, WishList, PublicWishList

hooks/                # Custom React hooks (usePhotos, useLetters, useGames, etc.)
lib/                  # Core utilities (auth, prisma, cloudinary, redis, validations, etc.)
prisma/               # Schema, migrations, seed
public/               # Static assets, PWA manifest, service worker
stores/               # Zustand store (useAppStore)
types/                # Shared TypeScript types
```

---

## 📄 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | — | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | — | `http://localhost:3000` (dev) or production URL |
| `GOOGLE_CLIENT_ID` | ✅ | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | — | Google OAuth client secret |
| `CLOUDINARY_CLOUD_NAME` | ✅ | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | — | Cloudinary API secret |
| `CLOUDINARY_STORAGE_LIMIT_BYTES` | ❌ | `26843545600` (25 GB) | Cloudinary storage limit |
| `UPSTASH_REDIS_REST_URL` | ❌ | — | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | — | Upstash Redis REST token |
| `SMTP_HOST` | ❌ | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | ❌ | `587` | SMTP server port |
| `SMTP_USER` | ❌ | — | SMTP username (Gmail email) |
| `SMTP_PASS` | ❌ | — | SMTP password (Gmail App Password) |
| `SMTP_FROM_EMAIL` | ❌ | — | Sender email address |
| `CRON_SECRET` | ✅ | — | Secret for Vercel Cron auth |
| `INVITE_TOKEN` | ✅ | — | Invite-only registration token |

> ✅ Required — app will not start without these.  
> ❌ Optional — falls back gracefully.

See [SETUP.md](./SETUP.md) for detailed setup instructions for each service.

---

## 🗄️ Database

NDjourney uses **Neon Serverless PostgreSQL** with **Prisma ORM**.

```bash
# Generate Prisma client
npm run db:generate

# Push schema (dev — syncs without migration files)
npm run db:push

# Create migration
npm run db:migrate

# Seed sample data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

Key models: `User`, `Couple`, `CoupleConfig`, `Photo`, `Album`, `Milestone`, `Letter`, `DailyNote`, `GameQuestion`, `GameScore`, `WishItem`.

---

## 📦 Deployment

This app is designed to deploy on **Vercel**.

```bash
# Build
npm run build

# Analyze bundle (optional)
ANALYZE=true npm run build

# Start production server
npm start
```

**On Vercel:**
1. Import your GitHub repo in the Vercel dashboard
2. Add all environment variables from `.env.example` (with real values)
3. Set **Cron Secret** to trigger `GET /api/cron/time-capsule` daily at 7:00 AM
4. Deploy — Vercel detects Next.js automatically

The app uses `output: "standalone"` for optimal serverless deployment.  
Security headers (CSP, HSTS, X-Frame-Options) are configured in `next.config.ts`.

---

## 📋 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run build:analyze` | Build with bundle analyzer |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create and run migration |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

---

## 📝 License

MIT — see [LICENSE](./LICENSE) for details.
Created By Niko Dwicahyo Widiyanto.
