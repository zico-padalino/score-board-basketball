import { Link, Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <div className="app-shell public-shell">
      <header className="topnav">
        <Link to="/" className="brand">
          <img className="brand-mark" src="/halcion-logo.png" alt="Halcion Community" />
          <div>
            <h1>HALCION</h1>
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
