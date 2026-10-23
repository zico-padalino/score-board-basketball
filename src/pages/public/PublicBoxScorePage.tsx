import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentData } from '../../hooks/useTournamentData'
import { supabase } from '../../lib/supabase'
import { listTournaments } from '../../lib/tournamentApi'
import type { Tournament } from '../../types/tournament'
import { BoxScoreTab } from './BoxScoreTab'

export function PublicBoxScorePage() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    listTournaments()
      .then((items) => {
        setTournaments(items)
        setSelectedId((current) => current || items[0]?.id || '')
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const selected = tournaments?.find((tournament) => tournament.id === selectedId)

  return (
    <main className="page wide">
      <section className="setup-hero">
        <div>
          <h2>Box Score</h2>
          <p>Statistik pemain dan hasil pertandingan turnamen.</p>
        </div>
      </section>

      {!supabase && <p className="muted">Data turnamen belum tersedia.</p>}
      {error && <p className="logo-error">{error}</p>}

      <section className="panel">
        <div className="field">
          <label htmlFor="publicBoxScoreTournament">Pilih turnamen</label>
          <select
            id="publicBoxScoreTournament"
            value={selectedId}
            disabled={!tournaments?.length}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {tournaments?.length ? (
              tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))
            ) : (
              <option value="">
                {!supabase
                  ? 'Supabase belum dikonfigurasi'
                  : tournaments
                    ? 'Belum ada turnamen'
                    : 'Memuat turnamen…'}
              </option>
            )}
          </select>
        </div>
        {selected && (
          <Link className="btn btn-ghost" to={`/t/${selected.id}?tab=boxscore`}>
            Buka halaman turnamen
          </Link>
        )}
      </section>

      {selected && <SelectedTournamentBoxScore key={selected.id} tournament={selected} />}
    </main>
  )
}

function SelectedTournamentBoxScore({ tournament }: { tournament: Tournament }) {
  const { tournament: loadedTournament, matches, teamById, error } = useTournamentData(tournament.id)

  if (error) return <p className="logo-error">{error}</p>
  if (loadedTournament === undefined) return <p className="muted">Memuat box score…</p>
  if (loadedTournament === null) return <p className="muted">Turnamen tidak ditemukan.</p>

  return <BoxScoreTab matches={matches} teamById={teamById} />
}
