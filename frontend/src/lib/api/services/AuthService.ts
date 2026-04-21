/**
 * Authentication Service
 * Handles all authentication-related API calls with standardized response format
 * Note: Auth endpoints use BaseRepository for login/register, but AuthenticatedRepository for others
 */

import { BaseRepository } from '../repository'
import type {
  LoginRequest,
  RegisterRequest,
  User,
  PasswordResetConfirm,
  LoginResponse,
  RegisterResponse,
} from '../types/auth.types'

export class AuthService extends BaseRepository {
  private readonly baseUrl = '/api/auth'

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.post<LoginResponse>(`${this.baseUrl}/login`, {
      identifier: credentials.identifier,
      password: credentials.password,
    })
  }

  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    return this.post<RegisterResponse>(`${this.baseUrl}/register`, {
      email: userData.email,
      username: userData.username,
      password: userData.password,
      full_name: userData.full_name,
      organization: userData.organization,
    })
  }

  async logout(): Promise<void> {
    await this.post<void>(`${this.baseUrl}/logout`, {})
  }

  /** Sends POST to refresh — the refresh_token httpOnly cookie is sent automatically. */
  async refreshToken(): Promise<void> {
    await this.post<void>(`${this.baseUrl}/refresh`, {})
  }

  /** Cookie is sent automatically; server validates and returns the user. */
  async getCurrentUser(): Promise<User> {
    return this.get<User>(`${this.baseUrl}/me`)
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.post<void>(`${this.baseUrl}/forgot-password`, { email })
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    await this.post<void>(`${this.baseUrl}/reset-password`, {
      token: data.token,
      new_password: data.new_password
    })
  }

  /**
   * Change user password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.post<void>(`${this.baseUrl}/change-password`, {
      old_password: oldPassword,
      new_password: newPassword
    })
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    // this.put() already unwraps the standardized response and returns the data part
    const response = await this.put<User>(`${this.baseUrl}/me`, data)

    // Return the response (already unwrapped by this.put())
    return response
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    await this.post<void>(`${this.baseUrl}/verify-email/${token}`, {})
  }

  /**
   * Logout from all devices
   */
  async logoutAll(): Promise<void> {
    await this.post<void>(`${this.baseUrl}/logout-all`, {})
  }
}

// Export singleton instance
export const authService = new AuthService()