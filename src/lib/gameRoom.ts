const STORAGE_KEY = 'halcion-court'

/** Kode lapangan yang dipakai bersama oleh semua perangkat admin. */
export const DEFAULT_COURT = 'LAPANGAN1'
export const COURTS = ['LAPANGAN1', 'LAPANGAN2', 'LAPANGAN3']

function normalize(code: string | null) {
  const clean = (code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return clean.length >= 4 ? clean.slice(0, 12) : null
}

function resolve() {
  const fromUrl = normalize(new URLSearchParams(window.location.search).get('game'))
  const stored = normalize(localStorage.getItem(STORAGE_KEY))
  const id = fromUrl ?? stored ?? DEFAULT_COURT
  localStorage.setItem(STORAGE_KEY, id)
  return id
}

/** Kode game/lapangan aktif di perangkat ini. */
export const gameId = resolve()

export function courtLabel(code: string) {
  const m = code.match(/^LAPANGAN(\d+)$/)
  return m ? `Lapangan ${m[1]}` : code
}

/** Pindah lapangan: halaman dimuat ulang supaya sinkron dengan kode baru. */
export function switchCourt(code: string) {
  const next = normalize(code)
  if (!next || next === gameId) return
  localStorage.setItem(STORAGE_KEY, next)
  window.location.assign(`${window.location.pathname}?game=${next}`)
}

export function displayUrl() {
  return `${window.location.origin}/display?game=${gameId}`
}

export function operatorUrl() {
  return `${window.location.origin}/admin/operator?game=${gameId}`
}
