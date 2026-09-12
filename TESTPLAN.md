# TESTPLAN — Couple Web

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-09-12
**Scope referensi:** `PRD.md` v1.0.0, schema `prisma/schema.prisma`, routes `app/api/**/route.ts`, guard `proxy.ts`
**Stack aktual:** Next.js 16.2.2 (App Router), React 19, TypeScript 5, Tailwind 4, NextAuth v5-beta (Google + Credentials), Prisma 7 + Neon Postgres, Cloudinary, Upstash Redis, Pusher, SMTP/Nodemailer, Zod, Zustand, TanStack Query 5, Tiptap 3, Leaflet

---

## 1. Executive Summary & Scope

### 1.1 Tujuan pengujian

1. Menjamin semua fitur P0 berjalan tanpa bug kritis di mobile (min 375px) dan desktop.
2. Menjamin privasi: hanya 2 akun `PARTNER` yang bisa tulis; publik hanya read-only di route yang diizinkan.
3. Menjamin integritas data: upload media, surat time-capsule, milestone, location, dan skor game tidak bocor antar-couple dan tidak bisa dibuka sebelum waktunya.
4. Menjamin ketahanan: validasi Zod, rate-limit Redis, magic-bytes upload, CSP, dan cron time-capsule berjalan sesuai kontrak.
5. Menyediakan regression suite yang bisa jalan di CI < 10 menit dan bisa diulang secara deterministik.

### 1.2 In-scope (berdasarkan implementasi aktual)

| Area | Cakupan konkret |
|------|-----------------|
| Auth & akses | Google OAuth + Credentials (bcryptjs), invite-token (`/invite`, cookie `invite_token`), kuota max 2 PARTNER, `ensureCouple()` idempotent, session DB + cache Redis 30 mnt + invalidasi, guard `proxy.ts` (`isPublicPath`/`isAuthPath`), redirect `/login?callbackUrl=&reason=` |
| Home / Hero | Countdown dari `anniversaryDate`, memory-of-day, quote harian, Spotify embed, navigasi Gallery/Timeline/Letters |
| Gallery | Masonry grid, album CRUD, filter album/tahun/favorit, upload single/bulk (10MB/foto, 100MB/video; JPG/JPEG/PNG/WEBP/HEIC; MP4/MOV/WEBM), lightbox + swipe, favorit toggle, soft-delete + hapus Cloudinary |
| Timeline | CRUD milestone (judul/tanggal/deskripsi/foto/lokasi/icon/warna), attach foto galeri via `MilestonePhoto`, urut tanggal, filter, animasi scroll |
| Letters | Tiptap (bold/italic/headings/list/emoji), mood 6 enum, inbox/sent, amplop animasi, `isOpened/openedAt`, time-capsule `unlockAt` + cron `GET /api/cron/time-capsule` + notifikasi email SMTP |
| Games | `WOULD_YOU_RATHER, TRIVIA, SPIN_THE_WHEEL, TRUTH_OR_DARE, SLIDING_PUZZLE, MEMORY_BLOCK_BLAST`; CRUD `GameQuestion`, `POST /api/games/score`, arcade-score, leaderboard |
| Daily Notes | Max 280 karakter, 1 banner/hari, history per tanggal (`date @db.Date`), `GET/POST /api/notes`, `PUT/DELETE /api/notes/[id]` |
| Wish List | CRUD + kategori (Date Ideas/Gifts/Travel/Other) + mark done + `doneAt`, publik + dashboard |
| Location | `POST/GET /api/location`, `POST /api/location/share`, `GET /api/location/history`, `GET /api/location/heart`; consent `isSharing`, GPS accuracy/heading/speed, Leaflet + OpenStreetMap tiles, Pusher realtime |
| Dashboard | Stats (`/api/dashboard/stats`), activity feed (`/api/dashboard/activity`), quick actions, settings couple-config, profile, storage usage (`/api/storage/usage`) |
| Upload pipeline | `POST /api/upload`, `/api/upload/sign` (signed), `/api/upload/server`, `/api/upload/bulk`, `DELETE /api/upload/[publicId]`; validasi `upload-policy.ts` + `upload-magic.ts`, rate-limit 50/jam |
| PWA & shell | `manifest.json`, `sw.js`, install prompt, offline cache halaman visited, `VersionCheck`, error/loading/not-found boundaries |
| Security headers | CSP (`lib/csp.ts` == `vercel.json`), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (geolocation=self saja) |

### 1.3 Out-of-scope

Mirror `PRD.md §15` + batasan eksplisit:

