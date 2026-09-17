export type EnrollmentPlatform =
  | 'Android'
  | 'Windows'

export type EnrollmentStatus =
  | 'Active'
  | 'Completed'
  | 'Expired'
  | 'Revoked'

export interface EnrollmentToken {
  id: string
  platform: EnrollmentPlatform
  status: EnrollmentStatus
  maxUses: number
  usedCount: number
  expiresAtUtc: string
  createdByUserId: string
  createdAtUtc: string
  updatedAtUtc: string
  lastUsedAtUtc: string | null
  revokedAtUtc: string | null
}

export interface CreatedEnrollmentToken {
  id: string
  token: string
  platform: EnrollmentPlatform
  status: EnrollmentStatus
  maxUses: number
  usedCount: number
  expiresAtUtc: string
  createdAtUtc: string
}

export interface CreateEnrollmentTokenRequest {
  platform: EnrollmentPlatform
  expirationMinutes: number
  maxUses: number
}

export interface EnrollmentTokenValidationResult {
  isValid: boolean
  enrollmentTokenId: string | null
  organizationId: string | null
  platform: string | null
  errorCode: string | null
  message: string | null
}