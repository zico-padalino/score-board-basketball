import { useState } from 'react'
import { TeamLogo } from '../../components/TeamLogo'
import { countLines, groupLetters, shufflePlayersIntoTeams } from '../../lib/tournament'
import { saveTeam } from '../../lib/tournamentApi'
import type { Player } from '../../types/game'
import type { Match, Tournament, TournamentTeam } from '../../types/tournament'

const COLORS = ['#f26b12', '#17567a', '#2a9d8f', '#c1121f', '#6a4c93', '#f4a261', '#264653', '#8ac926']

type Mode = 'existing' | 'new'

interface Preview {
  name: string
  color: string
  logo: string
  team?: TournamentTeam
  players: Player[]
}

/** Masukkan nama-nama pemain lalu acak & bagi rata ke tim. */
export function ShufflePlayersPanel({
  tournament,
  teams,
  matches,
  groupCount,
  hasGroups,
  reload,
}: {
  tournament: Tournament
  teams: TournamentTeam[]
  matches: Match[]
  groupCount: number
  hasGroups: boolean
  reload: () => void
}) {
  const [names, setNames] = useState('')
  const [mode, setMode] = useState<Mode>(teams.length > 0 ? 'existing' : 'new')
  const [newCount, setNewCount] = useState(Math.max(2, teams.length || 2))
  const [preview, setPreview] = useState<Preview[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = countLines(names)
  const effectiveMode: Mode = teams.length === 0 ? 'new' : mode
  const teamCount = effectiveMode === 'existing' ? teams.length : newCount
  const perTeam = teamCount > 0 ? Math.floor(total / teamCount) : 0
  const extra = teamCount > 0 ? total % teamCount : 0

  const doShuffle = () => {
    setError(null)
    if (total < teamCount) {
      setError(`Minimal ${teamCount} nama untuk ${teamCount} tim`)
      return
    }
    const buckets = shufflePlayersIntoTeams(names, teamCount)
    setPreview(
      buckets.map((players, i) => {
        const team = effectiveMode === 'existing' ? teams[i] : undefined
        return {
          name: team?.name ?? `Tim ${teams.length + i + 1}`,
          color: team?.color ?? COLORS[(teams.length + i) % COLORS.length],
          logo: team?.logo ?? '',
          team,
          players,
        }
      }),
    )
  }

  const save = async () => {
    if (!preview) return
    const hasPlayed = matches.some((m) => m.status !== 'scheduled')
    const msg =
      effectiveMode === 'existing'
        ? `Ganti roster ${teams.length} tim dengan hasil acak ini?` +
          (hasPlayed ? '\nLaga yang sudah dibuka tetap memakai roster lama.' : '')
        : `Buat ${preview.length} tim baru dengan hasil acak ini?`
    if (!window.confirm(msg)) return
    setBusy(true)
    setError(null)
    try {
      const groups = groupLetters(groupCount)
      await Promise.all(
        preview.map((p, i) => {
          if (p.team) return saveTeam({ ...p.team, players: p.players })
          return saveTeam({
            tournament_id: tournament.id,
            name: p.name,
            short_name: p.name.replace(/\s+/g, '').slice(0, 3).toUpperCase(),
            color: p.color,
            logo: '',
            group_name: hasGroups ? groups[(teams.length + i) % groups.length] : null,
            players: p.players,
          })
        }),
      )
      setPreview(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel shuffle-panel">
      <h3>Acak pemain</h3>
      <p className="muted">
        Masukkan semua nama pemain, lalu sistem mengacak dan membagi rata ke tim. Tulis{' '}
        <code>4 Budi</code> untuk mempertahankan nomor punggung.
      </p>
      {error && <p className="logo-error">{error}</p>}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="shuffleNames">Nama pemain (satu per baris) · {total} pemain</label>
          <textarea
            id="shuffleNames"
            rows={10}
            value={names}
            placeholder={'Zico\nAndi\nBudi\nRizky\n...'}
            onChange={(e) => {
              setNames(e.target.value)
              setPreview(null)
            }}
          />
        </div>
        <div>
          {teams.length > 0 && (
            <div className="field">
              <label htmlFor="shuffleMode">Bagi ke</label>
              <select
                id="shuffleMode"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as Mode)
                  setPreview(null)
                }}
              >
                <option value="existing">{teams.length} tim yang sudah ada (roster diganti)</option>
                <option value="new">Tim baru</option>
              </select>
            </div>
          )}
          {effectiveMode === 'new' && (
            <div className="field">
              <label htmlFor="shuffleCount">Jumlah tim baru</label>
              <input
                id="shuffleCount"
                type="number"
                min={2}
                max={16}
                value={newCount}
                onChange={(e) => {
                  setNewCount(Math.max(2, Math.min(16, Number(e.target.value) || 2)))
                  setPreview(null)
                }}
              />
            </div>
          )}
          {total > 0 && teamCount > 0 && (
            <p className="timing-preview">
              {total} pemain → {teamCount} tim: {perTeam} pemain per tim
              {extra > 0 && `, ${extra} tim dapat 1 pemain tambahan`}.
            </p>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={busy || total === 0} onClick={doShuffle}>
              {preview ? 'Acak ulang' : 'Acak pemain'}
            </button>
            {preview && (
              <button type="button" className="btn btn-navy" disabled={busy} onClick={() => void save()}>
                {busy ? 'Menyimpan…' : 'Simpan ke tim'}
              </button>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <div className="roster-grid shuffle-preview">
          {preview.map((p) => (
            <div key={p.name} className="roster-card">
              <h4 style={{ color: p.color }}>
                <TeamLogo
                  team={{ name: p.name, color: p.color, logo: p.logo, shortName: p.name.slice(0, 3) }}
                  size="sm"
                />
                {p.name}
                <small>&nbsp;· {p.players.length} pemain</small>
              </h4>
              <table className="roster-table">
                <tbody>
                  {p.players.map((pl) => (
                    <tr key={pl.id}>
                      <td>{pl.number}</td>
                      <td className="name">{pl.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