- Real-time chat/messaging di luar Pusher-sync yang sudah ada, video call, komentar/like sosial, multi-pasangan/grup, native mobile app, AI caption, backup otomatis Google Photos/Drive, print fisik.
- Load test skala besar (>100 concurrent) dan chaos test infra Neon/Cloudinary/Upstash — hanya smoke rate-limit 429.
- Audit penetrasi penuh pihak ketiga; hanya security-guards regression.
- Migrasi data legacy dan test billing Vercel/Cloudinary paid-tier.

### 1.4 Tech stack testing yang direkomendasikan

| Lapisan | Pilihan | Alasan |
|---------|---------|--------|
| Unit + Integration | **Vitest** (`vitest`, `@vitest/coverage-v8`) | ESM/TSX native, kompatibel Jest API (`describe/it/expect/vi`), `vitest run --coverage` dengan provider `v8` (terverifikasi Context7 `/vitest-dev/vitest`). Migrasi mulus dari `node:test` yang dipakai sekarang. |
| E2E | **Playwright** (`@playwright/test`) | Chromium/Firefox/WebKit satu API, auto-wait, `storageState` per-role, mobile emulation 375px, trace/video on-failure (terverifikasi Context7 `/microsoft/playwright`). |
| API mock eksternal | `msw` (Mock Service Worker) | Mock Cloudinary, Pusher, SMTP, Nominatim tanpa sentuh free-tier quota. |
| DB integration | Neon branch ephemeral + `prisma db push` + `prisma/seed.ts` | Isolasi per-run CI; teardown deterministik. |
| Alternatif ditolak | Jest | Lebih lambat, transform SWC tambahan; Vitest cukup karena repo sudah ESM + `tsx`. Cypress | WebKit/Firefox setup lebih berat; Playwright lebih cocok untuk PWA + multi-browser matrix. |

> Status implementasi (2026-09-12): suite terimplementasi — `tests/unit` 12 file/72 test, `tests/integration` 10 file/65 test (semua 41 route API tercover via mock seam), `tests/e2e` 10 file/61 test (chromium/mobile/firefox, ter-list valid; eksekusi live butuh dev server + DB, jalan di CI). Total `npx vitest run`: 22 file/137 test hijau, legacy `node:test` 16 test hijau, `tsc` bersih.

---

## 2. Testing Architecture & Strategy

### 2.1 Unit Testing

**Target:** `lib/*`, `lib/validations/*`, `hooks/*`, `stores/*`, util murni (`date.ts`, `geo.ts`, `format.ts`, `love-meter.ts`, `quotes.ts`, `cloudinary-urls.ts`, `upload-magic.ts`, `upload-policy.ts`, `api-body.ts`, `csp.ts`).

**Aturan isolasi:**

1. Fungsi murni: tanpa mock, assert langsung (contoh: countdown hari dari `anniversaryDate`, seed harian memory-of-day, haversine `geo.ts`, `escapeHtml` di `resend.ts`).
2. Boundary I/O (`prisma`, `redis`, `pusher-server`, `cloudinary`, `nodemailer`) **wajib** di-mock via `vi.mock()`. Dilarang akses jaringan/DB di unit test.
3. Mocking hanya di seam: `lib/prisma.ts`, `lib/redis.ts` (`getCached/setCached/checkRateLimit`), `lib/cloudinary.ts`, `lib/resend.ts`, `lib/auth.ts` (`auth()`).
4. Zod schema: uji tiap `lib/validations/*.ts` dengan tabel valid/invalid (lihat SEC matrix).
5. Hooks/stores (`useCountdown`, `usePhotos`, `useAppStore`): uji via `@testing-library/react` + `renderHook`, server-state via mock `api-fetch.ts`, bukan fetch asli.
6. Upload security: `checkMagicBytes` (PNG/JPEG/WEBP/MP4 header vs spoof GIF/HTML/SVG), `validateUploadRequest` (MIME + ekstensi + cap ukuran).

**Contoh pola (Vitest):**

```ts
// tests/unit/upload-policy.test.ts
import { describe, it, expect } from "vitest";
import { validateUploadRequest } from "@/lib/upload-policy";

describe("validateUploadRequest", () => {
  it("rejects svg/html", () => {
    expect(validateUploadRequest({ fileName: "x.svg", fileType: "image/svg+xml", fileSize: 100 }).valid).toBe(false);
  });
  it("allows jpg within cap", () => {
    expect(validateUploadRequest({ fileName: "a.jpg", fileType: "image/jpeg", fileSize: 1024 }).valid).toBe(true);
  });
});
```

### 2.2 Integration Testing

