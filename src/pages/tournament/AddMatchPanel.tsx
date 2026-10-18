import { useMemo, useState } from 'react'
import { standingsByGroup } from '../../lib/tournament'
import { insertMatches } from '../../lib/tournamentApi'
import type { Match, TournamentTeam } from '../../types/tournament'
import { fromLocalInput, toLocalInput } from '../../utils/datetime'

const KINDS = [
  { id: 'final', label: 'Final', ranks: [0, 1] },
  { id: 'third', label: 'Perebutan Juara 3', ranks: [2, 3] },
  { id: 'semi', label: 'Semifinal', ranks: [0, 3] },
  { id: 'custom', label: 'Laga lain (nama sendiri)', ranks: [0, 1] },
] as const

type KindId = (typeof KINDS)[number]['id']

/** Tambah laga final / tambahan dengan memilih sendiri tim yang bertanding. */
export function AddMatchPanel({
  tournamentId,
  teams,
  matches,
  matchMinutes,
  breakMinutes,
  onAdded,
}: {
  tournamentId: string
  teams: TournamentTeam[]
  matches: Match[]
  matchMinutes: number
  breakMinutes: number
  onAdded: () => void
}) {
  /** Urutan tim dari klasemen grup (gabungan semua grup). */
  const ranked = useMemo(() => {
    const groups = standingsByGroup(teams, matches.filter((m) => m.stage === 'group'))
    return groups
      .flatMap((g) => g.rows)
      .sort((a, b) => b.points - a.points || b.diff - a.diff || b.pointsFor - a.pointsFor)
      .map((r) => r.team.id)
  }, [teams, matches])

  const defaultStart = useMemo(() => {
    const last = matches
      .map((m) => m.scheduled_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop()
    if (!last) return ''
    const d = new Date(new Date(last).getTime() + (matchMinutes + breakMinutes) * 60000)
    return toLocalInput(d.toISOString())
  }, [matches, matchMinutes, breakMinutes])

  const lastVenue = [...matches].reverse().find((m) => m.venue)?.venue ?? ''

  const pickFor = (kind: KindId) => {
    const ranks = KINDS.find((k) => k.id === kind)?.ranks ?? [0, 1]
    return [ranked[ranks[0]] ?? '', ranked[ranks[1]] ?? '']
  }

  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<KindId>('final')
  const [customName, setCustomName] = useState('')
  const [homeId, setHomeId] = useState('')
  const [awayId, setAwayId] = useState('')
  const [when, setWhen] = useState('')
  const [venue, setVenue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    const [h, a] = pickFor('final')
    setKind('final')
    setHomeId(h)
    setAwayId(a)
    setWhen(defaultStart)
    setVenue(lastVenue)
    setError(null)
    setOpen(true)
  }

  const changeKind = (next: KindId) => {
    setKind(next)
    const [h, a] = pickFor(next)
    setHomeId(h)
    setAwayId(a)
  }

  const label =
    kind === 'custom' ? customName.trim() || 'Laga tambahan' : KINDS.find((k) => k.id === kind)!.label

  const add = async () => {
    if (!homeId || !awayId) {
      setError('Pilih kedua tim')
      return
    }
    if (homeId === awayId) {
      setError('Tim home dan away tidak boleh sama')
      return
    }
    const knockout = matches.filter((m) => m.stage === 'knockout')
    const round = Math.max(0, ...knockout.map((m) => m.round)) + (kind === 'final' ? 1 : 0) || 1
    setBusy(true)
    setError(null)
    try {
      await insertMatches([
        {
          id: crypto.randomUUID(),
          tournament_id: tournamentId,
          stage: 'knockout',
          group_name: null,
          round,
          round_label: label,
          bracket_index: knockout.filter((m) => m.round === round).length,
          home_team_id: homeId,
          away_team_id: awayId,
          next_match_id: null,
          next_slot: null,
          scheduled_at: fromLocalInput(when),
          venue: venue.trim(),
          status: 'scheduled',
          home_score: 0,
          away_score: 0,
        },
      ])
      setOpen(false)
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah laga')
    } finally {
      setBusy(false)
    }
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '—'
  const rankOf = (id: string) => {
    const i = ranked.indexOf(id)
    return i >= 0 ? ` (peringkat ${i + 1})` : ''
  }

  if (!open) {
    return (
      <section className="panel add-match">
        <div className="panel-head">
          <h3>Laga final</h3>
          <button type="button" className="btn btn-primary" disabled={teams.length < 2} onClick={start}>
            + Tambah laga final
          </button>
        </div>
        <p className="muted">
          Tambahkan Final, perebutan juara 3, atau laga lain, lalu pilih sendiri tim yang bertanding.
          Laga ini tidak dihitung ke klasemen grup.
        </p>
      </section>
    )
  }

  return (
    <section className="panel add-match">
      <h3>Tambah laga final</h3>
      {error && <p className="logo-error">{error}</p>}
      <div className="grid-3">
        <div className="field">
          <label htmlFor="amKind">Jenis laga</label>
          <select id="amKind" value={kind} onChange={(e) => changeKind(e.target.value as KindId)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {kind === 'custom' && (
          <div className="field">
            <label htmlFor="amName">Nama laga</label>
            <input
              id="amName"
              value={customName}
              placeholder="mis. Laga Eksibisi"
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="amHome">Tim home</label>
          <select id="amHome" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
            <option value="">— pilih tim —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {rankOf(t.id)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="amAway">Tim away</label>
          <select id="amAway" value={awayId} onChange={(e) => setAwayId(e.target.value)}>
            <option value="">— pilih tim —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {rankOf(t.id)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="amWhen">Tanggal & jam</label>
          <input id="amWhen" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="amVenue">Lapangan</label>
          <input id="amVenue" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
      </div>
      {homeId && awayId && homeId !== awayId && (
        <p className="timing-preview">
          <strong>{label}</strong>: {teamName(homeId)} vs {teamName(awayId)}
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void add()}>
          {busy ? 'Menambah…' : 'Tambah ke jadwal'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Batal
        </button>
      </div>
    </section>
  )
}
