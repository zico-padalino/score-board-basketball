import { useEffect, useState } from 'react'

const CHECK_MS = 60_000

function currentBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
  return el ? new URL(el.src).pathname : null
}

async function latestBundle(): Promise<string | null> {
  const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return null
  const html = await res.text()
  return html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null
}

/**
 * True kalau ada versi baru di server. Safari iOS / web app di Home Screen
 * sering tetap menjalankan bundle lama sampai benar-benar ditutup.
 */
export function useAppVersion({ autoReload = false } = {}) {
  const [outdated, setOutdated] = useState(false)

  useEffect(() => {
    const mine = currentBundle()
    if (!mine) return
    let stopped = false

    const check = async () => {
      try {
        const latest = await latestBundle()
        if (stopped || !latest || latest === mine) return
        if (autoReload) window.location.reload()
        else setOutdated(true)
      } catch {
        /* offline: coba lagi nanti */
      }
    }

    void check()
    const timer = window.setInterval(() => void check(), CHECK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [autoReload])

  return outdated
}