**Target:** semua `app/api/**/route.ts` + Prisma + Redis (test) + Zod + auth guard.

**Strategi:**

1. Runner Vitest dengan `TEST_DATABASE_URL` (Neon branch) + `REDIS_URL` test-namespace `test:*`. Setup file membuat 2 user PARTNER + 1 couple + invite token fixture; teardown hapus urutan anak→induk.
2. Tiap endpoint diuji matriks: `200/201 happy` → `400 Zod invalid` → `401 tanpa session` → `403 bukan pemilik / bukan anggota couple` → `404 id asing` → `429 rate-limit` (mock `checkRateLimit` agar deterministik, plus 1 test asli Redis).
3. Kontrak penting:
   - `POST /api/auth/register`: butuh `INVITE_TOKEN` valid; user ke-3 ditolak (`quota_full`); email duplikat ditolak; password <12 ditolak; hash bcrypt tersimpan bukan plaintext.
   - `GET /api/photos?albumId=&year=&isFavorite=`: filter kombinasi + pagination + hanya foto milik couple (atau publik sesuai kebijakan).
   - `DELETE /api/photos/[id]`: hapus DB + panggil Cloudinary destroy dengan `publicId` benar; id milik couple lain → 403/404 tanpa panggil Cloudinary.
   - `GET /api/letters/[id]`: time-capsule dengan `unlockAt > now` → 403 terkunci untuk recipient sekalipun; setelah `unlockAt <= now` → 200 + `PUT .../open` set `isOpened/openedAt` idempotent.
   - `GET /api/cron/time-capsule`: butuh header `Authorization: Bearer CRON_SECRET`; tanpa secret → 401; membuka batch yang jatuh tempo + set `notificationSentAt` + kirim email (mock SMTP).
   - `POST /api/location` + `/share`: tanpa `isSharing=true` → lokasi tidak dibagikan ke pasangan; history tercatat terpisah dari posisi terkini.
   - `POST /api/games/score`: unique `[userId, questionId]` → submit ganda tidak duplikat skor (upsert/409 sesuai implementasi); leaderboard agregat 2 pemain benar.
4. State management: uji `query-keys.ts` + invalidasi TanStack Query setelah mutasi (upload → gallery list refresh; kirim surat → inbox recipient refresh via Pusher mock).
5. Pusher: mock `pusher-server.ts` trigger; assert channel/event payload tanpa koneksi asli.

### 2.3 E2E Testing (Playwright)

**Prinsip:** browser asli, DB seed fresh per worker, auth via `storageState` (pola resmi Playwright: `auth.setup.ts` → `playwright/.auth/partner-a.json`, `partner-b.json`).

**Critical user journeys (wajib hijau):**

1. `invite → register A → register B → login → dashboard stats muncul`.
2. `upload foto (dashboard) → muncul di /gallery → toggle favorit → filter favorit → buka lightbox → hapus`.
3. `buat album → pindah foto antar album → album publik terlihat tanpa login (read-only)`.
4. `tambah milestone + attach foto → urut tanggal di /timeline → edit → hapus`.
5. `tulis surat Tiptap (bold/list/emoji) → kirim ke pasangan → inbox B muncul → buka amplop → tanda dibaca tercatat`.
6. `surat time-capsule: B lihat amplop terkunci → tidak bisa bypass via URL langsung → (majukan waktu via API test-helper) → bisa dibuka`.
7. `games: main Would-You-Rather + Trivia custom → skor tersimpan → leaderboard tampil`.
8. `daily note 280 char → tampil di dashboard pasangan hari itu → history per tanggal`.
9. `wishlist CRUD + mark done`.
10. `location: A share ON → B lihat posisi A di peta → A share OFF → B tidak lagi dapat update`.
11. `akses privat tanpa login → redirect /login?reason=unauthorized; user login buka /login → redirect /dashboard`.
12. `mobile 375px: bottom-nav tampil, upload, editor Tiptap, spin-wheel >30fps (smoke, bukan benchmark presisi)`.
13. `PWA: manifest + service worker terdaftar, halaman visited bisa dibuka offline (context offline:true)`.

**Auth & form strategy:**

- `tests/e2e/auth.setup.ts` memakai Credentials test-user (bukan Google OAuth asli; OAuth hanya diuji manual sekali + mocked callback di integration).
- Form: isi via `getByLabel/getByRole`, assert inline Zod error (judul kosong, email invalid, password pendek, file >cap, note >280 char), assert toast `sonner` untuk sukses/gagal.
- Upload di E2E memakai file fixture kecil (`tests/fixtures/1px.png`, `sample.mp4` <1MB) + intercept Cloudinary ke mock agar tidak boros bandwidth.

