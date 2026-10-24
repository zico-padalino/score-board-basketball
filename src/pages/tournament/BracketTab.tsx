import { useState } from 'react'
import { LiveClock } from '../../components/LiveClock'
import { TeamLogo } from '../../components/TeamLogo'
import { matchWinner } from '../../lib/tournament'
import type { Match, TournamentFormat, TournamentTeam } from '../../types/tournament'
import { formatDay, formatTime } from '../../utils/datetime'

export function BracketTab({
  matches,
  teamById,
  onOpen,
  onCreateBracket,
  creatingBracket = false,
  format,
  teams = [],
  onMoveMatch,
  onUpdateTeams,
}: {
  matches: Match[]
  teamById: Map<string, TournamentTeam>
  onOpen?: (match: Match) => void
  onCreateBracket?: () => void
  creatingBracket?: boolean
  format: TournamentFormat
  teams?: TournamentTeam[]
  onMoveMatch?: (match: Match, target: Match) => Promise<void>
  onUpdateTeams?: (match: Match, homeId: string, awayId: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [homeId, setHomeId] = useState('')
  const [awayId, setAwayId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const knockout = matches.filter((m) => m.stage === 'knockout')
  if (knockout.length === 0) {
    return (
      <section className="panel">
        <h3>Bagan gugur belum dibuat</h3>
        <p className="muted">
          {onCreateBracket
            ? format === 'group_knockout'
              ? 'Buat babak gugur dari hasil klasemen grup. Babak 8 besar, semifinal, dan final akan disiapkan otomatis sesuai jumlah tim yang lolos.'
              : 'Buat babak gugur untuk seluruh tim. Babak lanjutan akan disiapkan otomatis.'
            : 'Bagan gugur belum tersedia.'}
        </p>
        {onCreateBracket && (
          <button
            className="btn btn-navy"
            type="button"
            disabled={creatingBracket}
            onClick={onCreateBracket}
          >
            {creatingBracket
              ? 'Membuat bagan…'
              : format === 'group_knockout'
                ? 'Buat babak gugur dari klasemen'
                : 'Buat bagan gugur'}
          </button>
        )}
      </section>
    )
  }

  const rounds = [...new Set(knockout.map((m) => m.round))].sort((a, b) => a - b)
  const firstRoundMatches = knockout
    .filter((match) => match.round === rounds[0])
    .sort((a, b) => a.bracket_index - b.bracket_index)
  const final = knockout.find((m) => m.round === rounds[rounds.length - 1])
  const championId = final?.status === 'finished' ? matchWinner(final) : null
  const champion = championId ? teamById.get(championId) : undefined

  const slot = (m: Match, side: 'home' | 'away') => {
    const id = side === 'home' ? m.home_team_id : m.away_team_id
    const team = id ? teamById.get(id) : undefined
    const score = side === 'home' ? m.home_score : m.away_score
    const won = m.status === 'finished' && id !== null && matchWinner(m) === id
    return (
      <div className={`bk-slot ${won ? 'won' : ''}`}>
        {team ? (
          <>
            <TeamLogo
              team={{ name: team.name, color: team.color, logo: team.logo, shortName: team.short_name }}
              size="sm"
            />
            <span>{team.name}</span>
          </>
        ) : (
          <span className="muted">Menunggu pemenang</span>
        )}
        <b>{m.status === 'scheduled' ? '' : score}</b>
      </div>
    )
  }

  const startEdit = (match: Match) => {
    setEditingId(match.id)
    setHomeId(match.home_team_id ?? '')
    setAwayId(match.away_team_id ?? '')
    setEditError(null)
  }

  const saveTeams = async (match: Match) => {
    setSaving(true)
    setEditError(null)
    try {
      await onUpdateTeams?.(match, homeId, awayId)
      setEditingId(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Gagal menyimpan pasangan tim')
    } finally {
      setSaving(false)
    }
  }

  const moveMatch = async (match: Match) => {
    const target = firstRoundMatches.find((item) => item.id === targetId)
    if (!target) return
    setSaving(true)
    setEditError(null)
    try {
      await onMoveMatch?.(match, target)
      setTargetId('')
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Gagal memindahkan pertandingan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tour-stack">
      {champion && (
        <section className="panel bk-champion">
          <span>🏆 Juara</span>
          <TeamLogo
            team={{ name: champion.name, color: champion.color, logo: champion.logo, shortName: champion.short_name }}
            size="lg"
          />
          <strong>{champion.name}</strong>
        </section>
      )}
      {onCreateBracket && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Generate ulang bagan</h3>
              <p className="muted">
                Pertandingan gugur yang ada, termasuk skor dan laga yang sedang berlangsung, akan
                diganti.
              </p>
            </div>
            <button
              className="btn btn-navy"
              type="button"
              disabled={creatingBracket}
              onClick={onCreateBracket}
            >
              {creatingBracket ? 'Membuat bagan…' : 'Generate ulang bagan'}
            </button>
          </div>
        </section>
      )}
      <div className="bracket">
        {rounds.map((round) => {
          const list = knockout
            .filter((m) => m.round === round)
            .sort((a, b) => a.bracket_index - b.bracket_index)
          return (
            <div key={round} className="bk-round">
              <h4>{list[0].round_label}</h4>
              <div className="bk-matches">
                {list.map((m) => {
                  const ready = Boolean(m.home_team_id && m.away_team_id)
                  return (
                    <div className="bk-match-wrap" key={m.id}>
                      <button
                        type="button"
                        className={`bk-match status-${m.status}`}
                        disabled={!ready || !onOpen}
                        onClick={() => onOpen?.(m)}
                        title={ready && onOpen ? 'Buka di scoreboard' : undefined}
                      >
                        <span className="bk-when">
                          {m.scheduled_at
                            ? `${formatDay(m.scheduled_at).split(',')[0]} · ${formatTime(m.scheduled_at)}`
                            : 'Belum dijadwalkan'}
                          {m.status === 'live' && (
                            <em>
                              {' '}
                              · LIVE <LiveClock match={m} />
                            </em>
                          )}
                        </span>
                        {slot(m, 'home')}
                        {slot(m, 'away')}
                      </button>
                      {(onMoveMatch || onUpdateTeams) && (
                        <details className="bk-editor">
                          <summary>Atur pertandingan</summary>
                          {onUpdateTeams && (
                            <>
                              {m.status === 'scheduled' ? (
                                editingId === m.id ? (
                                  <div className="bk-editor-fields">
                                    <label>
                                      Tim 1
                                      <select value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                                        <option value="">Pilih tim</option>
                                        {teams.map((team) => (
                                          <option key={team.id} value={team.id}>
                                            {team.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      Tim 2
                                      <select value={awayId} onChange={(e) => setAwayId(e.target.value)}>
                                        <option value="">Pilih tim</option>
                                        {teams.map((team) => (
                                          <option key={team.id} value={team.id}>
                                            {team.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="btn-row">
                                      <button
                                        className="btn btn-sm btn-primary"
                                        type="button"
                                        disabled={saving}
                                        onClick={() => void saveTeams(m)}
                                      >
                                        Simpan pasangan
                                      </button>
                                      <button
                                        className="btn btn-sm btn-ghost"
                                        type="button"
                                        disabled={saving}
                                        onClick={() => setEditingId(null)}
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-ghost"
                                    type="button"
                                    onClick={() => startEdit(m)}
                                  >
                                    Atur siapa melawan siapa
                                  </button>
                                )
                              ) : (
                                <p className="muted">Pasangan laga yang sudah dimulai tidak dapat diubah.</p>
                              )}
                            </>
                          )}
                          {onMoveMatch && (
                            <div className="bk-editor-fields">
                              <label>
                                Pindahkan ke game babak pertama
                                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                                  <option value="">Pilih slot game</option>
                                  {firstRoundMatches
                                    .filter((target) => target.id !== m.id)
                                    .map((target) => (
                                      <option key={target.id} value={target.id}>
                                        Game {target.bracket_index + 1}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <button
                                className="btn btn-sm btn-navy"
                                type="button"
                                disabled={saving || !targetId}
                                onClick={() => void moveMatch(m)}
                              >
                                Pindahkan laga ke slot ini
                              </button>
                            </div>
                          )}
                          {editingId === m.id && editError && <p className="logo-error">{editError}</p>}
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
