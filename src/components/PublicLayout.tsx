import { Link, Outlet } from 'react-router-dom'
import { useBranding } from '../lib/branding'

export function PublicLayout() {
  const brand = useBranding()
  return (
    <div className="app-shell public-shell">
      <header className="topnav">
        <Link to="/" className="brand">
          <img className="brand-mark" src={brand.logo} alt={brand.name} />
          <div>
            <h1>{brand.name}</h1>
            <span>Basketball Community</span>
          </div>
        </Link>
        <Link to="/login" className="btn btn-sm btn-ghost no-print">
          Admin
        </Link>
      </header>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}