---

## 3. Test Cases Matrix

> Kolom: ID | Module/Feature | Type | Description | Expected | Priority. P0 = blocker rilis, P1 = harus ada, P2 = nice-to-have.

| ID | Module/Feature | Type | Test Description | Expected Result | Priority |
|----|----------------|------|------------------|-----------------|----------|
| AUTH-01 | Auth register | Integration | `POST /api/auth/register` dengan `INVITE_TOKEN` valid + password ≥12 | 201, user PARTNER tercipta, password ter-hash | P0 |
| AUTH-02 | Auth register | Integration | Register dengan invite token salah/kosong | 403 `invalid_invite` | P0 |
| AUTH-03 | Auth quota | Integration | Register user ke-3 saat sudah ada 2 PARTNER | Ditolak (`quota_full`, 403) | P0 |
| AUTH-04 | Auth login | Integration | Login Credentials email+password benar | Session DB tercipta, `ensureCouple` jalan | P0 |
| AUTH-05 | Auth login | Integration | Login password salah / user Google-only coba password | 401/null + cookie `auth_error_reason=google_only` | P0 |
| AUTH-06 | Auth guard | Unit | `isPublicPath`/`isAuthPath` di `proxy.ts`: `/`, `/gallery/albums`, `/gallery-edit`, `/dashboard/settings` | `/`=public, `/gallery/albums`=public, `/gallery-edit`=bukan public, `/dashboard/settings`=private | P0 |
| AUTH-07 | Auth guard E2E | E2E | Buka `/dashboard` tanpa login; buka `/login` saat sudah login | Redirect `/login?reason=unauthorized`; redirect `/dashboard` | P0 |
| AUTH-08 | Auth session | Integration | Session cache Redis strip `password` + invalidasi saat logout/update | Redis tidak menyimpan hash; session lama invalid | P1 |
| GAL-01 | Gallery upload | Integration | `POST /api/upload` + `POST /api/photos` JPG valid 1MB | 200/201, DB `Photo` + `publicId` tersimpan | P0 |
| GAL-02 | Gallery upload | Unit | `validateUploadRequest` tolak `x.svg`/`x.html`, terima `a.jpg`/`b.mp4` 50MB | valid=false untuk svg/html; true untuk jpg/mp4 dalam cap | P0 |
| GAL-03 | Gallery upload | Unit | `checkMagicBytes` PNG/JPEG asli vs spoof GIF-as-PNG | true untuk header asli; false untuk spoof | P0 |
| GAL-04 | Gallery upload | Integration | Upload foto >10MB / video >100MB / MIME tak didukung | 400/413 dengan pesan jelas, DB tidak bertambah | P0 |
| GAL-05 | Gallery list | Integration | `GET /api/photos?albumId=&year=&isFavorite=true` kombinasi filter | Hanya baris cocok yang kembali, urut `createdAt` desc | P0 |
| GAL-06 | Gallery favorit | E2E | Toggle bintang → filter favorit → reload persist | Status favorit persist setelah reload | P1 |
| GAL-07 | Gallery lightbox | E2E | Buka foto → swipe next/prev → caption tampil; video play di mobile viewport | Navigasi mulus, video playable | P1 |
| GAL-08 | Gallery bulk | Integration | `POST /api/photos/bulk-upload` 10 file valid; 11 file | 10 sukses; 11 ditolak/melebihi batas | P1 |
| GAL-09 | Gallery delete | Integration | `DELETE /api/photos/[id]` milik sendiri vs milik couple lain | Sendiri: DB terhapus + Cloudinary destroy dipanggil; asing: 403/404 + Cloudinary TIDAK dipanggil | P0 |
| GAL-10 | Gallery album | Integration | CRUD album + pindah foto antar album + `isPublic=false` disembunyikan dari publik | Pindah persist; album privat tak muncul di publik | P0 |
| TML-01 | Timeline CRUD | Integration | `POST/PUT/DELETE /api/milestones` happy path | 201/200, `date` tersimpan benar (timezone-safe) | P0 |
| TML-02 | Timeline validasi | Integration | `POST /api/milestones` judul kosong / tanggal invalid | 400 Zod error per-field | P0 |
| TML-03 | Timeline order | Integration | Seed 3 milestone acak → `GET /api/milestones` | Urut `date` ascending | P1 |
| TML-04 | Timeline foto | Integration | Attach 2 foto ke milestone via `MilestonePhoto`, hapus 1 | Join table konsisten, foto induk tidak terhapus | P1 |
| TML-05 | Timeline E2E | E2E | Tambah milestone via mobile form + attach foto → klik foto buka lightbox | Form tersubmit, lightbox terbuka | P1 |
| LTR-01 | Letters kirim | Integration | `POST /api/letters` Tiptap HTML + mood enum valid | 201, `authorId/recipientId` benar, `isOpened=false` | P0 |
| LTR-02 | Letters validasi | Integration | Judul kosong / konten kosong / mood invalid / `recipientId` bukan cuid | 400 dengan pesan ID (`Judul surat wajib diisi`, dst) | P0 |
| LTR-03 | Letters inbox/sent | Integration | `GET /api/letters?type=inbox\|sent` untuk A dan B | A-sent == B-inbox, tidak bocor ke user luar couple | P0 |
| LTR-04 | Letters time-lock | Integration | `GET /api/letters/[id]` time-capsule `unlockAt` masa depan oleh recipient | 403 terkunci, konten tidak bocor di body | P0 |
| LTR-05 | Letters open | Integration | `PUT /api/letters/[id]/open` setelah unlock; panggil 2x | Pertama set `isOpened/openedAt`; kedua idempotent 200 | P0 |
| LTR-06 | Letters cron | Integration | `GET /api/cron/time-capsule` tanpa/with `CRON_SECRET` + 1 surat jatuh tempo | Tanpa secret 401; dengan secret unlock + `notificationSentAt` + email mock terkirim | P0 |
| LTR-07 | Letters E2E | E2E | Tulis surat di Tiptap mobile → kirim → B buka amplop animasi → tanda dibaca | Inbox B bertambah, status dibaca tampil di A | P0 |
| LTR-08 | Letters XSS | Unit | `escapeHtml` + sanitasi konten Tiptap (`"><img onerror>`) | Payload netral (`&lt;img`), teks normal utuh | P0 |
| GAM-01 | Games Q CRUD | Integration | `POST/PUT/DELETE /api/games/questions` (TRIVIA + WYR) | 201/200/200, `isArchived` soft-hide dari list | P1 |
| GAM-02 | Games score | Integration | `POST /api/games/score` benar/salah + submit ganda same `[userId,questionId]` | Skor tercatat; duplikat tidak ganda (upsert/409) | P1 |
| GAM-03 | Games leaderboard | Integration | 2 pemain main 3 soal → `GET /api/games/leaderboard` | Agregat benar, urut skor desc | P1 |
| GAM-04 | Games arcade | Integration | `POST /api/games/arcade-score` sliding-puzzle/memory + `GET arcade-leaderboard?gameType=` | Skor + metadata JSON tersimpan, filter tipe benar | P2 |
| GAM-05 | Games E2E | E2E | Main WYR + Trivia custom di mobile, tambah pertanyaan custom | Skor realtime + leaderboard update | P1 |
| NOTE-01 | Daily notes | Integration | `POST /api/notes` 280 char pas + 281 char | 280 lolos 201; 281 ditolak 400 | P1 |
| NOTE-02 | Daily notes | Integration | `GET /api/notes?date=` + rate-limit 100/hari | Filter tanggal tepat; lewat limit 429 + `Retry-After` | P1 |
| NOTE-03 | Daily notes E2E | E2E | Kirim note → banner hilang → tampil di dashboard pasangan | Note hari itu tampil di kedua dashboard | P1 |
| WISH-01 | Wishlist | Integration | CRUD `POST/PUT/DELETE /api/wishes` + `PUT [id]` mark done | `isDone=true` set `doneAt`, filter `isDone/category` benar | P2 |
| WISH-02 | Wishlist E2E | E2E | Tambah wish + kategori + tandai done | Badge done + foto kenangan tampil | P2 |
| LOC-01 | Location update | Integration | `POST /api/location` lat/lon valid + accuracy/heading | 200, `UserLocation` upsert per user | P1 |
| LOC-02 | Location consent | Integration | `POST /api/location/share {isSharing:false}` lalu pasangan `GET /api/location` | Pasangan tidak menerima update baru; history lama tetap ada | P0 |
| LOC-03 | Location validasi | Integration | lat 200 / lon 500 / `deviceType` kosong (Zod `location.ts`) | 400 per-field | P1 |
| LOC-04 | Location history | Integration | Kirim 3 titik → `GET /api/location/history` | Urut waktu, tidak duplikat posisi terkini | P1 |
| LOC-05 | Location E2E | E2E | A share ON → B lihat marker A di Leaflet; A OFF → update berhenti | Marker muncul/hilang sesuai consent | P1 |
| DASH-01 | Dashboard stats | Integration | `GET /api/dashboard/stats` setelah seed foto/surat/milestone | Count foto/video/surat/milestone/hari-bersama akurat | P1 |
| DASH-02 | Dashboard activity | Integration | Upload + kirim surat → `GET /api/dashboard/activity` | Feed berisi 2 aktivitas terbaru berurutan | P2 |
| DASH-03 | Couple config | Integration | `PUT /api/couple` update nama/tanggal/tagline + target milestones | Persist + `targetMetAt` logic bila target tercapai | P1 |
| SEC-01 | Rate limit | Integration | Banjiri `POST /api/upload` >50/jam (mock) + 1 test Redis asli | 429 JSON + header `Retry-After` + `X-RateLimit-Remaining: 0` | P0 |
| SEC-02 | URL validasi | Unit | `httpUrl()` terima `https://…`, tolak `javascript:`/`data:text/html` | Sesuai tabel `security-guards.test.ts` | P0 |
| SEC-03 | Token compare | Unit | `safeTokenEqual` match/mismatch/kosong (timing-safe) | exact=true, mismatch/empty=false | P0 |
| SEC-04 | PII leak | Unit | `toPublicUser` strip email, handle null/undefined | Hanya `{id,name,image}`, null→null | P0 |
| SEC-05 | CSP sync | Integration | `lib/csp.ts` vs `vercel.json` + header runtime `/` | Tidak drift; header CSP/HSTS/X-Frame ada | P1 |
| SEC-06 | Couple isolation | Integration | Akses `photos/letters/milestones/[id]` milik couple lain | 403/404 konsisten, tidak bocor metadata | P0 |
| PERF-01 | Home perf | E2E | Lighthouse/mobile: LCP home <2s (4G throttling), galeri skeleton → konten | LCP <2s, tidak ada layout-shift fatal | P1 |
| PERF-02 | Upload perf | E2E | Upload foto tampil di galeri <5s (file kecil + mock CDN) | Tampil <5s + progress bar smooth | P1 |
| PWA-01 | PWA install | E2E | `manifest.json` + `sw.js` + install prompt | Manifest valid, SW registered, installable | P2 |
| PWA-02 | PWA offline | E2E | Kunjungi `/gallery` online → offline → reload | Cache fallback tampil, bukan blank | P2 |

