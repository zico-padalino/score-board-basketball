import type { Player } from '../types/game'
import type {
  Match,
  StandingRow,
  TournamentSettings,
  TournamentTeam,
} from '../types/tournament'
import {
  DEFAULT_TOURNAMENT_SETTINGS,
  LOSS_POINTS,
  WIN_POINTS,
} from '../types/tournament'
import { uid } from '../utils/format'

export type MatchDraft = Omit<
  Match,
  'period' | 'clock_ms' | 'shot_clock_ms' | 'clock_running' | 'live_at' | 'period_scores'
>

export function resolveSettings(
  settings: Partial<TournamentSettings> | undefined,
): TournamentSettings {
  return { ...DEFAULT_TOURNAMENT_SETTINGS, ...settings }
}

export function groupLetters(count: number): string[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) =>
    String.fromCharCode(65 + i),
  )
}

export function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** "4 Budi" per baris → roster; 5 pemain pertama jadi starter. */
export function parseRoster(text: string): Player[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(/^#?(\d{1,3})[\s.,-]+(.+)$/)
      return {
        id: uid('tp'),
        number: m ? m[1] : String(i + 1),
        name: (m ? m[2] : line).trim(),
        active: i < 5,
      }
    })
}

/**
 * Acak daftar pemain (satu per baris) lalu bagi rata ke `teamCount` tim.
 * Baris "4 Budi" mempertahankan nomor punggung; tanpa nomor diberi urutan.
 */
export function shufflePlayersIntoTeams(text: string, teamCount: number): Player[][] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const count = Math.max(1, teamCount)
  const buckets: string[][] = Array.from({ length: count }, () => [])
  shuffle(lines).forEach((line, i) => buckets[i % count].push(line))
  return buckets.map((lines) => parseRoster(lines.join('\n')))
}

export function countLines(text: string): number {
  return text.split('\n').filter((l) => l.trim()).length
}

export function rosterToText(players: Player[]): string {
  return players.map((p) => `${p.number} ${p.name}`).join('\n')
}

export function blankRoster(count = 12): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uid('tp'),
    number: String(i + 1),
    name: `Pemain ${i + 1}`,
    active: i < 5,
  }))
}

/** Circle method: tiap tim bertemu sekali (atau dua kali bila `double`). */
export function roundRobin(teamIds: string[], double: boolean): [string, string][][] {
  const ids: (string | null)[] = [...teamIds]
  if (ids.length < 2) return []
  if (ids.length % 2 === 1) ids.push(null)
  const n = ids.length
  const rounds: [string, string][][] = []
  let order = [...ids]
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = order[i]
      const b = order[n - 1 - i]
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    order = [order[0], order[n - 1], ...order.slice(1, n - 1)]
  }
  if (!double) return rounds
  return [...rounds, ...rounds.map((pairs) => pairs.map(([a, b]) => [b, a] as [string, string]))]
}

function baseMatch(tournamentId: string): Omit<MatchDraft, 'stage' | 'round' | 'round_label'> {
  return {
    id: crypto.randomUUID(),
    tournament_id: tournamentId,
    group_name: null,
    bracket_index: 0,
    home_team_id: null,
    away_team_id: null,
    next_match_id: null,
    next_slot: null,
    scheduled_at: null,
    venue: '',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
  }
}

export function buildGroupMatches(
  tournamentId: string,
  teams: TournamentTeam[],
  double: boolean,
): MatchDraft[] {
  const groups = new Map<string, string[]>()
  for (const t of teams) {
    const g = t.group_name || 'A'
    groups.set(g, [...(groups.get(g) ?? []), t.id])
  }
  const perGroup = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ids]) => ({ group, rounds: roundRobin(ids, double) }))

  const maxRounds = Math.max(0, ...perGroup.map((g) => g.rounds.length))
  const out: MatchDraft[] = []
  for (let r = 0; r < maxRounds; r++) {
    for (const { group, rounds } of perGroup) {
      for (const [home, away] of rounds[r] ?? []) {
        out.push({
          ...baseMatch(tournamentId),
          stage: 'group',
          group_name: group,
          round: r + 1,
          round_label: `Grup ${group} · Pekan ${r + 1}`,
          home_team_id: home,
          away_team_id: away,
        })
      }
    }
  }
  return out
}

