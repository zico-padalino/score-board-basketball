import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { BoxScorePage } from './pages/BoxScorePage'
import { DisplayPage } from './pages/DisplayPage'
import { OperatorPage } from './pages/OperatorPage'
import { ScoresheetPage } from './pages/ScoresheetPage'
import { SetupPage } from './pages/SetupPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SetupPage />} />
          <Route path="operator" element={<OperatorPage />} />
          <Route path="display" element={<DisplayPage />} />
          <Route path="scoresheet" element={<ScoresheetPage />} />
          <Route path="boxscore" element={<BoxScorePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
