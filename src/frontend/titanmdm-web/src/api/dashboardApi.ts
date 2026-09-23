import apiClient from './apiClient'

/*
 * ================================================================
 * WORKSPACES
 * ================================================================
 */

export type DashboardWorkspace =
  | 'global'
  | 'windows'
  | 'android'

/*
 * ================================================================
 * DEVICES
 * ================================================================
 */

export interface DeviceSummary {
  total: number
  online: number
  offline: number
  pending: number
  enrolling: number
  quarantined: number
  retired: number
  managed: number
}

/*
 * ================================================================
 * PLATFORMS
 * ================================================================
 */

export interface PlatformSummary {
  windows: number
  android: number
  unknown: number
}

/*
 * ================================================================
 * COMPLIANCE
 * ================================================================
 */

export interface ComplianceSummary {
  compliant: number
  nonCompliant: number
  evaluating: number
  quarantined: number
  unknown: number
  compliancePercentage:
    number | null
}

/*
 * ================================================================
 * COMMANDS
 * ================================================================
 */

export interface CommandSummary {
  total: number
  pending: number
  queued: number
  dispatching: number
  sent: number
  delivered: number
  executing: number
  success: number
  failed: number
  timeout: number
  cancelled: number
  active: number
  problems: number
}

/*
 * ================================================================
 * SYSTEM
 * ================================================================
 */

export interface SystemStatus {
  api: string
  database: string
}

/*
 * ================================================================
 * DASHBOARD
 * ================================================================
 */

export interface DashboardSummary {
  devices: DeviceSummary
  platforms: PlatformSummary
  compliance: ComplianceSummary
  commands: CommandSummary
  system: SystemStatus
  generatedAtUtc: string
}

/*
 * ================================================================
 * REQUEST DEDUPLICATION
 * ================================================================
 *
 * React StrictMode ejecuta determinados efectos dos veces durante
 * desarrollo.
 *
 * Guardamos la solicitud activa por workspace para que dos renders
 * simultáneos reutilicen la misma Promise en lugar de realizar
 * dos peticiones HTTP.
 * ================================================================
 */

const activeRequests =
  new Map<
    DashboardWorkspace,
    Promise<DashboardSummary>
  >()

/*
 * ================================================================
 * API
 * ================================================================
 */

export const dashboardApi = {
  async getSummary(
    workspace:
      DashboardWorkspace,
  ): Promise<DashboardSummary> {
    const existingRequest =
      activeRequests.get(
        workspace,
      )

    if (
      existingRequest
    ) {
      return existingRequest
    }

    const request =
      apiClient
        .get<DashboardSummary>(
          '/dashboard/summary',
          {
            params: {
              workspace,
            },
          },
        )
        .then(
          response =>
            response.data,
        )
        .finally(
          () => {
            activeRequests.delete(
              workspace,
            )
          },
        )

    activeRequests.set(
      workspace,
      request,
    )

    return request
  },
}