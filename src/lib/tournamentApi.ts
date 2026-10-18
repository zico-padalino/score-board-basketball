import type { GameState } from '../types/game'
import type {
  Match,
  Tournament,
  TournamentFormat,
  TournamentSettings,
  TournamentTeam,
} from '../types/tournament'
import { liveFromState } from './matchLive'
import { supabase } from './supabase'
import { matchWinner, type MatchDraft } from './tournament'

function db() {
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
  return supabase
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

export async function listTournaments(): Promise<Tournament[]> {
  return unwrap(
    await db().from('tournaments').select('*').order('created_at', { ascending: false }),
  )
}

export async function getTournament(id: string): Promise<Tournament | null> {
  return unwrap(await db().from('tournaments').select('*').eq('id', id).maybeSingle())
}

export async function createTournament(input: {
  name: string
  format: TournamentFormat
  settings: TournamentSettings
}): Promise<Tournament> {
  return unwrap(await db().from('tournaments').insert(input).select().single())
}

export async function updateTournament(
  id: string,
  patch: Partial<Pick<Tournament, 'name' | 'format' | 'settings'>>,
) {
  unwrap(await db().from('tournaments').update(patch).eq('id', id))
}

export async function deleteTournament(id: string) {
  unwrap(await db().from('tournaments').delete().eq('id', id))
}

export async function listTeams(tournamentId: string): Promise<TournamentTeam[]> {
  return unwrap(
    await db()
      .from('tournament_teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at'),
  )
}

export async function saveTeam(
  team: Omit<TournamentTeam, 'id'> & { id?: string },
): Promise<TournamentTeam> {
  return unwrap(await db().from('tournament_teams').upsert(team).select().single())
}

export async function updateTeams(teams: Pick<TournamentTeam, 'id' | 'group_name'>[]) {
  await Promise.all(
    teams.map(async (t) =>
      unwrap(
        await db().from('tournament_teams').update({ group_name: t.group_name }).eq('id', t.id),
      ),
    ),
  )
}

export async function deleteTeam(id: string) {
  unwrap(await db().from('tournament_teams').delete().eq('id', id))
}

export async function listMatches(tournamentId: string): Promise<Match[]> {
  return unwrap(
    await db()
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('round')
      .order('bracket_index'),
  )
}

export async function getMatch(id: string): Promise<Match | null> {
  return unwrap(await db().from('matches').select('*').eq('id', id).maybeSingle())
}

export async function insertMatches(matches: MatchDraft[]) {
  const ordered = [...matches].sort((a, b) => b.round - a.round)
  unwrap(await db().from('matches').insert(ordered))
}

export async function updateMatch(id: string, patch: Partial<Match>) {
  unwrap(await db().from('matches').update(patch).eq('id', id))
}

export async function deleteMatch(id: string) {
  unwrap(await db().from('matches').delete().eq('id', id))
}

export async function deleteAllMatches(tournamentId: string) {
  unwrap(await db().from('matches').delete().eq('tournament_id', tournamentId))
}

export async function deleteStageMatches(tournamentId: string, stage: Match['stage']) {
  unwrap(
    await db().from('matches').delete().eq('tournament_id', tournamentId).eq('stage', stage),
  )
}

export async function getMatchState(matchId: string): Promise<GameState | null> {
  const row = unwrap(
    await db().from('match_states').select('state').eq('match_id', matchId).maybeSingle(),
  ) as { state: GameState } | null
  return row?.state ?? null
}

export async function listMatchStates(matchIds: string[]): Promise<Map<string, GameState>> {
  if (matchIds.length === 0) return new Map()
  const rows = unwrap(
    await db().from('match_states').select('match_id,state').in('match_id', matchIds),
  ) as { match_id: string; state: GameState }[]
  return new Map(rows.map((r) => [r.match_id, r.state]))
}

export async function saveMatchProgress(matchId: string, state: GameState) {
  const live = liveFromState(state)
  const [a, b] = await Promise.all([
    db().from('matches').update(live).eq('id', matchId),
    db()
      .from('match_states')
      .upsert({ match_id: matchId, state, updated_at: live.live_at }),
  ])
  unwrap(a)
  unwrap(b)
  return live
}

export async function resetMatch(matchId: string) {
  await updateMatch(matchId, {
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    period: 1,
    clock_ms: 0,
    shot_clock_ms: 0,
    clock_running: false,
    live_at: null,
    period_scores: {},
  })
  unwrap(await db().from('match_states').delete().eq('match_id', matchId))
}

async function advanceWinner(match: Match, homeScore: number, awayScore: number) {
  const winner = matchWinner({ ...match, home_score: homeScore, away_score: awayScore })
  if (match.stage === 'knockout' && match.next_match_id && match.next_slot && winner) {
    await updateMatch(match.next_match_id, { [`${match.next_slot}_team_id`]: winner })
  }
}

/**
 * Koreksi skor laga dari jadwal. Kalau state scoreboard laga tersimpan, selisihnya
 * dicatat sebagai koreksi skor di babak terakhir supaya skor per babak & box score ikut sinkron.
 */
export async function editMatchScore(match: Match, homeScore: number, awayScore: number) {
  const state = await getMatchState(match.id)
  if (!state) {
    await updateMatch(match.id, { home_score: homeScore, away_score: awayScore })
  } else {
    const sum = (team: 'home' | 'away') =>
      state.scoreEvents.filter((e) => e.teamId === team).reduce((s, e) => s + e.points, 0)
    const adjust = (team: 'home' | 'away', target: number) => {
      const delta = target - sum(team)
      if (delta === 0) return []
      return [
        {
          id: `adj_${crypto.randomUUID().slice(0, 8)}`,
          teamId: team,
          playerId: null,
          points: delta,
          period: state.period,
          clockMs: state.clockMs,
          kind: 'adj' as const,
          timestamp: Date.now(),
        },
      ]
    }
    const next: GameState = {
      ...state,
      scoreEvents: [...state.scoreEvents, ...adjust('home', homeScore), ...adjust('away', awayScore)],
    }
    const live = liveFromState(next)
    await Promise.all([
      updateMatch(match.id, {
        home_score: live.home_score,
        away_score: live.away_score,
        period_scores: live.period_scores,
      }),
      db()
        .from('match_states')
        .upsert({ match_id: match.id, state: next, updated_at: new Date().toISOString() })
        .then(unwrap),
    ])
  }
  if (match.status === 'finished') await advanceWinner(match, homeScore, awayScore)
}

/** Simpan hasil akhir; di babak gugur pemenang otomatis masuk laga berikutnya. */
export async function finalizeMatch(matchId: string, gameState: GameState) {
  const match = await getMatch(matchId)
  if (!match) throw new Error('Laga tidak ditemukan')
  const live = await saveMatchProgress(matchId, { ...gameState, status: 'finished' })
  await advanceWinner(match, live.home_score, live.away_score)
}

/**
 * Ikuti perubahan laga turnamen ini. UPDATE dikirim sebagai baris baru;
 * INSERT/DELETE memanggil `onChange()` tanpa argumen supaya daftar dimuat ulang.
 */
export function subscribeTournament(
  tournamentId: string,
  onChange: (updated?: Match) => void,
) {
  if (!supabase) return () => undefined
  const client = supabase
  const channel = client
    .channel(`tournament:${tournamentId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
      (payload) => {
        if (payload.eventType === 'UPDATE') onChange(payload.new as Match)
        else onChange()
      },
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}
