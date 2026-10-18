import type { GameState } from '../types/game'
import type {
  Match,
  Tournament,
  TournamentFormat,
  TournamentSettings,
  TournamentTeam,
} from '../types/tournament'
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

export async function deleteStageMatches(tournamentId: string, stage: Match['stage']) {
  unwrap(
    await db().from('matches').delete().eq('tournament_id', tournamentId).eq('stage', stage),
  )
}

/** Simpan hasil akhir; di babak gugur pemenang otomatis masuk laga berikutnya. */
export async function finalizeMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
  gameState: GameState,
) {
  const match = await getMatch(matchId)
  if (!match) throw new Error('Laga tidak ditemukan')
  await updateMatch(matchId, {
    status: 'finished',
    home_score: homeScore,
    away_score: awayScore,
    game_state: gameState,
  })
  const winner = matchWinner({ ...match, home_score: homeScore, away_score: awayScore })
  if (match.stage === 'knockout' && match.next_match_id && match.next_slot && winner) {
    await updateMatch(match.next_match_id, { [`${match.next_slot}_team_id`]: winner })
  }
}

/** Panggil `onChange` setiap ada perubahan laga/tim turnamen ini. */
export function subscribeTournament(tournamentId: string, onChange: () => void) {
  if (!supabase) return () => undefined
  const client = supabase
  const channel = client
    .channel(`tournament:${tournamentId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
      onChange,
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}
