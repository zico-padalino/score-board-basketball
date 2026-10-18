import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TeamLogo } from '../components/TeamLogo'
import { setCountdownSound, useCountdownSoundEnabled } from '../hooks/useCountdownVoice'
import { snapshot } from '../hooks/useScoreboardSync'
import { unlockAudio } from '../utils/buzzer'
import { courtLabel, gameId } from '../lib/gameRoom'
import { finalizeMatch } from '../lib/tournamentApi'
import { useGameStore } from '../store/gameStore'
import type { Player, TeamId } from '../types/game'
import { formatClock, formatShotClock, periodLabel, periodsOf } from '../utils/format'
import { teamFoulsInPeriod, teamScore } from '../utils/stats'

type Toast = { id: number; text: string; tone: 'ok' | 'warn' | 'err' }

export function OperatorPage() {
  const state = useGameStore()
  const [selected, setSelected] = useState<{
    teamId: TeamId
    playerId: string
  } | null>(null)
  const [benchOpen, setBenchOpen] = useState<{ home: boolean; away: boolean }>({
    home: false,
    away: false,
  })
  const [mobileTeam, setMobileTeam] = useState<TeamId>('home')
  const [toast, setToast] = useState<Toast | null>(null)
  const [flash, setFlash] = useState(0)
  /** Bench player waiting to replace someone on court */
  const [pendingSubIn, setPendingSubIn] = useState<{
    teamId: TeamId
    playerId: string
  } | null>(null)

  const homeScore = teamScore(state.scoreEvents, 'home')
  const awayScore = teamScore(state.scoreEvents, 'away')
  const homeFouls = teamFoulsInPeriod(state, 'home', state.period)
  const awayFouls = teamFoulsInPeriod(state, 'away', state.period)
  const shotOn = state.config.shotClockEnabled !== false
  const shotLow = state.shotClockMs <= 5000
  const clockLow = state.clockMs <= 10000

  const selectedPlayer = useMemo(() => {
    if (!selected) return null
    const team = selected.teamId === 'home' ? state.home : state.away
    return team.players.find((p) => p.id === selected.playerId) ?? null
  }, [selected, state.home, state.away])

  const selectedStats = selected
    ? state.playerStats[selected.playerId]
    : null

  const recent = useMemo(
    () =>
      [...state.events]
        .filter((e) =>
          [
            'fg2_made',
            'fg3_made',
            'ft_made',
            'foul_personal',
            'timeout',
            'ast',
            'reb_off',
            'reb_def',
            'stl',
            'blk',
            'tov',
          ].includes(e.type),
        )
        .slice(-8)
        .reverse(),
    [state.events],
  )

  const showToast = (text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now()
    setToast({ id, text, tone })
    setFlash((n) => n + 1)
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(t)
  }, [toast])

  const [savingResult, setSavingResult] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [scorePicker, setScorePicker] = useState<{
    teamId: TeamId
    points: 1 | 2 | 3 | -1
  } | null>(null)
  const soundOn = useCountdownSoundEnabled()

  const finish = async () => {
    const match = state.match
    if (!match) {
      state.finishGame()
      showToast('Game selesai', 'warn')
      return
    }
    if (homeScore === awayScore) {
      showToast('Skor imbang — lanjutkan overtime dulu', 'warn')
      return
    }
    const ok = window.confirm(
      `Akhiri laga dan simpan hasil?\n${state.home.name} ${homeScore} – ${awayScore} ${state.away.name}`,
    )
    if (!ok) return
    state.finishGame()
    setSavingResult(true)
    try {
      await finalizeMatch(match.id, snapshot(useGameStore.getState()))
      showToast('Hasil tersimpan ke jadwal', 'ok')
    } catch {
      showToast('Gagal menyimpan hasil — cek koneksi', 'err')
    } finally {
      setSavingResult(false)
    }
  }

  const requirePlayer = () => {
    if (!selected) {
      showToast('Pilih pemain dulu', 'warn')
      return null
    }
    return selected
  }

  const withPlayer = (
    fn: (sel: NonNullable<typeof selected>) => void,
    label: string,
    tone: Toast['tone'] = 'ok',
  ) => {
    const sel = requirePlayer()
    if (!sel) return
    fn(sel)
    showToast(label, tone)
  }

  const toggleClock = () => {
    const s = useGameStore.getState()
    if (s.status === 'ready' || s.status === 'setup') {
      s.startGame()
      showToast('Jam dimulai')
    } else {
      const wasRunning = s.clockRunning
      s.toggleClock()
      showToast(wasRunning ? 'Jam di-pause' : 'Jam jalan')
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const s = useGameStore.getState()

      if (e.code === 'Space') {
        e.preventDefault()
        toggleClock()
        return
      }
      const shotOn = s.config.shotClockEnabled !== false
      if (e.key === '4' && shotOn) {
        s.resetShotClock()
        showToast('Shot clock 24')
        return
      }
      if (e.key === '5' && shotOn) {
        s.resetShotClock(14_000)
        showToast('Shot clock 14')
        return
      }
      if (e.key === 'z' || e.key === 'Z') {
        s.undoLastScore()
        showToast('Undo skor', 'warn')
        return
      }
      if (!selected) return
      if (e.key === '1') {
        s.recordScore(selected.teamId, 1, selected.playerId)
        showToast('+1 FT')
      } else if (e.key === '2') {
        s.recordScore(selected.teamId, 2, selected.playerId)
        showToast('+2')
      } else if (e.key === '3') {
        s.recordScore(selected.teamId, 3, selected.playerId)
        showToast('+3')
      } else if (e.key === 'f' || e.key === 'F') {
        s.recordFoul(selected.teamId, selected.playerId)
        showToast('Foul', 'err')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const eventLabel = (type: string) => {
    const map: Record<string, string> = {
      fg2_made: '+2',
      fg3_made: '+3',
      ft_made: '+1',
      foul_personal: 'FOUL',
      timeout: 'TIMEOUT',
      ast: 'AST',
      reb_off: 'OREB',
      reb_def: 'DREB',
      stl: 'STL',
      blk: 'BLK',
      tov: 'TOV',
    }
    return map[type] ?? type
  }

  const findPlayer = (teamId: TeamId, playerId: string | null) => {
    if (!playerId) return null
    const team = teamId === 'home' ? state.home : state.away
    return team.players.find((p) => p.id === playerId) ?? null
  }

  const renderFoulDots = (count: number, max = 5) => (
    <div className="foul-dots" aria-label={`${count} fouls`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'on' : ''} />
      ))}
    </div>
  )

  const startSubIn = (teamId: TeamId, playerId: string) => {
    const team = teamId === 'home' ? state.home : state.away
    const onCourt = team.players.filter((p) => p.active)
    const player = team.players.find((p) => p.id === playerId)
    if (!player || player.active) return

    // Ada slot kosong → langsung masuk
    if (onCourt.length < state.config.playersOnCourt) {
      const ok = state.togglePlayerActive(teamId, playerId)
      if (ok) {
        setSelected({ teamId, playerId })
        setPendingSubIn(null)
        showToast(`#${player.number} masuk court`)
      }
      return
    }

    // Lapangan penuh → pilih pemain yang diganti
    setSelected({ teamId, playerId })
    setPendingSubIn({ teamId, playerId })
    setBenchOpen((s) => ({ ...s, [teamId]: true }))
    showToast('Pilih pemain ON COURT yang diganti', 'warn')
  }

  const handlePlayerClick = (teamId: TeamId, p: Player) => {
    // Mode ganti: klik pemain on court untuk diganti
    if (
      pendingSubIn &&
      pendingSubIn.teamId === teamId &&
      p.active &&
      p.id !== pendingSubIn.playerId
    ) {
      const team = teamId === 'home' ? state.home : state.away
      const inn = team.players.find((x) => x.id === pendingSubIn.playerId)
      const ok = state.substitutePlayers(
        teamId,
        pendingSubIn.playerId,
        p.id,
      )
      if (ok) {
        showToast(`Sub: #${inn?.number ?? '?'} masuk · #${p.number} keluar`)
        setSelected({ teamId, playerId: pendingSubIn.playerId })
        setPendingSubIn(null)
      } else {
        showToast('Gagal ganti pemain', 'err')
      }
      return
    }

    setSelected({ teamId, playerId: p.id })
    setMobileTeam(teamId)
    if (pendingSubIn && pendingSubIn.playerId !== p.id) {
      setPendingSubIn(null)
    }
  }

  const renderPlayerBtn = (teamId: TeamId, p: Player) => {
    const st = state.playerStats[p.id]
    const isSelected =
      selected?.teamId === teamId && selected.playerId === p.id
    const fouledOut = (st?.pf ?? 0) >= state.config.maxPersonalFouls
    const isPendingIn =
      pendingSubIn?.teamId === teamId && pendingSubIn.playerId === p.id
    const isSwapTarget =
      Boolean(pendingSubIn) &&
      pendingSubIn?.teamId === teamId &&
      p.active &&
      !isPendingIn

    return (
      <button
        key={p.id}
        type="button"
        className={[
          'jersey',
          isSelected ? 'selected' : '',
          !p.active ? 'bench' : '',
          fouledOut ? 'fouled-out' : '',
          isPendingIn ? 'pending-in' : '',
          isSwapTarget ? 'swap-target' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => handlePlayerClick(teamId, p)}
        disabled={fouledOut && !isSwapTarget}
        title={
          isSwapTarget
            ? `Ganti keluar: #${p.number}`
            : fouledOut
              ? 'Foul out'
              : `#${p.number} ${p.name}`
        }
      >
        <span className="jersey-num">{p.number}</span>
        <span className="jersey-meta">
          <span className="jersey-name">{p.name}</span>
          <span className="jersey-stats">
            {st?.pts ?? 0}p · {st?.pf ?? 0}f
            {isSwapTarget ? ' · klik untuk keluar' : ''}
          </span>
        </span>
        {renderFoulDots(st?.pf ?? 0)}
      </button>
    )
  }

  /** Skor dari kartu tim: masuk ke pemain terpilih, atau tanya siapa pencetaknya. */
  const teamScoreAction = (teamId: TeamId, points: 1 | 2 | 3 | -1) => {
    if (selected?.teamId === teamId) {
      applyTeamScore(teamId, points, selected.playerId)
      return
    }
    setScorePicker({ teamId, points })
  }

  const applyTeamScore = (teamId: TeamId, points: 1 | 2 | 3 | -1, playerId: string | null) => {
    const team = teamId === 'home' ? state.home : state.away
    const player = playerId ? team.players.find((p) => p.id === playerId) : null
    const who = player ? `#${player.number} ${player.name}` : team.shortName
    if (points === -1) {
      state.correctScore(teamId, -1, playerId)
      showToast(`${who} −1`, 'warn')
    } else {
      state.recordScore(teamId, points, playerId)
      showToast(`${who} +${points}${points === 1 ? ' FT' : ''}`)
    }
    setScorePicker(null)
  }

  const editScore = (teamId: TeamId) => {
    const team = teamId === 'home' ? state.home : state.away
    const current = teamId === 'home' ? homeScore : awayScore
    const input = window.prompt(`Skor ${team.name} (sekarang ${current}):`, String(current))
    if (input === null) return
    const value = Number.parseInt(input.trim(), 10)
    if (!Number.isFinite(value) || value < 0) {
      showToast('Skor harus angka 0 atau lebih', 'err')
      return
    }
    if (value === current) return
    state.setTeamScore(teamId, value)
    showToast(`Skor ${team.shortName} jadi ${value}`, 'warn')
  }

  const renderTeamCol = (teamId: TeamId) => {
    const team = teamId === 'home' ? state.home : state.away
    const scoreVal = teamId === 'home' ? homeScore : awayScore
    const fouls = teamId === 'home' ? homeFouls : awayFouls
    const onCourt = team.players.filter((p) => p.active)
    const bench = team.players.filter((p) => !p.active)
    const showBench = benchOpen[teamId]

    return (
      <section
        className={`op-team op-team-${teamId}`}
        style={{ ['--team-color' as string]: team.color }}
      >
        <header className="op-team-head">
          <div className="op-team-title">
            <TeamLogo team={team} size="md" />
            <div>
              <div className="op-team-label">
                {teamId === 'home' ? 'HOME' : 'AWAY'}
                {state.possession === teamId && (
                  <span className="pos-pill">BALL</span>
                )}
                {fouls >= 5 && <span className="bonus-pill">BONUS</span>}
              </div>
              <h2>{team.name}</h2>
            </div>
          </div>
          <button
            type="button"
            className="op-team-score"
            title="Ketuk untuk edit skor"
            onClick={() => editScore(teamId)}
          >
            {scoreVal}
          </button>
        </header>

        <div className="op-team-meta">
          <div>
            <span className="meta-label">Team fouls</span>
            {renderFoulDots(Math.min(fouls, 5))}
            <strong>{fouls}</strong>
          </div>
          <div>
            <span className="meta-label">Timeout</span>
            <strong>
              {team.timeoutsUsed}/{state.config.timeoutsPerTeam}
            </strong>
          </div>
        </div>

        <div className="op-team-quick">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              state.recordTimeout(teamId)
              showToast(`Timeout ${team.name}`, 'warn')
            }}
          >
            Timeout
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              state.setPossession(teamId)
              showToast(`Possession ${team.shortName}`)
            }}
          >
            Ball
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => teamScoreAction(teamId, 2)}
          >
            +2
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => teamScoreAction(teamId, 3)}
          >
            +3
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost op-minus"
            disabled={scoreVal <= 0}
            title="Kurangi 1 poin dari pemain / tim"
            onClick={() => teamScoreAction(teamId, -1)}
          >
            −1
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="+1 lemparan bebas"
            onClick={() => teamScoreAction(teamId, 1)}
          >
            +1
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost op-edit-score"
            onClick={() => editScore(teamId)}
          >
            Edit skor
          </button>
        </div>

        <div className="op-section-label">
          On court
          {pendingSubIn?.teamId === teamId && (
            <span className="sub-hint"> — klik pemain yang diganti</span>
          )}
        </div>
        <div className="jersey-grid">{onCourt.map((p) => renderPlayerBtn(teamId, p))}</div>

        <button
          type="button"
          className="bench-toggle"
          onClick={() =>
            setBenchOpen((s) => ({ ...s, [teamId]: !s[teamId] }))
          }
        >
          Bench ({bench.length}) {showBench ? '▴' : '▾'}
        </button>
        {showBench && (
          <div className="jersey-grid bench-grid">
            {bench.map((p) => renderPlayerBtn(teamId, p))}
          </div>
        )}
      </section>
    )
  }

  const hasPlayer = Boolean(selected && selectedPlayer)

  return (
    <main className="page wide op-page">
      {toast && (
        <div className={`op-toast ${toast.tone}`} key={toast.id}>
          {toast.text}
        </div>
      )}

      {scorePicker && (() => {
        const team = scorePicker.teamId === 'home' ? state.home : state.away
        const minus = scorePicker.points === -1
        const ordered = [...team.players].sort((a, b) => Number(b.active) - Number(a.active))
        return (
          <div className="score-picker-backdrop" onClick={() => setScorePicker(null)}>
            <div
              className="score-picker"
              role="dialog"
              aria-label="Pilih pencetak poin"
              style={{ ['--team-color' as string]: team.color }}
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <strong>
                  {minus ? 'Kurangi 1 poin dari' : `Siapa yang mencetak +${scorePicker.points}?`}
                </strong>
                <span>{team.name}</span>
              </header>
              <div className="score-picker-grid">
                {ordered.map((p) => {
                  const pts = state.playerStats[p.id]?.pts ?? 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`score-picker-player ${p.active ? 'on-court' : 'bench'}`}
                      disabled={minus && pts <= 0}
                      onClick={() => applyTeamScore(scorePicker.teamId, scorePicker.points, p.id)}
                    >
                      <b>{p.number}</b>
                      <span>{p.name}</span>
                      <small>
                        {pts} pts{p.active ? '' : ' · bench'}
                      </small>
                    </button>
                  )
                })}
              </div>
              <div className="score-picker-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => applyTeamScore(scorePicker.teamId, scorePicker.points, null)}
                >
                  {minus ? 'Koreksi skor tim saja' : 'Tanpa pemain (skor tim)'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setScorePicker(null)}>
                  Batal
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {state.match && (
        <div className="op-match-banner">
          <span>
            <strong>Laga turnamen</strong> {state.match.label}
          </span>
          <div className="btn-row">
            <Link className="btn btn-sm btn-ghost" to={`/admin/turnamen/${state.match.tournamentId}`}>
              Jadwal
            </Link>
            {state.status === 'finished' ? (
              <span className="tag ready">Hasil tersimpan</span>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-success"
                disabled={savingResult}
                onClick={() => void finish()}
              >
                Akhiri & simpan hasil
              </button>
            )}
          </div>
        </div>
      )}

      <div className="operator">
        <header className={`op-toolbar ${adjustOpen ? 'adjust-open' : ''} ${shotOn ? '' : 'no-shot'}`}>
          <div className="op-toolbar-left">
            <span className={`tag ${state.status === 'live' ? 'live' : 'ready'}`}>
              {state.status}
            </span>
            <span className="op-period">{periodLabel(state.period, periodsOf(state.config))}</span>
            <span className="op-court" title="Semua perangkat admin di lapangan ini sinkron">
              {courtLabel(gameId)}
            </span>
          </div>

          <div className="op-clock-block">
            <button
              type="button"
              className={`op-main-clock ${clockLow ? 'low' : ''} ${
                state.clockRunning ? 'running' : ''
              }`}
              onClick={toggleClock}
              title="Space: start/pause"
            >
              {formatClock(state.clockMs)}
            </button>
            {shotOn && (
              <div className={`op-shot ${shotLow ? 'low' : ''}`}>
                <span>SHOT</span>
                <strong>{formatShotClock(state.shotClockMs)}</strong>
              </div>
            )}
          </div>

          <div className="op-toolbar-actions">
            <button
              type="button"
              className={`btn btn-sm op-start ${state.clockRunning ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleClock}
            >
              {state.clockRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              className={`btn btn-sm op-shot-toggle ${shotOn ? 'on' : 'off'}`}
              aria-pressed={shotOn}
              title="Aktifkan / matikan shot clock 24 & 14"
              onClick={() => {
                state.setShotClockEnabled(!shotOn)
                showToast(shotOn ? 'Shot clock dimatikan' : 'Shot clock aktif', shotOn ? 'warn' : 'ok')
              }}
            >
              Shot {shotOn ? 'ON' : 'OFF'}
            </button>
            {shotOn && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-navy"
                  onClick={() => {
                    state.resetShotClock()
                    showToast('Shot 24')
                  }}
                >
                  24
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-navy"
                  onClick={() => {
                    state.resetShotClock(14_000)
                    showToast('Shot 14')
                  }}
                >
                  14
                </button>
              </>
            )}
            <button
              type="button"
              className={`btn btn-sm btn-ghost op-adjust-toggle ${adjustOpen ? 'open' : ''}`}
              aria-expanded={adjustOpen}
              title="Ganti babak & koreksi jam"
              onClick={() => setAdjustOpen((v) => !v)}
            >
              {adjustOpen ? '✕' : '⋯'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost op-secondary"
              title="Babak sebelumnya"
              onClick={state.prevPeriod}
            >
              ← Babak
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost op-secondary"
              title="Babak berikutnya"
              onClick={state.nextPeriod}
            >
              Babak →
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost op-secondary"
              onClick={() => state.setClockMs(state.clockMs + 1000)}
            >
              +1s
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost op-secondary"
              onClick={() => state.setClockMs(Math.max(0, state.clockMs - 1000))}
            >
              −1s
            </button>
            <button
              type="button"
              className={`btn btn-sm btn-ghost op-secondary op-sound ${soundOn ? 'on' : ''}`}
              title="Suara hitung mundur 10 detik terakhir di perangkat ini"
              onClick={() => {
                void unlockAudio()
                setCountdownSound(!soundOn)
                showToast(soundOn ? 'Suara hitung mundur mati' : 'Suara hitung mundur aktif')
              }}
            >
              Suara {soundOn ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost op-secondary op-reset"
              title="Ulang laga dari 0–0 dengan tim yang sama"
              onClick={() => {
                const label = `${state.home.name} vs ${state.away.name}`
                if (!window.confirm(`Reset skor ${label} ke 0–0?\nJam, foul, timeout, dan statistik pemain ikut diulang.`)) return
                state.restartGame()
                setAdjustOpen(false)
                showToast('Skor direset ke 0–0', 'warn')
              }}
            >
              Reset skor
            </button>
          </div>

          <div className="op-toolbar-links">
            <Link
              className="btn btn-sm btn-navy"
              to={`/display?game=${gameId}`}
              target="_blank"
              title={`Layar penonton ${courtLabel(gameId)}`}
            >
              Layar
            </Link>
            <Link className="btn btn-sm btn-ghost" to="/admin/scoresheet">
              Sheet
            </Link>
            <Link className="btn btn-sm btn-ghost" to="/admin/boxscore">
              Box
            </Link>
          </div>
        </header>

        <div className="op-scorestrip">
          <button
            type="button"
            className={`strip-team home ${mobileTeam === 'home' ? 'active' : ''}`}
            onClick={() => setMobileTeam('home')}
          >
            <TeamLogo team={state.home} size="sm" />
            <span>{state.home.name}</span>
            <strong>{homeScore}</strong>
          </button>
          <div className="strip-vs">vs</div>
          <button
            type="button"
            className={`strip-team away ${mobileTeam === 'away' ? 'active' : ''}`}
            onClick={() => setMobileTeam('away')}
          >
            <strong>{awayScore}</strong>
            <span>{state.away.name}</span>
            <TeamLogo team={state.away} size="sm" />
          </button>
        </div>

        <div className={`op-mobile-tabs`} role="tablist" aria-label="Pilih tim">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTeam === 'home'}
            className={mobileTeam === 'home' ? 'active' : ''}
            onClick={() => setMobileTeam('home')}
            style={{ ['--team-color' as string]: state.home.color }}
          >
            <TeamLogo team={state.home} size="sm" />
            Home · {homeScore}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTeam === 'away'}
            className={mobileTeam === 'away' ? 'active' : ''}
            onClick={() => setMobileTeam('away')}
            style={{ ['--team-color' as string]: state.away.color }}
          >
            Away · {awayScore}
            <TeamLogo team={state.away} size="sm" />
          </button>
        </div>

        <div className={`op-main showing-${mobileTeam}`}>
          {renderTeamCol('home')}

          <section className={`op-console ${hasPlayer ? 'ready' : ''} flash-${flash % 2}`}>
            <div className="console-player">
              {hasPlayer && selected && selectedPlayer ? (
                <>
                  <div
                    className="console-jersey"
                    style={{
                      background:
                        selected.teamId === 'home'
                          ? state.home.color
                          : state.away.color,
                    }}
                  >
                    #{selectedPlayer.number}
                  </div>
                  <div>
                    <div className="console-name">{selectedPlayer.name}</div>
                    <div className="console-sub">
                      {(selected.teamId === 'home'
                        ? state.home
                        : state.away
                      ).name}{' '}
                      · {selectedStats?.pts ?? 0} PTS · {selectedStats?.pf ?? 0}{' '}
                      PF
                    </div>
                  </div>
                  {selectedPlayer.active ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        const ok = state.togglePlayerActive(
                          selected.teamId,
                          selected.playerId,
                        )
                        if (ok) {
                          setPendingSubIn(null)
                          showToast(`#${selectedPlayer.number} ke bench`, 'warn')
                        }
                      }}
                    >
                      Sub out
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        startSubIn(selected.teamId, selected.playerId)
                      }
                    >
                      Sub in
                    </button>
                  )}
                </>
              ) : (
                <div className="console-empty">
                  <strong>Pilih pemain</strong>
                  <span>Lalu catat skor / statistik</span>
                </div>
              )}
            </div>

            {pendingSubIn && (
              <div className="sub-banner">
                <div>
                  <strong>Mode ganti pemain</strong>
                  <span>
                    Klik pemain di <em>On court</em> yang mau diganti, atau
                    batalkan.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setPendingSubIn(null)
                    showToast('Ganti dibatalkan', 'warn')
                  }}
                >
                  Batal
                </button>
              </div>
            )}

            <div className="op-action-dock">
              <div className="dock-player">
                {hasPlayer && selectedPlayer ? (
                  <>
                    <strong>#{selectedPlayer.number}</strong>
                    <span>{selectedPlayer.name}</span>
                  </>
                ) : (
                  <span className="muted">Pilih pemain dulu</span>
                )}
              </div>
              <div className="score-btns">
                <button
                  className="btn btn-success"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordScore(sel.teamId, 1, sel.playerId),
                      '+1 FT',
                    )
                  }
                >
                  +1
                  <small>FT</small>
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordScore(sel.teamId, 2, sel.playerId),
                      '+2',
                    )
                  }
                >
                  +2
                  <small>FG</small>
                </button>
                <button
                  className="btn btn-navy"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordScore(sel.teamId, 3, sel.playerId),
                      '+3',
                    )
                  }
                >
                  +3
                  <small>3PT</small>
                </button>
              </div>
              <div className="dock-controls">
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordFoul(sel.teamId, sel.playerId),
                      'Foul',
                      'err',
                    )
                  }
                >
                  FOUL
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    state.undoLastScore()
                    showToast('Undo skor', 'warn')
                  }}
                >
                  Undo
                </button>
              </div>
            </div>

            <div className="console-group console-score-desktop">
              <div className="group-label">Skor</div>
              <div className="score-btns">
                <button
                  className="btn btn-success"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordScore(sel.teamId, 1, sel.playerId),
                      '+1 FT',
                    )
                  }
                >
                  +1
                  <small>FT</small>
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordScore(sel.teamId, 2, sel.playerId),
                      '+2',
                    )
                  }
                >
                  +2
                  <small>FG</small>
                </button>
                <button
                  className="btn btn-navy"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordScore(sel.teamId, 3, sel.playerId),
                      '+3',
                    )
                  }
                >
                  +3
                  <small>3PT</small>
                </button>
              </div>
            </div>

            <details className="console-more" open>
              <summary className="group-label">Miss &amp; Statistik</summary>
              <div className="console-group">
                <div className="stat-btns three">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={!hasPlayer}
                    onClick={() =>
                      withPlayer(
                        (sel) => state.recordMiss(sel.teamId, '1', sel.playerId),
                        'Miss FT',
                      )
                    }
                  >
                    Miss FT
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={!hasPlayer}
                    onClick={() =>
                      withPlayer(
                        (sel) => state.recordMiss(sel.teamId, '2', sel.playerId),
                        'Miss 2',
                      )
                    }
                  >
                    Miss 2
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={!hasPlayer}
                    onClick={() =>
                      withPlayer(
                        (sel) => state.recordMiss(sel.teamId, '3', sel.playerId),
                        'Miss 3',
                      )
                    }
                  >
                    Miss 3
                  </button>
                </div>
              </div>
              <div className="console-group">
                <div className="stat-btns">
                  {(
                    [
                      ['reb_off', 'OREB'],
                      ['reb_def', 'DREB'],
                      ['ast', 'AST'],
                      ['stl', 'STL'],
                      ['blk', 'BLK'],
                      ['tov', 'TOV'],
                    ] as const
                  ).map(([type, label]) => (
                    <button
                      key={type}
                      className="btn btn-ghost"
                      type="button"
                      disabled={!hasPlayer}
                      onClick={() =>
                        withPlayer(
                          (sel) =>
                            state.recordStat(type, sel.teamId, sel.playerId),
                          label,
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </details>

            <div className="console-group console-control-desktop">
              <div className="group-label">Kontrol</div>
              <div className="stat-btns three">
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={!hasPlayer}
                  onClick={() =>
                    withPlayer(
                      (sel) => state.recordFoul(sel.teamId, sel.playerId),
                      'Foul',
                      'err',
                    )
                  }
                >
                  FOUL
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    state.undoLastScore()
                    showToast('Undo skor', 'warn')
                  }}
                >
                  Undo skor
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void finish()}
                >
                  Akhiri
                </button>
              </div>
            </div>

            <div className="console-group recent-group">
              <div className="group-label">Play terakhir</div>
              <ul className="recent-list">
                {recent.length === 0 && (
                  <li className="muted">Belum ada aksi</li>
                )}
                {recent.map((e) => {
                  const p = findPlayer(e.teamId, e.playerId)
                  const team = e.teamId === 'home' ? state.home : state.away
                  return (
                    <li key={e.id}>
                      <span className="recent-tag">{eventLabel(e.type)}</span>
                      <span>
                        {team.shortName}
                        {p ? ` #${p.number}` : ''}
                      </span>
                      <span className="muted">{periodLabel(e.period, periodsOf(state.config))}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <p className="op-hints">
              Shortcut: <kbd>Space</kbd> jam · <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd> skor · <kbd>F</kbd> foul · <kbd>4</kbd>/<kbd>5</kbd>{' '}
              shot 24/14 · <kbd>Z</kbd> undo
            </p>
          </section>

          {renderTeamCol('away')}
        </div>
      </div>
    </main>
  )
}
