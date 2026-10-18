import { Link, Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <div className="app-shell public-shell">
      <header className="topnav">
        <Link to="/" className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <h1>COURTSIDE</h1>
            <span>Jadwal · Klasemen · Hasil</span>
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
