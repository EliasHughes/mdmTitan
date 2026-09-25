import apiClient from './apiClient'

export interface ApplicationSummary {
  packageName: string
  applicationName: string
  versionName: string | null
  versionCode: number
  isSystemApp: boolean
  deviceCount: number
  enabledCount: number
  lastSeenAtUtc: string
}

export interface DeviceApplication {
  id: string
  deviceId: string
  deviceName: string
  packageName: string
  applicationName: string
  versionName: string | null
  versionCode: number
  isSystemApp: boolean
  isEnabled: boolean
  isPresent: boolean
  installerPackageName: string | null
  firstInstallTimeUtc: string | null
  lastUpdateTimeUtc: string | null
  firstSeenAtUtc: string
  lastSeenAtUtc: string
}

export interface ApplicationsQuery {
  search?: string
  systemApp?: boolean
}

export const applicationsApi = {
  async getAll(
    query: ApplicationsQuery = {},
  ): Promise<ApplicationSummary[]> {
    const response =
      await apiClient.get<ApplicationSummary[]>(
        '/applications',
        {
          params: query,
        },
      )

    return response.data
  },

  async getByDevice(
    deviceId: string,
  ): Promise<DeviceApplication[]> {
    const response =
      await apiClient.get<DeviceApplication[]>(
        `/applications/device/${deviceId}`,
      )

    return response.data
  },
}

export interface SoftwarePackage {
  id: string
  name: string
  version: string
  packageType: string
  originalFileName: string
  sha256: string
  sizeBytes: number
  installArguments: string | null
  isActive: boolean
  createdAtUtc: string
}

export interface SoftwareDeployment {
  id: string
  packageId: string
  packageName: string
  packageVersion: string
  targetType: string
  targetId: string
  targetName: string
  status: string
  queuedDevices: number
  createdAtUtc: string
}