---

## 4. Kualitas Non-Fungsional (Kategori → Faktor → Penjelasan → Acuan Uji)

| Kategori | Faktor / Atribut | Penjelasan ringkas | Acuan uji di plan ini |
|----------|------------------|--------------------|-----------------------|
| Kinerja & Skala | Performance & Speed | Kecepatan respons aplikasi (latency) dan efisiensi memori/CPU | PERF-01/02 (LCP <2s, upload <5s), skeleton/spinner/optimistic-update; `optimizePackageImports`, `images deviceSizes`, `minimumCacheTTL` |
| Kinerja & Skala | Scalability | Kemampuan menangani lonjakan pengguna/data tanpa crash | SEC-01 rate-limit matrix (upload 50/jam, write 300/jam, location 600/jam); pagination list foto/milestone; index DB (`@@index` di Photo/Milestone/Letter) |
| Kinerja & Skala | Maintainability | Kemudahan kode dirawat, diperbaiki, dikembangkan | Struktur `tests/unit|integration|e2e`, coverage ≥80% `lib/`, pola `vi.mock` di seam, CSP single-source (`lib/csp.ts` + `sync-csp.mjs`) |
| Keandalan & Keamanan | Reliability & Availability | Tingkat keandalan dan jaminan uptime | Cron time-capsule harian `0 7 * * *` (LTR-06), session 3 hari + updateAge 24 jam, PWA offline fallback (PWA-02), error/loading boundaries |
| Keandalan & Keamanan | Resilience & Fault Tolerance | Pulih otomatis saat kegagalan/down | Redis down → auth tetap jalan (fallback DB, diuji via mock `getCached` throw); Cloudinary/Pusher/SMTP gagal → toast + retry, DB tidak korup; `ensureCouple` idempotent lawan race P2002 |
| Keandalan & Keamanan | Security & Privacy | Perlindungan data dari peretasan, enkripsi, kontrol akses | AUTH-01..08, SEC-02..06, GAL-09, LTR-04/08; bcrypt, signed upload, `safeTokenEqual` untuk INVITE/CRON, Zod sanitasi, `toPublicUser`, CSP/HSTS/X-Frame |
| Kualitas Kode | Consistency | Keseragaman struktur, penamaan, arsitektur | Konvensi ID `MODUL-NN`, penamaan file `*.test.ts`/`*.spec.ts`, Zod schema per-modul di `lib/validations/`, Prettier + Tailwind plugin, ESLint gate di CI |
| Kualitas Kode | Robustness | Tahan terhadap input invalid / edge cases | Seluruh baris 400-matrix (judul kosong, lat 200, SVG spoof, duplikat score, unlock prematur, quota ke-3, file oversize) |
| Kualitas Kode | Testability | Kemudahan diuji (unit test / mocking) | Seam `prisma/redis/cloudinary/resend/auth` termock; pure-utils tanpa I/O; fixtures + helper `createCoupleWithTwoPartners()` |
| Pengalaman Pengguna | Usability & Accessibility | Mudah dipakai pengguna biasa hingga disabilitas | E2E form labels/roles, keyboard-nav lightbox/dialog, kontras rose `#F43F5E` on blush, `prefers-color-scheme`, toast error berbahasa jelas |
| Pengalaman Pengguna | Portability & Interoperability | Jalan di berbagai platform/browser, terhubung API lain | Matrix Chromium/Firefox/WebKit + 375px/768px/1280px; kontrak Cloudinary/Upstash/Pusher/Nominatim via msw; Safari video smoke (MP4/H.264) |

