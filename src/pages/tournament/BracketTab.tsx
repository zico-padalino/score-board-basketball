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
}: {
  matches: Match[]
  teamById: Map<string, TournamentTeam>
  onOpen?: (match: Match) => void
  onCreateBracket?: () => void
  creatingBracket?: boolean
  format: TournamentFormat
}) {
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
                    <button
                      key={m.id}
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
