import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useGameStore } from '../store/gameStore'
import type { GameState } from '../types/game'
import { supabase } from '../lib/supabase'
import { gameId } from '../lib/gameRoom'
import { saveMatchProgress } from '../lib/tournamentApi'

const CHANNEL = 'halcion-state-v2'
const TABLE = 'games'
const LOCAL_GAP_MS = 80
const REMOTE_CLOCK_GAP_MS = 500
const SAVE_GAP_MS = 2000

type SyncKey = Pick<
  GameState,
  | 'home'
  | 'away'
  | 'period'
  | 'clockRunning'
  | 'possession'
  | 'status'
  | 'scoreEvents'
  | 'events'
  | 'config'
  | 'match'
>

type ClockPayload = Pick<GameState, 'clockMs' | 'shotClockMs'>

/**
 * `full` = state lengkap (setiap perubahan selain jam).
 * `clock` = hanya angka jam; sengaja tanpa `clockRunning` supaya pesan jam
 * yang terlambat dari perangkat lain tidak menjalankan ulang jam yang di-pause.
 */
type SyncMessage =
  | { kind: 'full'; data: GameState & { sentAt?: number } }
  | { kind: 'clock'; data: ClockPayload & { sentAt?: number } }

function keyOf(state: GameState): SyncKey {
  return {
    home: state.home,
    away: state.away,
    period: state.period,
    clockRunning: state.clockRunning,
    possession: state.possession,
    status: state.status,
    scoreEvents: state.scoreEvents,
    events: state.events,
    config: state.config,
    match: state.match,
  }
}

function isClockOnlyChange(a: SyncKey, b: SyncKey) {
  return (Object.keys(a) as (keyof SyncKey)[]).every((k) => a[k] === b[k])
}

function clockOf(state: GameState): ClockPayload {
  return { clockMs: state.clockMs, shotClockMs: state.shotClockMs }
}

export function snapshot(state: GameState): GameState {
  return {
    status: state.status,
    match: state.match,
    config: state.config,
    home: state.home,
    away: state.away,
    period: state.period,
    clockMs: state.clockMs,
    shotClockMs: state.shotClockMs,
    clockRunning: state.clockRunning,
    possession: state.possession,
    scoreEvents: state.scoreEvents,
    events: state.events,
    playerStats: state.playerStats,
    createdAt: state.createdAt,
  }
}

/** Batas koreksi jeda jaringan, supaya selisih jam antar perangkat tidak membuat jam melompat jauh. */
const MAX_LAG_MS = 1500

/** Kurangi jam yang sedang berjalan sebesar umur pesan (jeda jaringan). */
function compensate<T extends ClockPayload>(data: T, running: boolean, sentAt?: number): T {
  if (!running || typeof sentAt !== 'number') return data
  const lag = Math.min(MAX_LAG_MS, Math.max(0, Date.now() - sentAt))
  if (lag === 0) return data
  return {
    ...data,
    clockMs: Math.max(0, data.clockMs - lag),
    shotClockMs: Math.max(0, data.shotClockMs - lag),
  }
}

function applyMessage(msg: SyncMessage | undefined): boolean {
  if (msg?.kind === 'full' && msg.data?.home && msg.data?.away) {
    const { sentAt, ...state } = msg.data
    useGameStore.setState(compensate(state, state.clockRunning, sentAt))
    return true
  }
  if (msg?.kind === 'clock' && typeof msg.data?.clockMs === 'number') {
    const { sentAt, ...clock } = msg.data
    useGameStore.setState(compensate(clock, useGameStore.getState().clockRunning, sentAt))
    return true
  }
  return false
}

function openLocalChannel() {
  try {
    return new BroadcastChannel(`${CHANNEL}:${gameId}`)
  } catch {
    return null
  }
}

function openRemoteChannel() {
  return supabase?.channel(`game:${gameId}`, {
    config: { broadcast: { self: false } },
  })
}

function listenRemote(channel: RealtimeChannel, onMessage: (msg: SyncMessage) => void) {
  return channel
    .on('broadcast', { event: 'full' }, ({ payload }) =>
      onMessage({ kind: 'full', data: payload as GameState & { sentAt?: number } }),
    )
    .on('broadcast', { event: 'clock' }, ({ payload }) =>
      onMessage({ kind: 'clock', data: payload as ClockPayload & { sentAt?: number } }),
    )
}

/** State terakhir dari database; jam yang berjalan dikoreksi sesuai umur data. */
async function fetchRemoteState(): Promise<GameState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('state, updated_at')
    .eq('id', gameId)
    .maybeSingle()
  if (error || !data?.state?.home || !data?.state?.away) return null
  const state = data.state as GameState
  const savedAt = data.updated_at ? new Date(data.updated_at as string).getTime() : undefined
  return compensate(state, state.clockRunning, savedAt)
}

let flushPending: (() => void) | null = null

/** Simpan state sekarang ke Supabase tanpa menunggu jeda (mis. sebelum ganti laga). */
export function flushGameSave() {
  flushPending?.()
}

function saveMatch(state: GameState) {
  if (!supabase || !state.match || state.status === 'setup') return
  saveMatchProgress(state.match.id, snapshot(state)).catch((e: Error) =>
    console.warn('Gagal menyimpan skor laga:', e.message),
  )
}

/**
 * Sinkron scoreboard per kode lapangan: antar tab via BroadcastChannel,
 * antar perangkat via Supabase Realtime, dan state disimpan ke tabel `games`.
 * Mode `broadcast` (admin) mengirim sekaligus menerima perubahan operator lain;
 * mode `receive` (layar penonton) hanya menerima.
 */
