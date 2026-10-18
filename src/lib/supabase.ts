import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null when env belum diisi — app tetap jalan dengan localStorage saja. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null

export const LOGO_BUCKET = 'logos'

/** Upload logo ke Supabase Storage dan kembalikan URL publiknya. */
export async function uploadLogo(file: File, gameId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi')
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${gameId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw new Error(`Gagal upload logo: ${error.message}`)
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl
}
