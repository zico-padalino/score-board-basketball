import type { Team } from '../types/game'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<Size, string> = {
  sm: 'team-logo sm',
  md: 'team-logo md',
  lg: 'team-logo lg',
  xl: 'team-logo xl',
}

export function TeamLogo({
  team,
  size = 'md',
  className = '',
}: {
  team: Pick<Team, 'name' | 'color' | 'logo' | 'shortName'>
  size?: Size
  className?: string
}) {
  const initials = (team.shortName || team.name || '?').slice(0, 2).toUpperCase()

  if (team.logo) {
    return (
      <img
        className={`${sizes[size]} ${className}`.trim()}
        src={team.logo}
        alt={`Logo ${team.name}`}
        draggable={false}
      />
    )
  }

  return (
    <span
      className={`${sizes[size]} fallback ${className}`.trim()}
      style={{ background: team.color }}
      aria-label={team.name}
    >
      {initials}
    </span>
  )
}
