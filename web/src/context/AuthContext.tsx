import { createContext, useContext, useState, type ReactNode } from 'react'
import { clearToken, getToken, redirectToLogin, setToken as storeToken } from '../lib/gatewayAuth'

interface AuthContextValue {
  isAuthenticated: boolean
  login: () => void
  loginWithToken: (rawToken: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())

  const login = () => redirectToLogin()
  const loginWithToken = (rawToken: string) => {
    const ok = storeToken(rawToken)
    if (ok) setTokenState(getToken())
    return ok
  }
  const logout = () => {
    clearToken()
    setTokenState(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
