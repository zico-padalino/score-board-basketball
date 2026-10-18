/** ISO → nilai untuk `<input type="datetime-local">` di zona waktu lokal. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatDay(iso: string | null): string {
  if (!iso) return 'Belum dijadwalkan'
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

/** "20.00–21.15" berdasarkan jam mulai dan perkiraan lama laga. */
export function formatTimeRange(iso: string | null, minutes?: number): string {
  if (!iso || !minutes) return formatTime(iso)
  const end = new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
  return `${formatTime(iso)}–${formatTime(end)}`
}

export function dayKey(iso: string | null): string {
  if (!iso) return 'none'
  return toLocalInput(iso).slice(0, 10)
}
