import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { signIn, signOut, useAuth } from '../lib/auth'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin/turnamen'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (auth.isAdmin) return <Navigate to={next} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal login')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page login-page">
      <form className="panel login-card" onSubmit={onSubmit}>
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <h1>COURTSIDE</h1>
            <span>Login admin</span>
          </div>
        </div>
        {auth.session && !auth.isAdmin && !auth.loading && (
          <p className="logo-error">
            Akun {auth.session.user.email} bukan admin.{' '}
            <button type="button" className="link-btn" onClick={() => void signOut()}>
              Keluar
            </button>
          </p>
        )}
        {error && <p className="logo-error">{error}</p>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
        <Link to="/" className="muted login-back">
          ← Lihat jadwal & klasemen
        </Link>
      </form>
    </main>
  )
}
