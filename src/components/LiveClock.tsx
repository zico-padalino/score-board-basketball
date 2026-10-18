import { useEffect, useState } from 'react'
import type { Match } from '../types/tournament'
import { formatClock, periodLabel } from '../utils/format'

const STALE_MS = 15_000

/** Jam laga live: dihitung mundur lokal di antara update dari operator. */
export function LiveClock({
  match,
}: {
  match: Pick<Match, 'clock_ms' | 'clock_running' | 'live_at' | 'period' | 'period_scores'>
}) {
  const [base, setBase] = useState(() => ({ at: Date.now(), ms: match.clock_ms }))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setBase({ at: Date.now(), ms: match.clock_ms })
  }, [match.clock_ms, match.live_at, match.clock_running])

  const fresh =
    match.live_at !== null && Date.now() - new Date(match.live_at).getTime() < STALE_MS
  const running = match.clock_running && fresh

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(t)
  }, [running])

  const ms = running ? Math.max(0, base.ms - (now - base.at)) : match.clock_ms

  return (
    <span className={`live-clock ${running ? 'running' : ''}`}>
      <b>{periodLabel(Math.max(1, match.period), match.period_scores?.periods ?? 4)}</b>
      {formatClock(ms)}
    </span>
  )
}
