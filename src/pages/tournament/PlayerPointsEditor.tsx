import { useEffect, useState } from 'react'
import { flushGameSave } from '../../hooks/useScoreboardSync'
import { getMatchState, savePlayerPoints } from '../../lib/tournamentApi'
import { useGameStore } from '../../store/gameStore'
import type { GameState, Player } from '../../types/game'
import type { Match, TournamentTeam } from '../../types/tournament'
import { teamScore } from '../../utils/stats'

/** Bagi poin tim ke pemain untuk laga yang poinnya tidak tercatat per pemain. */
export function PlayerPointsEditor({
  match,
  home,
  away,
  onClose,
  onSaved,
}: {
  match: Match
  home?: TournamentTeam
  away?: TournamentTeam
  onClose: () => void
  onSaved: () => void
}) {
  const store = useGameStore.getState()
  const loaded = store.match?.id === match.id
  const [state, setState] = useState<GameState | null>(loaded ? store : null)
  const [points, setPoints] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loaded) return
    getMatchState(match.id)
      .then((s) => {
        if (!s) setError('Statistik laga ini belum tersedia. Buka laga di scoreboard dulu.')
        setState(s)
      })
      .catch((e: Error) => setError(e.message))
  }, [loaded, match.id])

  useEffect(() => {
    if (!state) return
    const init: Record<string, string> = {}
    for (const p of [...state.home.players, ...state.away.players]) {
      init[p.id] = String(state.playerStats[p.id]?.pts ?? 0)
    }
    setPoints(init)
  }, [state])

  if (!state) {
    return <div className="pp-editor">{error ? <p className="logo-error">{error}</p> : <p className="muted">Memuat…</p>}</div>
  }

  const value = (pid: string) => Math.max(0, Number.parseInt(points[pid] ?? '0', 10) || 0)

  const renderTeam = (side: 'home' | 'away', players: Player[], label: string) => {
    const total = teamScore(state.scoreEvents, side)
    const assigned = players.reduce((s, p) => s + value(p.id), 0)
    const left = total - assigned
    return (
      <div className="pp-team">
        <header>
          <strong>{label}</strong>
          <span className={`pp-left ${left === 0 ? 'ok' : left < 0 ? 'over' : ''}`}>
            Skor {total} · {left === 0 ? 'semua poin terbagi' : left > 0 ? `sisa ${left} poin` : `kelebihan ${-left}`}
          </span>
        </header>
        <div className="pp-rows">
          {players.map((p) => (
            <label key={p.id} className="pp-row">
              <b>{p.number}</b>
              <span>{p.name}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={points[p.id] ?? '0'}
                onChange={(e) => setPoints((cur) => ({ ...cur, [p.id]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  const over = (['home', 'away'] as const).some((side) => {
    const players = state[side].players
    return players.reduce((s, p) => s + value(p.id), 0) > teamScore(state.scoreEvents, side)
  })

  const onSave = async () => {
    if (over && !window.confirm('Jumlah poin pemain melebihi skor tim. Tetap simpan?')) return
    const payload = Object.fromEntries(Object.keys(points).map((pid) => [pid, value(pid)]))
    setBusy(true)
    setError(null)
    try {
      if (loaded && useGameStore.getState().match?.id === match.id) {
        useGameStore.getState().setPlayerPoints(payload)
        flushGameSave()
      } else {
        await savePlayerPoints(match.id, payload)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pp-editor">
      <p className="muted">
        Isi poin tiap pemain. Skor tim tidak berubah. Poin yang belum dibagi tetap tampil sebagai
        "Poin tim" di box score.
      </p>
      {error && <p className="logo-error">{error}</p>}
      <div className="pp-teams">
        {renderTeam('home', state.home.players, home?.name ?? state.home.name)}
        {renderTeam('away', state.away.players, away?.name ?? state.away.name)}
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-sm btn-navy" disabled={busy} onClick={() => void onSave()}>
          {busy ? 'Menyimpan…' : 'Simpan poin pemain'}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
          Tutup
        </button>
      </div>
    </div>
  )
}
