import apiClient from './apiClient'

import type {
  CreateEnrollmentTokenRequest,
  CreatedEnrollmentToken,
  EnrollmentToken,
  EnrollmentTokenValidationResult,
} from '../types/enrollment'

export const enrollmentApi = {
  async getTokens(): Promise<EnrollmentToken[]> {
    const response =
      await apiClient.get<EnrollmentToken[]>(
        '/api/enrollment/tokens',
      )

    return response.data
  },

  async createToken(
    request: CreateEnrollmentTokenRequest,
  ): Promise<CreatedEnrollmentToken> {
    const response =
      await apiClient.post<CreatedEnrollmentToken>(
        '/api/enrollment/tokens',
        request,
      )

    return response.data
  },

  async revokeToken(
    enrollmentTokenId: string,
  ): Promise<void> {
    await apiClient.post(
      `/api/enrollment/tokens/${enrollmentTokenId}/revoke`,
    )
  },

  async validateToken(
    token: string,
    platform: string,
  ): Promise<EnrollmentTokenValidationResult> {
    const response =
      await apiClient.post<EnrollmentTokenValidationResult>(
        '/api/enrollment/validate',
        {
          token,
          platform,
        },
      )

    return response.data
  },
}