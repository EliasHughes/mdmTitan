import apiClient from './apiClient'

import type {
  DeviceDetails,
  DeviceListResult,
} from '../types/device'

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
        '/devices',
        {
          params: {
            search:
              parameters.search || undefined,
            platform:
              parameters.platform || undefined,
            status:
              parameters.status || undefined,
            compliance:
              parameters.compliance || undefined,
            page:
              parameters.page ?? 1,
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
        `/devices/${deviceId}`,
      )

    return response.data
  },
}