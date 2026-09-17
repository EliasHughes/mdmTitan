import apiClient from './apiClient'

export interface DeviceListItem {
  id: string
  deviceName: string
  platform: string
  status: string
  complianceStatus: string
  serialNumber: string
  manufacturer: string | null
  model: string | null
  operatingSystem: string | null
  operatingSystemVersion: string | null
  assignedUser: string | null
  department: string | null
  ipAddress: string | null
  batteryLevel: number | null
  isManaged: boolean
  enrolledAtUtc: string | null
  lastSeenAtUtc: string | null
}

export interface DeviceDetails {
  id: string
  organizationId: string
  deviceName: string
  platform: string
  status: string
  complianceStatus: string
  serialNumber: string
  imei: string | null
  manufacturer: string | null
  model: string | null
  operatingSystem: string | null
  operatingSystemVersion: string | null
  agentVersion: string | null
  ipAddress: string | null
  macAddress: string | null
  assignedUser: string | null
  department: string | null
  batteryLevel: number | null
  isManaged: boolean
  enrolledAtUtc: string | null
  lastSeenAtUtc: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface DeviceListResult {
  items: DeviceListItem[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DeviceQueryParameters {
  search?: string
  platform?: string
  status?: string
  compliance?: string
  page?: number
  pageSize?: number
}

export const devicesApi = {
  async getDevices(
    parameters: DeviceQueryParameters = {},
  ): Promise<DeviceListResult> {
    const response =
      await apiClient.get<DeviceListResult>(
        '/api/devices',
        {
          params: {
            search: parameters.search || undefined,
            platform:
              parameters.platform || undefined,
            status:
              parameters.status || undefined,
            compliance:
              parameters.compliance || undefined,
            page: parameters.page ?? 1,
            pageSize:
              parameters.pageSize ?? 25,
          },
        },
      )

    return response.data
  },

  async getDeviceById(
    deviceId: string,
  ): Promise<DeviceDetails> {
    const response =
      await apiClient.get<DeviceDetails>(
        `/api/devices/${deviceId}`,
      )

    return response.data
  },
}