import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { Dna, Mail, Lock, User, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      if (isLogin) {
        await login({
          identifier: formData.get('identifier') as string,
          password: formData.get('password') as string,
        })
      } else {
        await register({
          email: formData.get('email') as string,
          username: formData.get('username') as string,
          password: formData.get('password') as string,
          full_name: formData.get('full_name') as string || undefined,
          organization: formData.get('organization') as string || undefined,
        })
      }
      navigate(from, { replace: true })
    } catch (err: any) {
      // Extract field errors if available
      if (err.fieldErrors && typeof err.fieldErrors === 'object') {
        setFieldErrors(err.fieldErrors)
        setError(err.message || `${isLogin ? 'Login' : 'Registration'} failed.`)
      } else {
        setError(err.message || `${isLogin ? 'Login' : 'Registration'} failed. Please try again.`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 rounded-2xl mb-4">
            <Dna className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            PyHamilton Script Generator
          </h1>
          <p className="text-sm text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className={cn(
                        "w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none transition-all",
                        fieldErrors.email ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-gray-800"
                      )}
                      placeholder="you@example.com"
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      minLength={3}
                      className={cn(
                        "w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none transition-all",
                        fieldErrors.username ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-gray-800"
                      )}
                      placeholder="username"
                    />
                  </div>
                  {fieldErrors.username && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full Name <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-gray-800 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Organization <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="organization"
                    name="organization"
                    type="text"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-gray-800 outline-none transition-all"
                    placeholder="Your Organization"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1.5">
                {isLogin ? 'Email or Username' : 'Email for Login'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none transition-all",
                    fieldErrors.identifier ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-gray-800",
                    !isLogin && "bg-gray-50"
                  )}
                  placeholder={isLogin ? "email or username" : "same as email above"}
                  disabled={!isLogin}
                />
              </div>
              {fieldErrors.identifier && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.identifier}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none transition-all",
                    fieldErrors.password ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-gray-800"
                  )}
                  placeholder="••••••••"
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-800 text-white py-2.5 rounded-lg font-medium hover:bg-gray-700 focus:ring-4 focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setFieldErrors({})
              }}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  )
}