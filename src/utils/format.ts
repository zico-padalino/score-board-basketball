import type { Period } from '../types/game'

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0 && ms < 60_000) {
    const tenths = Math.floor((Math.max(0, ms) % 1000) / 100)
    return `${seconds}.${tenths}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatShotClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return String(seconds)
}

export function periodLabel(period: Period): string {
  if (period <= 4) return `Q${period}`
  return `OT${period - 4}`
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
