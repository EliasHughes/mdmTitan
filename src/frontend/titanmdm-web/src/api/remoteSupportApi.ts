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

export interface RemoteSessionEvent {
  id: string
  eventType: string
  description: string
  userId?: string | null
  metadataJson?: string | null
  occurredAtUtc: string
}

export interface RemoteSession {
  id: string
  organizationId?: string
  deviceId: string
  requestedByUserId?: string
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

  failureReason?: string | null
  terminationReason?: string | null
  terminatedBy?: string | null

  events?: RemoteSessionEvent[]
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

export async function listRemoteSessions(
  take = 100,
): Promise<RemoteSession[]> {
  const response =
    await apiClient.get<RemoteSession[]>(
      '/remote-sessions',
      {
        params: {
          take,
        },
      },
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
): Promise<RemoteSession> {
  const response =
    await apiClient.post<RemoteSession>(
      `/remote-sessions/${sessionId}/terminate`,
      {
        reason,
      },
    )

  return response.data
}