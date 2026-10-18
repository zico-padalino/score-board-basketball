import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useGameClock } from '../hooks/useGameClock'
import { useScoreboardSync } from '../hooks/useScoreboardSync'

const links = [
  { to: '/turnamen', label: 'Turnamen', short: 'Liga' },
  { to: '/', label: 'Setup', short: 'Setup', end: true },
  { to: '/operator', label: 'Operator', short: 'Ops' },
  { to: '/display', label: 'Layar', short: 'Layar' },
  { to: '/scoresheet', label: 'Scoresheet', short: 'Sheet' },
  { to: '/boxscore', label: 'Box Score', short: 'Box' },
]

export function Layout() {
  const location = useLocation()
  const isDisplay = location.pathname === '/display'

  useGameClock(!isDisplay)
  useScoreboardSync(isDisplay ? 'receive' : 'broadcast')

  if (isDisplay) {
    return <Outlet />
  }

  return (
    <div className={`app-shell route-${location.pathname.split('/')[1] || 'setup'}`}>
      <header className="topnav">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <h1>COURTSIDE</h1>
            <span>Basketball Scoreboard</span>
          </div>
        </div>
        <nav className="nav-links desktop-nav" aria-label="Menu utama">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="app-content">
        <Outlet />
      </div>

      <nav className="bottom-nav" aria-label="Menu mobile">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              [
                isActive ? 'active' : '',
                `bn-${link.short.toLowerCase()}`,
              ]
                .filter(Boolean)
                .join(' ')
            }
          >
            <span className="bn-icon" aria-hidden />
            <span className="bn-label">{link.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
