import { useEffect, useMemo, useState } from 'react'
import { BoxScoreTable } from '../../components/BoxScoreTable'
import { TeamLogo } from '../../components/TeamLogo'
import { getMatchState, listMatchStates } from '../../lib/tournamentApi'
import type { GameState, PlayerStats } from '../../types/game'
import type { Match, TournamentTeam } from '../../types/tournament'
import { formatDay, formatTime } from '../../utils/datetime'
import { emptyStats, getReb, teamScore } from '../../utils/stats'

type SortKey = 'pts' | 'ppg' | 'reb' | 'ast' | 'stl' | 'blk' | 'tpm'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'pts', label: 'Poin' },
  { key: 'ppg', label: 'Rata-rata' },
  { key: 'reb', label: 'Rebound' },
  { key: 'ast', label: 'Assist' },
  { key: 'stl', label: 'Steal' },
  { key: 'blk', label: 'Block' },
  { key: 'tpm', label: '3 Poin' },
]

interface Leader {
  key: string
  name: string
  number: string
  team?: TournamentTeam
  games: number
  s: PlayerStats
}

function addStats(a: PlayerStats, b: PlayerStats): PlayerStats {
  const out = { ...a }
  for (const k of Object.keys(b) as (keyof PlayerStats)[]) {
    if (k === 'playerId') continue
    out[k] = (a[k] as number) + (b[k] as number)
  }
  return out
}

/** Rekap per pemain lintas laga; id pemain berbeda tiap laga, jadi kunci = tim + nomor + nama. */
function buildLeaders(
  played: Match[],
  states: Map<string, GameState>,
  teamById: Map<string, TournamentTeam>,
): Leader[] {
  const map = new Map<string, Leader>()
  for (const m of played) {
    const st = states.get(m.id)
    if (!st) continue
    for (const side of ['home', 'away'] as const) {
      const teamId = side === 'home' ? m.home_team_id : m.away_team_id
      const team = teamId ? teamById.get(teamId) : undefined
      for (const p of st[side].players) {
        const s = st.playerStats[p.id]
        if (!s) continue
        const key = `${teamId}|${p.number}|${p.name.trim().toLowerCase()}`
        const cur = map.get(key)
        const playedThis = s.pts + s.fga + s.fta + getReb(s) + s.ast + s.stl + s.blk + s.tov + s.pf > 0 || p.active
        map.set(key, {
          key,
          name: p.name,
          number: p.number,
          team,
          games: (cur?.games ?? 0) + (playedThis ? 1 : 0),
          s: cur ? addStats(cur.s, s) : { ...emptyStats(key), ...s, playerId: key },
        })
      }
    }
  }
  return [...map.values()]
}

function sortValue(l: Leader, key: SortKey) {
  if (key === 'ppg') return l.games ? l.s.pts / l.games : 0
  if (key === 'reb') return getReb(l.s)
  return l.s[key]
}

function matchTitle(m: Match, teamById: Map<string, TournamentTeam>) {
  const home = m.home_team_id ? teamById.get(m.home_team_id)?.name : 'TBD'
  const away = m.away_team_id ? teamById.get(m.away_team_id)?.name : 'TBD'
  const tag = m.status === 'live' ? ' · LIVE' : ''
  return `${home} ${m.home_score}–${m.away_score} ${away} · ${m.round_label}${tag}`
}