---

## 5. Environment & Data Setup

### 5.1 Environment variables

Salin `.env.example` → `.env.test` (CI memakai GitHub Secrets). Tabel wajib:

| Var | Dipakai untuk | Catatan test |
|-----|---------------|--------------|
| `DATABASE_URL` / `TEST_DATABASE_URL` | Prisma Neon | Integration/E2E wajib branch ephemeral, bukan DB dev |
| `AUTH_SECRET`, `NEXTAUTH_URL` | NextAuth session | E2E `NEXTAUTH_URL=http://localhost:3000` |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth | E2E tidak pakai asli; integration mock callback |
| `CLOUDINARY_*`, `CLOUDINARY_STORAGE_LIMIT_BYTES` | Upload CDN | E2E mock via msw/intercept; 1 smoke asli opsional |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Cache + rate-limit | Test pakai namespace `test:*` lalu flush |
| `SMTP_HOST/PORT/USER/PASS/FROM_*` | Email time-capsule | Mock transport; assert dipanggil dengan argumen benar |
| `PUSHER_APP_ID/SECRET`, `NEXT_PUBLIC_PUSHER_*` | Realtime sync | Mock `pusher-server` trigger |
| `CRON_SECRET` | `/api/cron/time-capsule` | LTR-06 wajib 401-vs-200 |
| `INVITE_TOKEN`, `SEED_PASSWORD` | Register + seed | Fixture: `INVITE_TOKEN=test-invite-123`, password ≥12 char |

