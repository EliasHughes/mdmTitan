import apiClient from './apiClient'

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

export interface PlatformSummary {
  windows: number
  android: number
  unknown: number
}

export interface ComplianceSummary {
  compliant: number
  nonCompliant: number
  evaluating: number
  quarantined: number
  unknown: number
  compliancePercentage: number | null
}

export interface SystemStatus {
  api: string
  database: string
}

export interface DashboardSummary {
  devices: DeviceSummary
  platforms: PlatformSummary
  compliance: ComplianceSummary
  system: SystemStatus
  generatedAtUtc: string
  commands: CommandSummary
}

export const dashboardApi = {
  async getSummary(): Promise<DashboardSummary> {
    const response =
      await apiClient.get<DashboardSummary>(
        '/dashboard/summary',
      )

    return response.data
  },

}

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