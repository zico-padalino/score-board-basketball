import type { GameState } from '../types/game'
import type { MatchLive } from '../types/tournament'
import { periodScore, teamScore } from '../utils/stats'

export function liveFromState(state: GameState): MatchLive {
  const lastPeriod = Math.max(
    4,
    state.period,
    ...state.scoreEvents.map((e) => e.period),
  )
  const periods = Array.from({ length: lastPeriod }, (_, i) => i + 1)
  return {
    status: state.status === 'finished' ? 'finished' : 'live',
    home_score: teamScore(state.scoreEvents, 'home'),
    away_score: teamScore(state.scoreEvents, 'away'),
    period: state.period,
    clock_ms: Math.round(state.clockMs),
    shot_clock_ms: Math.round(state.shotClockMs),
    clock_running: state.clockRunning && state.status !== 'finished',
    live_at: new Date().toISOString(),
    period_scores: {
      home: periods.map((p) => periodScore(state.scoreEvents, 'home', p)),
      away: periods.map((p) => periodScore(state.scoreEvents, 'away', p)),
    },
  }
}