export function useScoreboardSync(mode: 'broadcast' | 'receive') {
  const clockRunning = useGameStore((s) => s.clockRunning)

  useEffect(() => {
    const bc = openLocalChannel()
    const channel = openRemoteChannel()
    return mode === 'receive' ? receive(bc, channel) : broadcast(bc, channel)
  }, [mode])

  useEffect(() => {
    if (mode !== 'receive' || !clockRunning) return
    let frame = 0
    let last: number | null = null
    const loop = (now: number) => {
      if (last !== null) {
        const delta = now - last
        if (delta > 0 && delta < 250) useGameStore.getState().tick(delta)
      }
      last = now
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [mode, clockRunning])
}

function receive(bc: BroadcastChannel | null, channel?: RealtimeChannel) {
  let gotLive = false
  const apply = (msg: SyncMessage | undefined) => {
    if (applyMessage(msg)) gotLive = true
  }

  if (bc) bc.onmessage = (ev: MessageEvent<SyncMessage>) => apply(ev.data)

  if (channel) {
    listenRemote(channel, apply).subscribe()
    void fetchRemoteState().then((state) => {
      if (state && !gotLive) useGameStore.setState(state)
    })
  }

  return () => {
    bc?.close()
    if (channel) void supabase?.removeChannel(channel)
  }
}

function broadcast(bc: BroadcastChannel | null, channel?: RealtimeChannel) {
  let disposed = false
  let ready = false
  let hydrated = !supabase
  let applying = false
  /** Hanya perangkat yang menekan Start yang mengirim angka jam selama jam berjalan. */
  let ownsClock = false
  let lastLocal = 0
  let lastClock = 0
  let prev: SyncKey | null = keyOf(useGameStore.getState())
  let clockTimer: number | undefined
  let saveTimer: number | undefined

  const send = (msg: SyncMessage) => {
    if (!channel || !ready || !hydrated) return
    void channel.send({
      type: 'broadcast',
      event: msg.kind,
      payload: { ...msg.data, sentAt: Date.now() },
    })
  }

  const sendFull = () => {
    window.clearTimeout(clockTimer)
    clockTimer = undefined
    lastClock = performance.now()
    send({ kind: 'full', data: snapshot(useGameStore.getState()) })
  }

  const sendClock = () => {
    clockTimer = undefined
    const state = useGameStore.getState()
    if (state.clockRunning && !ownsClock) return
    lastClock = performance.now()
    send({ kind: 'clock', data: clockOf(state) })
  }

  const save = () => {
    window.clearTimeout(saveTimer)
    saveTimer = undefined
    if (!supabase || !hydrated) return
    const state = useGameStore.getState()
    supabase
      .from(TABLE)
      .upsert({
        id: gameId,
        state: snapshot(state),
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn('Gagal menyimpan game ke Supabase:', error.message)
      })
    saveMatch(state)
  }
  flushPending = save

  const scheduleSave = () => {
    if (supabase && saveTimer === undefined) {
      saveTimer = window.setTimeout(save, SAVE_GAP_MS)
    }
  }

  /** Terapkan perubahan dari operator lain tanpa memantulkannya kembali. */
  const applyRemote = (msg: SyncMessage | undefined) => {
    const wasRunning = useGameStore.getState().clockRunning
    applying = true
    try {
      if (!applyMessage(msg)) return false
    } finally {
      applying = false
    }
    if (msg?.kind === 'full' && msg.data.clockRunning !== wasRunning) ownsClock = false
    prev = keyOf(useGameStore.getState())
    return true
  }

  const unsub = useGameStore.subscribe((state) => {
    if (applying) return
    const key = keyOf(state)
    const clockOnly = prev !== null && isClockOnlyChange(prev, key)
    if (prev && !prev.clockRunning && key.clockRunning) ownsClock = true
    prev = key
    const now = performance.now()

    if (bc && (!clockOnly || now - lastLocal >= LOCAL_GAP_MS)) {
      lastLocal = now
      bc.postMessage(
        clockOnly
          ? ({ kind: 'clock', data: clockOf(state) } satisfies SyncMessage)
          : ({ kind: 'full', data: snapshot(state) } satisfies SyncMessage),
      )
    }

    if (channel) {
      const wait = REMOTE_CLOCK_GAP_MS - (now - lastClock)
      if (!clockOnly) sendFull()
      else if (wait <= 0) sendClock()
      else if (clockTimer === undefined) clockTimer = window.setTimeout(sendClock, wait)
    }

    scheduleSave()
  })

  if (bc) bc.onmessage = (ev: MessageEvent<SyncMessage>) => applyRemote(ev.data)

  if (channel) {
    listenRemote(channel, (msg) => {
      if (applyRemote(msg) && msg.kind === 'full') hydrated = true
    }).subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      ready = true
      if (hydrated) sendFull()
    })
  }

  if (supabase) {
    void fetchRemoteState().then((state) => {
      if (disposed || hydrated) return
      if (state) applyRemote({ kind: 'full', data: state })
      hydrated = true
      if (!state) {
        save()
        sendFull()
      }
    })
  }

  const onHide = () => save()
  window.addEventListener('pagehide', onHide)

  return () => {
    disposed = true
    if (flushPending === save) flushPending = null
    unsub()
    window.removeEventListener('pagehide', onHide)
    window.clearTimeout(clockTimer)
    if (saveTimer !== undefined) save()
    bc?.close()
    if (channel) void supabase?.removeChannel(channel)
  }
}
