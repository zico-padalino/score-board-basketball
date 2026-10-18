import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTournamentData } from '../../hooks/useTournamentData'
import { matchMinutesOf, resolveSettings } from '../../lib/tournament'
import type { Match } from '../../types/tournament'
import { FORMAT_LABELS } from '../../types/tournament'
import { dayKey, formatDay } from '../../utils/datetime'
import { BracketTab } from '../tournament/BracketTab'
import { StandingsTab } from '../tournament/StandingsTab'
import { PublicMatchCard } from './PublicMatchCard'
import { ResultsTab } from './ResultsTab'

type Tab = 'jadwal' | 'klasemen' | 'hasil' | 'bagan'

export function PublicTournamentPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { tournament, teams, matches, teamById, error } = useTournamentData(id)

  const days = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of matches) {
      const key = dayKey(m.scheduled_at)
      map.set(key, [...(map.get(key) ?? []), m])
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)))
      .map(([key, list]) => ({
        key,
        label: formatDay(list[0].scheduled_at),
        list: [...list].sort(
          (a, b) =>
            (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '') ||
            a.round - b.round ||
            a.bracket_index - b.bracket_index,
        ),
      }))
  }, [matches])

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
          <Link className="btn btn-navy" to="/">
            Kembali
          </Link>
        </section>
      </main>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'jadwal', label: 'Jadwal' },
    ...(tournament.format !== 'knockout' ? [{ id: 'klasemen' as Tab, label: 'Klasemen' }] : []),
    { id: 'hasil', label: 'Hasil' },
    ...(tournament.format !== 'group' ? [{ id: 'bagan' as Tab, label: 'Bagan' }] : []),
  ]
  const requested = params.get('tab') as Tab | null
  const tab: Tab = tabs.some((t) => t.id === requested) ? (requested as Tab) : 'jadwal'
  const live = matches.filter((m) => m.status === 'live')
  const matchMinutes = matchMinutesOf(resolveSettings(tournament.settings))

  return (
    <main className="page wide">
      <section className="setup-hero tour-hero">
        <div>
          <Link to="/" className="muted no-print">
            ← Semua turnamen
          </Link>
          <h2>{tournament.name}</h2>
          <p>
            <span className="tag">{FORMAT_LABELS[tournament.format]}</span> {teams.length} tim ·{' '}
            {matches.length} laga
            {live.length > 0 && (
              <>
                {' '}
                · <span className="tag live">{live.length} live</span>
              </>
            )}
          </p>
        </div>
      </section>

      <div className="seg-tabs main no-print">
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
        <div className="tour-stack">
          {live.length > 0 && (
            <section className="panel live-panel">
              <h3>Sedang berlangsung</h3>
              <div className="match-list">
                {live.map((m) => (
                  <PublicMatchCard key={m.id} match={m} teamById={teamById} matchMinutes={matchMinutes} />
                ))}
              </div>
            </section>
          )}
          {days.length === 0 && (
            <section className="panel">
              <p className="muted">Jadwal belum tersedia.</p>
            </section>
          )}
          {days.map((day) => (
            <section key={day.key} className="panel">
              <h3>{day.label}</h3>
              <div className="match-list">
                {day.list.map((m) => (
                  <PublicMatchCard key={m.id} match={m} teamById={teamById} matchMinutes={matchMinutes} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {tab === 'klasemen' && <StandingsTab tournament={tournament} teams={teams} matches={matches} />}
      {tab === 'hasil' && <ResultsTab matches={matches} teamById={teamById} />}
      {tab === 'bagan' && <BracketTab matches={matches} teamById={teamById} />}
    </main>
  )
}
