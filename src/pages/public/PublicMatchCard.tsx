import { LiveClock } from '../../components/LiveClock'
import { TeamLogo } from '../../components/TeamLogo'
import type { Match, TournamentTeam } from '../../types/tournament'
import { formatTime } from '../../utils/datetime'

function Side({ team, winner, align }: { team?: TournamentTeam; winner: boolean; align: 'home' | 'away' }) {
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
        <span className="muted">TBD</span>
      )}
    </div>
  )
}

export function PublicMatchCard({
  match,
  teamById,
}: {
  match: Match
  teamById: Map<string, TournamentTeam>
}) {
  const home = match.home_team_id ? teamById.get(match.home_team_id) : undefined
  const away = match.away_team_id ? teamById.get(match.away_team_id) : undefined
  const finished = match.status === 'finished'

  return (
    <div className={`match-row public status-${match.status}`}>
      <div className="mr-meta">
        <strong>{formatTime(match.scheduled_at)}</strong>
        <span>{match.round_label}</span>
        {match.venue && <span className="muted">{match.venue}</span>}
      </div>
      <div className="mr-board">
        <Side team={home} align="home" winner={finished && match.home_score > match.away_score} />
        <div className="mr-score">
          {match.status === 'scheduled' ? (
            <i>vs</i>
          ) : (
            <>
              <b>{match.home_score}</b>
              <i>–</i>
              <b>{match.away_score}</b>
            </>
          )}
          {match.status === 'live' && <LiveClock match={match} />}
        </div>
        <Side team={away} align="away" winner={finished && match.away_score > match.home_score} />
      </div>
      <div className="mr-actions">
        {match.status === 'live' && <span className="tag live">● Live</span>}
        {finished && <span className="tag ready">Final</span>}
      </div>
    </div>
  )
}
