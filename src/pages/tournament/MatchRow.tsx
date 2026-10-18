import { useState } from 'react'
import { LiveClock } from '../../components/LiveClock'
import { TeamLogo } from '../../components/TeamLogo'
import { resetMatch, updateMatch } from '../../lib/tournamentApi'
import type { Match, TournamentTeam } from '../../types/tournament'
import { formatTime, fromLocalInput, toLocalInput } from '../../utils/datetime'

const STATUS_LABEL: Record<Match['status'], string> = {
  scheduled: 'Terjadwal',
  live: 'Berlangsung',
  finished: 'Selesai',
}

function TeamSide({
  team,
  placeholder,
  winner,
  align,
}: {
  team: TournamentTeam | undefined
  placeholder: string
  winner: boolean
  align: 'home' | 'away'
}) {
  return (
    <div className={`mr-team ${align} ${winner ? 'winner' : ''}`}>
      {team ? (
        <>
          <TeamLogo
            team={{ name: team.name, color: team.color, logo: team.logo, shortName: team.short_name }}
            size="sm"
          />
          <span>{team.name}</span>
        </>
      ) : (
        <span className="muted">{placeholder}</span>
      )}
    </div>
  )
}

export function MatchRow({
  match,
  teams,
  teamById,
  onOpen,
  onChanged,
  showLabel = true,
}: {
  match: Match
  teams: TournamentTeam[]
  teamById: Map<string, TournamentTeam>
  onOpen: (match: Match) => void
  onChanged: () => void
  showLabel?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [when, setWhen] = useState(toLocalInput(match.scheduled_at))
  const [venue, setVenue] = useState(match.venue)
  const [homeId, setHomeId] = useState(match.home_team_id ?? '')
  const [awayId, setAwayId] = useState(match.away_team_id ?? '')
  const [busy, setBusy] = useState(false)

  const home = match.home_team_id ? teamById.get(match.home_team_id) : undefined
  const away = match.away_team_id ? teamById.get(match.away_team_id) : undefined
  const ready = Boolean(home && away)
  const finished = match.status === 'finished'
  const showScore = match.status !== 'scheduled'
  const placeholder = match.stage === 'knockout' ? 'Menunggu pemenang' : 'TBD'

  const save = async (patch: Partial<Match>) => {
    setBusy(true)
    try {
      await updateMatch(match.id, patch)
      setEditing(false)
      onChanged()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }

  const openLabel =
    match.status === 'scheduled' ? 'Buka Game' : match.status === 'live' ? 'Lanjutkan' : 'Lihat Game'

  return (
    <div className={`match-row status-${match.status}`}>
      <div className="mr-meta">
        <strong>{formatTime(match.scheduled_at)}</strong>
        {showLabel && <span>{match.round_label}</span>}
        {match.venue && <span className="muted">{match.venue}</span>}
      </div>

      <div className="mr-board">
        <TeamSide
          team={home}
          placeholder={placeholder}
          winner={finished && match.home_score > match.away_score}
          align="home"
        />
        <div className="mr-score">
          {showScore ? (
            <>
              <b>{match.home_score}</b>
              <i>–</i>
              <b>{match.away_score}</b>
            </>
          ) : (
            <i>vs</i>
          )}
          {match.status === 'live' && <LiveClock match={match} />}
        </div>
        <TeamSide
          team={away}
          placeholder={placeholder}
          winner={finished && match.away_score > match.home_score}
          align="away"
        />
      </div>

      <div className="mr-actions">
        <span className={`tag ${match.status === 'live' ? 'live' : match.status === 'finished' ? 'ready' : ''}`}>
          {STATUS_LABEL[match.status]}
        </span>
        <button
          type="button"
          className={`btn btn-sm ${match.status === 'finished' ? 'btn-ghost' : 'btn-primary'}`}
          disabled={!ready}
          title={ready ? undefined : 'Tim belum lengkap'}
          onClick={() => onOpen(match)}
        >
          {openLabel}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing((v) => !v)}>
          Edit
        </button>
      </div>

      {editing && (
        <div className="mr-edit">
          <div className="field">
            <label>Tanggal & jam</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="field">
            <label>Lapangan</label>
            <input value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="field">
            <label>Home</label>
            <select value={homeId} disabled={finished} onChange={(e) => setHomeId(e.target.value)}>
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Away</label>
            <select value={awayId} disabled={finished} onChange={(e) => setAwayId(e.target.value)}>
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-sm btn-navy"
              disabled={busy}
              onClick={() =>
                save({
                  scheduled_at: fromLocalInput(when),
                  venue: venue.trim(),
                  home_team_id: homeId || null,
                  away_team_id: awayId || null,
                })
              }
            >
              Simpan
            </button>
            {match.status !== 'scheduled' && (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('Reset hasil laga ini? Skor dan statistik laga akan dihapus.')) return
                  setBusy(true)
                  resetMatch(match.id)
                    .then(() => {
                      setEditing(false)
                      onChanged()
                    })
                    .catch((e: Error) => window.alert(e.message))
                    .finally(() => setBusy(false))
                }}
              >
                Reset hasil
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
