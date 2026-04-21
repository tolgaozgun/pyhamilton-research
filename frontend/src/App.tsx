import { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Settings, Layers, Menu, X, Dna, LogOut, Github, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/toaster'
import { APIStatusIndicator } from '@/components/APIStatusIndicator'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthPage from '@/pages/AuthPage'
import AgenticPage from '@/pages/AgenticPage'
import LabwarePage from '@/pages/LabwarePage'
import RAGPage from '@/pages/RAGPage'
import SettingsPage from '@/pages/SettingsPage'
import { useAuth } from '@/lib/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/agentic', icon: Bot, label: 'Agentic' },
  { to: '/labware', icon: Layers, label: 'Labware' },
  { to: '/knowledge-base', icon: Database, label: 'Knowledge Base' },
  { to: '/settings', icon: Settings, label: 'Settings' },
] as const

function SidebarContent({ onNavigate, onLogout }: { onNavigate?: () => void; onLogout: () => void }) {
  return (
    <>
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-lg">
            <Dna className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm tracking-tight">PyHamilton</div>
            <div className="text-[10px] text-gray-500 tracking-wide uppercase">Script Generator</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* API Status Indicator */}
      <APIStatusIndicator />

      {/* Logout button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <a
            href="https://github.com/tolgaozgun/pyhamilton-research"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span>Tolga Ozgun</span>
          </a>
        </div>
      </div>
    </>
  )
}

export default function App() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    setMobileOpen(false)
  }

  // Don't show sidebar for auth page
  if (location.pathname === '/auth') {
    return (
      <>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
        <Toaster />
      </>
    )
  }

  return (
    <>
      <div className="flex h-screen bg-gray-50 text-gray-900">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 flex-col bg-white border-r border-gray-200 shrink-0">
          <SidebarContent onLogout={handleLogout} />
        </aside>

        {/* Mobile header */}
        <div className="fixed top-0 left-0 right-0 z-40 flex md:hidden items-center justify-between px-4 h-14 bg-white/95 backdrop-blur-md border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-gray-800 rounded-lg">
              <Dna className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">PyHamilton</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-40 bg-gray-400/60 backdrop-blur-sm md:hidden"
              />
              <motion.aside
                initial={{ x: -256 }}
                animate={{ x: 0 }}
                exit={{ x: -256 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-56 flex flex-col bg-white border-r border-gray-200 md:hidden"
              >
                <SidebarContent onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Routes location={location}>
                <Route path="/auth" element={<AuthPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AgenticPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agentic"
                  element={
                    <ProtectedRoute>
                      <AgenticPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/labware"
                  element={
                    <ProtectedRoute>
                      <LabwarePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/knowledge-base"
                  element={
                    <ProtectedRoute>
                      <RAGPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster />
    </>
  )
}