function knockoutLabel(matchesInRound: number): string {
  if (matchesInRound === 1) return 'Final'
  if (matchesInRound === 2) return 'Semifinal'
  if (matchesInRound === 4) return 'Perempat Final'
  return `${matchesInRound * 2} Besar`
}

/** Urutan seed di bagan standar (1 vs N, 2 vs N-1, ... di sisi berlawanan). */
function bracketSeedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((s) => [s, n + 1 - s])
  }
  return order
}

/**
 * Bagan gugur dari daftar seed (index 0 = seed 1). Jumlah tim bukan pangkat 2
 * → seed teratas dapat bye dan langsung masuk babak berikutnya.
 */
export function buildKnockoutMatches(
  tournamentId: string,
  seeds: string[],
): MatchDraft[] {
  if (seeds.length < 2) return []
  let size = 2
  while (size < seeds.length) size *= 2
  const roundsCount = Math.log2(size)

  const rounds: MatchDraft[][] = []
  for (let r = 1; r <= roundsCount; r++) {
    const count = size / 2 ** r
    rounds.push(
      Array.from({ length: count }, (_, i) => ({
        ...baseMatch(tournamentId),
        stage: 'knockout' as const,
        round: r,
        round_label: knockoutLabel(count),
        bracket_index: i,
      })),
    )
  }
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((m, i) => {
      m.next_match_id = rounds[r + 1][Math.floor(i / 2)].id
      m.next_slot = i % 2 === 0 ? 'home' : 'away'
    })
  }

  const order = bracketSeedOrder(size)
  const byes = new Set<string>()
  rounds[0].forEach((m, i) => {
    const home = seeds[order[i * 2] - 1] ?? null
    const away = seeds[order[i * 2 + 1] - 1] ?? null
    m.home_team_id = home
    m.away_team_id = away
    if (home && away) return
    const next = rounds[1]?.find((n) => n.id === m.next_match_id)
    if (next && m.next_slot) next[`${m.next_slot}_team_id`] = home ?? away
    byes.add(m.id)
  })

  return rounds.flat().filter((m) => !byes.has(m.id))
}

export function computeStandings(
  teams: TournamentTeam[],
  matches: Pick<Match, 'stage' | 'status' | 'home_team_id' | 'away_team_id' | 'home_score' | 'away_score'>[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((team) => [
      team.id,
      { team, played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, points: 0 },
    ]),
  )
  for (const m of matches) {
    if (m.stage !== 'group' || m.status !== 'finished') continue
    const home = m.home_team_id ? rows.get(m.home_team_id) : undefined
    const away = m.away_team_id ? rows.get(m.away_team_id) : undefined
    if (!home || !away) continue
    home.played += 1
    away.played += 1
    home.pointsFor += m.home_score
    home.pointsAgainst += m.away_score
    away.pointsFor += m.away_score
    away.pointsAgainst += m.home_score
    if (m.home_score > m.away_score) {
      home.won += 1
      away.lost += 1
    } else if (m.away_score > m.home_score) {
      away.won += 1
      home.lost += 1
    }
  }
  for (const r of rows.values()) {
    r.diff = r.pointsFor - r.pointsAgainst
    r.points = r.won * WIN_POINTS + r.lost * LOSS_POINTS
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.diff - a.diff ||
      b.pointsFor - a.pointsFor ||
      a.team.name.localeCompare(b.team.name),
  )
}

export function standingsByGroup(
  teams: TournamentTeam[],
  matches: Match[],
): { group: string; rows: StandingRow[] }[] {
  const groups = [...new Set(teams.map((t) => t.group_name || 'A'))].sort()
  return groups.map((group) => ({
    group,
    rows: computeStandings(
      teams.filter((t) => (t.group_name || 'A') === group),
      matches.filter((m) => (m.group_name || 'A') === group),
    ),
  }))
}

