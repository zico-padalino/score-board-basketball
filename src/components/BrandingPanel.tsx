import { useRef, useState } from 'react'
import { DEFAULT_BRANDING, saveBranding, useBranding } from '../lib/branding'
import { uploadLogo } from '../lib/supabase'

/** Admin: ganti logo & nama aplikasi untuk semua halaman dan perangkat. */
export function BrandingPanel() {
  const brand = useBranding()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logo, setLogo] = useState(brand.logo)
  const [name, setName] = useState(brand.name)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const onPick = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ tone: 'err', text: 'File harus berupa gambar' })
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setMessage({ tone: 'err', text: 'Ukuran logo maks 1.5 MB' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      setLogo(await uploadLogo(file, 'branding'))
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Gagal upload logo' })
    } finally {
      setBusy(false)
    }
  }

  const save = async (next = { logo, name: name.trim() || DEFAULT_BRANDING.name }) => {
    setBusy(true)
    setMessage(null)
    try {
      await saveBranding(next)
      setLogo(next.logo)
      setName(next.name)
      setMessage({ tone: 'ok', text: 'Tersimpan — logo & nama baru dipakai di semua halaman.' })
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan' })
    } finally {
      setBusy(false)
    }
  }

  const changed = logo !== brand.logo || (name.trim() || DEFAULT_BRANDING.name) !== brand.name

  return (
    <section className="panel branding-panel">
      <h3>Tampilan aplikasi</h3>
      <p className="muted">
        Logo & nama ini dipakai di header admin & publik, halaman login, layar penonton (pojok &
        latar), dan ikon tab browser.
      </p>
      {message && <p className={message.tone === 'ok' ? 'branding-ok' : 'logo-error'}>{message.text}</p>}
      <div className="branding-row">
        <div className="branding-preview">
          <img src={logo} alt="Logo aplikasi" />
        </div>
        <div className="branding-fields">
          <div className="field">
            <label htmlFor="brandName">Nama aplikasi</label>
            <input id="brandName" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-navy" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Memproses…' : 'Upload logo baru'}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || !changed} onClick={() => void save()}>
              Simpan
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Kembalikan logo & nama bawaan Halcion?')) void save(DEFAULT_BRANDING)
              }}
            >
              Pakai bawaan
            </button>
          </div>
          <p className="muted logo-hint">PNG transparan disarankan · maks 1.5 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              void onPick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </section>
  )
}
