export type DevicePlatform =
  | 'Android'
  | 'Windows'
  | 'Unknown'

export type DeviceStatus =
  | 'Pending'
  | 'Enrolling'
  | 'Online'
  | 'Offline'
  | 'Locked'
  | 'Quarantined'
  | 'Retired'
  | 'Wiped'

export type ComplianceStatus =
  | 'Unknown'
  | 'Evaluating'
  | 'Compliant'
  | 'NonCompliant'
  | 'Quarantined'

export interface DeviceListItem {
  id: string
  deviceName: string
  platform: DevicePlatform
  status: DeviceStatus
  complianceStatus: ComplianceStatus
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
  platform: DevicePlatform
  status: DeviceStatus
  complianceStatus: ComplianceStatus
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

export interface AndroidDeviceDetails {
  androidDeviceId: string
  deviceId: string

  googleDeviceName: string
  googleDeviceId: string | null

  managementMode: string | null
  ownership: string | null
  state: string | null

  appliedPolicyName: string | null
  appliedPolicyVersion: number | null
  appliedPolicyState: string | null

  enrollmentTokenName: string | null
  userName: string | null

  brand: string | null
  hardware: string | null
  deviceBasebandVersion: string | null
  bootloaderVersion: string | null

  securityPatchLevel: string | null
  apiLevel: number | null
  buildNumber: string | null
  kernelVersion: string | null

  androidDevicePolicyVersion: string | null
  androidDevicePolicyVersionCode: string | null

  encryptionStatus: string | null
  securityPosture: string | null

  enrollmentTimeUtc: string | null
  lastStatusReportTimeUtc: string | null
  lastPolicySyncTimeUtc: string | null
  lastSynchronizedAtUtc: string

  isDeletedInGoogle: boolean
  deletedInGoogleAtUtc: string | null
}