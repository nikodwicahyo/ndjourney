# 🚀 Couple Web — Setup Guide

> Panduan lengkap untuk setup semua layanan yang dibutuhkan.

---

## 1. Neon Database (PostgreSQL)

1. Daftar di [neon.tech](https://neon.tech) (free tier)
2. Buat project baru → pilih region terdekat
3. Dapatkan connection string → copy ke `DATABASE_URL` di `.env.local`
4. Generate prisma client:
   ```bash
   npx prisma generate
   ```
5. Jalankan migrasi:
   ```bash
   npx prisma db push
   # atau
   npx prisma migrate dev --name init
   ```
6. Seed data:
   ```bash
   npx prisma db seed
   ```

## 2. Cloudinary (Media Storage)

1. Daftar di [cloudinary.com](https://cloudinary.com) (free tier — 25GB)
2. Dashboard → dapatkan:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. **Untuk development:** Settings → Upload → Upload Presets → Add unsigned preset
4. **Untuk production:** Gunakan signed upload (via API, sudah diimplementasi)

## 3. Google OAuth (Authentication)

1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Create Project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://[domain-kamu].vercel.app/api/auth/callback/google`
5. Copy `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` ke `.env.local`

## 4. Upstash Redis (Rate Limiting + Cache)

1. Daftar di [upstash.com](https://upstash.com) (free tier — 10.000 req/hari)
2. Create Database → pilih region Asia (Singapore/Jakarta)
3. Dapatkan REST URL dan REST Token
4. Copy ke `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`

## 5. Pusher Channels (Real-time Sync)

1. Daftar di [pusher.com](https://pusher.com) (free tier — 200.000 messages/hari)
2. Buat Channels app baru → pilih cluster terdekat (ap-southeast-1 for Singapore/Indonesia)
3. Dapatkan credentials dari App Keys tab:
   - `PUSHER_APP_ID`
   - `PUSHER_SECRET`
   - `NEXT_PUBLIC_PUSHER_APP_KEY` (App Key)
   - `NEXT_PUBLIC_PUSHER_CLUSTER`
4. Enable **Client Events** di Settings (opsional, untuk future use)
5. Copy semua key ke `.env.local`

> **Arsitektur:** Server mengirim event `sync-mutate` ke channel `private-couple-{coupleId}`.
> Client subscribe dan invalidate TanStack React Query cache berdasarkan scope
> (`GALLERY`, `TIMELINE`, `LETTERS`, `DAILY_NOTES`, `WISHLIST`, `DASHBOARD`).

## 6. SMTP Email (Notifications)

> Menggunakan Nodemailer dengan Gmail SMTP. Tidak perlu domain sendiri — pakai Gmail biasa.

1. Gunakan akun Gmail yang sudah ada (atau buat baru)
2. Aktifkan **2-Step Verification** di [myaccount.google.com/security](https://myaccount.google.com/security)
3. Buat **App Password** di [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords):
   - Pilih *Mail* sebagai app dan *Windows Computer* sebagai device
   - Copy 16-karakter password yang muncul
4. Set environment variables:
   ```
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_USER="emailkamu@gmail.com"
   SMTP_PASS="16-karakter-app-password"
   SMTP_FROM_EMAIL="emailkamu@gmail.com"
   ```

> **Alternatif SMTP lain:** Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` sesuai provider (SendGrid, Mailgun, Brevo, dll).

## 7. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Setup .env.local
cp .env.example .env.local
# Isi semua environment variable

# 3. Generate Prisma client
npx prisma generate
npx prisma db push
npx prisma db seed

# 4. Jalankan development server
npm run dev
```

## 8. Deploy ke Vercel

```bash
# 1. Push ke GitHub
git init
git add .
git commit -m "initial: couple web"
gh repo create couple-web --private
git push origin main

# 2. Import di Vercel
# https://vercel.com/new → Import GitHub repo
# Framework: Next.js (auto)

# 3. Tambah semua env variable di Vercel Dashboard:
# Settings → Environment Variables
# Paste semua dari .env.example (dengan nilai sebenarnya)

# 4. Deploy
git push origin main

# 5. (Opsional) Custom domain
# Settings → Domains → Add domain
```

## 9. Registrasi Akun

> Web hanya bisa diakses oleh 2 akun pasangan.

1. Set `INVITE_TOKEN` di environment variable
2. Buka `https://[domain]/invite/[TOKEN]`
3. User pertama register
4. User kedua register (bisa pakai link yang sama)
5. Setelah dua akun terdaftar, ganti `INVITE_TOKEN`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Generate: `openssl rand -base64 32` (`NEXTAUTH_SECRET` accepted as fallback) |
| `NEXTAUTH_URL` | ✅ | `http://localhost:3000` (dev) / production URL |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `UPSTASH_REDIS_REST_URL` | ❌ | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Upstash Redis REST token |
| `SMTP_HOST` | ❌ | SMTP server (default: `smtp.gmail.com`) |
| `SMTP_PORT` | ❌ | SMTP port (default: `587`) |
| `SMTP_USER` | ❌ | SMTP username (Gmail email) |
| `SMTP_PASS` | ❌ | SMTP password (Gmail App Password) |
| `SMTP_FROM_EMAIL` | ❌ | Sender email address |
| `CRON_SECRET` | ✅ | Secret for Vercel Cron (`Authorization: Bearer` on `/api/cron/time-capsule`) |
| `SEED_PASSWORD` | ❌ | Min 12 chars; required only to run `db:seed` (never in production) |
| `INVITE_TOKEN` | ✅ | Token untuk registrasi invite-only |
| `PUSHER_APP_ID` | ❌ | Pusher App ID (real-time sync) |
| `PUSHER_SECRET` | ❌ | Pusher App Secret |
| `NEXT_PUBLIC_PUSHER_APP_KEY` | ❌ | Pusher App Key (public) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | ❌ | Pusher cluster (e.g. `ap1`, `us2`) |

> ✅ = Wajib / ❌ = Opsional (fallback gracefully)
