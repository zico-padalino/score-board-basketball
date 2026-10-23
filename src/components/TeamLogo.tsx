import type { Team } from '../types/game'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<Size, string> = {
  sm: 'team-logo sm',
  md: 'team-logo md',
  lg: 'team-logo lg',
  xl: 'team-logo xl',
}

const builtInPlaceholders = new Set(['/logos/garuda.svg', '/logos/rajawali.svg'])

export function TeamLogo({
  team,
  size = 'md',
  className = '',
}: {
  team: Pick<Team, 'name' | 'color' | 'logo' | 'shortName'>
  size?: Size
  className?: string
}) {
  if (!team.logo || builtInPlaceholders.has(team.logo)) return null

  return (
    <img
      className={`${sizes[size]} ${className}`.trim()}
      src={team.logo}
      alt={`Logo ${team.name}`}
      draggable={false}
    />
  )
}
