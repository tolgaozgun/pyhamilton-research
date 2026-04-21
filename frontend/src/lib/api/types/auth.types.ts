/**
 * Authentication types
 * Type definitions for authentication-related API contracts
 */

// ============================================================================
// Request Types
// ============================================================================

export interface LoginRequest {
  identifier: string  // email or username
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  full_name?: string
  organization?: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirm {
  token: string
  new_password: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

// ============================================================================
// Response Types
// ============================================================================

export interface SessionInfo {
  token_type: string
  expires_in: number
}

export interface LoginResponse {
  user: User
  session: SessionInfo
}

export interface RegisterResponse {
  user: User
  session: SessionInfo
}

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

// ============================================================================
// State Types
// ============================================================================

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

