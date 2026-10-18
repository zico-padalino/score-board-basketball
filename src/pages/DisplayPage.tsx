import { useEffect, useRef, useState } from 'react'
import { TeamLogo } from '../components/TeamLogo'
import { setCountdownSound, useCountdownSoundEnabled } from '../hooks/useCountdownVoice'
import { courtLabel, gameId } from '../lib/gameRoom'
import { useFullscreen } from '../hooks/useFullscreen'
import { useGameStore } from '../store/gameStore'
import type { TeamId } from '../types/game'
import {
  formatClock,
  formatShotClock,
  periodLabel,
  periodsOf,
  regularPeriods,
} from '../utils/format'
import { periodScore, teamFoulsInPeriod, teamScore } from '../utils/stats'
import { unlockAudio } from '../utils/buzzer'


export function DisplayPage() {
  const home = useGameStore((s) => s.home)
  const away = useGameStore((s) => s.away)
  const scoreEvents = useGameStore((s) => s.scoreEvents)
  const period = useGameStore((s) => s.period)
  const clockMs = useGameStore((s) => s.clockMs)
  const shotClockMs = useGameStore((s) => s.shotClockMs)
  const possession = useGameStore((s) => s.possession)
  const status = useGameStore((s) => s.status)
  const clockRunning = useGameStore((s) => s.clockRunning)
  const config = useGameStore((s) => s.config)
  const periods = periodsOf(config)
  const PERIODS = regularPeriods(periods)
  const state = useGameStore()
  const soundOn = useCountdownSoundEnabled()

  const homeScore = teamScore(scoreEvents, 'home')
  const awayScore = teamScore(scoreEvents, 'away')
  const homeFouls = teamFoulsInPeriod(state, 'home', period)
  const awayFouls = teamFoulsInPeriod(state, 'away', period)

  const [pulse, setPulse] = useState<TeamId | null>(null)
  const [showControls, setShowControls] = useState(true)
  const prevScores = useRef({ home: homeScore, away: awayScore })
  const rootRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef)

  useEffect(() => {
    void unlockAudio()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        void toggleFullscreen()
      }
      if (e.key === 'Escape' && isFullscreen) {
        setShowControls(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen, toggleFullscreen])

  useEffect(() => {
    if (!isFullscreen) {
      setShowControls(true)
      return
    }

    const reveal = () => {
      setShowControls(true)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => setShowControls(false), 3000)
    }

    reveal()
    window.addEventListener('mousemove', reveal)
    window.addEventListener('touchstart', reveal)
    return () => {
      window.removeEventListener('mousemove', reveal)
      window.removeEventListener('touchstart', reveal)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [isFullscreen])

  useEffect(() => {
    const prev = prevScores.current
    if (homeScore > prev.home) setPulse('home')
    else if (awayScore > prev.away) setPulse('away')
    prevScores.current = { home: homeScore, away: awayScore }
    if (homeScore === prev.home && awayScore === prev.away) return
    const t = window.setTimeout(() => setPulse(null), 850)
    return () => window.clearTimeout(t)
  }, [homeScore, awayScore])

  const lastScore = scoreEvents[scoreEvents.length - 1]
  const lastTeam =
    lastScore && (lastScore.teamId === 'home' ? home : away)
  const lastPlayer = lastScore
    ? lastTeam?.players.find((p) => p.id === lastScore.playerId)
    : null

  const shotLow = shotClockMs <= 5000
  const clockLow = clockMs <= 10000
  const shotPct = Math.min(100, (shotClockMs / config.shotClockMs) * 100)

  const otHome = scoreEvents
    .filter((e) => e.teamId === 'home' && e.period > periods)
    .reduce((s, e) => s + e.points, 0)
  const otAway = scoreEvents
    .filter((e) => e.teamId === 'away' && e.period > periods)
    .reduce((s, e) => s + e.points, 0)
  const showOt = period > periods || otHome > 0 || otAway > 0

  const foulLights = (count: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`dl-light ${i < count ? 'on' : ''}`} />
    ))

  const timeoutLights = (used: number, max: number) =>
    Array.from({ length: max }, (_, i) => (
      <span key={i} className={`dl-to ${i < used ? 'used' : 'left'}`} />
    ))

  return (
    <div
      ref={rootRef}
      className={`display ${isFullscreen ? 'is-fullscreen' : ''} ${
        showControls ? 'show-controls' : ''
      }`}
    >
      <div className="display-bg" aria-hidden>
        <div
          className="display-wash home"
          style={{ background: home.color }}
        />
        <div
          className="display-wash away"
          style={{ background: away.color }}
        />
        <div className="display-wood" />
        <div className="display-vignette" />
        <div className="display-scan" />
      </div>

      <div className="display-controls no-print">
        <button
          type="button"
          className={`display-sound-btn ${soundOn ? 'on' : 'off'}`}
          onClick={() => {
            void unlockAudio()
            setCountdownSound(!soundOn)
          }}
          title="Suara hitung mundur 10 detik terakhir"
        >
          Suara<span className="sound-state"> {soundOn ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          className="display-fs-btn"
          onClick={() => void toggleFullscreen()}
          title="Fullscreen (F)"
        >
          {isFullscreen ? 'Keluar FS' : 'Fullscreen'}
        </button>
      </div>

      <header className="display-top">
        <div className="display-brand">
          <img className="brand-orb" src="/halcion-logo.png" alt="Halcion Community" />
          <div>
            <strong>HALCION</strong>
            <em>LIVE SCOREBOARD</em>
          </div>
        </div>
        <div className={`display-live-pill ${clockRunning ? 'on' : ''}`}>
          <span className="live-dot" />
          {clockRunning ? 'LIVE' : status.toUpperCase()}
          <span className="display-court">· {courtLabel(gameId)}</span>
        </div>
      </header>

      <div className="display-stage">
        <section
          className={[
            'display-side',
            'home',
            pulse === 'home' ? 'score-pop' : '',
            possession === 'home' ? 'has-ball' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ ['--team' as string]: home.color }}
        >
          <div className="side-accent" />
          <div className="side-label">HOME</div>
          <TeamLogo team={home} size="xl" className="side-logo" />
          <h2 className="side-name">{home.name}</h2>
          <div className="side-score" key={`h-${homeScore}`}>
            {homeScore}
          </div>

          <div className="side-stats">
            <div className="stat-block">
              <span className="stat-label">Team Fouls</span>
              <div className="dl-lights">{foulLights(homeFouls)}</div>
              {homeFouls >= 5 && <em className="bonus">BONUS</em>}
            </div>
            <div className="stat-block">
              <span className="stat-label">Timeouts</span>
              <div className="dl-tos">
                {timeoutLights(home.timeoutsUsed, config.timeoutsPerTeam)}
              </div>
            </div>
          </div>

          <div className={`ball-flag ${possession === 'home' ? 'on' : ''}`}>
            <span className="ball-orb" />
            POSSESSION
          </div>
        </section>

        <section className="display-mid">
          <div className="mid-period">{periodLabel(period, periods)}</div>
          <div
            className={[
              'mid-clock',
              clockLow ? 'low' : '',
              clockRunning ? 'running' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {formatClock(clockMs)}
          </div>

          {config.shotClockEnabled !== false && (
            <div className={`shot-module ${shotLow ? 'low' : ''}`}>
              <div
                className="shot-ring"
                style={{
                  background: `conic-gradient(${
                    shotLow ? '#ff5a5a' : '#f26b12'
                  } ${shotPct}%, rgba(255,255,255,0.08) 0)`,
                }}
              >
                <div className="shot-core">
                  <small>SHOT</small>
                  <strong>{formatShotClock(shotClockMs)}</strong>
                </div>
              </div>
            </div>
          )}

          <table className="period-board">
            <thead>
              <tr>
                <th />
                {PERIODS.map((p) => (
                  <th key={p} className={period === p ? 'now' : ''}>
                    {periodLabel(p, periods)}
                  </th>
                ))}
                {showOt && (
                  <th className={period > periods ? 'now' : ''}>OT</th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="team-cell" style={{ color: home.color }}>
                  {home.shortName}
                </td>
                {PERIODS.map((p) => (
                  <td key={p} className={period === p ? 'now' : ''}>
                    {periodScore(scoreEvents, 'home', p)}
                  </td>
                ))}
                {showOt && (
                  <td className={period > periods ? 'now' : ''}>{otHome}</td>
                )}
              </tr>
              <tr>
                <td className="team-cell" style={{ color: away.color }}>
                  {away.shortName}
                </td>
                {PERIODS.map((p) => (
                  <td key={p} className={period === p ? 'now' : ''}>
                    {periodScore(scoreEvents, 'away', p)}
                  </td>
                ))}
                {showOt && (
                  <td className={period > periods ? 'now' : ''}>{otAway}</td>
                )}
              </tr>
            </tbody>
          </table>
        </section>

        <section
          className={[
            'display-side',
            'away',
            pulse === 'away' ? 'score-pop' : '',
            possession === 'away' ? 'has-ball' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ ['--team' as string]: away.color }}
        >
          <div className="side-accent" />
          <div className="side-label">AWAY</div>
          <TeamLogo team={away} size="xl" className="side-logo" />
          <h2 className="side-name">{away.name}</h2>
          <div className="side-score" key={`a-${awayScore}`}>
            {awayScore}
          </div>

          <div className="side-stats">
            <div className="stat-block">
              <span className="stat-label">Team Fouls</span>
              <div className="dl-lights">{foulLights(awayFouls)}</div>
              {awayFouls >= 5 && <em className="bonus">BONUS</em>}
            </div>
            <div className="stat-block">
              <span className="stat-label">Timeouts</span>
              <div className="dl-tos">
                {timeoutLights(away.timeoutsUsed, config.timeoutsPerTeam)}
              </div>
            </div>
          </div>

          <div className={`ball-flag ${possession === 'away' ? 'on' : ''}`}>
            <span className="ball-orb" />
            POSSESSION
          </div>
        </section>
      </div>

      <footer className="display-ticker">
        {lastScore && lastTeam ? (
          <div className="ticker-track" key={lastScore.id}>
            <span className="ticker-badge">LAST PLAY</span>
            <span className="ticker-team" style={{ color: lastTeam.color }}>
              {lastTeam.name}
            </span>
            <span className="ticker-player">
              {lastPlayer
                ? `#${lastPlayer.number} ${lastPlayer.name}`
                : 'Team score'}
            </span>
            <strong className="ticker-pts">+{lastScore.points}</strong>
            <span className="ticker-when">
              {periodLabel(lastScore.period, periods)} · {formatClock(lastScore.clockMs)}
            </span>
          </div>
        ) : (
          <div className="ticker-track idle">
            <span className="ticker-badge">HALCION</span>
            <span>Siap untuk tip-off</span>
          </div>
        )}
      </footer>
    </div>
  )
}
