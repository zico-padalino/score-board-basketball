import { BoxScoreTable } from '../components/BoxScoreTable'
import { useGameStore } from '../store/gameStore'

export function BoxScorePage() {
  const state = useGameStore()

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
      <BoxScoreTable team={state.home} playerStats={state.playerStats} />
      <BoxScoreTable team={state.away} playerStats={state.playerStats} />
    </main>
  )
}
