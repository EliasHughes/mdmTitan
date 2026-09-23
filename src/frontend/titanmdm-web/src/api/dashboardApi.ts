import apiClient from './apiClient'

/*
 * ================================================================
 * WORKSPACE
 * ================================================================
 */

export type DashboardWorkspace =
  | 'global'
  | 'windows'
  | 'android'

/*
 * ================================================================
 * DEVICE SUMMARY
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
 * PLATFORM SUMMARY
 * ================================================================
 */

export interface PlatformSummary {
  windows: number
  android: number
  unknown: number
}

/*
 * ================================================================
 * COMPLIANCE SUMMARY
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
 * COMMAND SUMMARY
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
 * SYSTEM STATUS
 * ================================================================
 */

export interface SystemStatus {
  api: string
  database: string
}

/*
 * ================================================================
 * DASHBOARD SUMMARY
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
 * DASHBOARD API
 * ================================================================
 */

export const dashboardApi = {
  async getSummary(
    workspace:
      DashboardWorkspace =
        'global',
  ): Promise<DashboardSummary> {
    const response =
      await apiClient.get<DashboardSummary>(
        '/dashboard/summary',
        {
          params: {
            workspace,
          },
        },
      )

    return response.data
  },
}