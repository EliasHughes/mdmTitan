import apiClient from './apiClient'

export interface DashboardSummary {
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  compliantDevices: number
  nonCompliantDevices: number
  androidDevices: number
  windowsDevices: number
  pendingEnrollmentDevices: number
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