import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GameConfig,
  GameEvent,
  GameState,
  MatchLink,
  Period,
  Player,
  ScoreEvent,
  StatEventType,
  TeamId,
} from '../types/game'
import { DEFAULT_CONFIG } from '../types/game'
import { emptyStats } from '../utils/stats'
import { periodsOf, uid } from '../utils/format'

function makePlayers(prefix: string, count = 12): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uid(`${prefix}_p`),
    number: String(i + 1),
    name: `Pemain ${i + 1}`,
    active: i < 5,
  }))
}

function initStats(players: Player[]): Record<string, ReturnType<typeof emptyStats>> {
  const map: Record<string, ReturnType<typeof emptyStats>> = {}
  for (const p of players) map[p.id] = emptyStats(p.id)
  return map
}

function createInitialState(partial?: Partial<GameState>): GameState {
  const homePlayers = makePlayers('home')
  const awayPlayers = makePlayers('away')
  return {
    status: 'setup',
    match: null,
    config: { ...DEFAULT_CONFIG },
    home: {
      id: 'home',
      name: 'Garuda',
      shortName: 'GAR',
      color: '#e85d04',
      logo: '/logos/garuda.svg',
      players: homePlayers,
      timeoutsUsed: 0,
      periodFouls: {},
    },
    away: {
      id: 'away',
      name: 'Rajawali',
      shortName: 'RAJ',
      color: '#1d3557',
      logo: '/logos/rajawali.svg',
      players: awayPlayers,
      timeoutsUsed: 0,
      periodFouls: {},
    },
    period: 1,
    clockMs: DEFAULT_CONFIG.periodLengthMs,
    shotClockMs: DEFAULT_CONFIG.shotClockMs,
    clockRunning: false,
    possession: 'home',
    scoreEvents: [],
    events: [],
    playerStats: { ...initStats(homePlayers), ...initStats(awayPlayers) },
    createdAt: Date.now(),
    ...partial,
  }
}

interface GameActions {
  resetGame: () => void
  /** Ulang laga yang sama dari 0–0 (tim, roster, pengaturan & tautan laga tetap). */
  restartGame: () => void
  setupTeams: (payload: {
    homeName: string
    awayName: string
    homeColor: string
    awayColor: string
    homeLogo: string
    awayLogo: string
    homePlayers: Player[]
    awayPlayers: Player[]
    config?: Partial<GameConfig>
    match?: MatchLink | null
  }) => void
  startGame: () => void
  toggleClock: () => void
  pauseClock: () => void
  tick: (deltaMs: number) => { gameExpired: boolean; shotExpired: boolean }
  setClockMs: (ms: number) => void
  setShotClockMs: (ms: number) => void
  resetShotClock: (ms?: number) => void
  setPossession: (team: TeamId) => void
  setShotClockEnabled: (enabled: boolean) => void
  nextPeriod: () => void
  prevPeriod: () => void
  recordScore: (teamId: TeamId, points: 1 | 2 | 3, playerId?: string | null) => void
  recordMiss: (teamId: TeamId, kind: '2' | '3' | '1', playerId?: string | null) => void
  recordStat: (
    type: Extract<
      StatEventType,
      'reb_off' | 'reb_def' | 'ast' | 'stl' | 'blk' | 'tov'
    >,
    teamId: TeamId,
    playerId: string,
  ) => void
  recordFoul: (
    teamId: TeamId,
    playerId: string,
    foulType?: 'foul_personal' | 'foul_technical' | 'foul_unsportsmanlike',
  ) => void
  recordTimeout: (teamId: TeamId) => void
  togglePlayerActive: (teamId: TeamId, playerId: string) => boolean
  substitutePlayers: (
    teamId: TeamId,
    inPlayerId: string,
    outPlayerId: string,
  ) => boolean
  undoLastScore: () => void
  undoLastEvent: () => void
  finishGame: () => void
  /** Koreksi skor tim (+/−) tanpa mengubah statistik pemain; skor tidak bisa di bawah 0. */
  correctScore: (teamId: TeamId, delta: number, playerId?: string | null) => void
  /** Isi PTS pemain langsung (skor tim tidak berubah). */
  setPlayerPoints: (points: Record<string, number>) => void
  /** Ubah skor tim langsung ke angka tertentu (lewat koreksi). */
  setTeamScore: (teamId: TeamId, value: number) => void
}

type Store = GameState & GameActions

function ensureStats(
  stats: GameState['playerStats'],
  playerId: string,
): GameState['playerStats'] {
  if (stats[playerId]) return stats
  return { ...stats, [playerId]: emptyStats(playerId) }
}

