import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import DashboardPage from './pages/DashboardPage'
import CustomCursor from './components/CustomCursor'

function ShareRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/editor/${id}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Routes>
        <Route path="/"               element={<HomePage />} />
        <Route path="/dashboard"      element={<DashboardPage />} />
        <Route path="/editor"         element={<EditorPage />} />
        <Route path="/editor/:id"     element={<EditorPage />} />
        <Route path="/share/:id"      element={<ShareRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
