import { TeamLogo } from '../../components/TeamLogo'
import type { Match, TournamentTeam } from '../../types/tournament'
import { formatDay, formatTime } from '../../utils/datetime'

function periodHeaders(count: number) {
  return Array.from({ length: count }, (_, i) => (i < 4 ? `Q${i + 1}` : `OT${i - 3}`))
}

export function ResultsTab({
  matches,
  teamById,
}: {
  matches: Match[]
  teamById: Map<string, TournamentTeam>
}) {
  const results = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))

  if (results.length === 0) {
    return (
      <section className="panel">
        <p className="muted">Belum ada laga yang selesai.</p>
      </section>
    )
  }

  return (
    <div className="tour-stack">
      <div className="btn-row no-print">
        <button type="button" className="btn btn-navy" onClick={() => window.print()}>
          Cetak hasil
        </button>
      </div>
      {results.map((m) => {
        const home = m.home_team_id ? teamById.get(m.home_team_id) : undefined
        const away = m.away_team_id ? teamById.get(m.away_team_id) : undefined
        const homeQ = m.period_scores?.home ?? []
        const awayQ = m.period_scores?.away ?? []
        const count = Math.max(4, homeQ.length, awayQ.length)
        const rows = [
          { team: home, q: homeQ, total: m.home_score, won: m.home_score > m.away_score },
          { team: away, q: awayQ, total: m.away_score, won: m.away_score > m.home_score },
        ]
        return (
          <div key={m.id} className="box-score result-card">
            <p className="result-meta">
              <strong>{m.round_label}</strong> · {formatDay(m.scheduled_at)} {formatTime(m.scheduled_at)}
              {m.venue && ` · ${m.venue}`}
            </p>
            <table>
              <thead>
                <tr>
                  <th className="name">Tim</th>
                  {periodHeaders(count).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.won ? 'winner-row' : undefined}>
                    <td className="name">
                      <span className="st-team">
                        {r.team && (
                          <TeamLogo
                            team={{
                              name: r.team.name,
                              color: r.team.color,
                              logo: r.team.logo,
                              shortName: r.team.short_name,
                            }}
                            size="sm"
                          />
                        )}
                        {r.team?.name ?? 'TBD'}
                      </span>
                    </td>
                    {Array.from({ length: count }, (_, p) => (
                      <td key={p}>{r.q[p] ?? 0}</td>
                    ))}
                    <td>
                      <strong>{r.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
