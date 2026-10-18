import type { GameState } from '../types/game'
import type { MatchLive } from '../types/tournament'
import { periodsOf } from '../utils/format'
import { periodScore, teamScore } from '../utils/stats'

export function liveFromState(state: GameState): MatchLive {
  const periods = periodsOf(state.config)
  const lastPeriod = Math.max(
    periods,
    state.period,
    ...state.scoreEvents.map((e) => e.period),
  )
  const all = Array.from({ length: lastPeriod }, (_, i) => i + 1)
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
      home: all.map((p) => periodScore(state.scoreEvents, 'home', p)),
      away: all.map((p) => periodScore(state.scoreEvents, 'away', p)),
      periods,
    },
  }
}
