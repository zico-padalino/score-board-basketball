import type {
  GameState,
  PlayerStats,
  ScoreEvent,
  TeamId,
} from '../types/game'

export function emptyStats(playerId: string): PlayerStats {
  return {
    playerId,
    pts: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    plusMinus: 0,
  }
}

export function teamScore(events: ScoreEvent[], teamId: TeamId): number {
  return events
    .filter((e) => e.teamId === teamId)
    .reduce((sum, e) => sum + e.points, 0)
}

export function periodScore(
  events: ScoreEvent[],
  teamId: TeamId,
  period: number,
): number {
  return events
    .filter((e) => e.teamId === teamId && e.period === period)
    .reduce((sum, e) => sum + e.points, 0)
}

export function teamFoulsInPeriod(
  state: GameState,
  teamId: TeamId,
  period: number,
): number {
  const team = teamId === 'home' ? state.home : state.away
  return team.periodFouls[period] ?? 0
}

export function fgPct(made: number, att: number): string {
  if (att === 0) return '—'
  return `${Math.round((made / att) * 100)}%`
}

export function totalsFromPlayers(stats: PlayerStats[]): PlayerStats {
  return stats.reduce(
    (acc, s) => ({
      playerId: 'team',
      pts: acc.pts + s.pts,
      fgm: acc.fgm + s.fgm,
      fga: acc.fga + s.fga,
      tpm: acc.tpm + s.tpm,
      tpa: acc.tpa + s.tpa,
      ftm: acc.ftm + s.ftm,
      fta: acc.fta + s.fta,
      oreb: acc.oreb + s.oreb,
      dreb: acc.dreb + s.dreb,
      ast: acc.ast + s.ast,
      stl: acc.stl + s.stl,
      blk: acc.blk + s.blk,
      tov: acc.tov + s.tov,
      pf: acc.pf + s.pf,
      plusMinus: acc.plusMinus + s.plusMinus,
    }),
    emptyStats('team'),
  )
}

export function getReb(s: PlayerStats): number {
  return s.oreb + s.dreb
}