### 5.2 Fixtures & mocks

```
tests/fixtures/
  users.ts            # partnerA, partnerB, outsider (email unik per-run)
  couple.ts           # createCoupleWithTwoPartners()
  photos.ts           # 1px.png, portrait.jpg, sample.mp4 (<1MB)
  letters.ts          # plain + time-capsule (unlockAt ±1 hari)
  milestones.ts       # 3 milestone tanggal tersebar
  games.ts            # WYR + TRIVIA sample + jawaban
  location.ts         # titik Jakarta/Bandung valid + invalid (lat 200)
```

- Cloudinary/Pusher/SMTP/Nominatim: `msw` handler default sukses + mode gagal (`?fail=1`) untuk failure-recovery.
- Waktu: `vi.useFakeTimers()` / `vi.setSystemTime()` untuk countdown, memory-of-day seed, dan `unlockAt` (jangan `sleep` asli).
- Magic-bytes: buffer header asli di `tests/fixtures/magic/` (PNG `89 50 4E 47`, JPEG `FF D8 FF`, MP4 `ftyp`).

### 5.3 Teardown

1. Integration: hapus urutan `GameScore → MilestonePhoto → Photo → Milestone → Letter → DailyNote → WishItem → UserLocation* → LocationShare → CoupleMember → Couple → User`; `redis.flushdb test:*`; hapus `publicId` test di Cloudinary (mock).
2. E2E: tiap worker memakai couple terisolasi (`workerStorageState` Playwright per `parallelIndex`); `afterAll` hapus via API cleanup dengan token test.
3. Dilarang teardown menyentuh DB dev/prod — guard: test abort bila `DATABASE_URL` tidak mengandung penanda branch test.

---

## 6. Execution & CI/CD Strategy

### 6.1 Struktur folder pengujian

