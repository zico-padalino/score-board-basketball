import { useEffect, useSyncExternalStore } from 'react'
import { useGameStore } from '../store/gameStore'
import { announceCountdown } from '../utils/buzzer'

const STORAGE_KEY = 'halcion-countdown-sound'
/** Hanya bunyi bila jam baru saja melewati angka bulat (bukan saat jam dikoreksi). */
const BOUNDARY_MS = 350
const listeners = new Set<() => void>()

function readEnabled() {
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function setCountdownSound(on: boolean) {
  localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  listeners.forEach((l) => l())
}

/** Preferensi suara hitung mundur per perangkat (tidak disinkronkan). */
export function useCountdownSoundEnabled() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    readEnabled,
  )
}

/** Ucapkan 10, 9, 8, … 1 di 10 detik terakhir saat jam berjalan. */
export function useCountdownVoice() {
  const enabled = useCountdownSoundEnabled()

  useEffect(() => {
    if (!enabled) return
    let lastSaid: number | null = null
    return useGameStore.subscribe((s) => {
      if (!s.clockRunning) {
        lastSaid = null
        return
      }
      const sec = Math.ceil(s.clockMs / 1000)
      if (sec > 10 || sec < 1) {
        lastSaid = null
        return
      }
      // hanya turun: koreksi jam dari operator lain tidak membuat angka terucap ulang
      if (lastSaid !== null && sec >= lastSaid) return
      lastSaid = sec
      if (sec * 1000 - s.clockMs <= BOUNDARY_MS) announceCountdown(sec)
    })
  }, [enabled])
}
