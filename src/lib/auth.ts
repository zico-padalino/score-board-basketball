import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface AuthState {
  loading: boolean
  session: Session | null
  isAdmin: boolean
}

async function checkAdmin(session: Session | null) {
  if (!supabase || !session) return false
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}

/** Sesi Supabase Auth + apakah email-nya terdaftar di tabel `admins`. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: Boolean(supabase),
    session: null,
    isAdmin: false,
  })

  useEffect(() => {
    if (!supabase) return
    let active = true
    const apply = async (session: Session | null) => {
      const isAdmin = await checkAdmin(session)
      if (active) setState({ loading: false, session, isAdmin })
    }
    void supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void apply(session), 0)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(
      error.message === 'Invalid login credentials' ? 'Email atau password salah' : error.message,
    )
  }
}

export async function signOut() {
  await supabase?.auth.signOut()
}
