import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import {
  playPeriodBuzzer,
  playShotClockBuzzer,
  subscribeBuzzerBroadcast,
  unlockAudio,
} from '../utils/buzzer'

export function useGameClock(enabled = true) {
  const clockRunning = useGameStore((s) => s.clockRunning)
  const tick = useGameStore((s) => s.tick)
  const lastRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    const unlock = () => {
      void unlockAudio()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    return subscribeBuzzerBroadcast()
  }, [enabled])

  useEffect(() => {
    if (!enabled || !clockRunning) {
      lastRef.current = null
      return
    }

    let frame = 0
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now
      const delta = now - lastRef.current
      lastRef.current = now
      if (delta > 0 && delta < 250) {
        const { gameExpired, shotExpired } = tick(delta)
        if (gameExpired) playPeriodBuzzer()
        else if (shotExpired) playShotClockBuzzer()
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [enabled, clockRunning, tick])
}
