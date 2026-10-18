import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCountdownVoice } from '../hooks/useCountdownVoice'
import { useGameClock } from '../hooks/useGameClock'
import { useScoreboardSync } from '../hooks/useScoreboardSync'
import { signOut, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { gameId } from '../lib/gameRoom'
import { useBranding } from '../lib/branding'

const links = [
  { to: '/admin/turnamen', label: 'Turnamen', short: 'Liga' },
  { to: '/admin', label: 'Setup', short: 'Setup', end: true },
  { to: '/admin/operator', label: 'Operator', short: 'Ops' },
  { to: `/display?game=${gameId}`, label: 'Layar', short: 'Layar' },
  { to: '/admin/scoresheet', label: 'Scoresheet', short: 'Sheet' },
  { to: '/admin/boxscore', label: 'Box Score', short: 'Box' },
]

/** Halaman admin: wajib login dengan email yang terdaftar di tabel `admins`. */
export function Layout() {
  const auth = useAuth()
  const location = useLocation()

  if (!supabase) return <AdminShell />

  if (auth.loading) {
    return (
      <main className="page">
        <p className="muted">Memeriksa login…</p>
      </main>
    )
  }

  if (!auth.isAdmin) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return <AdminShell email={auth.session?.user.email} />
}

function AdminShell({ email }: { email?: string }) {
  const brand = useBranding()
  const location = useLocation()

  useGameClock(true)
  useScoreboardSync('broadcast')
  useCountdownVoice()

  return (
    <div className={`app-shell route-${location.pathname.split('/')[2] || 'setup'}`}>
      <header className="topnav">
        <div className="brand">
          <img className="brand-mark" src={brand.logo} alt={brand.name} />
          <div>
            <h1>{brand.name}</h1>
            <span>Admin{email ? ` · ${email}` : ''}</span>
          </div>
        </div>
        <nav className="nav-links desktop-nav" aria-label="Menu utama">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              target={link.short === 'Layar' ? '_blank' : undefined}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/">Publik</NavLink>
        </nav>
        {supabase && (
          <button type="button" className="nav-logout" onClick={() => void signOut()}>
            Keluar
          </button>
        )}
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
            target={link.short === 'Layar' ? '_blank' : undefined}
            className={({ isActive }) =>
              [isActive ? 'active' : '', `bn-${link.short.toLowerCase()}`].filter(Boolean).join(' ')
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
