import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  getTournament,
  listMatches,
  listTeams,
  subscribeTournament,
} from '../lib/tournamentApi'
import type { Match, Tournament, TournamentTeam } from '../types/tournament'

/** Turnamen + tim + laga, dengan skor/jam laga yang ikut update realtime. */
export function useTournamentData(id: string) {
  const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined)
  const [teams, setTeams] = useState<TournamentTeam[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [t, tm, ms] = await Promise.all([getTournament(id), listTeams(id), listMatches(id)])
      setTournament(t)
      setTeams(tm)
      setMatches(ms)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat turnamen')
    }
  }, [id])

  useEffect(() => {
    if (!supabase) return
    void reload()
    const unsub = subscribeTournament(id, (row) => {
      if (row) setMatches((list) => list.map((m) => (m.id === row.id ? { ...m, ...row } : m)))
      else void listMatches(id).then(setMatches)
    })
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => {
      unsub()
      window.removeEventListener('focus', onFocus)
    }
  }, [id, reload])

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])

  return { tournament, teams, matches, teamById, error, setError, reload }
}
