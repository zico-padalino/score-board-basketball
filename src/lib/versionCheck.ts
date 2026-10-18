const CHECK_EVERY_MS = 60_000

function bundleOf(html: string) {
  return html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null
}

function currentBundle() {
  const script = [...document.scripts].find((s) => /\/assets\/index-[\w-]+\.js/.test(s.src))
  return script ? new URL(script.src).pathname : null
}

/**
 * Muat ulang otomatis kalau ada deploy baru, supaya semua perangkat
 * (terutama Safari iPhone yang suka menyimpan versi lama) memakai kode yang sama.
 */
export function startVersionCheck() {
  if (!import.meta.env.PROD) return
  const mine = currentBundle()
  if (!mine) return

  const check = async () => {
    try {
      const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' })
      const latest = bundleOf(await res.text())
      if (latest && latest !== mine) window.location.reload()
    } catch {
      /* offline — coba lagi nanti */
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
  window.setInterval(() => void check(), CHECK_EVERY_MS)
}
