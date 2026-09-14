import type { OrgMember, OrgRole, Project, ProjectAccess } from '../types'

/**
 * The one place a ProjectAccess is turned into words.
 *
 * The invite dialog, the members table, the project cards and the accept-invite
 * page all read from here, so they cannot end up describing the same grant
 * differently — which would leave an admin unsure what they actually gave away.
 */

export function canAccessProject(access: ProjectAccess, projectId: string): boolean {
  return access.kind === 'all' || access.projectIds.includes(projectId)
}

export function memberCanAccessProject(member: OrgMember, projectId: string): boolean {
  return canAccessProject(member.access, projectId)
}

/** Projects covered by a grant, in the order they appear in `projects`. */
export function projectsForAccess(access: ProjectAccess, projects: Project[]): Project[] {
  if (access.kind === 'all') return projects
  return projects.filter((p) => access.projectIds.includes(p.id))
}

/**
 * Human-readable summary of a grant, e.g. 'All projects', 'Fabla only',
 * 'Fabla, TypeU', 'Fabla, TypeU +2 more'.
 */
export function describeAccess(access: ProjectAccess, projects: Project[]): string {
  if (access.kind === 'all') return 'All projects'

  const named = projectsForAccess(access, projects).map((p) => p.name)
  if (named.length === 0) return 'No projects'
  if (named.length === 1) return `${named[0]} only`
  if (named.length <= 3) return named.join(', ')
  return `${named.slice(0, 2).join(', ')} +${named.length - 2} more`
}

/**
 * Grants an admin can pick from in the invite dialog. 'single' is a distinct
 * option rather than a one-item 'projects' selection because it is the common
 * case of inviting someone into the project you are already looking at.
 */
export type AccessChoice = 'all' | 'projects' | 'single'

export function buildAccess(
  choice: AccessChoice,
  selectedProjectIds: string[],
  currentProjectId?: string,
): ProjectAccess {
  if (choice === 'all') return { kind: 'all' }
  if (choice === 'single') {
    return { kind: 'projects', projectIds: currentProjectId ? [currentProjectId] : [] }
  }
  return { kind: 'projects', projectIds: selectedProjectIds }
}

/** True when a grant is incomplete and should block submission. */
export function isAccessEmpty(access: ProjectAccess): boolean {
  return access.kind === 'projects' && access.projectIds.length === 0
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full control, including billing and deleting the organization.',
  admin: 'Can create projects, manage connections, and invite people.',
  member: 'Can ask questions and search the projects they have access to.',
}

/** Only owners and admins may reach org administration screens. */
export function canAdminister(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}
