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
