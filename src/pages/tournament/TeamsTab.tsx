import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TeamLogo } from '../../components/TeamLogo'
import { uploadLogo } from '../../lib/supabase'
import {
  groupLetters,
  parseRoster,
  resolveSettings,
  rosterToText,
  shuffle,
} from '../../lib/tournament'
import {
  deleteTeam,
  deleteTournament,
  saveTeam,
  updateTeams,
  updateTournament,
} from '../../lib/tournamentApi'
import type { Match, Tournament, TournamentSettings, TournamentTeam } from '../../types/tournament'
import { PERIOD_OPTIONS } from '../../types/tournament'

const COLORS = ['#e85d04', '#1d3557', '#2a9d8f', '#c1121f', '#6a4c93', '#f4a261', '#264653', '#8ac926']

interface TeamForm {
  id?: string
  name: string
  color: string
  logo: string
  group_name: string
  roster: string
}

function emptyForm(index: number): TeamForm {
  return { name: '', color: COLORS[index % COLORS.length], logo: '', group_name: '', roster: '' }
}

export function TeamsTab({
  tournament,
  teams,
  matches,
  reload,
}: {
  tournament: Tournament
  teams: TournamentTeam[]
  matches: Match[]
  reload: () => void
}) {
  const navigate = useNavigate()
  const settings = resolveSettings(tournament.settings)
  const hasGroups = tournament.format !== 'knockout'
  const groups = groupLetters(settings.groupCount)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<TeamForm>(() => emptyForm(teams.length))
  const [draftSettings, setDraftSettings] = useState<TournamentSettings>(settings)
  const [name, setName] = useState(tournament.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = () =>
    run(async () => {
      if (!form.name.trim()) throw new Error('Nama tim wajib diisi')
      const teamName = form.name.trim()
      await saveTeam({
        ...(form.id ? { id: form.id } : {}),
        tournament_id: tournament.id,
        name: teamName,
        short_name: teamName.slice(0, 3).toUpperCase(),
        color: form.color,
        logo: form.logo,
        group_name: hasGroups ? form.group_name || (groups.length === 1 ? 'A' : null) : null,
        players: parseRoster(form.roster),
      })
      setForm(emptyForm(teams.length + 1))
    })

  const onEdit = (t: TournamentTeam) => {
    setForm({
      id: t.id,
      name: t.name,
      color: t.color,
      logo: t.logo,
      group_name: t.group_name ?? '',
      roster: rosterToText(t.players ?? []),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onDelete = (t: TournamentTeam) => {
    const used = matches.some((m) => m.home_team_id === t.id || m.away_team_id === t.id)
    const msg = used
      ? `Hapus ${t.name}? Tim ini sudah ada di jadwal — slotnya akan jadi kosong.`
      : `Hapus ${t.name}?`
    if (!window.confirm(msg)) return
    void run(() => deleteTeam(t.id))
  }

  const onLogo = (file: File | undefined) => {
    if (!file) return
    void run(async () => {
      if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar')
      if (file.size > 1.5 * 1024 * 1024) throw new Error('Ukuran logo maks 1.5 MB')
      const url = await uploadLogo(file, `t-${tournament.id}`)
      setForm((f) => ({ ...f, logo: url }))
    })
  }

  const randomizeGroups = () => {
    if (teams.length === 0) return
    if (!window.confirm('Acak ulang grup semua tim?')) return
    void run(() =>
      updateTeams(
        shuffle(teams).map((t, i) => ({ id: t.id, group_name: groups[i % groups.length] })),
      ),
    )
  }

  const setGroup = (t: TournamentTeam, group: string) =>
    run(() => updateTeams([{ id: t.id, group_name: group || null }]))

  const saveSettings = () =>
    run(() => updateTournament(tournament.id, { name: name.trim() || tournament.name, settings: draftSettings }))

  const removeTournament = () => {
    if (!window.confirm(`Hapus turnamen "${tournament.name}" beserta semua tim dan jadwalnya?`)) return
    void run(async () => {
      await deleteTournament(tournament.id)
      navigate('/admin/turnamen')
    })
  }

  return (
    <div className="tour-stack">
      {error && <p className="logo-error">{error}</p>}
      <div className="grid-2">
        <section className="panel">
          <h3>{form.id ? 'Edit tim' : 'Tambah tim'}</h3>
          <div className="logo-picker" style={{ marginBottom: '0.85rem' }}>
            <TeamLogo
              team={{ name: form.name || '?', color: form.color, logo: form.logo, shortName: form.name.slice(0, 3) }}
              size="lg"
            />
            <div className="logo-actions">
              <button type="button" className="btn btn-sm btn-navy" disabled={busy} onClick={() => fileRef.current?.click()}>
                Upload logo
              </button>
              {form.logo && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm({ ...form, logo: '' })}>
                  Hapus logo
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={(e) => {
                  onLogo(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="teamName">Nama tim</label>
              <input id="teamName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="teamColor">Warna</label>
              <input id="teamColor" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          {hasGroups && groups.length > 1 && (
            <div className="field">
              <label htmlFor="teamGroup">Grup</label>
              <select id="teamGroup" value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })}>
                <option value="">— pilih / acak nanti —</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    Grup {g}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="teamRoster">Roster (satu pemain per baris: nomor nama)</label>
            <textarea
              id="teamRoster"
              rows={6}
              value={form.roster}
              placeholder={'4 Budi\n7 Andi\n11 Rizky'}
              onChange={(e) => setForm({ ...form, roster: e.target.value })}
            />
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onSubmit}>
              {form.id ? 'Simpan tim' : 'Tambah tim'}
            </button>
            {form.id && (
              <button type="button" className="btn btn-ghost" onClick={() => setForm(emptyForm(teams.length))}>
                Batal
              </button>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Tim ({teams.length})</h3>
            {hasGroups && groups.length > 1 && (
              <button type="button" className="btn btn-sm btn-navy" disabled={busy || teams.length === 0} onClick={randomizeGroups}>
                Acak grup
              </button>
            )}
          </div>
          {teams.length === 0 && <p className="muted">Belum ada tim.</p>}
          <ul className="team-list">
            {teams.map((t) => (
              <li key={t.id}>
                <TeamLogo team={{ name: t.name, color: t.color, logo: t.logo, shortName: t.short_name }} size="sm" />
                <div>
                  <strong>{t.name}</strong>
                  <span className="muted">{t.players?.length || 0} pemain</span>
                </div>
                {hasGroups && groups.length > 1 && (
                  <select value={t.group_name ?? ''} disabled={busy} onChange={(e) => void setGroup(t, e.target.value)}>
                    <option value="">—</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(t)}>
                  Edit
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDelete(t)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h3>Pengaturan turnamen</h3>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="sName">Nama</label>
            <input id="sName" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {hasGroups && (
            <div className="field">
              <label htmlFor="sGroups">Jumlah grup</label>
              <input
                id="sGroups"
                type="number"
                min={1}
                max={16}
                value={draftSettings.groupCount}
                onChange={(e) => setDraftSettings({ ...draftSettings, groupCount: Number(e.target.value) || 1 })}
              />
            </div>
          )}
          {tournament.format === 'group_knockout' && (
            <div className="field">
              <label htmlFor="sAdvance">Lolos per grup</label>
              <input
                id="sAdvance"
                type="number"
                min={1}
                max={8}
                value={draftSettings.advancePerGroup}
                onChange={(e) => setDraftSettings({ ...draftSettings, advancePerGroup: Number(e.target.value) || 1 })}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="sPeriods">Jumlah babak</label>
            <select
              id="sPeriods"
              value={draftSettings.periods}
              onChange={(e) => setDraftSettings({ ...draftSettings, periods: Number(e.target.value) })}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sPeriod">Menit per {draftSettings.periods === 4 ? 'kuarter' : 'babak'}</label>
            <input
              id="sPeriod"
              type="number"
              min={1}
              max={20}
              value={draftSettings.periodMinutes}
              onChange={(e) => setDraftSettings({ ...draftSettings, periodMinutes: Number(e.target.value) || 10 })}
            />
          </div>
          {hasGroups && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={draftSettings.doubleRoundRobin}
                onChange={(e) => setDraftSettings({ ...draftSettings, doubleRoundRobin: e.target.checked })}
              />
              Kandang–tandang (2 putaran)
            </label>
          )}
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-navy" disabled={busy} onClick={() => void saveSettings()}>
            Simpan pengaturan
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={removeTournament}>
            Hapus turnamen
          </button>
        </div>
      </section>
    </div>
  )
}
