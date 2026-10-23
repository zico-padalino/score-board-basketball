import { BoxScoreTable } from '../components/BoxScoreTable'
import { Link } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { teamScore } from '../utils/stats'

export function BoxScorePage() {
  const state = useGameStore()

  return (
    <main className="page wide">
      <div className="btn-row no-print" style={{ marginBottom: '1rem' }}>
        <Link className="btn btn-ghost" to="/boxscore">
          Box Score turnamen
        </Link>
        <button
          className="btn btn-navy"
          type="button"
          onClick={() => window.print()}
        >
          Cetak Box Score
        </button>
        <span className="muted">* = pemain di lapangan</span>
      </div>
      <BoxScoreTable
        team={state.home}
        playerStats={state.playerStats}
        teamScore={teamScore(state.scoreEvents, 'home')}
      />
      <BoxScoreTable
        team={state.away}
        playerStats={state.playerStats}
        teamScore={teamScore(state.scoreEvents, 'away')}
      />
    </main>
  )
}
