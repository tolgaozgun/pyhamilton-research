/**
 * Authentication context and hooks for React application.
 * Provides user authentication state and token management.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiClient } from './api/client'

// Types
export interface User {
  id: number
  email: string
  username: string
  role: 'ADMIN' | 'USER'
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
  full_name?: string
  organization?: string
  last_login?: string
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginCredentials {
  identifier: string
  password: string
}

export interface RegisterData {
  email: string
  username: string
  password: string
  full_name?: string
  organization?: string
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshTokens: () => Promise<AuthTokens | void>
  updateUser: () => Promise<void>
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Auth provider component - wraps the app to provide auth context
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })

  // Update state helper
  const updateState = (updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  // Initialize auth state from cookies/local storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have a stored access token
        const tokens = getStoredTokens()
        if (tokens?.access_token) {
          // Try to get current user info
          const user = await apiClient.get<User>('/api/auth/me')

          updateState({
            user: user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return
        }

        // No valid session found
        updateState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        console.error('Auth initialization failed:', error)
        // Clear invalid tokens
        clearStoredTokens()
        updateState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Session expired',
        })
      }
    }

    initAuth()
  }, [])

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    updateState({ isLoading: true, error: null })

    try {
      const tokens = await apiClient.post<AuthTokens>('/api/auth/login', {
        identifier: credentials.identifier,
        password: credentials.password,
      })

      // Store tokens
      setStoredTokens(tokens)

      // Get user info
      const user = await apiClient.get<User>('/api/auth/me')
      updateState({
        user: user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Login failed'
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      })
    }
  }, [])

  // Register function
  const register = useCallback(async (data: RegisterData) => {
    updateState({ isLoading: true, error: null })

    try {
      const tokens = await apiClient.post<AuthTokens>('/api/auth/register', {
        ...data,
      })

      // Store tokens
      setStoredTokens(tokens)

      // Get user info
      const user = await apiClient.get<User>('/api/auth/me')
      updateState({
        user: user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Registration failed'
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      })
    }
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    updateState({ isLoading: true, error: null })

    try {
      const tokens = getStoredTokens()
      if (tokens?.refresh_token) {
        // Call logout endpoint to revoke refresh token
        await apiClient.post('/api/auth/logout', {
          refresh_token: tokens.refresh_token,
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Always clear local state
      clearStoredTokens()
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
    }
  }, [])

  // Refresh tokens function
  const refreshTokens = useCallback(async () => {
    const tokens = getStoredTokens()
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available')
    }

    try {
      const newTokens = await apiClient.post<AuthTokens>('/api/auth/refresh', {
        refresh_token: tokens.refresh_token,
      })

      setStoredTokens(newTokens)
      return newTokens
    } catch (error) {
      // If refresh fails, clear everything and force re-login
      clearStoredTokens()
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired. Please login again.',
      })
      throw error
    }
  }, [])

  // Update user info
  const updateUser = useCallback(async () => {
    try {
      const user = await apiClient.get<User>('/api/auth/me')

      updateState({
        user: user,
        isAuthenticated: true,
        error: null,
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
    refreshTokens,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

/**
 * Hook to get current authenticated user
 */
export function useCurrentUser(): User | null {
  const { user } = useAuth()
  return user
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth()
  return user?.role === 'ADMIN'
}

/**
 * Hook to require authentication - throws if not authenticated
 */
export function requireAuth(): User {
  const user = useCurrentUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

// Export token storage helpers
export const ACCESS_TOKEN_KEY = 'access_token'
export const REFRESH_TOKEN_KEY = 'refresh_token'

export function setStoredTokens(tokens: AuthTokens) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
  }
}

export function getStoredTokens(): AuthTokens | null {
  if (typeof window !== 'undefined') {
    const access = localStorage.getItem(ACCESS_TOKEN_KEY)
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY)

    if (access && refresh) {
      return {
        access_token: access,
        refresh_token: refresh,
        token_type: 'bearer',
        expires_in: 1800, // 30 minutes
      }
    }
  }
  return null
}

export function clearStoredTokens() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }
}

