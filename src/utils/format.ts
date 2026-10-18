import type { Period } from '../types/game'

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0 && ms < 60_000) {
    const safe = Math.max(0, ms)
    const tenths = Math.floor((safe % 1000) / 100)
    return `${Math.floor(safe / 1000)}.${tenths}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Waktu untuk kotak edit: "m:ss" (atau "s.t" di bawah 1 menit). */
export function formatClockInput(ms: number): string {
  const safe = Math.max(0, ms)
  if (safe < 60_000) return (Math.floor(safe / 100) / 10).toFixed(1)
  const total = Math.round(safe / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Baca waktu ketikan operator: "5:30", "05:30", "0:12.5", "45" (detik), "12.5".
 * Mengembalikan milidetik, atau null bila format salah.
 */
export function parseClockInput(raw: string): number | null {
  const text = raw.trim().replace(',', '.')
  if (!text) return null
  const m = text.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/)
  if (m) {
    const minutes = Number(m[1])
    const seconds = Number(m[2])
    if (seconds >= 60) return null
    return Math.round((minutes * 60 + seconds) * 1000)
  }
  if (/^\d{1,4}(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000)
  return null
}

export function formatShotClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return String(seconds)
}

/** Q1–Q4 untuk 4 kuarter, B1/B2/... untuk format babak lain, lalu OT1, OT2, ... */
export function periodLabel(period: Period | number, periods = 4): string {
  if (period <= periods) return periods === 4 ? `Q${period}` : `B${period}`
  return `OT${period - periods}`
}

export function periodsOf(config: { periods?: number } | undefined): number {
  return config?.periods ?? 4
}

/** Daftar babak reguler [1..n] untuk tabel skor. */
export function regularPeriods(periods: number): Period[] {
  return Array.from({ length: periods }, (_, i) => (i + 1) as Period)
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
