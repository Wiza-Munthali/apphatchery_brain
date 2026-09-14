import { createContext, useContext, useState, type ReactNode } from 'react'
import { clearToken, getToken, redirectToLogin, setToken as storeToken } from '../lib/gatewayAuth'

/**
 * Prototype-only session marker.
 *
 * Signing an organization up and accepting an invite have no gateway
 * equivalent yet — the gateway only knows how to authenticate members of one
 * hardcoded GitHub org. Rather than block those flows, they establish a local
 * session so the multi-tenant UI can be walked end to end.
 *
 * This is not authentication. It grants no gateway access: calls to /ask and
 * /search still require a real token and will bounce to the login redirect
 * without one.
 */
const LOCAL_SESSION_KEY = 'brain.localSession'

function readLocalSession(): boolean {
  try {
    return sessionStorage.getItem(LOCAL_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

function writeLocalSession(active: boolean) {
  try {
    if (active) sessionStorage.setItem(LOCAL_SESSION_KEY, 'true')
    else sessionStorage.removeItem(LOCAL_SESSION_KEY)
  } catch {
    // storage unavailable — the in-memory state still holds for this tab
  }
}

interface AuthContextValue {
  isAuthenticated: boolean
  /** True when the session is the prototype-local kind, with no gateway token. */
  isLocalSession: boolean
  login: () => void
  loginWithToken: (rawToken: string) => boolean
  /** Starts a prototype-local session (org signup, invite acceptance). */
  startLocalSession: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [localSession, setLocalSession] = useState<boolean>(readLocalSession)

  const login = () => redirectToLogin()

  const loginWithToken = (rawToken: string) => {
    const ok = storeToken(rawToken)
    if (ok) setTokenState(getToken())
    return ok
  }

  const startLocalSession = () => {
    writeLocalSession(true)
    setLocalSession(true)
  }

  const logout = () => {
    clearToken()
    writeLocalSession(false)
    setTokenState(null)
    setLocalSession(false)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token || localSession,
        isLocalSession: !token && localSession,
        login,
        loginWithToken,
        startLocalSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
