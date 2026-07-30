import { GATEWAY_TOKEN_STORAGE_KEY, GATEWAY_URL } from './gatewayConfig'

interface JwtPayload {
  exp?: number
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function isExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return Date.now() >= payload.exp * 1000
}

// The GitHub OAuth callback lands back on this app at `#token=<jwt>` (a URL
// fragment, so it's never sent to any server). HashRouter also lives in
// `location.hash`, so this must run and strip the fragment before the router
// mounts, or it'll try to treat "token=<jwt>" as a route.
export function captureTokenFromHash(): void {
  const hash = window.location.hash
  if (!hash.startsWith('#token=')) return

  const token = decodeURIComponent(hash.slice('#token='.length))
  sessionStorage.setItem(GATEWAY_TOKEN_STORAGE_KEY, token)
  history.replaceState(null, '', window.location.pathname + window.location.search)
}

export function getToken(): string | null {
  const token = sessionStorage.getItem(GATEWAY_TOKEN_STORAGE_KEY)
  if (!token) return null
  if (isExpired(token)) {
    sessionStorage.removeItem(GATEWAY_TOKEN_STORAGE_KEY)
    return null
  }
  return token
}

export function clearToken(): void {
  sessionStorage.removeItem(GATEWAY_TOKEN_STORAGE_KEY)
}

// For people pasting in a token issued out-of-band (e.g. no GitHub account).
// Returns false without storing anything if the token is malformed or expired.
export function setToken(rawToken: string): boolean {
  const token = rawToken.trim()
  if (!token || isExpired(token)) return false
  sessionStorage.setItem(GATEWAY_TOKEN_STORAGE_KEY, token)
  return true
}

export function redirectToLogin(): void {
  window.location.href = `${GATEWAY_URL}/auth/login`
}
