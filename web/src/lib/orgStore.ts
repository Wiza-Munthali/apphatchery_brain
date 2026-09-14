import type { Connection, Invite, Org, OrgMember, Project } from '../types'

/**
 * Local persistence for the multi-tenant prototype, so projects created,
 * invites sent and connections configured survive a reload.
 *
 * SECURITY: this stores connection *metadata* only — account label, granted
 * scopes, selected resource ids, status. A credential (Zulip API key, any OAuth
 * token) must never be written here, and `Connection` has no field to hold one.
 * Secrets belong server-side, encrypted, and are never sent to the browser at
 * all; the values typed into the Zulip credential form live in component state
 * for the life of the dialog and are discarded when it closes.
 */

export interface OrgState {
  org: Org
  members: OrgMember[]
  invites: Invite[]
  projects: Project[]
  connections: Connection[]
}

const storageKey = (orgId: string) => `brain.org.${orgId}`

/**
 * Which org this browser is currently in.
 *
 * Needed because state is keyed by org id: without this pointer, a reload
 * would always rehydrate whichever org the fixtures happen to name, and an
 * organization created through signup would vanish on refresh.
 */
const CURRENT_ORG_KEY = 'brain.currentOrg'

export function loadCurrentOrgId(): string | null {
  try {
    return localStorage.getItem(CURRENT_ORG_KEY)
  } catch {
    return null
  }
}

export function saveCurrentOrgId(orgId: string) {
  try {
    localStorage.setItem(CURRENT_ORG_KEY, orgId)
  } catch {
    // storage unavailable — the org just won't be remembered across reloads
  }
}

export function loadOrgState(orgId: string): OrgState | null {
  try {
    const raw = localStorage.getItem(storageKey(orgId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Cheap shape check — a partially-written or stale-schema blob falls back
    // to the seed fixtures rather than crashing the app on boot.
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.org || !Array.isArray(parsed.projects) || !Array.isArray(parsed.members)) return null
    return parsed as OrgState
  } catch {
    return null
  }
}

export function saveOrgState(state: OrgState) {
  try {
    localStorage.setItem(storageKey(state.org.id), JSON.stringify(state))
  } catch {
    // storage unavailable (private browsing, quota) — state just won't persist
  }
}

export function clearOrgState(orgId: string) {
  try {
    localStorage.removeItem(storageKey(orgId))
  } catch {
    // nothing to do — the in-memory state is still authoritative for this tab
  }
}
