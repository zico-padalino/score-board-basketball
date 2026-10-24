import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTournamentData } from '../hooks/useTournamentData'
import { hasUnfinishedOtherGame, openMatchInScoreboard } from '../lib/matchLauncher'
import { supabase } from '../lib/supabase'
import {
  assignSchedule,
  buildKnockoutMatches,
  matchWinner,
  matchMinutesOf,
  resolveSettings,
  seedsFromGroups,
  standingsByGroup,
} from '../lib/tournament'
import { deleteStageMatches, insertMatches, updateMatch } from '../lib/tournamentApi'
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
  const [creatingBracket, setCreatingBracket] = useState(false)

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

  const createBracket = async () => {
    setError(null)
    setCreatingBracket(true)
    try {
      const knockoutMatches = matches.filter((match) => match.stage === 'knockout')
      if (
        knockoutMatches.length > 0 &&
        !window.confirm(
          `Generate ulang bagan akan menghapus ${knockoutMatches.length} pertandingan gugur yang ada, termasuk skor dan pertandingan yang sedang berlangsung. Lanjutkan?`,
        )
      ) {
        return
      }

      let seeds: string[]
      if (tournament.format === 'group_knockout') {
        const groupMatches = matches.filter((match) => match.stage === 'group')
        if (groupMatches.length === 0) throw new Error('Buat jadwal grup terlebih dahulu.')
        const pending = groupMatches.filter((match) => match.status !== 'finished').length
        if (
          pending > 0 &&
          !window.confirm(
            `${pending} laga grup belum selesai. Tetap buat babak gugur dari klasemen sekarang?`,
          )
        ) {
          return
        }
        const settings = resolveSettings(tournament.settings)
        seeds = seedsFromGroups(
          standingsByGroup(teams, groupMatches),
          settings.advancePerGroup,
        )
      } else {
        seeds = teams.map((team) => team.id)
      }

      if (seeds.length < 2) throw new Error('Minimal 2 tim untuk babak gugur.')

      const settings = resolveSettings(tournament.settings)
      const matchMinutes = matchMinutesOf(settings)
      const breakMinutes = settings.breakMinutes ?? 15
      const lastScheduled = matches
        .map((match) => match.scheduled_at)
        .filter((scheduledAt): scheduledAt is string => Boolean(scheduledAt))
        .map((scheduledAt) => new Date(scheduledAt))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0]
      const nextSlot = lastScheduled
        ? new Date(lastScheduled.getTime() + (matchMinutes + breakMinutes) * 60_000)
        : null
      const now = new Date()
      const start = nextSlot && nextSlot > now ? nextSlot : new Date(now)
      if (!nextSlot || nextSlot <= now) {
        start.setDate(start.getDate() + 1)
        start.setHours(9, 0, 0, 0)
      }
      const venue = [...matches].reverse().find((match) => match.venue)?.venue ?? ''
      const drafts = assignSchedule(buildKnockoutMatches(tournament.id, seeds), {
        start: start.toISOString(),
        matchMinutes,
        breakMinutes,
        perDay: 0,
        venue,
      })
      if (knockoutMatches.length > 0) {
        await deleteStageMatches(tournament.id, 'knockout')
      }
      await insertMatches(drafts)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat bagan gugur')
    } finally {
      setCreatingBracket(false)
    }
  }

  const moveBracketMatch = async (match: Match, target: Match) => {
    setError(null)
    try {
      if (match.id === target.id) return
      if (
        !window.confirm(
          `Pindahkan ${match.round_label} ke slot ${target.round_label} · game ${target.bracket_index + 1}? Data dan skor pertandingan tetap dipertahankan. Posisi laga tujuan akan bertukar.`,
        )
      ) {
        return
      }

      const position = (item: Match) => ({
        round: item.round,
        round_label: item.round_label,
        bracket_index: item.bracket_index,
        next_match_id: item.next_match_id,
        next_slot: item.next_slot,
      })
      const matchPosition = position(match)
      const targetPosition = position(target)

      for (const item of [match, target]) {
        const winner = item.status === 'finished' ? matchWinner(item) : null
        if (winner && item.next_match_id && item.next_slot) {
          const next = matches.find((candidate) => candidate.id === item.next_match_id)
          if (next?.[`${item.next_slot}_team_id`] === winner) {
            await updateMatch(next.id, { [`${item.next_slot}_team_id`]: null })
          }
        }
      }

      await updateMatch(match.id, targetPosition)
      await updateMatch(target.id, matchPosition)

      for (const [item, nextMatchId, nextSlot] of [
        [match, targetPosition.next_match_id, targetPosition.next_slot],
        [target, matchPosition.next_match_id, matchPosition.next_slot],
      ] as const) {
        const winner = item.status === 'finished' ? matchWinner(item) : null
        if (winner && nextMatchId && nextSlot) {
          await updateMatch(nextMatchId, { [`${nextSlot}_team_id`]: winner })
        }
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memindahkan pertandingan')
    }
  }

  const updateBracketTeams = async (match: Match, homeId: string, awayId: string) => {
    if (!homeId || !awayId || homeId === awayId) {
      throw new Error('Pilih dua tim yang berbeda.')
    }
    await updateMatch(match.id, { home_team_id: homeId, away_team_id: awayId })
    await reload()
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
      {tab === 'bagan' && (
        <BracketTab
          matches={matches}
          teamById={teamById}
          onOpen={onOpen}
          onCreateBracket={createBracket}
          creatingBracket={creatingBracket}
          format={tournament.format}
          teams={teams}
          onMoveMatch={moveBracketMatch}
          onUpdateTeams={updateBracketTeams}
        />
      )}
      {tab === 'tim' && (
        <TeamsTab tournament={tournament} teams={teams} matches={matches} reload={reload} />
      )}
    </main>
  )
}
