import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export interface Branding {
  logo: string
  name: string
}

export const DEFAULT_BRANDING: Branding = {
  logo: '/halcion-logo.png',
  name: 'HALCION',
}

const ROW_ID = 'branding'
const CACHE_KEY = 'halcion-branding'
const listeners = new Set<() => void>()

function readCache(): Branding {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return { ...DEFAULT_BRANDING, ...JSON.parse(raw) }
  } catch {
    /* cache rusak — pakai default */
  }
  return DEFAULT_BRANDING
}

let current: Branding = readCache()

function applyToDocument(b: Branding) {
  document.title =
    b.name === DEFAULT_BRANDING.name
      ? 'Halcion Community — Basketball Scoreboard'
      : `${b.name} — Basketball Scoreboard`
  const icons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
  icons.forEach((link) => {
    if (b.logo === DEFAULT_BRANDING.logo) {
      link.href = link.dataset.defaultHref ?? link.href
    } else {
      link.dataset.defaultHref ??= link.href
      link.href = b.logo
    }
  })
}

function publish(next: Branding) {
  current = next
  localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  applyToDocument(next)
  listeners.forEach((l) => l())
}

/** Muat logo & nama aplikasi dari Supabase (tabel app_settings). */
export async function loadBranding() {
  applyToDocument(current)
  if (!supabase) return
  const { data, error } = await supabase
    .from('app_settings')
    .select('data')
    .eq('id', ROW_ID)
    .maybeSingle()
  if (error) return
  publish({ ...DEFAULT_BRANDING, ...((data?.data as Partial<Branding>) ?? {}) })
}

export async function saveBranding(next: Branding) {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi')
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: ROW_ID, data: next, updated_at: new Date().toISOString() })
  if (error) {
    throw new Error(
      error.message.includes('app_settings')
        ? 'Tabel app_settings belum ada. Jalankan ulang supabase/schema.sql di SQL Editor.'
        : error.message,
    )
  }
  publish(next)
}

/** Logo & nama aplikasi yang sedang aktif. */
export function useBranding(): Branding {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
