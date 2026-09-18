import apiClient from './apiClient'

import type {
  AndroidEnterpriseStatus,
  AndroidEnrollment,
  AndroidSignupResponse,
  CreateAndroidEnrollmentRequest,
  CreatedAndroidEnrollment,
} from '../types/androidEnterprise'

export const androidEnterpriseApi = {
  async getStatus():
    Promise<AndroidEnterpriseStatus> {
    const response =
      await apiClient.get<AndroidEnterpriseStatus>(
        '/android-enterprise/status',
      )

    return response.data
  },

  async createSignup():
    Promise<AndroidSignupResponse> {
    const response =
      await apiClient.post<AndroidSignupResponse>(
        '/android-enterprise/signup',
      )

    return response.data
  },

  async getEnrollments():
    Promise<AndroidEnrollment[]> {
    const response =
      await apiClient.get<AndroidEnrollment[]>(
        '/android-enterprise/enrollments',
      )

    return response.data
  },

  async createEnrollment(
    request: CreateAndroidEnrollmentRequest,
  ): Promise<CreatedAndroidEnrollment> {
    const response =
      await apiClient.post<CreatedAndroidEnrollment>(
        '/android-enterprise/enrollments',
        request,
      )

    return response.data
  },

  async revokeEnrollment(
    id: string,
  ): Promise<void> {
    await apiClient.delete(
      `/android-enterprise/enrollments/${id}`,
    )
  },
}