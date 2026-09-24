import apiClient from './apiClient'

import type {
  CreateEnrollmentTokenRequest,
  CreatedEnrollmentToken,
  CreateWindowsInstallerRequest,
  EnrollmentToken,
  EnrollmentTokenValidationResult,
  WindowsAgentPackageInfo,
} from '../types/enrollment'

export const enrollmentApi = {
  async getTokens():
    Promise<EnrollmentToken[]> {
    const response =
      await apiClient.get<
        EnrollmentToken[]
      >(
        '/enrollment/tokens',
      )

    return response.data
  },

  async createToken(
    request:
      CreateEnrollmentTokenRequest,
  ): Promise<CreatedEnrollmentToken> {
    const response =
      await apiClient.post<
        CreatedEnrollmentToken
      >(
        '/enrollment/tokens',
        request,
      )

    return response.data
  },

  async revokeToken(
    enrollmentTokenId:
      string,
  ): Promise<void> {
    await apiClient.post(
      `/enrollment/tokens/${enrollmentTokenId}/revoke`,
    )
  },

  async validateToken(
    token:
      string,
    platform:
      string,
  ): Promise<EnrollmentTokenValidationResult> {
    const response =
      await apiClient.post<
        EnrollmentTokenValidationResult
      >(
        '/enrollment/validate',
        {
          token,
          platform,
        },
      )

    return response.data
  },

  async getWindowsPackageInfo():
    Promise<WindowsAgentPackageInfo> {
    const response =
      await apiClient.get<
        WindowsAgentPackageInfo
      >(
        '/enrollment/windows/package-info',
      )

    return response.data
  },

  async downloadWindowsInstaller(
    request:
      CreateWindowsInstallerRequest,
  ): Promise<Blob> {
    const response =
      await apiClient.post(
        '/enrollment/windows/installer',
        request,
        {
          responseType:
            'blob',
        },
      )

    return response.data
  },
}