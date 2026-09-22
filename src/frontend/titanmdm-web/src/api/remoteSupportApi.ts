import apiClient from './apiClient'

export type RemoteSessionStatus =
  | 'Requested'
  | 'Connecting'
  | 'Connected'
  | 'Disconnecting'
  | 'Completed'
  | 'Failed'
  | 'Expired'
  | 'Cancelled'

export interface RemoteSession {
  id: string
  organizationId: string
  deviceId: string
  requestedByUserId: string
  technicianName: string
  reason: string
  status: RemoteSessionStatus

  allowKeyboard: boolean
  allowMouse: boolean
  allowClipboard: boolean
  allowFileTransfer: boolean

  requestedAtUtc: string
  expiresAtUtc: string

  connectedAtUtc?: string | null
  disconnectedAtUtc?: string | null
  updatedAtUtc?: string | null

  failureReason?: string | null
  terminationReason?: string | null
  terminatedBy?: string | null
}

export interface CreateRemoteSessionRequest {
  deviceId: string
  reason: string

  allowKeyboard: boolean
  allowMouse: boolean
  allowClipboard: boolean
  allowFileTransfer: boolean

  maximumDurationMinutes: number
}

export async function listRemoteSessions():
  Promise<RemoteSession[]> {
  const response =
    await apiClient.get<RemoteSession[]>(
      '/remote-sessions',
    )

  return response.data
}

export async function getRemoteSession(
  sessionId: string,
): Promise<RemoteSession> {
  const response =
    await apiClient.get<RemoteSession>(
      `/remote-sessions/${sessionId}`,
    )

  return response.data
}

export async function createRemoteSession(
  request: CreateRemoteSessionRequest,
): Promise<RemoteSession> {
  const response =
    await apiClient.post<RemoteSession>(
      '/remote-sessions',
      request,
    )

  return response.data
}

export async function terminateRemoteSession(
  sessionId: string,
  reason =
    'Sesión finalizada por el técnico.',
): Promise<void> {
  await apiClient.post(
    `/remote-sessions/${sessionId}/terminate`,
    {
      reason,
    },
  )
}