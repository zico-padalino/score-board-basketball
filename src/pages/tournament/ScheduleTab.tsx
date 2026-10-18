import { useMemo, useState } from 'react'
import {
  assignSchedule,
  buildGroupMatches,
  buildKnockoutMatches,
  resolveSettings,
  seedsFromGroups,
  shuffle,
  standingsByGroup,
  type ScheduleOptions,
} from '../../lib/tournament'
import { deleteStageMatches, insertMatches } from '../../lib/tournamentApi'
import type { Match, Tournament, TournamentTeam } from '../../types/tournament'
import { dayKey, formatDay, toLocalInput } from '../../utils/datetime'
import { MatchRow } from './MatchRow'

type Filter = 'all' | 'group' | 'knockout'

function defaultStart(matches: Match[]) {
  const last = matches
    .map((m) => m.scheduled_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop()
  const d = last ? new Date(last) : new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

export function ScheduleTab({
  tournament,
  teams,
  matches,
  teamById,
  onOpen,
  reload,
}: {
  tournament: Tournament
  teams: TournamentTeam[]
  matches: Match[]
  teamById: Map<string, TournamentTeam>
  onOpen: (match: Match) => void
  reload: () => void
}) {
  const settings = resolveSettings(tournament.settings)
  const hasGroups = tournament.format !== 'knockout'
  const hasKnockout = tournament.format !== 'group'
  const groupMatches = matches.filter((m) => m.stage === 'group')
  const knockoutMatches = matches.filter((m) => m.stage === 'knockout')

  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shuffleSeeds, setShuffleSeeds] = useState(false)
  const [opts, setOpts] = useState<ScheduleOptions>(() => ({
    start: defaultStart(matches),
    gapMinutes: 90,
    perDay: 4,
    venue: '',
  }))

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

  const confirmReplace = (existing: Match[], what: string) => {
    if (existing.length === 0) return true
    const played = existing.some((m) => m.status !== 'scheduled')
    return window.confirm(
      played
        ? `Jadwal ${what} sudah ada dan sebagian sudah dimainkan. Buat ulang akan MENGHAPUS hasilnya. Lanjutkan?`
        : `Ganti jadwal ${what} yang sudah ada?`,
    )
  }

  const generateGroups = () =>
    run(async () => {
      const unassigned = teams.filter((t) => !t.group_name)
      if (teams.length < 2) throw new Error('Minimal 2 tim')
      if (unassigned.length && settings.groupCount > 1) {
        throw new Error(`Atur grup dulu untuk: ${unassigned.map((t) => t.name).join(', ')}`)
      }
      if (!confirmReplace(groupMatches, 'grup')) return
      const drafts = assignSchedule(
        buildGroupMatches(tournament.id, teams, settings.doubleRoundRobin),
        opts,
      )
      if (groupMatches.length) await deleteStageMatches(tournament.id, 'group')
      await insertMatches(drafts)
    })

  const generateKnockout = () =>
    run(async () => {
      let seeds: string[]
      if (tournament.format === 'group_knockout') {
        if (groupMatches.length === 0) throw new Error('Buat dan mainkan jadwal grup dulu')
        const pending = groupMatches.filter((m) => m.status !== 'finished').length
        if (
          pending > 0 &&
          !window.confirm(`${pending} laga grup belum selesai. Tetap buat babak gugur dari klasemen sekarang?`)
        ) {
          return
        }
        seeds = seedsFromGroups(standingsByGroup(teams, groupMatches), settings.advancePerGroup)
      } else {
        seeds = teams.map((t) => t.id)
        if (shuffleSeeds) seeds = shuffle(seeds)
      }
      if (seeds.length < 2) throw new Error('Minimal 2 tim untuk babak gugur')
      if (!confirmReplace(knockoutMatches, 'gugur')) return
      const drafts = assignSchedule(buildKnockoutMatches(tournament.id, seeds), opts)
      if (knockoutMatches.length) await deleteStageMatches(tournament.id, 'knockout')
      await insertMatches(drafts)
    })

  const visible = matches.filter((m) => filter === 'all' || m.stage === filter)
  const days = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of visible) {
      const key = dayKey(m.scheduled_at)
      map.set(key, [...(map.get(key) ?? []), m])
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)))
      .map(([key, list]) => ({
        key,
        label: formatDay(list[0].scheduled_at),
        list: list.sort(
          (a, b) =>
            (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '') ||
            a.round - b.round ||
            a.bracket_index - b.bracket_index,
        ),
      }))
  }, [visible])

  return (
    <div className="tour-stack">
      <details className="panel tour-generator" open={matches.length === 0}>
        <summary>
          <h3>Buat jadwal</h3>
        </summary>
        {error && <p className="logo-error">{error}</p>}
        <div className="grid-3">
          <div className="field">
            <label htmlFor="gStart">Mulai</label>
            <input
              id="gStart"
              type="datetime-local"
              value={opts.start}
              onChange={(e) => setOpts({ ...opts, start: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="gGap">Jeda antar laga (menit)</label>
            <input
              id="gGap"
              type="number"
              min={15}
              step={15}
              value={opts.gapMinutes}
              onChange={(e) => setOpts({ ...opts, gapMinutes: Number(e.target.value) || 90 })}
            />
          </div>
          <div className="field">
            <label htmlFor="gPerDay">Laga per hari</label>
            <input
              id="gPerDay"
              type="number"
              min={1}
              value={opts.perDay}
              onChange={(e) => setOpts({ ...opts, perDay: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="gVenue">Lapangan</label>
          <input
            id="gVenue"
            value={opts.venue}
            placeholder="mis. GOR Untirta"
            onChange={(e) => setOpts({ ...opts, venue: e.target.value })}
          />
        </div>
        <div className="btn-row">
          {hasGroups && (
            <button className="btn btn-primary" type="button" disabled={busy} onClick={generateGroups}>
              {groupMatches.length ? 'Buat ulang jadwal grup' : 'Buat jadwal grup'}
            </button>
          )}
          {hasKnockout && (
            <button className="btn btn-navy" type="button" disabled={busy} onClick={generateKnockout}>
              {tournament.format === 'group_knockout'
                ? `Buat babak gugur (${settings.advancePerGroup} teratas tiap grup)`
                : knockoutMatches.length
                  ? 'Buat ulang bagan gugur'
                  : 'Buat bagan gugur'}
            </button>
          )}
          {tournament.format === 'knockout' && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={shuffleSeeds}
                onChange={(e) => setShuffleSeeds(e.target.checked)}
              />
              Acak urutan tim (undian)
            </label>
          )}
        </div>
        <p className="muted">
          {hasGroups && 'Jadwal grup: setiap tim bertemu semua lawan di grupnya. '}
          {hasKnockout &&
            'Bagan gugur: jumlah tim yang bukan 4/8/16 membuat tim unggulan dapat bye. '}
          Tanggal, lapangan, dan tim tiap laga bisa diubah lewat tombol Edit.
        </p>
      </details>

      {tournament.format === 'group_knockout' && (
        <div className="seg-tabs">
          {(['all', 'group', 'knockout'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Semua' : f === 'group' ? 'Grup' : 'Gugur'}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 && (
        <section className="panel">
          <p className="muted">Belum ada jadwal. Tambahkan tim lalu klik "Buat jadwal".</p>
        </section>
      )}

      {days.map((day) => (
        <section key={day.key} className="panel">
          <h3>{day.label}</h3>
          <div className="match-list">
            {day.list.map((m) => (
              <MatchRow
                key={`${m.id}-${m.scheduled_at}-${m.home_team_id}-${m.away_team_id}`}
                match={m}
                teams={teams}
                teamById={teamById}
                onOpen={onOpen}
                onChanged={reload}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
