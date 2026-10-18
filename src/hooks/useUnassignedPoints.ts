import { useCallback, useEffect, useState } from 'react'
import { listMatchStates } from '../lib/tournamentApi'
import type { GameState } from '../types/game'
import type { Match } from '../types/tournament'
import { teamScore } from '../utils/stats'

function unassignedOf(state: GameState) {
  let total = 0
  for (const side of ['home', 'away'] as const) {
    const players = state[side].players.reduce((s, p) => s + (state.playerStats[p.id]?.pts ?? 0), 0)
    total += Math.max(0, teamScore(state.scoreEvents, side) - players)
  }
  return total
}

/** Poin per laga yang tercatat sebagai skor tim saja (belum dibagi ke pemain). */
export function useUnassignedPoints(matches: Match[]) {
  const [byMatch, setByMatch] = useState<Map<string, number>>(new Map())
  const [version, setVersion] = useState(0)
  const key = matches
    .filter((m) => m.status !== 'scheduled')
    .map((m) => `${m.id}:${m.status}:${m.home_score}:${m.away_score}`)
    .join(',')

  useEffect(() => {
    const ids = key ? key.split(',').map((k) => k.split(':')[0]) : []
    let active = true
    listMatchStates(ids)
      .then((states) => {
        if (!active) return
        const next = new Map<string, number>()
        for (const [id, st] of states) next.set(id, unassignedOf(st))
        setByMatch(next)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [key, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return { byMatch, refresh }
}
