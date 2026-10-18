# Halcion Community — Basketball Scoreboard

Aplikasi web scoreboard basketball dengan scoresheet resmi dan box score statistik lengkap. Siap dipakai di desktop & mobile, dengan layar penonton full screen.

## Fitur

- **Setup** — nama tim, logo (upload / dummy), warna, roster 12 pemain, durasi kuarter
- **Operator** — jam, shot clock, skor, foul, timeout, statistik, substitusi
- **Layar penonton** — scoreboard arena + fullscreen + sync antar tab & antar perangkat (Supabase Realtime)
- **Scoresheet** — skor per kuarter, foul, timeout, running score (cetak)
- **Box Score** — PTS, FG/3P/FT, REB, AST, STL, BLK, TOV, PF
- **Mobile** — bottom navigation & tombol touch-friendly

Data disimpan di `localStorage` browser. Kalau Supabase dikonfigurasi, state pertandingan
juga disimpan ke tabel `games` dan disiarkan realtime per **kode game**, jadi layar penonton
bisa dibuka di perangkat lain lewat `/display?game=KODE` dan operator bisa melanjutkan
di perangkat lain lewat `/operator?game=KODE`.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi VITE_SUPABASE_ANON_KEY (opsional)
npm run dev
```

## Supabase

1. Dashboard Supabase → **SQL Editor** → jalankan isi `supabase/schema.sql`
   (membuat tabel `games` dan bucket Storage `logos`).
2. **Project Settings → API Keys** → salin anon / publishable key.
3. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di `.env.local` (lokal) dan di
   Environment Variables Vercel.

Tanpa env tersebut aplikasi tetap jalan seperti biasa (localStorage + sync antar tab).

## Deploy ke Vercel

Repo menyertakan `vercel.json` (Vite, output `dist`, SPA rewrite).

1. [Vercel](https://vercel.com/new) → **Import Git Repository** → pilih `score-board-basketball`
2. Tambahkan Environment Variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
3. Deploy — setiap push ke `main` akan otomatis deploy ulang

Buka URL Vite (biasanya `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Deploy ke Netlify

Repo sudah menyertakan `netlify.toml` (build: `npm run build`, publish: `dist`, SPA redirect).

### Cara cepat

1. Push kode ke GitHub: https://github.com/zico-padalino/score-board-basketball
2. Buka [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
3. Pilih repo `score-board-basketball`
4. Deploy (settings terisi otomatis dari `netlify.toml`)

Atau pakai Netlify CLI:

```bash
npm i -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## Repo

https://github.com/zico-padalino/score-board-basketball
