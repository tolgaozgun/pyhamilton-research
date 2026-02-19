import { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap, Code2, Bot, Settings, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import SimplePage from '@/pages/SimplePage'
import DeveloperPage from '@/pages/DeveloperPage'
import AgenticPage from '@/pages/AgenticPage'
import SettingsPage from '@/pages/SettingsPage'

const NAV_ITEMS = [
  { to: '/', icon: Zap, label: 'Simple', end: true },
  { to: '/developer', icon: Code2, label: 'Developer' },
  { to: '/agentic', icon: Bot, label: 'Agentic' },
  { to: '/settings', icon: Settings, label: 'Settings' },
] as const

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">🧬</span>
          <div>
            <div className="font-bold text-zinc-100 text-sm tracking-tight">PyHamilton</div>
            <div className="text-[10px] text-zinc-500 tracking-wide uppercase">Script Generator</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest ? rest.end : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <span className="text-xs text-zinc-600">v2.0</span>
      </div>
    </>
  )
}

export default function App() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 flex-col bg-zinc-950 border-r border-zinc-800 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex md:hidden items-center justify-between px-4 h-14 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">🧬</span>
          <span className="font-bold text-zinc-100 text-sm">PyHamilton</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
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
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-56 flex flex-col bg-zinc-950 border-r border-zinc-800 md:hidden"
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
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
              <Route path="/" element={<SimplePage />} />
              <Route path="/developer" element={<DeveloperPage />} />
              <Route path="/agentic" element={<AgenticPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
