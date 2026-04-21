import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode, Provider, LLMConfig } from '@/types'

interface AppState {
  mode: Mode
  setMode: (mode: Mode) => void
  llmConfig: LLMConfig
  setLLMConfig: (config: Partial<LLMConfig>) => void
  sidebarOpen: boolean
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'simple',
      setMode: (mode) => set({ mode }),
      llmConfig: {
        provider: 'google' as Provider,
        model_name: 'gemini-2.0-flash',
        api_key: '',
        temperature: 0.3,
        max_tokens: 4096,
      },
      setLLMConfig: (config) =>
        set((state) => ({ llmConfig: { ...state.llmConfig, ...config } })),
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    { name: 'pyhamilton-settings', partialize: (state) => ({ llmConfig: { ...state.llmConfig, api_key: '' }, mode: state.mode }) }
  )
)
