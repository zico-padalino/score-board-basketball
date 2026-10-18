import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTournamentData } from '../hooks/useTournamentData'
import { hasUnfinishedOtherGame, openMatchInScoreboard } from '../lib/matchLauncher'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/gameStore'
import type { Match } from '../types/tournament'
import { FORMAT_LABELS } from '../types/tournament'
import { BracketTab } from './tournament/BracketTab'
import { ScheduleTab } from './tournament/ScheduleTab'
import { StandingsTab } from './tournament/StandingsTab'
import { TeamsTab } from './tournament/TeamsTab'

type Tab = 'jadwal' | 'klasemen' | 'bagan' | 'tim'

export function TournamentPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { tournament, teams, matches, teamById, error, setError, reload } = useTournamentData(id)
  const [opening, setOpening] = useState<string | null>(null)

  if (!supabase) {
    return (
      <main className="page">
        <section className="panel">
          <p className="muted">Fitur turnamen butuh Supabase.</p>
        </section>
      </main>
    )
  }

  if (tournament === undefined) {
    return (
      <main className="page">
        {error ? <p className="logo-error">{error}</p> : <p className="muted">Memuat…</p>}
      </main>
    )
  }

  if (tournament === null) {
    return (
      <main className="page">
        <section className="panel">
          <p className="muted">Turnamen tidak ditemukan.</p>
          <Link className="btn btn-navy" to="/admin/turnamen">
            Kembali
          </Link>
        </section>
      </main>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'jadwal', label: 'Jadwal' },
    ...(tournament.format !== 'knockout' ? [{ id: 'klasemen' as Tab, label: 'Klasemen' }] : []),
    ...(tournament.format !== 'group' ? [{ id: 'bagan' as Tab, label: 'Bagan Gugur' }] : []),
    { id: 'tim', label: 'Tim & Pengaturan' },
  ]
  const requested = params.get('tab') as Tab | null
  const tab: Tab = tabs.some((t) => t.id === requested) ? (requested as Tab) : 'jadwal'

  const onOpen = async (match: Match) => {
    const home = match.home_team_id ? teamById.get(match.home_team_id) : undefined
    const away = match.away_team_id ? teamById.get(match.away_team_id) : undefined
    if (!home || !away) return
    if (hasUnfinishedOtherGame(match.id)) {
      const cur = useGameStore.getState()
      const ok = window.confirm(
        `Scoreboard sedang memainkan ${cur.home.name} vs ${cur.away.name} (belum diakhiri). ` +
          `Skor terakhirnya sudah tersimpan. Pindah ke ${home.name} vs ${away.name}?`,
      )
      if (!ok) return
    }
    setOpening(match.id)
    try {
      await openMatchInScoreboard(match, home, away, tournament)
      navigate('/admin/operator')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuka game')
      setOpening(null)
    }
  }

  const live = matches.filter((m) => m.status === 'live').length
  const done = matches.filter((m) => m.status === 'finished').length

  return (
    <main className="page wide">
      <section className="setup-hero tour-hero">
        <div>
          <Link to="/admin/turnamen" className="muted">
            ← Semua turnamen
          </Link>
          <h2>{tournament.name}</h2>
          <p>
            <span className="tag">{FORMAT_LABELS[tournament.format]}</span> {teams.length} tim ·{' '}
            {matches.length} laga · {done} selesai
            {live > 0 && (
              <>
                {' '}
                · <span className="tag live">{live} live</span>
              </>
            )}
          </p>
        </div>
      </section>

      {error && <p className="logo-error">{error}</p>}
      {opening && <p className="muted">Membuka game…</p>}

      <div className="seg-tabs main">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'jadwal' && (
        <ScheduleTab
          tournament={tournament}
          teams={teams}
          matches={matches}
          teamById={teamById}
          onOpen={onOpen}
          reload={reload}
        />
      )}
      {tab === 'klasemen' && <StandingsTab tournament={tournament} teams={teams} matches={matches} />}
      {tab === 'bagan' && <BracketTab matches={matches} teamById={teamById} onOpen={onOpen} />}
      {tab === 'tim' && (
        <TeamsTab tournament={tournament} teams={teams} matches={matches} reload={reload} />
      )}
    </main>
  )
}
