import apiClient from './apiClient'

export type PolicyPlatform =
  | 'Windows'
  | 'Android'

export type PolicyStatus =
  | 'Draft'
  | 'Active'
  | 'Disabled'
  | 'Archived'

export interface Policy {
  id: string
  organizationId: string
  name: string
  description: string | null
  platform: PolicyPlatform
  status: PolicyStatus
  currentVersion: number
  assignedDevices: number
  createdByUserId: string
  createdAtUtc: string
  updatedAtUtc: string
  activatedAtUtc: string | null
  archivedAtUtc: string | null
}

export interface PolicyDetails
  extends Policy {
  configurationJson: string
  appliedDevices: number
  failedDevices: number
}

export interface PolicyAssignment {
  id: string
  policyId: string
  deviceId: string
  deviceName: string
  policyVersion: number
  status: string
  commandId: string | null
  assignedAtUtc: string
  updatedAtUtc: string
  appliedAtUtc: string | null
  errorMessage: string | null
}

export interface CreatePolicyRequest {
  name: string
  description?: string | null
  platform: PolicyPlatform
  configurationJson: string
}

export interface UpdatePolicyRequest {
  name: string
  description?: string | null
  configurationJson: string
}

export const policiesApi = {
  async getAll(
    platform?: string,
    status?: string,
  ): Promise<Policy[]> {
    const response =
      await apiClient.get<Policy[]>(
        '/policies',
        {
          params: {
            platform:
              platform || undefined,
            status:
              status || undefined,
          },
        },
      )

    return response.data
  },

  async getById(
    policyId: string,
  ): Promise<PolicyDetails> {
    const response =
      await apiClient.get<PolicyDetails>(
        `/policies/${policyId}`,
      )

    return response.data
  },

  async create(
    request: CreatePolicyRequest,
  ): Promise<PolicyDetails> {
    const response =
      await apiClient.post<PolicyDetails>(
        '/policies',
        request,
      )

    return response.data
  },

  async update(
    policyId: string,
    request: UpdatePolicyRequest,
  ): Promise<PolicyDetails> {
    const response =
      await apiClient.put<PolicyDetails>(
        `/policies/${policyId}`,
        request,
      )

    return response.data
  },

  async activate(
    policyId: string,
  ): Promise<void> {
    await apiClient.post(
      `/policies/${policyId}/activate`,
    )
  },

  async disable(
    policyId: string,
  ): Promise<void> {
    await apiClient.post(
      `/policies/${policyId}/disable`,
    )
  },

  async archive(
    policyId: string,
  ): Promise<void> {
    await apiClient.post(
      `/policies/${policyId}/archive`,
    )
  },

  async assign(
    policyId: string,
    deviceIds: string[],
  ): Promise<PolicyAssignment[]> {
    const response =
      await apiClient.post<
        PolicyAssignment[]
      >(
        `/policies/${policyId}/assign`,
        { deviceIds },
      )

    return response.data
  },

  async getAssignments(
    policyId: string,
  ): Promise<PolicyAssignment[]> {
    const response =
      await apiClient.get<
        PolicyAssignment[]
      >(
        `/policies/${policyId}/assignments`,
      )

    return response.data
  },
}