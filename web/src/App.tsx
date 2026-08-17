import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import SharePage from './pages/SharePage'
import DashboardPage from './pages/DashboardPage'
import CursorShowcase from './pages/CursorShowcase'
import CustomCursor from './components/CustomCursor'

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Routes>
        <Route path="/"               element={<HomePage />} />
        <Route path="/dashboard"      element={<DashboardPage />} />
        <Route path="/editor"         element={<EditorPage />} />
        <Route path="/editor/:id"     element={<EditorPage />} />
        <Route path="/share/:id"      element={<SharePage />} />
        <Route path="/cursor-showcase" element={<CursorShowcase />} />
      </Routes>
    </BrowserRouter>
  )
}