/**
 * Seed babak gugur dari klasemen: semua juara grup dulu, lalu runner-up, dst.
 * Dengan bagan standar, tim satu grup tidak bertemu di babak pertama.
 */
export function seedsFromGroups(
  groups: { group: string; rows: StandingRow[] }[],
  advancePerGroup: number,
): string[] {
  const seeds: string[] = []
  for (let rank = 0; rank < advancePerGroup; rank++) {
    for (const g of groups) {
      const row = g.rows[rank]
      if (row) seeds.push(row.team.id)
    }
  }
  return seeds
}

/** Total jeda antar babak: 2 menit tiap pergantian + ~9 menit ekstra halftime. */
export function intermissionMinutes(periods: number): number {
  return periods > 1 ? (periods - 1) * 2 + 9 : 0
}

/**
 * Perkiraan lama satu laga: jam bersih semua babak, +50% untuk jam berhenti
 * (foul, timeout, lemparan bebas), + jeda antar babak. Dibulatkan ke 5 menit.
 */
export function estimateMatchMinutes(periodMinutes: number, periods = 4): number {
  const clock = periodMinutes * periods
  return Math.ceil((clock * 1.5 + intermissionMinutes(periods)) / 5) * 5
}

export function matchMinutesOf(settings: TournamentSettings): number {
  return settings.matchMinutes ?? estimateMatchMinutes(settings.periodMinutes, settings.periods)
}

export interface ScheduleOptions {
  start: string
  matchMinutes: number
  breakMinutes: number
  /** 0 = semua laga di hari yang sama. */
  perDay: number
  venue: string
}

/** Jam selesai laga ke-`count` (terakhir) bila dijadwalkan dengan `opts`. */
export function scheduleEnd(count: number, opts: ScheduleOptions): Date | null {
  if (count === 0 || !opts.start) return null
  const [last] = assignSchedule(
    Array.from({ length: count }, () => ({ scheduled_at: null, venue: '' })),
    opts,
  ).slice(-1)
  if (!last.scheduled_at) return null
  return new Date(new Date(last.scheduled_at).getTime() + opts.matchMinutes * 60000)
}

/** Jumlah laga fase grup (round robin per grup). */
export function countGroupMatches(teams: TournamentTeam[], double: boolean): number {
  const sizes = new Map<string, number>()
  for (const t of teams) {
    const g = t.group_name || 'A'
    sizes.set(g, (sizes.get(g) ?? 0) + 1)
  }
  let total = 0
  for (const n of sizes.values()) total += (n * (n - 1)) / 2
  return double ? total * 2 : total
}

/** Isi tanggal/jam berurutan: `perDay` laga per hari, tiap slot = lama laga + jeda. */
export function assignSchedule<T extends Pick<MatchDraft, 'scheduled_at' | 'venue'>>(
  matches: T[],
  opts: ScheduleOptions,
): T[] {
  const start = opts.start ? new Date(opts.start) : null
  const perDay = opts.perDay > 0 ? opts.perDay : Number.POSITIVE_INFINITY
  const slot = Math.max(1, opts.matchMinutes) + Math.max(0, opts.breakMinutes)
  return matches.map((m, i) => {
    const venue = opts.venue.trim() || m.venue
    if (!start || Number.isNaN(start.getTime())) return { ...m, venue }
    const d = new Date(start)
    d.setDate(d.getDate() + Math.floor(i / perDay))
    d.setMinutes(d.getMinutes() + (i % perDay) * slot)
    return { ...m, scheduled_at: d.toISOString(), venue }
  })
}

export function matchWinner(m: Pick<Match, 'home_team_id' | 'away_team_id' | 'home_score' | 'away_score'>) {
  if (m.home_score === m.away_score) return null
  return m.home_score > m.away_score ? m.home_team_id : m.away_team_id
}