function applyMadeShot(
  stats: GameState['playerStats'],
  playerId: string,
  points: 1 | 2 | 3,
): GameState['playerStats'] {
  const next = ensureStats(stats, playerId)
  const s = { ...next[playerId] }
  s.pts += points
  if (points === 1) {
    s.ftm += 1
    s.fta += 1
  } else if (points === 2) {
    s.fgm += 1
    s.fga += 1
  } else {
    s.fgm += 1
    s.fga += 1
    s.tpm += 1
    s.tpa += 1
  }
  return { ...next, [playerId]: s }
}

function applyMiss(
  stats: GameState['playerStats'],
  playerId: string,
  kind: '1' | '2' | '3',
): GameState['playerStats'] {
  const next = ensureStats(stats, playerId)
  const s = { ...next[playerId] }
  if (kind === '1') s.fta += 1
  else if (kind === '2') s.fga += 1
  else {
    s.fga += 1
    s.tpa += 1
  }
  return { ...next, [playerId]: s }
}

export const useGameStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      resetGame: () => set(createInitialState()),

      restartGame: () => {
        const s = get()
        const players = [...s.home.players, ...s.away.players]
        set({
          status: 'ready',
          period: 1,
          clockMs: s.config.periodLengthMs,
          shotClockMs: s.config.shotClockMs,
          clockRunning: false,
          possession: 'home',
          home: { ...s.home, timeoutsUsed: 0, periodFouls: {} },
          away: { ...s.away, timeoutsUsed: 0, periodFouls: {} },
          scoreEvents: [],
          events: [],
          playerStats: initStats(players),
          createdAt: Date.now(),
        })
      },

      setupTeams: (payload) => {
        const config = { ...DEFAULT_CONFIG, ...payload.config }
        const homePlayers = payload.homePlayers
        const awayPlayers = payload.awayPlayers
        set({
          status: 'ready',
          match: payload.match ?? null,
          config,
          home: {
            id: 'home',
            name: payload.homeName.trim() || 'HOME',
            shortName: (payload.homeName.trim() || 'HOME').slice(0, 3).toUpperCase(),
            color: payload.homeColor,
            logo: payload.homeLogo || '/logos/garuda.svg',
            players: homePlayers,
            timeoutsUsed: 0,
            periodFouls: {},
          },
          away: {
            id: 'away',
            name: payload.awayName.trim() || 'AWAY',
            shortName: (payload.awayName.trim() || 'AWAY').slice(0, 3).toUpperCase(),
            color: payload.awayColor,
            logo: payload.awayLogo || '/logos/rajawali.svg',
            players: awayPlayers,
            timeoutsUsed: 0,
            periodFouls: {},
          },
          period: 1,
          clockMs: config.periodLengthMs,
          shotClockMs: config.shotClockMs,
          clockRunning: false,
          possession: 'home',
          scoreEvents: [],
          events: [],
          playerStats: { ...initStats(homePlayers), ...initStats(awayPlayers) },
          createdAt: Date.now(),
        })
      },

      startGame: () => {
        const state = get()
        if (state.status === 'finished') return
        set({
          status: 'live',
          clockRunning: true,
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type: 'period_start',
              teamId: 'home',
              playerId: null,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
          ],
        })
      },

      toggleClock: () => {
        const { clockRunning, status } = get()
        if (status === 'setup' || status === 'finished') return
        set({
          clockRunning: !clockRunning,
          status: clockRunning ? 'paused' : 'live',
        })
      },

      pauseClock: () => set({ clockRunning: false, status: 'paused' }),

      tick: (deltaMs) => {
        const state = get()
        if (!state.clockRunning) {
          return { gameExpired: false, shotExpired: false }
        }
        const shotOn = state.config.shotClockEnabled !== false
        const clockMs = Math.max(0, state.clockMs - deltaMs)
        const shotClockMs = shotOn
          ? Math.max(0, state.shotClockMs - deltaMs)
          : state.shotClockMs
        const gameExpired = state.clockMs > 0 && clockMs === 0
        const shotExpired = shotOn && state.shotClockMs > 0 && shotClockMs === 0
        const stop = gameExpired || shotExpired
        set({
          clockMs,
          shotClockMs,
          clockRunning: stop ? false : state.clockRunning,
          status: stop && state.status === 'live' ? 'paused' : state.status,
        })
        return { gameExpired, shotExpired }
      },

      setClockMs: (ms) => set({ clockMs: Math.max(0, ms) }),
      setShotClockMs: (ms) => set({ shotClockMs: Math.max(0, ms) }),
      resetShotClock: (ms) =>
        set({ shotClockMs: ms ?? get().config.shotClockMs }),
      setPossession: (team) => set({ possession: team }),

      setShotClockEnabled: (enabled) => {
        const { config } = get()
        set({
          config: { ...config, shotClockEnabled: enabled },
          shotClockMs: config.shotClockMs,
        })
      },

      nextPeriod: () => {
        const state = get()
        const next = Math.min(8, state.period + 1) as Period
        const length =
          next <= periodsOf(state.config) ? state.config.periodLengthMs : state.config.otLengthMs
        set({
          period: next,
          clockMs: length,
          shotClockMs: state.config.shotClockMs,
          clockRunning: false,
          status: 'paused',
          home: { ...state.home },
          away: { ...state.away },
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type: 'period_end',
              teamId: 'home',
              playerId: null,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
            {
              id: uid('ev'),
              type: 'period_start',
              teamId: 'home',
              playerId: null,
              period: next,
              clockMs: length,
              timestamp: Date.now(),
            },
          ],
        })
      },

      prevPeriod: () => {
        const state = get()
        if (state.period <= 1) return
        const prev = (state.period - 1) as Period
        const length =
          prev <= periodsOf(state.config) ? state.config.periodLengthMs : state.config.otLengthMs
        set({
          period: prev,
          clockMs: length,
          clockRunning: false,
          status: 'paused',
        })
      },

      recordScore: (teamId, points, playerId = null) => {
        const state = get()
        const event: ScoreEvent = {
          id: uid('sc'),
          teamId,
          playerId,
          points,
          period: state.period,
          clockMs: state.clockMs,
          kind: String(points) as '1' | '2' | '3',
          timestamp: Date.now(),
        }
        const gameEvent: GameEvent = {
          id: uid('ev'),
          type:
            points === 1
              ? 'ft_made'
              : points === 2
                ? 'fg2_made'
                : 'fg3_made',
          teamId,
          playerId,
          period: state.period,
          clockMs: state.clockMs,
          points,
          timestamp: Date.now(),
        }
        let playerStats = state.playerStats
        if (playerId) {
          playerStats = applyMadeShot(playerStats, playerId, points)
        }
        set({
          scoreEvents: [...state.scoreEvents, event],
          events: [...state.events, gameEvent],
          playerStats,
          shotClockMs: state.config.shotClockMs,
          possession: teamId === 'home' ? 'away' : 'home',
          status: state.status === 'setup' ? 'ready' : state.status,
        })
      },

      recordMiss: (teamId, kind, playerId = null) => {
        const state = get()
        const type: StatEventType =
          kind === '1' ? 'ft_miss' : kind === '2' ? 'fg2_miss' : 'fg3_miss'
        let playerStats = state.playerStats
        if (playerId) playerStats = applyMiss(playerStats, playerId, kind)
        set({
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type,
              teamId,
              playerId,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
          ],
          playerStats,
        })
      },

      recordStat: (type, teamId, playerId) => {
        const state = get()
        const next = ensureStats(state.playerStats, playerId)
        const s = { ...next[playerId] }
        if (type === 'reb_off') s.oreb += 1
        if (type === 'reb_def') s.dreb += 1
        if (type === 'ast') s.ast += 1
        if (type === 'stl') s.stl += 1
        if (type === 'blk') s.blk += 1
        if (type === 'tov') s.tov += 1
        set({
          playerStats: { ...next, [playerId]: s },
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type,
              teamId,
              playerId,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
          ],
        })
      },

      recordFoul: (teamId, playerId, foulType = 'foul_personal') => {
        const state = get()
        const teamKey = teamId
        const team = { ...state[teamKey] }
        const periodFouls = { ...team.periodFouls }
        periodFouls[state.period] = (periodFouls[state.period] ?? 0) + 1
        team.periodFouls = periodFouls

        const next = ensureStats(state.playerStats, playerId)
        const s = { ...next[playerId] }
        s.pf += 1

        set({
          [teamKey]: team,
          playerStats: { ...next, [playerId]: s },
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type: foulType,
              teamId,
              playerId,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
          ],
        })
      },

      recordTimeout: (teamId) => {
        const state = get()
        const team = { ...state[teamId] }
        if (team.timeoutsUsed >= state.config.timeoutsPerTeam) return
        team.timeoutsUsed += 1
        set({
          [teamId]: team,
          clockRunning: false,
          status: 'paused',
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type: 'timeout',
              teamId,
              playerId: null,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
          ],
        })
      },

      togglePlayerActive: (teamId, playerId) => {
        const state = get()
        const team = { ...state[teamId] }
        const target = team.players.find((p) => p.id === playerId)
        if (!target) return false
        const players = team.players.map((p) =>
          p.id === playerId ? { ...p, active: !p.active } : p,
        )
        const activeCount = players.filter((p) => p.active).length
        if (activeCount > state.config.playersOnCourt) return false
        team.players = players
        set({ [teamId]: team })
        return true
      },

      substitutePlayers: (teamId, inPlayerId, outPlayerId) => {
        const state = get()
        if (inPlayerId === outPlayerId) return false
        const team = { ...state[teamId] }
        const inn = team.players.find((p) => p.id === inPlayerId)
        const out = team.players.find((p) => p.id === outPlayerId)
        if (!inn || !out) return false
        if (inn.active || !out.active) return false

        team.players = team.players.map((p) => {
          if (p.id === inPlayerId) return { ...p, active: true }
          if (p.id === outPlayerId) return { ...p, active: false }
          return p
        })

        set({
          [teamId]: team,
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type: 'sub_out',
              teamId,
              playerId: outPlayerId,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
            {
              id: uid('ev'),
              type: 'sub_in',
              teamId,
              playerId: inPlayerId,
              period: state.period,
              clockMs: state.clockMs,
              timestamp: Date.now(),
            },
          ],
        })
        return true
      },

      undoLastScore: () => {
        const state = get()
        if (state.scoreEvents.length === 0) return
        const last = state.scoreEvents[state.scoreEvents.length - 1]
        let playerStats = state.playerStats
        if (last.kind === 'adj' && last.playerId && playerStats[last.playerId]) {
          const s = { ...playerStats[last.playerId] }
          s.pts = Math.max(0, s.pts - last.points)
          playerStats = { ...playerStats, [last.playerId]: s }
        } else if (last.playerId && playerStats[last.playerId]) {
          const s = { ...playerStats[last.playerId] }
          s.pts = Math.max(0, s.pts - last.points)
          if (last.points === 1) {
            s.ftm = Math.max(0, s.ftm - 1)
            s.fta = Math.max(0, s.fta - 1)
          } else if (last.points === 2) {
            s.fgm = Math.max(0, s.fgm - 1)
            s.fga = Math.max(0, s.fga - 1)
          } else {
            s.fgm = Math.max(0, s.fgm - 1)
            s.fga = Math.max(0, s.fga - 1)
            s.tpm = Math.max(0, s.tpm - 1)
            s.tpa = Math.max(0, s.tpa - 1)
          }
          playerStats = { ...playerStats, [last.playerId]: s }
        }
        set({
          scoreEvents: state.scoreEvents.slice(0, -1),
          playerStats,
          events: state.events.filter(
            (e) =>
              !(
                e.timestamp === last.timestamp &&
                e.teamId === last.teamId &&
                e.points === last.points
              ),
          ),
        })
      },

      undoLastEvent: () => {
        const state = get()
        if (state.events.length === 0) return
        set({ events: state.events.slice(0, -1) })
      },

      finishGame: () =>
        set({ status: 'finished', clockRunning: false }),

      correctScore: (teamId, delta, playerId = null) => {
        const state = get()
        const current = state.scoreEvents
          .filter((e) => e.teamId === teamId)
          .reduce((sum, e) => sum + e.points, 0)
        let points = Math.max(-current, Math.round(delta))
        let playerStats = state.playerStats
        if (playerId) {
          const next = ensureStats(playerStats, playerId)
          const s = { ...next[playerId] }
          points = Math.max(-s.pts, points)
          s.pts += points
          playerStats = { ...next, [playerId]: s }
        }
        if (points === 0) return
        const timestamp = Date.now()
        set({
          playerStats,
          scoreEvents: [
            ...state.scoreEvents,
            {
              id: uid('adj'),
              teamId,
              playerId,
              points,
              period: state.period,
              clockMs: state.clockMs,
              kind: 'adj',
              timestamp,
            },
          ],
          events: [
            ...state.events,
            {
              id: uid('ev'),
              type: 'score_adjust',
              teamId,
              playerId,
              period: state.period,
              clockMs: state.clockMs,
              points,
              timestamp,
            },
          ],
        })
      },

      setPlayerPoints: (points) => {
        const state = get()
        const playerStats = { ...state.playerStats }
        for (const [pid, pts] of Object.entries(points)) {
          const base = playerStats[pid] ?? emptyStats(pid)
          playerStats[pid] = { ...base, pts: Math.max(0, Math.round(pts)) }
        }
        set({ playerStats })
      },

      setTeamScore: (teamId, value) => {
        const current = get()
          .scoreEvents.filter((e) => e.teamId === teamId)
          .reduce((sum, e) => sum + e.points, 0)
        get().correctScore(teamId, Math.max(0, Math.round(value)) - current)
      },
    }),
    {
      name: 'basketball-scoreboard-v1',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        return {
          ...current,
          ...p,
          config: { ...DEFAULT_CONFIG, ...p.config },
          match: p.match ?? null,
          home: {
            ...current.home,
            ...p.home,
            logo: p.home?.logo || '/logos/garuda.svg',
          },
          away: {
            ...current.away,
            ...p.away,
            logo: p.away?.logo || '/logos/rajawali.svg',
          },
        }
      },
    },
  ),
)
