let ctx: AudioContext | null = null
const CHANNEL = 'courtside-buzzer'

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Unlock audio after a user gesture (click/tap). Call once from UI. */
export async function unlockAudio() {
  const audio = getCtx()
  if (!audio) return
  if (audio.state === 'suspended') {
    try {
      await audio.resume()
    } catch {
      /* ignore */
    }
  }
}

function broadcast(kind: 'shot' | 'period') {
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.postMessage({ kind })
    bc.close()
  } catch {
    /* ignore */
  }
}

/** Listen for buzzers from other tabs (e.g. layar penonton). */
export function subscribeBuzzerBroadcast() {
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = (ev: MessageEvent<{ kind?: string }>) => {
      if (ev.data?.kind === 'period') playPeriodBuzzer(false)
      else if (ev.data?.kind === 'shot') playShotClockBuzzer(false)
    }
    return () => bc.close()
  } catch {
    return () => undefined
  }
}

function tone(
  audio: AudioContext,
  {
    frequency,
    duration,
    type = 'sawtooth',
    gain = 0.22,
    startAt = 0,
  }: {
    frequency: number
    duration: number
    type?: OscillatorType
    gain?: number
    startAt?: number
  },
) {
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = type
  osc.frequency.value = frequency
  g.gain.value = gain
  const t0 = audio.currentTime + startAt
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g)
  g.connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** Shot clock violation — short sharp buzz */
export function playShotClockBuzzer(relay = true) {
  const audio = getCtx()
  if (!audio) return
  void audio.resume()
  tone(audio, { frequency: 880, duration: 0.18, type: 'square', gain: 0.2 })
  tone(audio, {
    frequency: 660,
    duration: 0.22,
    type: 'square',
    gain: 0.18,
    startAt: 0.16,
  })
  tone(audio, {
    frequency: 880,
    duration: 0.28,
    type: 'square',
    gain: 0.2,
    startAt: 0.36,
  })
  if (relay) broadcast('shot')
}

/** Period / game clock end — longer horn */
export function playPeriodBuzzer(relay = true) {
  const audio = getCtx()
  if (!audio) return
  void audio.resume()
  tone(audio, { frequency: 220, duration: 0.55, type: 'sawtooth', gain: 0.28 })
  tone(audio, {
    frequency: 180,
    duration: 0.55,
    type: 'square',
    gain: 0.16,
    startAt: 0,
  })
  tone(audio, {
    frequency: 220,
    duration: 0.65,
    type: 'sawtooth',
    gain: 0.26,
    startAt: 0.5,
  })
  tone(audio, {
    frequency: 160,
    duration: 0.65,
    type: 'square',
    gain: 0.14,
    startAt: 0.5,
  })
  if (relay) broadcast('period')
}
