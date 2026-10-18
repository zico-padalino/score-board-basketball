import type { GameState, Player } from './game'

export type TournamentFormat = 'group_knockout' | 'group' | 'knockout'
export type MatchStage = 'group' | 'knockout'
export type MatchStatus = 'scheduled' | 'live' | 'finished'

export interface TournamentSettings {
  groupCount: number
  advancePerGroup: number
  doubleRoundRobin: boolean
  periodMinutes: number
}

export interface Tournament {
  id: string
  name: string
  format: TournamentFormat
  settings: Partial<TournamentSettings>
  created_at: string
}

export interface TournamentTeam {
  id: string
  tournament_id: string
  name: string
  short_name: string
  color: string
  logo: string
  group_name: string | null
  players: Player[]
}

export interface Match {
  id: string
  tournament_id: string
  stage: MatchStage
  group_name: string | null
  round: number
  round_label: string
  bracket_index: number
  home_team_id: string | null
  away_team_id: string | null
  next_match_id: string | null
  next_slot: 'home' | 'away' | null
  scheduled_at: string | null
  venue: string
  status: MatchStatus
  home_score: number
  away_score: number
  period: number
  clock_ms: number
  shot_clock_ms: number
  clock_running: boolean
  live_at: string | null
  period_scores: PeriodScores
}

export interface PeriodScores {
  home?: number[]
  away?: number[]
}

/** Kolom live yang ditulis scoreboard ke baris laga. */
export type MatchLive = Pick<
  Match,
  | 'status'
  | 'home_score'
  | 'away_score'
  | 'period'
  | 'clock_ms'
  | 'shot_clock_ms'
  | 'clock_running'
  | 'live_at'
  | 'period_scores'
>

export interface MatchStateRow {
  match_id: string
  state: GameState
}

export interface StandingRow {
  team: TournamentTeam
  played: number
  won: number
  lost: number
  pointsFor: number
  pointsAgainst: number
  diff: number
  points: number
}

export const DEFAULT_TOURNAMENT_SETTINGS: TournamentSettings = {
  groupCount: 2,
  advancePerGroup: 2,
  doubleRoundRobin: false,
  periodMinutes: 10,
}

export const WIN_POINTS = 3
export const LOSS_POINTS = 1

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  group_knockout: 'Grup + Gugur',
  group: 'Grup / Liga saja',
  knockout: 'Gugur saja',
}
