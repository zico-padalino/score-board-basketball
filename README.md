# COURTSIDE — Basketball Scoreboard

Aplikasi web scoreboard basketball dengan scoresheet resmi dan box score statistik lengkap. Siap dipakai di desktop & mobile, dengan layar penonton full screen.

## Fitur

- **Setup** — nama tim, logo (upload / dummy), warna, roster 12 pemain, durasi kuarter
- **Operator** — jam, shot clock, skor, foul, timeout, statistik, substitusi
- **Layar penonton** — scoreboard arena + fullscreen + sync antar tab
- **Scoresheet** — skor per kuarter, foul, timeout, running score (cetak)
- **Box Score** — PTS, FG/3P/FT, REB, AST, STL, BLK, TOV, PF
- **Mobile** — bottom navigation & tombol touch-friendly

Data disimpan di `localStorage` browser.

## Menjalankan lokal

```bash
npm install
npm run dev
```

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
