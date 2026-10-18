import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createTournament, listTournaments } from '../lib/tournamentApi'
import type { Tournament, TournamentFormat } from '../types/tournament'
import { DEFAULT_TOURNAMENT_SETTINGS, FORMAT_LABELS } from '../types/tournament'

export function TournamentsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Tournament[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('group_knockout')
  const [settings, setSettings] = useState(DEFAULT_TOURNAMENT_SETTINGS)

  useEffect(() => {
    if (!supabase) return
    listTournaments()
      .then(setItems)
      .catch((e: Error) => setError(e.message))
  }, [])

  const onCreate = async () => {
    if (!name.trim()) {
      setError('Nama turnamen wajib diisi')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const t = await createTournament({ name: name.trim(), format, settings })
      navigate(`/turnamen/${t.id}?tab=tim`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat turnamen')
      setBusy(false)
    }
  }

  if (!supabase) {
    return (
      <main className="page">
        <section className="panel">
          <h2>Turnamen</h2>
          <p className="muted">
            Fitur turnamen butuh Supabase. Isi <code>VITE_SUPABASE_URL</code> dan{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> lalu jalankan <code>supabase/schema.sql</code>.
          </p>
        </section>
      </main>
    )
  }

  const hasGroups = format !== 'knockout'

  return (
    <main className="page">
      <section className="setup-hero">
        <div>
          <h2>Turnamen</h2>
          <p>
            Buat jadwal sistem grup dan/atau gugur, lalu buka tiap laga di scoreboard.
            Klasemen dihitung otomatis: menang 3 poin, kalah 1 poin.
          </p>
        </div>
      </section>

      {error && <p className="logo-error">{error}</p>}

      <div className="grid-2">
        <section className="panel">
          <h3>Daftar turnamen</h3>
          {items === null && <p className="muted">Memuat…</p>}
          {items?.length === 0 && <p className="muted">Belum ada turnamen.</p>}
          <ul className="tour-list">
            {items?.map((t) => (
              <li key={t.id}>
                <Link to={`/turnamen/${t.id}`}>
                  <strong>{t.name}</strong>
                  <span className="tag">{FORMAT_LABELS[t.format]}</span>
                  <span className="muted">
                    {new Date(t.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h3>Turnamen baru</h3>
          <div className="field">
            <label htmlFor="tName">Nama turnamen</label>
            <input
              id="tName"
              value={name}
              placeholder="mis. Liga Antar Kampus 2026"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="tFormat">Sistem</label>
            <select
              id="tFormat"
              value={format}
              onChange={(e) => setFormat(e.target.value as TournamentFormat)}
            >
              {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {hasGroups && (
            <div className="grid-2">
              <div className="field">
                <label htmlFor="tGroups">Jumlah grup</label>
                <input
                  id="tGroups"
                  type="number"
                  min={1}
                  max={16}
                  value={settings.groupCount}
                  onChange={(e) =>
                    setSettings({ ...settings, groupCount: Number(e.target.value) || 1 })
                  }
                />
              </div>
              {format === 'group_knockout' && (
                <div className="field">
                  <label htmlFor="tAdvance">Lolos per grup</label>
                  <input
                    id="tAdvance"
                    type="number"
                    min={1}
                    max={8}
                    value={settings.advancePerGroup}
                    onChange={(e) =>
                      setSettings({ ...settings, advancePerGroup: Number(e.target.value) || 1 })
                    }
                  />
                </div>
              )}
            </div>
          )}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="tPeriod">Durasi kuarter (menit)</label>
              <input
                id="tPeriod"
                type="number"
                min={1}
                max={20}
                value={settings.periodMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, periodMinutes: Number(e.target.value) || 10 })
                }
              />
            </div>
            {hasGroups && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={settings.doubleRoundRobin}
                  onChange={(e) =>
                    setSettings({ ...settings, doubleRoundRobin: e.target.checked })
                  }
                />
                Kandang–tandang (2 putaran)
              </label>
            )}
          </div>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={onCreate}>
            {busy ? 'Membuat…' : 'Buat turnamen'}
          </button>
        </section>
      </div>
    </main>
  )
}
