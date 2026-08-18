import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import DashboardPage from './pages/DashboardPage'
import CursorShowcase from './pages/CursorShowcase'
import CustomCursor from './components/CustomCursor'

// Old share links pointed at a read-only preview with an "Open in ZFlap"
// click-through — the editor already works fully for anonymous visitors on
// a public doc, so send them straight there instead.
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
        <Route path="/cursor-showcase" element={<CursorShowcase />} />
      </Routes>
    </BrowserRouter>
  )
}
