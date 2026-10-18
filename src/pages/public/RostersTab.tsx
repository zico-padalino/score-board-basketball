import { TeamLogo } from '../../components/TeamLogo'
import type { TournamentTeam } from '../../types/tournament'

export function RostersTab({ teams }: { teams: TournamentTeam[] }) {
  if (teams.length === 0) {
    return (
      <section className="panel">
        <p className="muted">Belum ada tim.</p>
      </section>
    )
  }

  const sorted = [...teams].sort(
    (a, b) =>
      (a.group_name ?? '').localeCompare(b.group_name ?? '') || a.name.localeCompare(b.name),
  )
  const showGroup = new Set(teams.map((t) => t.group_name ?? '')).size > 1

  return (
    <div className="roster-grid">
      {sorted.map((team) => (
        <section key={team.id} className="panel roster-card team-roster">
          <h4 style={{ color: team.color }}>
            <TeamLogo
              team={{ name: team.name, color: team.color, logo: team.logo, shortName: team.short_name }}
              size="md"
            />
            <span>
              {team.name}
              {showGroup && team.group_name && <small>Grup {team.group_name}</small>}
            </span>
          </h4>
          {team.players?.length ? (
            <table className="roster-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th className="name">Pemain</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((p) => (
                  <tr key={p.id}>
                    <td>{p.number}</td>
                    <td className="name">{p.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Roster belum diisi.</p>
          )}
        </section>
      ))}
    </div>
  )
}