```
tests/
  unit/                 # mirror lib/: date.test.ts, geo.test.ts, upload-policy.test.ts, ...
  integration/
    api/
      auth.register.test.ts
      photos.test.ts
      milestones.test.ts
      letters.test.ts
      letters-open.test.ts
      games.test.ts
      notes.test.ts
      wishes.test.ts
      location.test.ts
      dashboard.test.ts
      cron.time-capsule.test.ts
      csp.test.ts
    setup.ts            # env guard + prisma connect
    fixtures/           # helper createCoupleWithTwoPartners, seed, teardown
  e2e/
    auth.setup.ts       # hasilkan playwright/.auth/partner-a|b.json
    auth.spec.ts
    gallery.spec.ts
    timeline.spec.ts
    letters.spec.ts
    games.spec.ts
    notes-wishlist.spec.ts
    location.spec.ts
    dashboard.spec.ts
    pwa-offline.spec.ts
  fixtures/             # file biner kecil + data JSON
__tests__/proxy.test.ts # legacy node:test (tetap jalan)
lib/__tests__/security-guards.test.ts
app/api/letters/[id]/__tests__/open-letter.test.ts
vitest.config.mts
playwright.config.ts
```

### 6.2 Perintah CLI

```bash
# Unit saja (cepat, tanpa DB)
npx vitest run tests/unit

# Integration (butuh TEST_DATABASE_URL + Redis test)
npx vitest run tests/integration

# Semua Vitest + coverage lib/
npx vitest run --coverage

# E2E (butuh dev server + seed)
npx playwright test

# E2E satu journey + headed debug
npx playwright test tests/e2e/letters.spec.ts --headed --debug

# Legacy node:test yang sudah ada (tetap didukung)
npm test

# Script yang direkomendasikan di package.json:
# "test:unit": "vitest run tests/unit"
# "test:integration": "vitest run tests/integration"
# "test:e2e": "playwright test"
# "test:coverage": "vitest run --coverage"
# "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
```

`vitest.config.mts` minimal (Vite native `resolve.tsconfigPaths`, tanpa plugin tambahan):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    coverage: { provider: "v8", reporter: ["text", "lcov"], include: ["lib/**/*.ts"] },
  },
});
```

`playwright.config.ts` minimal:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry", video: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", dependencies: ["setup"], use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", dependencies: ["setup"], use: { ...devices["Pixel 7"] } },
    { name: "firefox", dependencies: ["setup"], use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", dependencies: ["setup"], use: { ...devices["Desktop Safari"] } },
  ],
});
```

### 6.3 GitHub Actions / CI pipeline

File: `.github/workflows/test.yml`

```yaml
name: test
on: [push, pull_request]
jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npx vitest run tests/unit
      - run: npx vitest run tests/integration
        env:
          TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
          INVITE_TOKEN: test-invite-123
          CRON_SECRET: test-cron-secret
  e2e:
    runs-on: ubuntu-latest
    needs: unit-integration
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium firefox
      - run: npm run build
      - run: npx playwright test
        env:
          TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          NEXTAUTH_URL: http://localhost:3000
```

Quality gates: unit+integration hijau wajib sebelum E2E; coverage `lib/` ≥80%; semua P0 hijau sebelum merge ke `main`/deploy Vercel; artefak Playwright (trace/video) diunggah saat gagal.

### 6.4 Exit criteria rilis

- [ ] Semua P0 pass di Chromium + 1 browser tambahan + viewport 375px.
- [ ] Tidak ada PII bocor (SEC-04/06), time-capsule tidak bisa bypass (LTR-04), quota invite tegak (AUTH-03).
- [ ] Cron + email mock terverifikasi (LTR-06); CSP tanpa drift (SEC-05).
- [ ] Flaky rate <2% (retry CI 2x, quarantine daftar terpisah bila ada).

---

## Appendix — Traceability PRD → Test

| PRD | Fitur | ID uji |
|-----|-------|--------|
| F-01 | Home/Hero | PERF-01, DASH-01 (hari bersama), E2E journey 1 |
| F-02 | Galeri | GAL-01..10, SEC-01 |
| F-03 | Timeline | TML-01..05 |
| F-04 | Surat + capsule | LTR-01..08 |
| F-05 | Games | GAM-01..05 |
| F-06 | Dashboard | DASH-01..03, AUTH-07 |
| F-07 | Daily note | NOTE-01..03 |
| F-08 | Wishlist | WISH-01..02 |
| F-09 | PWA | PWA-01..02 |
| §10 | Auth & Security | AUTH-01..08, SEC-01..06 |
| Out-of-scope §15 | Chat/call/sosial/multi-couple/AI/backup | Ditegaskan tidak diuji di §1.3 |
