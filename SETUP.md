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

## 5. Resend (Email Notification)

1. Daftar di [resend.com](https://resend.com) (free tier — 3.000 email/bulan)
2. API Keys → Create API Key → copy ke `RESEND_API_KEY`
3. Domains → Add domain (atau gunakan `onboarding@resend.dev` untuk testing)
4. Set `RESEND_FROM_EMAIL` sesuai domain

## 6. Local Development

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

## 7. Deploy ke Vercel

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

## 8. Registrasi Akun

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
| `NEXTAUTH_SECRET` | ✅ | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | `http://localhost:3000` (dev) / production URL |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `UPSTASH_REDIS_REST_URL` | ❌ | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Upstash Redis REST token |
| `RESEND_API_KEY` | ❌ | Resend API key |
| `RESEND_FROM_EMAIL` | ❌ | Resend sender email |
| `INVITE_TOKEN` | ✅ | Token untuk registrasi invite-only |

> ✅ = Wajib / ❌ = Opsional (fallback gracefully)
