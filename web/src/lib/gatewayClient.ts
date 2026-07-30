import type { GatewayResource, GatewaySearchResult } from '../types'
import { GATEWAY_URL } from './gatewayConfig'
import { clearToken, getToken, redirectToLogin } from './gatewayAuth'

export class GatewayAuthError extends Error {
  constructor() {
    super('Your session expired. Redirecting to log in again…')
    this.name = 'GatewayAuthError'
  }
}

export class GatewayRateLimitError extends Error {
  constructor() {
    super("You've hit the rate limit (20 requests/minute). Wait a moment and try again.")
    this.name = 'GatewayRateLimitError'
  }
}

export class GatewayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GatewayError'
  }
}

export interface AskRequest {
  question: string
  session_id?: string | null
  project?: string | null
}

export interface AskResponse {
  answer: string
  session_id: string
  sources: GatewayResource[]
}

export interface SearchResponse {
  results: GatewaySearchResult[]
}

async function gatewayFetch<T>(path: string, body: unknown): Promise<T> {
  const token = getToken()
  if (!token) {
    redirectToLogin()
    throw new GatewayAuthError()
  }

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 401) {
    clearToken()
    redirectToLogin()
    throw new GatewayAuthError()
  }

  if (res.status === 429) {
    throw new GatewayRateLimitError()
  }

  if (!res.ok) {
    throw new GatewayError(`Gateway request to ${path} failed (${res.status}).`)
  }

  return (await res.json()) as T
}

export function askGateway(request: AskRequest): Promise<AskResponse> {
  return gatewayFetch<AskResponse>('/ask', request)
}

export function searchGateway(query: string): Promise<SearchResponse> {
  return gatewayFetch<SearchResponse>('/search', { query })
}
