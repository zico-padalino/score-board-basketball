import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useGameStore } from '../store/gameStore'
import type { GameState } from '../types/game'
import { supabase } from '../lib/supabase'
import { gameId, joinedFromLink } from '../lib/gameRoom'
import { saveMatchProgress } from '../lib/tournamentApi'

const CHANNEL = 'courtside-state-v1'
const TABLE = 'games'
const LOCAL_GAP_MS = 80
const REMOTE_CLOCK_GAP_MS = 1000
const SAVE_GAP_MS = 2000

type SyncPayload = Pick<
  GameState,
  | 'home'
  | 'away'
  | 'period'
  | 'clockMs'
  | 'shotClockMs'
  | 'clockRunning'
  | 'possession'
  | 'status'
  | 'scoreEvents'
  | 'config'
>

function pick(state: GameState): SyncPayload {
  return {
    home: state.home,
    away: state.away,
    period: state.period,
    clockMs: state.clockMs,
    shotClockMs: state.shotClockMs,
    clockRunning: state.clockRunning,
    possession: state.possession,
    status: state.status,
    scoreEvents: state.scoreEvents,
    config: state.config,
  }
}

export function snapshot(state: GameState): GameState {
  return {
    ...pick(state),
    match: state.match,
    events: state.events,
    playerStats: state.playerStats,
    createdAt: state.createdAt,
  }
}

function isClockOnlyChange(a: SyncPayload, b: SyncPayload) {
  return (
    a.home === b.home &&
    a.away === b.away &&
    a.period === b.period &&
    a.clockRunning === b.clockRunning &&
    a.possession === b.possession &&
    a.status === b.status &&
    a.scoreEvents === b.scoreEvents &&
    a.config === b.config
  )
}

function openLocalChannel() {
  try {
    return new BroadcastChannel(CHANNEL)
  } catch {
    return null
  }
}

function openRemoteChannel() {
  return supabase?.channel(`game:${gameId}`, {
    config: { broadcast: { self: false } },
  })
}

async function fetchRemoteState(): Promise<GameState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('state')
    .eq('id', gameId)
    .maybeSingle()
  if (error || !data?.state?.home || !data?.state?.away) return null
  return data.state as GameState
}

let joinHandled = !joinedFromLink
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
 * Sinkron layar penonton dengan operator: antar tab via BroadcastChannel,
 * antar perangkat via Supabase Realtime, dan state disimpan ke tabel `games`.
 */
export function useScoreboardSync(mode: 'broadcast' | 'receive') {
  const clockRunning = useGameStore((s) => s.clockRunning)

  useEffect(() => {
    const bc = openLocalChannel()
    const channel = openRemoteChannel()
    return mode === 'receive'
      ? receive(bc, channel)
      : broadcast(bc, channel)
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
  const apply = (data: SyncPayload | undefined) => {
    if (!data?.home || !data?.away) return
    gotLive = true
    useGameStore.setState(data)
  }

  if (bc) bc.onmessage = (ev: MessageEvent<SyncPayload>) => apply(ev.data)

  if (channel) {
    channel
      .on('broadcast', { event: 'state' }, ({ payload }) => apply(payload))
      .subscribe()
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
  let hydrated = joinHandled
  let lastLocal = 0
  let lastRemote = 0
  let prev: SyncPayload | null = null
  let remoteTimer: number | undefined
  let saveTimer: number | undefined

  const sendRemote = () => {
    window.clearTimeout(remoteTimer)
    remoteTimer = undefined
    if (!channel || !ready || !hydrated) return
    lastRemote = performance.now()
    void channel.send({
      type: 'broadcast',
      event: 'state',
      payload: pick(useGameStore.getState()),
    })
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

  const unsub = useGameStore.subscribe((state) => {
    const payload = pick(state)
    const now = performance.now()

    if (bc && (!state.clockRunning || now - lastLocal >= LOCAL_GAP_MS)) {
      lastLocal = now
      bc.postMessage(payload)
    }

    if (channel) {
      const clockOnly = prev !== null && isClockOnlyChange(prev, payload)
      const wait = REMOTE_CLOCK_GAP_MS - (now - lastRemote)
      if (!clockOnly || wait <= 0) sendRemote()
      else if (remoteTimer === undefined) {
        remoteTimer = window.setTimeout(sendRemote, wait)
      }
    }

    prev = payload
    scheduleSave()
  })

  bc?.postMessage(pick(useGameStore.getState()))

  if (channel) {
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      ready = true
      sendRemote()
    })
  }

  if (!hydrated) {
    void fetchRemoteState().then((state) => {
      if (disposed) return
      joinHandled = true
      hydrated = true
      if (state) useGameStore.setState(state)
      else save()
      sendRemote()
    })
  } else {
    save()
  }

  const onHide = () => save()
  window.addEventListener('pagehide', onHide)

  return () => {
    disposed = true
    if (flushPending === save) flushPending = null
    unsub()
    window.removeEventListener('pagehide', onHide)
    window.clearTimeout(remoteTimer)
    if (saveTimer !== undefined) save()
    bc?.close()
    if (channel) void supabase?.removeChannel(channel)
  }
}
