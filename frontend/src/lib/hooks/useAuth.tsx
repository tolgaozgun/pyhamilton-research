/**
 * Authentication Hook
 * Custom hook for authentication operations using AuthService
 */

console.log('🚀🚀🚀 [AUTH] AUTH HOOK FILE LOADED!!! 🚀🚀🚀')

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../api/services/AuthService'
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthState
} from '../api/types/auth.types'
import { toast } from 'sonner'

// ============================================================================
// Context Type
// ============================================================================

export interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  updateUser: () => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ============================================================================
// Provider Component
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  })

  // Update state helper
  const updateState = (updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Cookies are automatically sent by the browser, just try to get current user
        const user = await authService.getCurrentUser()
        updateState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        })
        return
      } catch (error) {
        console.error('Auth initialization failed:', error)
        updateState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        })
      }
    }

    initAuth()
  }, [])

  // Login function
  const login = useCallback(async (credentials: LoginRequest) => {
    updateState({ isLoading: true, error: null })

    try {
      // Tokens are set as httpOnly cookies by the server — we just read the user
      const response = await authService.login(credentials)

      if (!response?.user) {
        throw new Error('Login response missing user data')
      }

      updateState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })

      toast.success('Welcome back!', { description: 'You have successfully logged in.' })
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed'
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage
      })
      throw error
    }
  }, [])

  // Register function
  const register = useCallback(async (data: RegisterRequest) => {
    updateState({ isLoading: true, error: null })

    try {
      // Tokens are set as httpOnly cookies by the server — we just read the user
      const response = await authService.register(data)

      updateState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })

      toast.success('Account created!', { description: 'Welcome to PyHamilton Script Generator.' })
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed'
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage
      })
      throw error
    }
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    updateState({ isLoading: true, error: null })

    try {
      // Server clears httpOnly cookies on logout
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })

      toast.success('Logged out', { description: 'You have been successfully logged out.' })
    }
  }, [])

  // Refresh tokens function
  const refreshToken = useCallback(async () => {
    try {
      // Server rotates cookies; nothing to store on the client
      await authService.refreshToken()
    } catch (error) {
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired. Please login again.'
      })
      throw error
    }
  }, [])

  // Update user info
  const updateUser = useCallback(async () => {
    try {
      const response = await authService.getCurrentUser()
      updateState({
        user: response,
        isAuthenticated: true,
        error: null
      })
    } catch (error) {
      console.error('Failed to update user info:', error)
    }
  }, [])

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    updateUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// ============================================================================
// Utility Hooks
// ============================================================================

export function useCurrentUser(): User | null {
  const { user } = useAuth()
  return user
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

export function useIsAdmin(): boolean {
  const { user } = useAuth()
  return user?.role === 'ADMIN'
}

export function requireAuth(): User {
  const user = useCurrentUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}