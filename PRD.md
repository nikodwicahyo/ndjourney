# 💕 Couple Web — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-03-28  
**Author:** [Nama Kamu]  
**Pasangan:** [Nama Kamu] & [Nama Pasangan]

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Personas](#3-user-personas)
4. [Tech Stack (100% Free Tier)](#4-tech-stack-100-free-tier)
5. [System Architecture](#5-system-architecture)
6. [Database Schema](#6-database-schema)
7. [Feature Requirements](#7-feature-requirements)
8. [API Endpoints](#8-api-endpoints)
9. [UI/UX Guidelines](#9-uiux-guidelines)
10. [Authentication & Security](#10-authentication--security)
11. [File Structure](#11-file-structure)
12. [Environment Variables](#12-environment-variables)
13. [Deployment Guide (Vercel)](#13-deployment-guide-vercel)
14. [Milestones & Timeline](#14-milestones--timeline)
15. [Out of Scope](#15-out-of-scope)

---

## 1. Overview

### 1.1 Deskripsi Produk

**Couple Web** adalah aplikasi web privat & romantis yang dibangun khusus untuk dua orang pasangan. Web ini menjadi "rumah digital" yang menyimpan kenangan, cerita, surat cinta, foto, video, serta menyediakan mini-games seru untuk pasangan.

Web ini hanya bisa diakses penuh oleh dua akun (pasangan), namun memiliki tampilan publik yang bisa dibagikan ke orang lain sebagai showcase kenangan.

### 1.2 Tagline

> *"Tempat semua cerita kita tersimpan selamanya."*

### 1.3 Target Platform

- Web (desktop & mobile responsive)
- PWA (Progressive Web App) — bisa diinstall di homescreen

---

## 2. Goals & Success Metrics

### 2.1 Goals

| Goal | Deskripsi |
|------|-----------|
| Kenangan tersimpan | Semua foto, video, dan momen penting tersimpan rapi |
| Privat & aman | Hanya dua akun yang bisa edit/manage konten |
| Romantis & personal | Desain dan fitur yang terasa personal, bukan generic |
| Mudah digunakan | Pasangan bisa tambah konten sendiri tanpa technical skill |
| Gratis selamanya | Semua infrastruktur menggunakan free tier |

### 2.2 Success Metrics

- Semua fitur core berjalan tanpa bug di mobile & desktop
- Waktu loading halaman utama < 2 detik (Vercel CDN)
- Upload foto berhasil di koneksi 4G standar (< 10MB/foto)
- Kedua akun pasangan bisa login dan manage konten secara independen
- PWA bisa diinstall di Android & iOS

---

## 3. User Personas

### Persona A — "Pengelola" (kamu)
- Developer / tech-savvy
- Setup dan maintain project
- Akses penuh ke dashboard dan deploy

### Persona B — "Pasangan"
- Tidak harus paham teknologi
- Bisa upload foto, tulis surat, tambah milestone via UI yang simpel
- Akses sama besarnya dengan Persona A setelah login

### Persona C — "Pengunjung" (opsional)
- Teman/keluarga yang diberi link
- Hanya bisa lihat halaman publik (galeri, timeline, hero)
- Tidak bisa edit atau lihat surat privat

---

## 4. Tech Stack (100% Free Tier)

### 4.1 Frontend

| Teknologi | Versi | Kegunaan | Free? |
|-----------|-------|----------|-------|
| Next.js | 14 (App Router) | Framework utama, SSG + SSR | ✅ Open source |
| TypeScript | 5.x | Type safety | ✅ Open source |
| Tailwind CSS | 3.x | Styling utility-first | ✅ Open source |
| shadcn/ui | latest | Komponen UI siap pakai | ✅ Open source |
| Framer Motion | 11.x | Animasi halus | ✅ Open source |
| Zustand | 4.x | Client state management | ✅ Open source |
| React Query (TanStack) | 5.x | Server state + caching | ✅ Open source |
| Tiptap | 2.x | Rich text editor (surat) | ✅ Open source |
| Swiper.js | 11.x | Carousel/slider galeri | ✅ Open source |
| next-pwa | latest | PWA support | ✅ Open source |
| Lucide React | latest | Icon library | ✅ Open source |

### 4.2 Backend

| Teknologi | Kegunaan | Free? |
|-----------|----------|-------|
| Next.js API Routes | Serverless API endpoints | ✅ Bawaan Next.js |
| NextAuth.js v5 | Autentikasi (Google OAuth + Email) | ✅ Open source |
| Prisma ORM | Database access, migrations | ✅ Open source |
| Zod | Validasi input/schema | ✅ Open source |
| bcryptjs | Hash password | ✅ Open source |
| nodemailer | Kirim email notifikasi | ✅ Open source |

### 4.3 Database & Storage

| Layanan | Kegunaan | Free Tier |
|---------|----------|-----------|
| **Neon** (PostgreSQL) | Database utama | ✅ 512MB storage, 1 project |
| **Cloudinary** | Upload & serve foto + video | ✅ 25GB storage, 25GB bandwidth/bulan |
| **Upstash Redis** | Cache + rate limiting | ✅ 10.000 req/hari |

> **Alternatif DB:** Supabase (PostgreSQL, free 500MB). Keduanya sama-sama kompatibel dengan Prisma.

### 4.4 Deployment & DevOps

| Layanan | Kegunaan | Free Tier |
|---------|----------|-----------|
| **Vercel** | Hosting + CDN + deploy | ✅ Hobby plan, unlimited deploy |
| **GitHub** | Source control + CI/CD trigger | ✅ Public/private repo |
| **GitHub Actions** | Optional automated tests | ✅ 2.000 menit/bulan |
| **Resend** | Email transaksional (notifikasi surat) | ✅ 3.000 email/bulan |

### 4.5 Ringkasan Biaya

```
Total biaya per bulan: Rp 0 (selama dalam batas free tier)

Estimasi penggunaan:
- Storage foto: ~5GB/tahun (hemat dari 25GB free Cloudinary)
- Database: ~50MB (jauh dari 512MB free Neon)
- Bandwidth: dalam batas Vercel Hobby
- Email: < 100 email/bulan (jauh dari 3.000 free Resend)
```

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (Hosting)                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Next.js 14 App                       │  │
│  │                                                   │  │
│  │  ┌──────────────┐      ┌────────────────────┐    │  │
│  │  │  App Router  │      │   API Routes        │    │  │
│  │  │  (Frontend)  │ ───► │  /api/...          │    │  │
│  │  └──────────────┘      └────────┬───────────┘    │  │
│  │                                 │                 │  │
│  └─────────────────────────────────┼─────────────────┘  │
│                                    │                     │
└────────────────────────────────────┼─────────────────────┘
                                     │
              ┌──────────────────────┼───────────────────┐
              │                      │                   │
              ▼                      ▼                   ▼
    ┌─────────────────┐   ┌──────────────────┐  ┌──────────────┐
    │  Neon PostgreSQL│   │   Cloudinary     │  │Upstash Redis │
    │  (Database)     │   │   (Media CDN)    │  │  (Cache)     │
    └─────────────────┘   └──────────────────┘  └──────────────┘
              │
              ▼
    ┌─────────────────┐
    │  Resend (Email) │
    └─────────────────┘
```

---

## 6. Database Schema

### 6.1 Prisma Schema Lengkap

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // hashed, untuk credential login
  role          Role      @default(PARTNER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  photos        Photo[]
  letters       Letter[]  @relation("LetterAuthor")
  receivedLetters Letter[] @relation("LetterRecipient")
  milestones    Milestone[]
  dailyNotes    DailyNote[]
  gameScores    GameScore[]
}

enum Role {
  PARTNER
  ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─────────────────────────────────────────
// COUPLE CONFIG
// ─────────────────────────────────────────

model CoupleConfig {
  id             String   @id @default(cuid())
  name1          String   // nama pasangan 1
  name2          String   // nama pasangan 2
  anniversaryDate DateTime // tanggal jadian
  tagline        String?
  heroPhotoUrl   String?
  spotifyPlaylistUrl String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

// ─────────────────────────────────────────
// GALLERY
// ─────────────────────────────────────────

model Photo {
  id          String   @id @default(cuid())
  url         String   // Cloudinary URL
  publicId    String   // Cloudinary public_id (untuk delete)
  thumbnailUrl String?
  caption     String?
  takenAt     DateTime?
  width       Int?
  height      Int?
  isVideo     Boolean  @default(false)
  isFavorite  Boolean  @default(false)
  albumId     String?
  uploadedById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  album       Album?   @relation(fields: [albumId], references: [id])
  uploadedBy  User     @relation(fields: [uploadedById], references: [id])
  milestones  MilestonePhoto[]
}

model Album {
  id          String   @id @default(cuid())
  name        String
  description String?
  coverPhotoUrl String?
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  photos      Photo[]
}

// ─────────────────────────────────────────
// TIMELINE / MILESTONES
// ─────────────────────────────────────────

model Milestone {
  id          String   @id @default(cuid())
  title       String
  description String?  @db.Text
  date        DateTime
  icon        String?  // emoji atau icon name
  color       String?  // hex color untuk tampilan
  location    String?
  isPublic    Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy   User     @relation(fields: [createdById], references: [id])
  photos      MilestonePhoto[]
}

model MilestonePhoto {
  milestoneId String
  photoId     String

  milestone   Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  photo       Photo     @relation(fields: [photoId], references: [id], onDelete: Cascade)

  @@id([milestoneId, photoId])
}

// ─────────────────────────────────────────
// LOVE LETTERS
// ─────────────────────────────────────────

model Letter {
  id           String      @id @default(cuid())
  title        String
  content      String      @db.Text // HTML dari Tiptap
  authorId     String
  recipientId  String
  isTimeCapsule Boolean    @default(false)
  unlockAt     DateTime?   // null = langsung bisa dibaca
  isOpened     Boolean     @default(false)
  openedAt     DateTime?
  mood         LetterMood  @default(LOVE)
  isPublic     Boolean     @default(false)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  author       User        @relation("LetterAuthor", fields: [authorId], references: [id])
  recipient    User        @relation("LetterRecipient", fields: [recipientId], references: [id])
}

enum LetterMood {
  LOVE
  GRATEFUL
  MISSING
  HAPPY
  APOLOGY
  SURPRISE
}

// ─────────────────────────────────────────
// DAILY NOTES
// ─────────────────────────────────────────

model DailyNote {
  id        String   @id @default(cuid())
  content   String   @db.Text
  authorId  String
  date      DateTime @default(now())
  createdAt DateTime @default(now())

  author    User     @relation(fields: [authorId], references: [id])
}

// ─────────────────────────────────────────
// GAMES
// ─────────────────────────────────────────

model GameQuestion {
  id       String       @id @default(cuid())
  type     GameType
  question String       @db.Text
  optionA  String?
  optionB  String?
  answer   String?      // untuk trivia
  category String?
  createdAt DateTime    @default(now())

  scores   GameScore[]
}

model GameScore {
  id         String   @id @default(cuid())
  userId     String
  questionId String
  isCorrect  Boolean
  playedAt   DateTime @default(now())

  user       User         @relation(fields: [userId], references: [id])
  question   GameQuestion @relation(fields: [questionId], references: [id])
}

enum GameType {
  WOULD_YOU_RATHER
  TRIVIA
  SPIN_THE_WHEEL
  TRUTH_OR_DARE
}

// ─────────────────────────────────────────
// WISH LIST
// ─────────────────────────────────────────

model WishItem {
  id          String   @id @default(cuid())
  title       String
  description String?
  imageUrl    String?
  link        String?
  category    String?
  isDone      Boolean  @default(false)
  doneAt      DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 7. Feature Requirements

### 7.1 F-01: Home / Hero Page

**Priority:** P0 (Must Have)

| Komponen | Detail |
|----------|--------|
| Hero Section | Foto pasangan full-width dengan overlay gradient |
| Countdown | "Hari ke-XXX bersama" — dihitung dari `anniversaryDate` |
| Nama pasangan | Tampil besar, animasi typewriter |
| Quote of the day | Diambil dari daftar quotes, ganti setiap hari via seed |
| Memory of the day | 1 foto random dari galeri muncul tiap buka halaman |
| Musik mini player | Embed Spotify playlist (iframe), posisi pojok kanan bawah |
| Tombol navigasi | Menuju Gallery, Timeline, Letters |

**Acceptance Criteria:**
- [ ] Countdown akurat sampai hari
- [ ] Memory of the day berbeda tiap hari (menggunakan tanggal sebagai seed random)
- [ ] Halaman load < 2 detik di koneksi 4G
- [ ] Responsive di mobile (min 375px width)

---

### 7.2 F-02: Galeri Foto & Video

**Priority:** P0 (Must Have)

| Komponen | Detail |
|----------|--------|
| Grid Masonry | Layout masonry responsif, 2 col mobile / 3–4 col desktop |
| Album | Bisa buat album, pindah foto antar album |
| Filter | Filter by album, by tahun, by favorit |
| Upload | Drag & drop atau klik, max 10MB/foto, max 100MB/video |
| Lightbox | Fullscreen viewer, swipe antar foto, caption tampil |
| Video player | Native HTML5 video dengan Cloudinary URL |
| Favorit | Toggle bintang di setiap foto |
| Bulk upload | Upload multiple foto sekaligus (max 10 foto) |
| Delete | Soft delete + hapus dari Cloudinary |

**Upload Flow:**
```
User pilih file
  → Validasi (ukuran, format)
  → Upload ke Cloudinary via /api/upload
  → Cloudinary return URL + publicId
  → Simpan ke DB (Photo table)
  → Tampil di galeri
```

**Format yang didukung:**
- Foto: JPG, JPEG, PNG, WEBP, HEIC
- Video: MP4, MOV, WEBM (max 100MB)

**Acceptance Criteria:**
- [ ] Upload foto berhasil dan tampil dalam 5 detik
- [ ] Lightbox bisa swipe di mobile
- [ ] Video bisa diputar di mobile Safari
- [ ] Album bisa dibuat dan foto bisa dipindah

---

### 7.3 F-03: Love Timeline

**Priority:** P0 (Must Have)

| Komponen | Detail |
|----------|--------|
| Timeline vertikal | Card milestone berurutan dari awal hingga sekarang |
| Add milestone | Form: judul, tanggal, deskripsi, foto, lokasi, icon/emoji, warna |
| Edit & Delete | Pasangan bisa edit atau hapus milestone miliknya |
| Foto di milestone | Setiap milestone bisa attach beberapa foto dari galeri |
| Animasi scroll | Card muncul dengan animasi fade-in saat di-scroll ke bawah |
| Filter | Filter "hanya foto" / "semua" |

**Acceptance Criteria:**
- [ ] Milestone tampil berurutan berdasarkan tanggal
- [ ] Form tambah milestone bisa diakses dari mobile
- [ ] Foto milestone bisa diklik (buka lightbox)
- [ ] Animasi scroll tidak lag di mobile

---

### 7.4 F-04: Surat Cinta (Love Letters)

**Priority:** P0 (Must Have)

| Komponen | Detail |
|----------|--------|
| Tulis surat | Editor Tiptap: bold, italic, headings, emoji, list |
| Pilih penerima | Otomatis ke pasangan |
| Mood | Pilih mood: Cinta, Kangen, Terima kasih, Happy, Minta maaf, Kejutan |
| Time capsule | Toggle: "Buka di tanggal tertentu" — date picker |
| Animasi amplop | Surat tampil dalam animasi amplop yang dibuka |
| Notifikasi email | Kirim email via Resend saat surat dikirim / saat time capsule terbuka |
| List surat | Inbox: surat yang diterima. Sent: surat yang dikirim. |
| Tanda dibaca | Tandai surat sudah dibaca + catat waktu dibuka |

**Time Capsule Flow:**
```
Surat dibuat dengan unlockAt = tanggal masa depan
  → Penerima lihat amplop "terkunci" di inbox
  → Cron job harian cek surat yang sudah bisa dibuka
  → Kirim email notifikasi via Resend
  → Surat bisa dibuka
```

> Catatan: Gunakan Vercel Cron Jobs (gratis, 1 job/hari cukup)

**Acceptance Criteria:**
- [ ] Editor Tiptap bisa dipakai di mobile
- [ ] Time capsule tidak bisa dibuka sebelum tanggalnya
- [ ] Email notifikasi terkirim saat surat terbuka
- [ ] Animasi amplop berjalan smooth

---

### 7.5 F-05: Fun Games

**Priority:** P1 (Should Have)**

#### 5a. Would You Rather?
- Tampilkan pertanyaan "A atau B" random
- Kedua user pilih, lalu reveal pilihan masing-masing
- Buat pertanyaan custom sendiri

#### 5b. Trivia — Seberapa Kenal Kamu?
- Buat pertanyaan trivia tentang pasangan (isi sendiri)
- Contoh: "Apa makanan favorit aku?" → A / B / C / D
- Skor real-time, leaderboard dua orang

#### 5c. Spin the Wheel — Ide Kencan
- Wheel berisi ide kencan (bisa custom)
- Animasi putar yang smooth (canvas atau CSS)
- Contoh: "Nonton Netflix", "Makan di luar", "Masak bareng"

#### 5d. Truth or Dare Romantis
- Deck kartu Truth / Dare random
- Bisa tambah kartu sendiri
- Animasi flip kartu

**Acceptance Criteria:**
- [ ] Semua 4 game bisa dimainkan di mobile
- [ ] Spin wheel animasi smooth (> 30fps)
- [ ] Custom pertanyaan bisa ditambah dari UI

---

### 7.6 F-06: Dashboard (Private)

**Priority:** P0 (Must Have)

| Komponen | Detail |
|----------|--------|
| Overview stats | Jumlah foto, video, surat, milestone, hari bersama |
| Quick actions | Upload foto, tulis surat, tambah milestone |
| Recent activity | Feed aktivitas terbaru (foto diupload, surat dikirim, dll) |
| Settings | Edit profil, edit couple config (nama, tanggal jadian, tagline) |
| Manage Albums | CRUD album |
| Manage Games | Tambah/edit pertanyaan games |
| Manage Wish List | CRUD wish list |

---

### 7.7 F-07: Daily Love Note

**Priority:** P1 (Should Have)**

- Setiap hari muncul notifikasi kecil/banner: "Kirim note ke [nama pasangan] hari ini?"
- Note singkat (max 280 karakter, seperti tweet)
- Tampil di dashboard pasangan hari itu
- History note bisa dilihat per tanggal

---

### 7.8 F-08: Wish List

**Priority:** P2 (Nice to Have)**

- Daftar wish list bersama: aktivitas, hadiah, destinasi
- Bisa mark sebagai "done" + tambah foto kenangan
- Category: Date Ideas / Gifts / Travel / Other

---

### 7.9 F-09: PWA Support

**Priority:** P1 (Should Have)**

- Bisa diinstall di homescreen Android & iOS
- Offline mode: cache halaman yang sudah dikunjungi
- Push notification (opsional, Web Push API) untuk daily note & time capsule

---

## 8. API Endpoints

### 8.1 Auth
```
POST   /api/auth/[...nextauth]   # NextAuth handler
POST   /api/auth/register        # Registrasi akun (invite only)
```

### 8.2 Couple Config
```
GET    /api/couple               # Ambil config pasangan
PUT    /api/couple               # Update config (nama, tanggal, dll)
```

### 8.3 Gallery
```
GET    /api/photos               # List foto (query: albumId, year, isFavorite)
POST   /api/photos               # Upload foto baru
GET    /api/photos/:id           # Detail foto
PUT    /api/photos/:id           # Update caption, album, favorit
DELETE /api/photos/:id           # Hapus foto (+ hapus dari Cloudinary)
POST   /api/photos/bulk-upload   # Upload multiple foto

GET    /api/albums               # List semua album
POST   /api/albums               # Buat album baru
PUT    /api/albums/:id           # Update album
DELETE /api/albums/:id           # Hapus album
```

### 8.4 Timeline
```
GET    /api/milestones           # List semua milestone
POST   /api/milestones           # Tambah milestone
GET    /api/milestones/:id       # Detail milestone
PUT    /api/milestones/:id       # Update milestone
DELETE /api/milestones/:id       # Hapus milestone
```

### 8.5 Letters
```
GET    /api/letters              # List surat (query: type=inbox|sent)
POST   /api/letters              # Kirim surat baru
GET    /api/letters/:id          # Baca surat (cek unlock date)
PUT    /api/letters/:id/open     # Tandai dibaca
DELETE /api/letters/:id          # Hapus surat
```

### 8.6 Games
```
GET    /api/games/questions      # List pertanyaan (query: type)
POST   /api/games/questions      # Tambah pertanyaan custom
PUT    /api/games/questions/:id  # Edit pertanyaan
DELETE /api/games/questions/:id  # Hapus pertanyaan
POST   /api/games/score          # Simpan skor
GET    /api/games/leaderboard    # Leaderboard dua orang
```

### 8.7 Daily Notes
```
GET    /api/notes                # List notes (query: date)
POST   /api/notes                # Kirim daily note
```

### 8.8 Wish List
```
GET    /api/wishes               # List wish items
POST   /api/wishes               # Tambah wish
PUT    /api/wishes/:id           # Update (termasuk mark done)
DELETE /api/wishes/:id           # Hapus
```

### 8.9 Upload
```
POST   /api/upload               # Upload ke Cloudinary, return URL
DELETE /api/upload/:publicId     # Hapus dari Cloudinary
```

### 8.10 Cron Jobs (Vercel Cron)
```
GET    /api/cron/time-capsule    # Cek & unlock surat time capsule (daily)
```

---

## 9. UI/UX Guidelines

### 9.1 Design System

| Elemen | Spesifikasi |
|--------|-------------|
| Font utama | `Playfair Display` (serif, untuk heading romantis) |
| Font body | `Inter` (sans-serif, untuk body text) |
| Primary color | Warna bisa dikustomisasi via couple config |
| Default palette | Rose pink `#F43F5E` + Blush `#FFF1F2` |
| Dark mode | Otomatis via `prefers-color-scheme` |
| Border radius | `rounded-2xl` (16px) untuk card, `rounded-full` untuk avatar |
| Shadow | Subtle: `shadow-sm`, tidak ada shadow besar |

### 9.2 Animasi

- **Page transition:** Fade + slide-up via Framer Motion
- **Card hover:** Scale 1.02 + shadow naik
- **Photo upload:** Progress bar smooth
- **Timeline scroll:** Stagger fade-in (tiap card delay 100ms)
- **Letter open:** Amplop animasi CSS (flip + unfold)
- **Spin wheel:** CSS `@keyframes` rotate, ease-out saat berhenti

### 9.3 Responsive Breakpoints

```
Mobile:   375px – 768px   (1 kolom, navigation bottom tab)
Tablet:   768px – 1024px  (2 kolom)
Desktop:  1024px+         (sidebar + main content)
```

### 9.4 Loading States

- Skeleton loader untuk galeri foto
- Spinner untuk upload
- Optimistic update untuk toggle favorit & daily note
- Error toast untuk aksi yang gagal

---

## 10. Authentication & Security

### 10.1 Auth Strategy

- **Provider:** NextAuth.js v5
- **Method 1:** Google OAuth (direkomendasikan — tanpa password)
- **Method 2:** Email + Password (bcrypt hash, sebagai fallback)
- **Session:** JWT, expire 30 hari
- **Invite only:** Registrasi hanya bisa via link undangan khusus (`/invite/[token]`)

### 10.2 Access Control

| Route | Public | Partner (login) |
|-------|--------|-----------------|
| `/` | ✅ | ✅ |
| `/gallery` | ✅ (read only) | ✅ (full) |
| `/timeline` | ✅ (read only) | ✅ (full) |
| `/letters` | ❌ | ✅ |
| `/games` | ❌ | ✅ |
| `/dashboard` | ❌ | ✅ |
| `/api/*` | ❌ | ✅ |

### 10.3 Security Measures

- Rate limiting pada API upload via Upstash Redis (max 20 upload/jam per user)
- CSRF protection bawaan NextAuth
- Input sanitasi via Zod di semua endpoint
- Cloudinary signed upload (tidak expose API secret ke client)
- Environment variables tidak di-commit ke Git (`.env.local`)
- Content Security Policy headers via `next.config.js`

---

## 11. File Structure

```
couple-web/
├── app/
│   ├── (public)/                    # Route group — no auth required
│   │   ├── page.tsx                 # Home / Hero
│   │   ├── gallery/
│   │   │   └── page.tsx
│   │   └── timeline/
│   │       └── page.tsx
│   ├── (private)/                   # Route group — auth required
│   │   ├── layout.tsx               # Auth guard wrapper
│   │   ├── letters/
│   │   │   ├── page.tsx             # Inbox
│   │   │   ├── new/page.tsx         # Tulis surat
│   │   │   └── [id]/page.tsx        # Baca surat
│   │   ├── games/
│   │   │   └── page.tsx
│   │   └── dashboard/
│   │       ├── page.tsx
│   │       └── settings/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── couple/route.ts
│   │   ├── photos/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── bulk-upload/route.ts
│   │   ├── albums/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── milestones/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── letters/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── open/route.ts
│   │   ├── games/
│   │   │   ├── questions/route.ts
│   │   │   └── leaderboard/route.ts
│   │   ├── notes/route.ts
│   │   ├── wishes/route.ts
│   │   ├── upload/route.ts
│   │   └── cron/
│   │       └── time-capsule/route.ts
│   ├── layout.tsx                   # Root layout
│   └── globals.css
│
├── components/
│   ├── ui/                          # shadcn/ui components
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── BottomNav.tsx            # Mobile navigation
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── CountdownTimer.tsx
│   │   ├── MemoryOfDay.tsx
│   │   └── MusicPlayer.tsx
│   ├── gallery/
│   │   ├── MasonryGrid.tsx
│   │   ├── PhotoCard.tsx
│   │   ├── Lightbox.tsx
│   │   ├── UploadButton.tsx
│   │   └── AlbumSelector.tsx
│   ├── timeline/
│   │   ├── TimelineList.tsx
│   │   ├── MilestoneCard.tsx
│   │   └── AddMilestoneForm.tsx
│   ├── letters/
│   │   ├── LetterList.tsx
│   │   ├── LetterCard.tsx
│   │   ├── LetterEditor.tsx         # Tiptap wrapper
│   │   ├── EnvelopeAnimation.tsx
│   │   └── TimeCapsuleLock.tsx
│   ├── games/
│   │   ├── WouldYouRather.tsx
│   │   ├── TriviaGame.tsx
│   │   ├── SpinWheel.tsx
│   │   └── TruthOrDare.tsx
│   └── dashboard/
│       ├── StatsCard.tsx
│       ├── RecentActivity.tsx
│       └── QuickActions.tsx
│
├── lib/
│   ├── prisma.ts                    # Prisma client singleton
│   ├── auth.ts                      # NextAuth config
│   ├── cloudinary.ts                # Cloudinary helper
│   ├── redis.ts                     # Upstash Redis client
│   ├── resend.ts                    # Email helper
│   ├── validations/                 # Zod schemas
│   │   ├── photo.ts
│   │   ├── letter.ts
│   │   ├── milestone.ts
│   │   └── game.ts
│   └── utils.ts                     # Helper functions
│
├── hooks/
│   ├── useCountdown.ts
│   ├── usePhotos.ts
│   ├── useLetters.ts
│   └── useMilestones.ts
│
├── stores/
│   └── useAppStore.ts               # Zustand global store
│
├── types/
│   └── index.ts                     # Global TypeScript types
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                      # Seed data (quotes, sample games)
│
├── public/
│   ├── icons/                       # PWA icons
│   ├── manifest.json                # PWA manifest
│   └── sw.js                        # Service Worker
│
├── .env.local                       # Local env (tidak di-commit)
├── .env.example                     # Template env vars
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 12. Environment Variables

```bash
# .env.example

# ── DATABASE ──────────────────────────────────
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
# Neon: https://console.neon.tech
# Format: postgresql://[user]:[password]@[host]/[dbname]

# ── NEXTAUTH ──────────────────────────────────
NEXTAUTH_SECRET="generate-dengan-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
# Production: https://nama-kalian.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID="dari-console.cloud.google.com"
GOOGLE_CLIENT_SECRET="dari-console.cloud.google.com"

# ── CLOUDINARY ────────────────────────────────
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
# Daftar: https://cloudinary.com

# ── UPSTASH REDIS ─────────────────────────────
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
# Daftar: https://upstash.com

# ── RESEND (Email) ────────────────────────────
RESEND_API_KEY="re_xxxxxxxxxxxx"
RESEND_FROM_EMAIL="noreply@nama-kalian.com"
# Daftar: https://resend.com

# ── APP CONFIG ────────────────────────────────
INVITE_TOKEN="token-rahasia-untuk-registrasi"
# Buat sendiri, kasih ke pasangan untuk daftar
```

---

## 13. Deployment Guide (Vercel)

### Step 1 — Persiapan Repository

```bash
# 1. Buat project Next.js
npx create-next-app@latest couple-web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias "@/*"

cd couple-web

# 2. Install dependencies
npm install prisma @prisma/client
npm install next-auth@beta @auth/prisma-adapter
npm install @tanstack/react-query zustand
npm install framer-motion
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
npm install cloudinary
npm install @upstash/redis
npm install resend
npm install zod bcryptjs
npm install swiper
npm install -D @types/bcryptjs

# 3. Install shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card dialog input label textarea toast

# 4. Setup Prisma
npx prisma init
# Paste schema dari bagian 6.1
npx prisma generate
```

### Step 2 — Setup Neon Database

```bash
# 1. Daftar di https://neon.tech
# 2. Buat project baru
# 3. Copy connection string ke DATABASE_URL di .env.local
# 4. Jalankan migrasi
npx prisma migrate dev --name init
npx prisma db seed
```

### Step 3 — Setup Cloudinary

```
1. Daftar di https://cloudinary.com (gratis)
2. Dashboard → Settings → API Keys
3. Copy Cloud Name, API Key, API Secret ke .env.local
4. Settings → Upload → Upload Presets → Add unsigned preset
   (untuk dev; production gunakan signed upload)
```

### Step 4 — Setup Google OAuth

```
1. Buka https://console.cloud.google.com
2. Create Project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID
4. Authorized redirect URIs:
   - http://localhost:3000/api/auth/callback/google
   - https://nama-kalian.vercel.app/api/auth/callback/google
5. Copy Client ID & Secret ke .env.local
```

### Step 5 — Setup Upstash Redis

```
1. Daftar di https://upstash.com
2. Create Database → pilih region Asia (Singapore)
3. Copy REST URL & Token ke .env.local
```

### Step 6 — Setup Resend

```
1. Daftar di https://resend.com
2. API Keys → Create API Key
3. Domains → Add Domain (atau gunakan onboarding@resend.dev untuk testing)
4. Copy API Key ke .env.local
```

### Step 7 — Deploy ke Vercel

```bash
# 1. Push ke GitHub
git init
git add .
git commit -m "initial commit: couple web"
gh repo create couple-web --private
git push origin main

# 2. Import di Vercel
# Buka https://vercel.com/new
# Import repository dari GitHub
# Framework: Next.js (auto-detected)

# 3. Tambah Environment Variables di Vercel Dashboard
# Settings → Environment Variables → paste semua dari .env.example

# 4. Tambah Vercel Cron Job di vercel.json
```

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/time-capsule",
      "schedule": "0 7 * * *"
    }
  ]
}
```

```bash
# 5. Deploy
git push origin main
# Vercel otomatis build & deploy setiap push ke main
```

### Step 8 — Setup Custom Domain (Opsional)

```
1. Vercel → Project → Settings → Domains
2. Tambah domain kamu (contoh: untuk-namapasangan.com)
3. Update DNS di domain registrar kamu
4. Update NEXTAUTH_URL di Vercel env vars ke domain baru
5. Update Google OAuth redirect URI dengan domain baru
```

### Step 9 — Registrasi Akun Pasangan

```
1. Kamu daftar dulu di /invite/[INVITE_TOKEN]
2. Kasih link yang sama ke pasangan
3. Setelah dua akun dibuat, set INVITE_TOKEN baru atau disable endpoint
```

---

## 14. Milestones & Timeline

### Phase 1 — Foundation (Minggu 1–2)
- [x] Setup project Next.js + Tailwind + shadcn
- [ ] Setup database Neon + Prisma schema + migrasi
- [ ] Setup NextAuth (Google OAuth)
- [ ] Setup Cloudinary
- [ ] Layout dasar (Navbar, Footer, auth guard)
- [ ] Deploy pertama ke Vercel

### Phase 2 — Core Features (Minggu 3–5)
- [ ] F-01: Home / Hero page
- [ ] F-02: Galeri foto (upload, grid, lightbox)
- [ ] F-03: Timeline milestones
- [ ] F-04: Love letters + time capsule
- [ ] Dashboard dasar

### Phase 3 — Fun Features (Minggu 6–7)
- [ ] F-05: Games (Would You Rather, Trivia, Spin Wheel, T&D)
- [ ] F-07: Daily love note
- [ ] F-08: Wish list

### Phase 4 — Polish (Minggu 8)
- [ ] F-09: PWA (manifest, service worker, install prompt)
- [ ] Animasi & transisi semua halaman
- [ ] Loading states & error handling
- [ ] Performance audit (Lighthouse > 90)
- [ ] Testing di berbagai device
- [ ] Custom domain setup

---

## 15. Out of Scope

Fitur-fitur berikut **tidak** akan dibangun di v1.0:

- ❌ Real-time chat / messaging (butuh WebSocket, keluar dari serverless)
- ❌ Video call
- ❌ Fitur sosial (komentar dari orang lain, likes)
- ❌ Multiple pasangan / grup
- ❌ Mobile app native (React Native)
- ❌ AI features (caption otomatis, dll) — bisa jadi v2.0
- ❌ Backup otomatis ke Google Photos / Drive
- ❌ Print / cerita foto fisik integration

---

## Appendix — Useful Links

| Resource | URL |
|----------|-----|
| Neon (PostgreSQL) | https://neon.tech |
| Cloudinary | https://cloudinary.com |
| Upstash Redis | https://upstash.com |
| Resend (Email) | https://resend.com |
| Vercel | https://vercel.com |
| NextAuth.js v5 | https://authjs.dev |
| Prisma Docs | https://prisma.io/docs |
| shadcn/ui | https://ui.shadcn.com |
| Framer Motion | https://framer.com/motion |
| Tiptap Editor | https://tiptap.dev |
| Cloudinary Next.js | https://cloudinary.com/documentation/nextjs_integration |

---

*Dibuat dengan cinta 💕 — versi 1.0.0*
