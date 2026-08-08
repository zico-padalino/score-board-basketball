import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { GameState } from '../types/game'

const CHANNEL = 'courtside-state-v1'

type SyncPayload = Pick<
  GameState,
  | 'home'
  | 'away'
  | 'period'
  | 'clockMs'
  | 'shotClockMs'
  | 'clockRunning'
  | 'possession'
  | 'status'
  | 'scoreEvents'
  | 'config'
>

function pick(state: GameState): SyncPayload {
  return {
    home: state.home,
    away: state.away,
    period: state.period,
    clockMs: state.clockMs,
    shotClockMs: state.shotClockMs,
    clockRunning: state.clockRunning,
    possession: state.possession,
    status: state.status,
    scoreEvents: state.scoreEvents,
    config: state.config,
  }
}

/** Keep layar penonton synced with operator across tabs. */
export function useScoreboardSync(mode: 'broadcast' | 'receive') {
  useEffect(() => {
    let bc: BroadcastChannel
    try {
      bc = new BroadcastChannel(CHANNEL)
    } catch {
      return
    }

    if (mode === 'receive') {
      bc.onmessage = (ev: MessageEvent<SyncPayload>) => {
        if (!ev.data?.home || !ev.data?.away) return
        useGameStore.setState(ev.data)
      }
      return () => bc.close()
    }

    let lastSent = 0
    const unsub = useGameStore.subscribe((state) => {
      const now = performance.now()
      const minGap = state.clockRunning ? 80 : 0
      if (now - lastSent < minGap) return
      lastSent = now
      bc.postMessage(pick(state))
    })

    bc.postMessage(pick(useGameStore.getState()))
    return () => {
      unsub()
      bc.close()
    }
  }, [mode])
}
