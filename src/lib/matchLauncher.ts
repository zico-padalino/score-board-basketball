import { flushGameSave } from '../hooks/useScoreboardSync'
import { useGameStore } from '../store/gameStore'
import type { Player } from '../types/game'
import type { Match, Tournament, TournamentTeam } from '../types/tournament'
import { blankRoster, resolveSettings } from './tournament'
import { getMatchState } from './tournamentApi'
import { uid } from '../utils/format'

function rosterFor(team: TournamentTeam, prefix: string): Player[] {
  const players = team.players?.length ? team.players : blankRoster()
  return players.map((p, i) => ({
    ...p,
    id: uid(`${prefix}_p`),
    active: i < 5,
  }))
}

/** True kalau scoreboard sedang memainkan game lain yang belum selesai. */
export function hasUnfinishedOtherGame(matchId: string) {
  const s = useGameStore.getState()
  const busy = s.status === 'live' || s.status === 'paused'
  return busy && s.match?.id !== matchId
}

/** Muat laga ke scoreboard; laga yang sudah pernah dibuka dilanjutkan dari state terakhir. */
export async function openMatchInScoreboard(
  match: Match,
  home: TournamentTeam,
  away: TournamentTeam,
  tournament: Tournament,
) {
  flushGameSave()
  const saved = await getMatchState(match.id)
  const link = {
    id: match.id,
    tournamentId: tournament.id,
    label: `${tournament.name} · ${match.round_label}`,
  }

  if (saved?.home && saved?.away) {
    useGameStore.setState({ ...saved, match: link })
    return
  }

  const settings = resolveSettings(tournament.settings)
  const store = useGameStore.getState()
  store.setupTeams({
    homeName: home.name,
    awayName: away.name,
    homeColor: home.color,
    awayColor: away.color,
    homeLogo: home.logo,
    awayLogo: away.logo,
    homePlayers: rosterFor(home, 'home'),
    awayPlayers: rosterFor(away, 'away'),
    config: {
      periods: settings.periods,
      periodLengthMs: settings.periodMinutes * 60 * 1000,
    },
    match: link,
  })
  const s = useGameStore.getState()
  useGameStore.setState({
    home: { ...s.home, logo: home.logo, shortName: home.short_name || s.home.shortName },
    away: { ...s.away, logo: away.logo, shortName: away.short_name || s.away.shortName },
  })
}
