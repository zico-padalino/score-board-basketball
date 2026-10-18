import { useMemo, useState } from 'react'
import {
  assignSchedule,
  buildGroupMatches,
  buildKnockoutMatches,
  countGroupMatches,
  estimateMatchMinutes,
  scheduleEnd,
  matchMinutesOf,
  resolveSettings,
  seedsFromGroups,
  shuffle,
  standingsByGroup,
  type ScheduleOptions,
} from '../../lib/tournament'
import { useGameStore } from '../../store/gameStore'
import {
  deleteAllMatches,
  deleteStageMatches,
  insertMatches,
  updateMatch,
  updateTournament,
} from '../../lib/tournamentApi'
import type { Match, Tournament, TournamentTeam } from '../../types/tournament'
import { PERIOD_OPTIONS } from '../../types/tournament'
import { dayKey, formatDay, toLocalInput } from '../../utils/datetime'
import { MatchRow } from './MatchRow'

type Filter = 'all' | 'group' | 'knockout'

function defaultStart(matches: Match[]) {
  const firstPending = matches
    .filter((m) => m.status === 'scheduled' && m.scheduled_at)
    .map((m) => m.scheduled_at as string)
    .sort()[0]
  if (firstPending) return toLocalInput(firstPending)
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
    matchMinutes: matchMinutesOf(settings),
    breakMinutes: settings.breakMinutes ?? 15,
    perDay: 0,
    venue: '',
  }))
  const [periods, setPeriods] = useState(settings.periods)
  const [periodMinutes, setPeriodMinutes] = useState(settings.periodMinutes)
  const estimate = estimateMatchMinutes(periodMinutes, periods)
  const slotMinutes = opts.matchMinutes + opts.breakMinutes
  const periodName = periods === 4 ? 'kuarter' : 'babak'

  const pendingCount = matches.filter((m) => m.status === 'scheduled').length
  const previewCount =
    hasGroups && groupMatches.length === 0
      ? countGroupMatches(teams, settings.doubleRoundRobin)
      : pendingCount
  const previewEnd = scheduleEnd(previewCount, opts)

  const changeFormat = (nextPeriods: number, nextMinutes: number) => {
    const followEstimate = opts.matchMinutes === estimate
    setPeriods(nextPeriods)
    setPeriodMinutes(nextMinutes)
    if (followEstimate) {
      setOpts((o) => ({ ...o, matchMinutes: estimateMatchMinutes(nextMinutes, nextPeriods) }))
    }
  }

  const rememberTiming = () =>
    updateTournament(tournament.id, {
      settings: {
        ...tournament.settings,
        periods,
        periodMinutes,
        matchMinutes: opts.matchMinutes,
        breakMinutes: opts.breakMinutes,
      },
    })

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
      await rememberTiming()
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
      await rememberTiming()
    })

  const removeAll = () =>
    run(async () => {
      const played = matches.filter((m) => m.status !== 'scheduled').length
      const ok = window.confirm(
        `Hapus semua ${matches.length} laga di turnamen ini?` +
          (played ? `\n${played} laga sudah dimainkan — skor dan klasemennya ikut terhapus.` : '') +
          '\nTim dan roster tidak ikut terhapus.',
      )
      if (!ok) return
      await deleteAllMatches(tournament.id)
      const linked = useGameStore.getState().match
      if (linked && linked.tournamentId === tournament.id) useGameStore.setState({ match: null })
    })

  const retime = () =>
    run(async () => {
      const pending = matches
        .filter((m) => m.status === 'scheduled' && (filter === 'all' || m.stage === filter))
        .sort(
          (a, b) =>
            (a.stage === b.stage ? 0 : a.stage === 'group' ? -1 : 1) ||
            (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '') ||
            a.round - b.round ||
            a.bracket_index - b.bracket_index,
        )
      if (pending.length === 0) throw new Error('Tidak ada laga terjadwal yang bisa diatur ulang')
      const ok = window.confirm(
        `Atur ulang jam ${pending.length} laga yang belum dimainkan mulai ${new Date(opts.start).toLocaleString('id-ID')}, ` +
          `tiap laga ${opts.matchMinutes} menit + jeda ${opts.breakMinutes} menit?`,
      )
      if (!ok) return
      const timed = assignSchedule(pending, opts)
      await Promise.all(
        timed.map((m) => updateMatch(m.id, { scheduled_at: m.scheduled_at, venue: m.venue })),
      )
      await rememberTiming()
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
        <div className="grid-4">
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
            <label htmlFor="gMatch">Lama pertandingan (menit)</label>
            <input
              id="gMatch"
              type="number"
              min={10}
              step={5}
              value={opts.matchMinutes}
              onChange={(e) => setOpts({ ...opts, matchMinutes: Number(e.target.value) || estimate })}
            />
          </div>
          <div className="field">
            <label htmlFor="gBreak">Jeda antar laga (menit)</label>
            <input
              id="gBreak"
              type="number"
              min={0}
              step={5}
              value={opts.breakMinutes}
              onChange={(e) => setOpts({ ...opts, breakMinutes: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="field">
            <label htmlFor="gPerDayMode">Laga per hari</label>
            <select
              id="gPerDayMode"
              value={opts.perDay > 0 ? 'custom' : 'all'}
              onChange={(e) =>
                setOpts({ ...opts, perDay: e.target.value === 'all' ? 0 : opts.perDay || 4 })
              }
            >
              <option value="all">Semua selesai hari itu juga</option>
              <option value="custom">Atur jumlah per hari</option>
            </select>
          </div>
          {opts.perDay > 0 && (
            <div className="field">
              <label htmlFor="gPerDay">Jumlah laga per hari</label>
              <input
                id="gPerDay"
                type="number"
                min={1}
                value={opts.perDay}
                onChange={(e) => setOpts({ ...opts, perDay: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="gPeriods">Jumlah babak</label>
            <select
              id="gPeriods"
              value={periods}
              onChange={(e) => changeFormat(Number(e.target.value), periodMinutes)}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gPeriodMin">Menit per {periodName}</label>
            <input
              id="gPeriodMin"
              type="number"
              min={1}
              max={40}
              value={periodMinutes}
              onChange={(e) => changeFormat(periods, Math.max(1, Number(e.target.value) || 1))}
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
        {previewEnd && (
          <p className="timing-preview">
            {previewCount} laga
            {opts.perDay > 0 ? `, ${opts.perDay} per hari` : ' dalam satu hari'} · laga terakhir
            selesai sekitar{' '}
            <strong>
              {previewEnd.toLocaleString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
            {opts.perDay === 0 && previewEnd.toDateString() !== new Date(opts.start).toDateString() && (
              <span className="timing-warn">
                {' '}
                — melewati tengah malam. Mulai lebih awal, kurangi lama laga/jeda, atau atur jumlah
                laga per hari.
              </span>
            )}
          </p>
        )}
        <p className="muted timing-hint">
          Laga berikutnya mulai {slotMinutes} menit setelah laga sebelumnya ({opts.matchMinutes} menit
          main + {opts.breakMinutes} menit jeda). Perkiraan lama laga {periods}×{periodMinutes} menit:{' '}
          {estimate} menit (jam bersih, ditambah waktu jam berhenti dan jeda antar {periodName}).
          {opts.matchMinutes !== estimate && (
            <>
              {' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => setOpts({ ...opts, matchMinutes: estimate })}
              >
                Pakai perkiraan
              </button>
            </>
          )}
        </p>
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
          {matches.some((m) => m.status === 'scheduled') && (
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={retime}>
              Atur ulang jam jadwal yang ada
            </button>
          )}
          {matches.length > 0 && (
            <button className="btn btn-danger" type="button" disabled={busy} onClick={removeAll}>
              Hapus semua jadwal
            </button>
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
                matchMinutes={matchMinutesOf(settings)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
