import { TeamLogo } from '../components/TeamLogo'
import { useGameStore } from '../store/gameStore'
import { formatClock, periodLabel, periodsOf, regularPeriods } from '../utils/format'
import { periodScore, teamFoulsInPeriod, teamScore } from '../utils/stats'
import type { Team } from '../types/game'

export function ScoresheetPage() {
  const state = useGameStore()
  const periodCount = periodsOf(state.config)
  const periods = regularPeriods(periodCount)
  const label = (p: number) => periodLabel(p, periodCount)
  const homeScore = teamScore(state.scoreEvents, 'home')
  const awayScore = teamScore(state.scoreEvents, 'away')

  const renderTeamSheet = (team: Team) => {
    const teamId = team.id
    return (
      <div key={teamId}>
        <div className="team-title" style={{ color: team.color }}>
          <TeamLogo team={team} size="sm" />
          {team.name}
        </div>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th className="name">Pemain</th>
              {periods.map((p) => (
                <th key={p}>{label(p)}</th>
              ))}
              <th>OT</th>
              <th>PTS</th>
              <th>PF</th>
              <th>ON</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p) => {
              const st = state.playerStats[p.id]
              const playerEvents = state.scoreEvents.filter(
                (e) => e.playerId === p.id,
              )
              const q = (period: number) =>
                playerEvents
                  .filter((e) => e.period === period)
                  .reduce((s, e) => s + e.points, 0)
              const ot = playerEvents
                .filter((e) => e.period > periodCount)
                .reduce((s, e) => s + e.points, 0)
              return (
                <tr key={p.id}>
                  <td>{p.number}</td>
                  <td className="name">{p.name}</td>
                  {periods.map((pp) => (
                    <td key={pp}>{q(pp) || ''}</td>
                  ))}
                  <td>{ot || ''}</td>
                  <td>
                    <strong>{st?.pts ?? 0}</strong>
                  </td>
                  <td>{st?.pf ?? 0}</td>
                  <td>{p.active ? '●' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <table style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>Team Fouls</th>
              {periods.map((p) => (
                <th key={p}>{label(p)}</th>
              ))}
              <th>Timeouts</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total</td>
              {periods.map((p) => (
                <td key={p}>{teamFoulsInPeriod(state, teamId, p)}</td>
              ))}
              <td>
                {team.timeoutsUsed}/{state.config.timeoutsPerTeam}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <main className="page wide">
      <div className="btn-row no-print" style={{ marginBottom: '1rem' }}>
        <button
          className="btn btn-navy"
          type="button"
          onClick={() => window.print()}
        >
          Cetak Scoresheet
        </button>
      </div>

      <div className="scoresheet">
        <header className="scoresheet-header">
          <div>
            <div className="muted">OFFICIAL SCORESHEET</div>
            <h2 className="scoresheet-matchup">
              <TeamLogo team={state.home} size="sm" />
              <span>{state.home.name}</span>
              <em>vs</em>
              <span>{state.away.name}</span>
              <TeamLogo team={state.away} size="sm" />
            </h2>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="muted">PERIOD</div>
            <strong style={{ fontSize: '1.4rem' }}>
              {label(state.period)}
            </strong>
            <div className="muted">{formatClock(state.clockMs)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '3rem',
                lineHeight: 1,
              }}
            >
              {homeScore} – {awayScore}
            </div>
            <div className="muted">FINAL / RUNNING</div>
          </div>
        </header>

        <table>
          <thead>
            <tr>
              <th>Tim</th>
              {periods.map((p) => (
                <th key={p}>{label(p)}</th>
              ))}
              <th>OT</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(['home', 'away'] as const).map((id) => {
              const team = state[id]
              const ot = state.scoreEvents
                .filter((e) => e.teamId === id && e.period > periodCount)
                .reduce((s, e) => s + e.points, 0)
              return (
                <tr key={id}>
                  <td className="name">
                    <strong>{team.name}</strong>
                  </td>
                  {periods.map((p) => (
                    <td key={p}>{periodScore(state.scoreEvents, id, p)}</td>
                  ))}
                  <td>{ot}</td>
                  <td>
                    <strong>{teamScore(state.scoreEvents, id)}</strong>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {renderTeamSheet(state.home)}
        {renderTeamSheet(state.away)}

        <div className="running-score">
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              Running Score — {state.home.name}
            </h3>
            <ol>
              {state.scoreEvents
                .filter((e) => e.teamId === 'home')
                .map((e, idx) => {
                  const player = state.home.players.find((p) => p.id === e.playerId)
                  const running = state.scoreEvents
                    .filter((x) => x.teamId === 'home')
                    .slice(0, idx + 1)
                    .reduce((s, x) => s + x.points, 0)
                  return (
                    <li key={e.id}>
                      <span>
                        {label(e.period)} {formatClock(e.clockMs)} · #
                        {e.kind === 'adj' ? 'koreksi' : (player?.number ?? '—')} {e.points > 0 ? '+' + e.points : e.points}
                      </span>
                      <span>{running}</span>
                    </li>
                  )
                })}
            </ol>
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              Running Score — {state.away.name}
            </h3>
            <ol>
              {state.scoreEvents
                .filter((e) => e.teamId === 'away')
                .map((e, idx) => {
                  const player = state.away.players.find((p) => p.id === e.playerId)
                  const running = state.scoreEvents
                    .filter((x) => x.teamId === 'away')
                    .slice(0, idx + 1)
                    .reduce((s, x) => s + x.points, 0)
                  return (
                    <li key={e.id}>
                      <span>
                        {label(e.period)} {formatClock(e.clockMs)} · #
                        {e.kind === 'adj' ? 'koreksi' : (player?.number ?? '—')} {e.points > 0 ? '+' + e.points : e.points}
                      </span>
                      <span>{running}</span>
                    </li>
                  )
                })}
            </ol>
          </div>
        </div>
      </div>
    </main>
  )
}