export function BoxScoreTab({
  matches,
  teamById,
}: {
  matches: Match[]
  teamById: Map<string, TournamentTeam>
}) {
  const played = useMemo(
    () =>
      matches
        .filter((m) => m.status !== 'scheduled')
        .sort(
          (a, b) =>
            (a.status === 'live' ? -1 : 0) - (b.status === 'live' ? -1 : 0) ||
            (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''),
        ),
    [matches],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = played.find((m) => m.id === selectedId) ?? played[0]
  const [state, setState] = useState<GameState | null>(null)
  const [allStates, setAllStates] = useState<Map<string, GameState>>(new Map())
  const [sort, setSort] = useState<SortKey>('pts')

  useEffect(() => {
    if (!selected) return
    let active = true
    getMatchState(selected.id)
      .then((s) => active && setState(s))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [selected])

  const playedKey = played.map((m) => `${m.id}:${m.status}:${m.home_score}:${m.away_score}`).join(',')
  useEffect(() => {
    const ids = playedKey ? playedKey.split(',').map((k) => k.split(':')[0]) : []
    let active = true
    listMatchStates(ids)
      .then((s) => active && setAllStates(s))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [playedKey])

  const unassigned = useMemo(() => {
    let points = 0
    let count = 0
    for (const st of allStates.values()) {
      let match = 0
      for (const side of ['home', 'away'] as const) {
        const players = st[side].players.reduce((s, p) => s + (st.playerStats[p.id]?.pts ?? 0), 0)
        match += Math.max(0, teamScore(st.scoreEvents, side) - players)
      }
      if (match > 0) count += 1
      points += match
    }
    return { points, matches: count }
  }, [allStates])

  const leaders = useMemo(
    () =>
      buildLeaders(played, allStates, teamById)
        .filter((l) => l.games > 0)
        .sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || b.s.pts - a.s.pts)
        .slice(0, 20),
    [played, allStates, teamById, sort],
  )

  if (played.length === 0) {
    return (
      <section className="panel">
        <p className="muted">Box score muncul setelah laga dibuka dan dimainkan di scoreboard.</p>
      </section>
    )
  }

  const home = selected?.home_team_id ? teamById.get(selected.home_team_id) : undefined
  const away = selected?.away_team_id ? teamById.get(selected.away_team_id) : undefined

  return (
    <div className="tour-stack">
      <section className="panel boxscore-picker no-print">
        <div className="field">
          <label htmlFor="bsMatch">Pilih laga</label>
          <select
            id="bsMatch"
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {played.map((m) => (
              <option key={m.id} value={m.id}>
                {matchTitle(m, teamById)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-navy" onClick={() => window.print()}>
          Cetak box score
        </button>
      </section>

      {selected && (
        <section className="panel boxscore-head">
          <div className="bs-team">
            {home && (
              <TeamLogo
                team={{ name: home.name, color: home.color, logo: home.logo, shortName: home.short_name }}
                size="md"
              />
            )}
            <strong>{home?.name ?? 'TBD'}</strong>
          </div>
          <div className="bs-score">
            <b>{selected.home_score}</b>
            <i>–</i>
            <b>{selected.away_score}</b>
            <span className={`tag ${selected.status === 'live' ? 'live' : 'ready'}`}>
              {selected.status === 'live' ? '● Live' : 'Final'}
            </span>
          </div>
          <div className="bs-team away">
            <strong>{away?.name ?? 'TBD'}</strong>
            {away && (
              <TeamLogo
                team={{ name: away.name, color: away.color, logo: away.logo, shortName: away.short_name }}
                size="md"
              />
            )}
          </div>
          <p className="muted bs-meta">
            {selected.round_label} · {formatDay(selected.scheduled_at)} {formatTime(selected.scheduled_at)}
            {selected.venue && ` · ${selected.venue}`}
          </p>
        </section>
      )}

      {state ? (
        <div className="boxscore-tables">
          <BoxScoreTable
            team={{ ...state.home, name: home?.name ?? state.home.name, color: home?.color ?? state.home.color }}
            playerStats={state.playerStats}
            showOnCourt={selected?.status === 'live'}
            teamScore={teamScore(state.scoreEvents, 'home')}
          />
          <BoxScoreTable
            team={{ ...state.away, name: away?.name ?? state.away.name, color: away?.color ?? state.away.color }}
            playerStats={state.playerStats}
            showOnCourt={selected?.status === 'live'}
            teamScore={teamScore(state.scoreEvents, 'away')}
          />
          {selected?.status === 'live' && <p className="muted">* = sedang di lapangan</p>}
        </div>
      ) : (
        <section className="panel">
          <p className="muted">Statistik laga ini belum tersedia.</p>
        </section>
      )}

      <section className="panel leaders no-print-break">
        <div className="panel-head">
          <h3>Statistik pemain turnamen</h3>
        </div>
        {unassigned.points > 0 && (
          <p className="unassigned-note">
            {unassigned.points} poin di {unassigned.matches} laga masih tercatat sebagai skor tim
            (belum per pemain), jadi belum masuk ke statistik pemain di bawah.
          </p>
        )}
        <div className="seg-tabs leader-sorts no-print">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={sort === s.key ? 'active' : ''}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {leaders.length === 0 ? (
          <p className="muted">Belum ada statistik pemain.</p>
        ) : (
          <div className="box-score">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="name">Pemain</th>
                  <th className="name">Tim</th>
                  <th>Main</th>
                  <th>PTS</th>
                  <th>PPG</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th>STL</th>
                  <th>BLK</th>
                  <th>3PM</th>
                  <th>PF</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((l, i) => (
                  <tr key={l.key}>
                    <td>{i + 1}</td>
                    <td className="name">
                      <strong>#{l.number}</strong> {l.name}
                    </td>
                    <td className="name" style={{ color: l.team?.color }}>
                      {l.team?.name ?? '—'}
                    </td>
                    <td>{l.games}</td>
                    <td>
                      <strong>{l.s.pts}</strong>
                    </td>
                    <td>{l.games ? (l.s.pts / l.games).toFixed(1) : '0.0'}</td>
                    <td>{getReb(l.s)}</td>
                    <td>{l.s.ast}</td>
                    <td>{l.s.stl}</td>
                    <td>{l.s.blk}</td>
                    <td>{l.s.tpm}</td>
                    <td>{l.s.pf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted leader-note">
          Dihitung dari semua laga yang sudah dibuka di scoreboard (termasuk yang sedang live).
        </p>
      </section>
    </div>
  )
}
