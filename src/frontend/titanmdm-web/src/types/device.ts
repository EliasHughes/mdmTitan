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

  batteryLevel: number | null

  isManaged: boolean

  enrolledAtUtc: string | null
  lastSeenAtUtc: string | null
}

export interface DeviceListResponse {
  items: DeviceListItem[]
  total: number
}