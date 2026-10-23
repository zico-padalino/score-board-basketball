import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { listTournaments } from '../../lib/tournamentApi'
import type { Tournament } from '../../types/tournament'
import { FORMAT_LABELS } from '../../types/tournament'

export function PublicHomePage() {
  const [items, setItems] = useState<Tournament[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    listTournaments()
      .then(setItems)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <main className="page">
      <section className="setup-hero">
        <div>
          <h2>Turnamen</h2>
          <p>Jadwal pertandingan, skor live, klasemen, dan hasil.</p>
        </div>
        <Link className="btn btn-primary" to="/boxscore">
          Lihat Box Score
        </Link>
      </section>
      {!supabase && <p className="muted">Data turnamen belum tersedia.</p>}
      {error && <p className="logo-error">{error}</p>}
      <section className="panel">
        {items === null && supabase && <p className="muted">Memuat…</p>}
        {items?.length === 0 && <p className="muted">Belum ada turnamen.</p>}
        <ul className="tour-list">
          {items?.map((t) => (
            <li key={t.id}>
              <Link to={`/t/${t.id}`}>
                <strong>{t.name}</strong>
                <span className="tag">{FORMAT_LABELS[t.format]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
