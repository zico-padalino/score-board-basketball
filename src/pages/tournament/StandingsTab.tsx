import { TeamLogo } from '../../components/TeamLogo'
import { resolveSettings, standingsByGroup } from '../../lib/tournament'
import type { Match, Tournament, TournamentTeam } from '../../types/tournament'
import { LOSS_POINTS, WIN_POINTS } from '../../types/tournament'

export function StandingsTab({
  tournament,
  teams,
  matches,
}: {
  tournament: Tournament
  teams: TournamentTeam[]
  matches: Match[]
}) {
  const settings = resolveSettings(tournament.settings)
  const qualify = tournament.format === 'group_knockout' ? settings.advancePerGroup : 0
  const groups = standingsByGroup(
    teams,
    matches.filter((m) => m.stage === 'group'),
  )

  if (teams.length === 0) {
    return (
      <section className="panel">
        <p className="muted">Belum ada tim.</p>
      </section>
    )
  }

  return (
    <div className="tour-stack">
      <p className="muted">
        Menang = {WIN_POINTS} poin · Kalah = {LOSS_POINTS} poin · Urutan: poin, selisih skor, skor
        dicetak. Hanya laga grup yang sudah selesai di scoreboard yang dihitung.
        {qualify > 0 && ` ${qualify} tim teratas tiap grup lolos ke babak gugur.`}
      </p>
      <div className={groups.length > 1 ? 'grid-2' : undefined}>
        {groups.map(({ group, rows }) => (
          <div key={group} className="box-score standings">
            {groups.length > 1 && <h3 className="section-title">Grup {group}</h3>}
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="name">Tim</th>
                  <th title="Main">M</th>
                  <th title="Menang">W</th>
                  <th title="Kalah">L</th>
                  <th title="Skor dicetak">PF</th>
                  <th title="Skor kemasukan">PA</th>
                  <th title="Selisih">+/-</th>
                  <th>Poin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.team.id} className={i < qualify ? 'qualify' : undefined}>
                    <td>{i + 1}</td>
                    <td className="name">
                      <span className="st-team">
                        <TeamLogo
                          team={{
                            name: r.team.name,
                            color: r.team.color,
                            logo: r.team.logo,
                            shortName: r.team.short_name,
                          }}
                          size="sm"
                        />
                        {r.team.name}
                      </span>
                    </td>
                    <td>{r.played}</td>
                    <td>{r.won}</td>
                    <td>{r.lost}</td>
                    <td>{r.pointsFor}</td>
                    <td>{r.pointsAgainst}</td>
                    <td>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                    <td>
                      <strong>{r.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
