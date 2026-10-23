import { useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandingPanel } from '../components/BrandingPanel'
import { TeamLogo } from '../components/TeamLogo'
import { COURTS, courtLabel, displayUrl, gameId, switchCourt } from '../lib/gameRoom'
import { supabase, uploadLogo } from '../lib/supabase'
import { countLines, shufflePlayersIntoTeams } from '../lib/tournament'
import { useGameStore } from '../store/gameStore'
import type { Player } from '../types/game'
import { PERIOD_OPTIONS } from '../types/tournament'
import { uid } from '../utils/format'

function blankRoster(prefix: string): Player[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: uid(`${prefix}_p`),
    number: String(i + 1),
    name: `Pemain ${i + 1}`,
    active: i < 5,
  }))
}

function validateLogoFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar')
  }
  if (file.size > 1.5 * 1024 * 1024) {
    throw new Error('Ukuran logo maks 1.5 MB')
  }
}

function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
}

export function SetupPage() {
  const navigate = useNavigate()
  const setupTeams = useGameStore((s) => s.setupTeams)
  const resetGame = useGameStore((s) => s.resetGame)
  const status = useGameStore((s) => s.status)

  const [homeName, setHomeName] = useState('Garuda')
  const [awayName, setAwayName] = useState('Rajawali')
  const [homeColor, setHomeColor] = useState('#e85d04')
  const [awayColor, setAwayColor] = useState('#1d3557')
  const [homeLogo, setHomeLogo] = useState('')
  const [awayLogo, setAwayLogo] = useState('')
  const [periodMinutes, setPeriodMinutes] = useState(10)
  const [periods, setPeriods] = useState(4)
  const [shotClock, setShotClock] = useState(true)
  const [homePlayers, setHomePlayers] = useState(() => blankRoster('home'))
  const [awayPlayers, setAwayPlayers] = useState(() => blankRoster('away'))
  const [shuffleNames, setShuffleNames] = useState('')
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState<'home' | 'away' | null>(
    null,
  )

  const homeFileRef = useRef<HTMLInputElement>(null)
  const awayFileRef = useRef<HTMLInputElement>(null)

  const updatePlayer = (
    side: 'home' | 'away',
    id: string,
    patch: Partial<Player>,
  ) => {
    const setter = side === 'home' ? setHomePlayers : setAwayPlayers
    setter((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const onPickLogo = async (
    side: 'home' | 'away',
    file: File | undefined,
  ) => {
    if (!file) return
    try {
      validateLogoFile(file)
      setLogoUploading(side)
      const logo = supabase
        ? await uploadLogo(file, gameId)
        : await readLogoFile(file)
      setLogoError(null)
      if (side === 'home') setHomeLogo(logo)
      else setAwayLogo(logo)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Gagal upload logo')
    } finally {
      setLogoUploading(null)
    }
  }

  const onStart = () => {
    setupTeams({
      homeName,
      awayName,
      homeColor,
      awayColor,
      homeLogo,
      awayLogo,
      homePlayers,
      awayPlayers,
      config: {
        periods,
        shotClockEnabled: shotClock,
        periodLengthMs: periodMinutes * 60 * 1000,
      },
    })
    navigate('/admin/operator')
  }

  const renderLogoField = (
    side: 'home' | 'away',
    logo: string,
    name: string,
    fileRef: RefObject<HTMLInputElement | null>,
  ) => (
    <div className="logo-field">
      <label>Logo tim</label>
      <div className="logo-picker">
        <TeamLogo team={{ name, color: '', logo, shortName: name.slice(0, 3) }} size="lg" />
        <div className="logo-actions">
          <button
            type="button"
            className="btn btn-sm btn-navy"
            disabled={logoUploading !== null}
            onClick={() => fileRef.current?.click()}
          >
            {logoUploading === side ? 'Mengupload…' : 'Upload logo'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (side === 'home') setHomeLogo('')
              else setAwayLogo('')
            }}
          >
            Hapus
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              void onPickLogo(side, e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <p className="muted logo-hint">Opsional · PNG / JPG / WEBP / SVG · maks 1.5 MB</p>
        </div>
      </div>
    </div>
  )

  return (
    <main className="page">
      <section className="setup-hero">
        <div>
          <h2>Siapkan pertandingan</h2>
          <p>
            Atur nama tim, logo opsional, roster, dan durasi kuarter.
          </p>
        </div>
        {status !== 'setup' && (
          <div className="btn-row">
            <span className={`tag ${status === 'live' ? 'live' : 'ready'}`}>
              Status: {status}
            </span>
            <button className="btn btn-ghost" type="button" onClick={resetGame}>
              Reset pertandingan
            </button>
          </div>
        )}
      </section>

      {logoError && <p className="logo-error">{logoError}</p>}

      <details className="panel shuffle-panel" style={{ marginBottom: '1rem' }}>
        <summary>
          <h3>Acak pemain Home vs Away</h3>
        </summary>
        <div className="field">
          <label htmlFor="setupShuffle">
            Nama pemain (satu per baris) · {countLines(shuffleNames)} pemain
          </label>
          <textarea
            id="setupShuffle"
            rows={8}
            value={shuffleNames}
            placeholder={'Zico\nAndi\nBudi\nRizky\n...'}
            onChange={(e) => setShuffleNames(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={countLines(shuffleNames) < 2}
          onClick={() => {
            const [home, away] = shufflePlayersIntoTeams(shuffleNames, 2)
            setHomePlayers(home)
            setAwayPlayers(away)
          }}
        >
          Acak ke Home & Away
        </button>
        <span className="muted" style={{ marginLeft: '0.75rem' }}>
          Klik lagi untuk mengacak ulang. Hasilnya langsung mengisi roster di bawah.
        </span>
      </details>

      <div className="grid-2">
        <section className="panel">
          <h3>Tim Home</h3>
          {renderLogoField(
            'home',
            homeLogo,
            homeName,
            homeFileRef,
          )}
          <div className="field">
            <label htmlFor="homeName">Nama tim</label>
            <input
              id="homeName"
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="homeColor">Warna</label>
            <input
              id="homeColor"
              type="color"
              value={homeColor}
              onChange={(e) => setHomeColor(e.target.value)}
            />
          </div>
          <div className="roster-list">
            {homePlayers.map((p) => (
              <div className="roster-row" key={p.id}>
                <input
                  value={p.number}
                  onChange={(e) =>
                    updatePlayer('home', p.id, { number: e.target.value })
                  }
                  aria-label="Nomor"
                />
                <input
                  value={p.name}
                  onChange={(e) =>
                    updatePlayer('home', p.id, { name: e.target.value })
                  }
                  aria-label="Nama"
                />
                <label className="muted">
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={(e) =>
                      updatePlayer('home', p.id, { active: e.target.checked })
                    }
                  />{' '}
                  Court
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Tim Away</h3>
          {renderLogoField(
            'away',
            awayLogo,
            awayName,
            awayFileRef,
          )}
          <div className="field">
            <label htmlFor="awayName">Nama tim</label>
            <input
              id="awayName"
              value={awayName}
              onChange={(e) => setAwayName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="awayColor">Warna</label>
            <input
              id="awayColor"
              type="color"
              value={awayColor}
              onChange={(e) => setAwayColor(e.target.value)}
            />
          </div>
          <div className="roster-list">
            {awayPlayers.map((p) => (
              <div className="roster-row" key={p.id}>
                <input
                  value={p.number}
                  onChange={(e) =>
                    updatePlayer('away', p.id, { number: e.target.value })
                  }
                  aria-label="Nomor"
                />
                <input
                  value={p.name}
                  onChange={(e) =>
                    updatePlayer('away', p.id, { name: e.target.value })
                  }
                  aria-label="Nama"
                />
                <label className="muted">
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={(e) =>
                      updatePlayer('away', p.id, { active: e.target.checked })
                    }
                  />{' '}
                  Court
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h3>Pengaturan pertandingan</h3>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="periodsCount">Jumlah babak</label>
            <select
              id="periodsCount"
              value={periods}
              onChange={(e) => setPeriods(Number(e.target.value))}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="periodMin">Menit per {periods === 4 ? 'kuarter' : 'babak'}</label>
            <input
              id="periodMin"
              type="number"
              min={1}
              max={20}
              value={periodMinutes}
              onChange={(e) => setPeriodMinutes(Number(e.target.value) || 10)}
            />
          </div>
          <div className="field">
            <label htmlFor="shotClockMode">Shot clock</label>
            <select
              id="shotClockMode"
              value={shotClock ? 'on' : 'off'}
              onChange={(e) => setShotClock(e.target.value === 'on')}
            >
              <option value="on">Aktif (24 / 14 detik)</option>
              <option value="off">Tidak pakai shot clock</option>
            </select>
          </div>
          <div className="field">
            <label>Foul limit</label>
            <input value="5 (FIBA)" disabled />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
          <button className="btn btn-primary" type="button" onClick={onStart}>
            Mulai ke Operator
          </button>
          <button
            className="btn btn-navy"
            type="button"
            onClick={() => navigate(`/display?game=${gameId}`)}
          >
            Buka Layar Penonton
          </button>
        </div>
        {supabase && (
          <div className="court-picker">
            <div className="field">
              <label htmlFor="courtSelect">Lapangan</label>
              <select
                id="courtSelect"
                value={COURTS.includes(gameId) ? gameId : ''}
                onChange={(e) => switchCourt(e.target.value)}
              >
                {!COURTS.includes(gameId) && <option value="">{gameId}</option>}
                {COURTS.map((c) => (
                  <option key={c} value={c}>
                    {courtLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <p className="muted">
              Semua perangkat admin di <strong>{courtLabel(gameId)}</strong> otomatis memakai
              scoreboard yang sama. Layar penonton:{' '}
              <a href={displayUrl()} target="_blank" rel="noreferrer">
                {displayUrl()}
              </a>
            </p>
          </div>
        )}
      </section>

      {supabase && <BrandingPanel />}
    </main>
  )
}
