export type TeamId = 'home' | 'away'
export type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 // 5+ = OT

export type StatEventType =
  | 'fg2_made'
  | 'fg2_miss'
  | 'fg3_made'
  | 'fg3_miss'
  | 'ft_made'
  | 'ft_miss'
  | 'reb_off'
  | 'reb_def'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'foul_personal'
  | 'foul_technical'
  | 'foul_unsportsmanlike'
  | 'timeout'
  | 'period_start'
  | 'period_end'
  | 'sub_in'
  | 'sub_out'

export interface Player {
  id: string
  number: string
  name: string
  active: boolean // on court
}

export interface PlayerStats {
  playerId: string
  pts: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
  plusMinus: number
}

export interface Team {
  id: TeamId
  name: string
  shortName: string
  color: string
  /** URL path or data URL for team logo */
  logo: string
  players: Player[]
  timeoutsUsed: number
  periodFouls: Record<number, number>
}

export interface ScoreEvent {
  id: string
  teamId: TeamId
  playerId: string | null
  points: number
  period: Period
  clockMs: number
  kind: '1' | '2' | '3'
  timestamp: number
}

export interface GameEvent {
  id: string
  type: StatEventType
  teamId: TeamId
  playerId: string | null
  period: Period
  clockMs: number
  points?: number
  note?: string
  timestamp: number
}

export interface GameConfig {
  periodLengthMs: number
  otLengthMs: number
  shotClockMs: number
  maxPersonalFouls: number
  timeoutsPerTeam: number
  playersOnCourt: number
}

/** Laga turnamen yang sedang dimainkan di scoreboard. */
export interface MatchLink {
  id: string
  tournamentId: string
  label: string
}

export interface GameState {
  status: 'setup' | 'ready' | 'live' | 'paused' | 'finished'
  match: MatchLink | null
  config: GameConfig
  home: Team
  away: Team
  period: Period
  clockMs: number
  shotClockMs: number
  clockRunning: boolean
  possession: TeamId | null
  scoreEvents: ScoreEvent[]
  events: GameEvent[]
  playerStats: Record<string, PlayerStats>
  createdAt: number
}

export const DEFAULT_CONFIG: GameConfig = {
  periodLengthMs: 10 * 60 * 1000,
  otLengthMs: 5 * 60 * 1000,
  shotClockMs: 24 * 1000,
  maxPersonalFouls: 5,
  timeoutsPerTeam: 5,
  playersOnCourt: 5,
}
