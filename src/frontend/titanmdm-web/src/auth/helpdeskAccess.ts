export const helpdeskStaffPermissions = [
  'helpdesk.view',
  'tickets.comment',
  'tickets.assign',
  'tickets.close',
  'helpdesk.manage',
  'settings.manage',
] as const

export function canUseHelpdeskConsole(
  hasPermission: (permission: string) => boolean,
): boolean {
  return helpdeskStaffPermissions.some(
    permission => hasPermission(permission),
  )
}