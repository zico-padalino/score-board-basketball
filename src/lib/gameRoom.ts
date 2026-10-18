const STORAGE_KEY = 'courtside-game-id'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

function normalize(code: string | null) {
  const clean = (code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return clean.length >= 4 ? clean.slice(0, 12) : null
}

function resolve() {
  const fromUrl = normalize(new URLSearchParams(window.location.search).get('game'))
  const stored = normalize(localStorage.getItem(STORAGE_KEY))
  const id = fromUrl ?? stored ?? randomCode()
  localStorage.setItem(STORAGE_KEY, id)
  return { id, joined: fromUrl !== null && fromUrl !== stored }
}

const room = resolve()

/** Kode game aktif di perangkat ini. */
export const gameId = room.id

/** True kalau dibuka lewat `?game=KODE` milik perangkat lain — state diambil dari cloud. */
export const joinedFromLink = room.joined

export function displayUrl() {
  return `${window.location.origin}/display?game=${gameId}`
}

export function operatorUrl() {
  return `${window.location.origin}/operator?game=${gameId}`
}
