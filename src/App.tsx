import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PublicLayout } from './components/PublicLayout'
import { useCountdownVoice } from './hooks/useCountdownVoice'
import { useScoreboardSync } from './hooks/useScoreboardSync'
import { BoxScorePage } from './pages/BoxScorePage'
import { DisplayPage } from './pages/DisplayPage'
import { LoginPage } from './pages/LoginPage'
import { OperatorPage } from './pages/OperatorPage'
import { PublicHomePage } from './pages/public/PublicHomePage'
import { PublicTournamentPage } from './pages/public/PublicTournamentPage'
import { ScoresheetPage } from './pages/ScoresheetPage'
import { SetupPage } from './pages/SetupPage'
import { TournamentPage } from './pages/TournamentPage'
import { TournamentsPage } from './pages/TournamentsPage'

function DisplayRoute() {
  useScoreboardSync('receive')
  useCountdownVoice()
  return <DisplayPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<PublicHomePage />} />
          <Route path="t/:id" element={<PublicTournamentPage />} />
        </Route>
        <Route path="login" element={<LoginPage />} />
        <Route path="display" element={<DisplayRoute />} />

        <Route path="admin" element={<Layout />}>
          <Route index element={<SetupPage />} />
          <Route path="operator" element={<OperatorPage />} />
          <Route path="scoresheet" element={<ScoresheetPage />} />
          <Route path="boxscore" element={<BoxScorePage />} />
          <Route path="turnamen" element={<TournamentsPage />} />
          <Route path="turnamen/:id" element={<TournamentPage />} />
        </Route>

        <Route path="operator" element={<Navigate to="/admin/operator" replace />} />
        <Route path="turnamen" element={<Navigate to="/admin/turnamen" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
