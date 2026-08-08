import { useGameStore } from '../store/gameStore'
import type { Player, Team } from '../types/game'
import { fgPct, getReb, totalsFromPlayers } from '../utils/stats'

export function BoxScorePage() {
  const state = useGameStore()

  const renderTable = (team: Team) => {
    const rows = team.players.map((p: Player) => state.playerStats[p.id])
    const totals = totalsFromPlayers(rows.filter(Boolean))

    return (
      <div key={team.id}>
        <h3 className="section-title" style={{ color: team.color }}>
          {team.name}
        </h3>
        <div className="box-score">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th className="name">Pemain</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>FGM</th>
                <th>FGA</th>
                <th>FG%</th>
                <th>3PM</th>
                <th>3PA</th>
                <th>3P%</th>
                <th>FTM</th>
                <th>FTA</th>
                <th>FT%</th>
                <th>OREB</th>
                <th>DREB</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TOV</th>
                <th>PF</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map((p) => {
                const s = state.playerStats[p.id]
                if (!s) return null
                return (
                  <tr key={p.id}>
                    <td>{p.number}</td>
                    <td className="name">
                      {p.name}
                      {p.active ? ' *' : ''}
                    </td>
                    <td>—</td>
                    <td>
                      <strong>{s.pts}</strong>
                    </td>
                    <td>{s.fgm}</td>
                    <td>{s.fga}</td>
                    <td>{fgPct(s.fgm, s.fga)}</td>
                    <td>{s.tpm}</td>
                    <td>{s.tpa}</td>
                    <td>{fgPct(s.tpm, s.tpa)}</td>
                    <td>{s.ftm}</td>
                    <td>{s.fta}</td>
                    <td>{fgPct(s.ftm, s.fta)}</td>
                    <td>{s.oreb}</td>
                    <td>{s.dreb}</td>
                    <td>{getReb(s)}</td>
                    <td>{s.ast}</td>
                    <td>{s.stl}</td>
                    <td>{s.blk}</td>
                    <td>{s.tov}</td>
                    <td>{s.pf}</td>
                  </tr>
                )
              })}
              <tr className="totals">
                <td />
                <td className="name">TOTAL</td>
                <td />
                <td>{totals.pts}</td>
                <td>{totals.fgm}</td>
                <td>{totals.fga}</td>
                <td>{fgPct(totals.fgm, totals.fga)}</td>
                <td>{totals.tpm}</td>
                <td>{totals.tpa}</td>
                <td>{fgPct(totals.tpm, totals.tpa)}</td>
                <td>{totals.ftm}</td>
                <td>{totals.fta}</td>
                <td>{fgPct(totals.ftm, totals.fta)}</td>
                <td>{totals.oreb}</td>
                <td>{totals.dreb}</td>
                <td>{getReb(totals)}</td>
                <td>{totals.ast}</td>
                <td>{totals.stl}</td>
                <td>{totals.blk}</td>
                <td>{totals.tov}</td>
                <td>{totals.pf}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
          Cetak Box Score
        </button>
        <span className="muted">* = pemain di lapangan</span>
      </div>
      {renderTable(state.home)}
      {renderTable(state.away)}
    </main>
  )
}
