import { useEffect, useState } from 'react'
import { TeamLogo } from '../../components/TeamLogo'
import { getMatchState } from '../../lib/tournamentApi'
import type { GameState, Player, PlayerStats } from '../../types/game'
import type { Match, TournamentTeam } from '../../types/tournament'

interface Row {
  player: Player
  stats?: PlayerStats
}

function RosterTable({
  team,
  rows,
  withStats,
}: {
  team?: TournamentTeam
  rows: Row[]
  withStats: boolean
}) {
  return (
    <div className="roster-card">
      <h4 style={{ color: team?.color }}>
        {team && (
          <TeamLogo
            team={{ name: team.name, color: team.color, logo: team.logo, shortName: team.short_name }}
            size="sm"
          />
        )}
        {team?.name ?? 'TBD'}
      </h4>
      {rows.length === 0 ? (
        <p className="muted">Roster belum diisi.</p>
      ) : (
        <table className="roster-table">
          <thead>
            <tr>
              <th>No</th>
              <th className="name">Pemain</th>
              {withStats && (
                <>
                  <th>PTS</th>
                  <th>PF</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, stats }) => (
              <tr key={player.id} className={withStats && player.active ? 'on-court' : undefined}>
                <td>{player.number}</td>
                <td className="name">{player.name}</td>
                {withStats && (
                  <>
                    <td>
                      <strong>{stats?.pts ?? 0}</strong>
                    </td>
                    <td className={(stats?.pf ?? 0) >= 5 ? 'fouled-out' : undefined}>{stats?.pf ?? 0}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Roster kedua tim; laga live/selesai ikut menampilkan poin & foul per pemain. */
export function MatchRosters({
  match,
  home,
  away,
}: {
  match: Match
  home?: TournamentTeam
  away?: TournamentTeam
}) {
  const played = match.status !== 'scheduled'
  const [state, setState] = useState<GameState | null>(null)

  useEffect(() => {
    if (!played) return
    let active = true
    getMatchState(match.id)
      .then((s) => {
        if (active) setState(s)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [match.id, played, match.home_score, match.away_score, match.status, match.period])

  const rowsFor = (side: 'home' | 'away', team?: TournamentTeam): Row[] => {
    if (played && state) {
      return state[side].players.map((p) => ({ player: p, stats: state.playerStats[p.id] }))
    }
    return (team?.players ?? []).map((p) => ({ player: p }))
  }

  const withStats = played && state !== null

  return (
    <div className="match-rosters">
      <RosterTable team={home} rows={rowsFor('home', home)} withStats={withStats} />
      <RosterTable team={away} rows={rowsFor('away', away)} withStats={withStats} />
      {withStats && match.status === 'live' && (
        <p className="muted roster-legend">● = sedang di lapangan</p>
      )}
    </div>
  )
}
