import {
  policiesApi,
  type Policy,
  type PolicyDetails,
} from './policiesApi'

export type KioskMode =
  | 'singleApp'
  | 'multiApp'

export interface KioskApplication {
  packageName: string
  displayName: string
  installType:
    | 'FORCE_INSTALLED'
    | 'AVAILABLE'
    | 'REQUIRED_FOR_SETUP'
  defaultApp: boolean
}

export interface KioskConfiguration {
  titanProfileType: 'kiosk'
  kioskMode: KioskMode
  applications: KioskApplication[]

  systemNavigation: {
    homeButton: boolean
    overviewButton: boolean
    statusBar: boolean
    notifications: boolean
  }

  deviceRestrictions: {
    factoryResetDisabled: boolean
    safeBootDisabled: boolean
    screenCaptureDisabled: boolean
    usbFileTransferDisabled: boolean
    outgoingCallsDisabled: boolean
    smsDisabled: boolean
    bluetoothDisabled: boolean
    cameraDisabled: boolean
  }

  display: {
    screenTimeoutSeconds: number
    stayOnWhilePluggedIn: boolean
  }
}

export interface CreateKioskProfile {
  name: string
  description?: string
  configuration: KioskConfiguration
}

function buildAndroidPolicy(
  configuration: KioskConfiguration,
) {
  const applications =
    configuration.applications.map(
      (application) => ({
        packageName:
          application.packageName,

        installType:
          application.installType,

        lockTaskAllowed:
          true,

        defaultPermissionPolicy:
          'GRANT',
      }),
    )

  const defaultApp =
    configuration.applications.find(
      (application) =>
        application.defaultApp,
    )

  return {
    titanProfileType: 'kiosk',

    kioskMode:
      configuration.kioskMode,

    applications,

    persistentPreferredActivities:
      defaultApp
        ? [
            {
              receiverActivity:
                `${defaultApp.packageName}/.MainActivity`,

              actions: [
                'android.intent.action.MAIN',
              ],

              categories: [
                'android.intent.category.HOME',
                'android.intent.category.DEFAULT',
              ],
            },
          ]
        : [],

    keyguardDisabled: true,

    statusBarDisabled:
      !configuration
        .systemNavigation.statusBar,

    screenCaptureDisabled:
      configuration
        .deviceRestrictions
        .screenCaptureDisabled,

    factoryResetDisabled:
      configuration
        .deviceRestrictions
        .factoryResetDisabled,

    safeBootDisabled:
      configuration
        .deviceRestrictions
        .safeBootDisabled,

    usbFileTransferDisabled:
      configuration
        .deviceRestrictions
        .usbFileTransferDisabled,

    outgoingCallsDisabled:
      configuration
        .deviceRestrictions
        .outgoingCallsDisabled,

    smsDisabled:
      configuration
        .deviceRestrictions
        .smsDisabled,

    bluetoothDisabled:
      configuration
        .deviceRestrictions
        .bluetoothDisabled,

    cameraDisabled:
      configuration
        .deviceRestrictions
        .cameraDisabled,

    maximumTimeToLock:
      configuration.display
        .screenTimeoutSeconds * 1000,

    stayOnPluggedModes:
      configuration.display
        .stayOnWhilePluggedIn
        ? [
            'AC',
            'USB',
            'WIRELESS',
          ]
        : [],
  }
}

export const kioskApi = {
  async getProfiles(): Promise<
    Policy[]
  > {
    const policies =
      await policiesApi.getAll(
        'Android',
      )

    const details =
      await Promise.all(
        policies.map((policy) =>
          policiesApi.getById(
            policy.id,
          ),
        ),
      )

    const kioskIds =
      new Set(
        details
          .filter((policy) => {
            try {
              const configuration =
                JSON.parse(
                  policy.configurationJson,
                )

              return (
                configuration
                  ?.titanProfileType ===
                'kiosk'
              )
            } catch {
              return false
            }
          })
          .map((policy) => policy.id),
      )

    return policies.filter((policy) =>
      kioskIds.has(policy.id),
    )
  },

  async getProfile(
    policyId: string,
  ): Promise<PolicyDetails> {
    return policiesApi.getById(
      policyId,
    )
  },

  async createProfile(
    request: CreateKioskProfile,
  ): Promise<PolicyDetails> {
    return policiesApi.create({
      name: request.name,
      description:
        request.description,
      platform: 'Android',
      configurationJson:
        JSON.stringify(
          buildAndroidPolicy(
            request.configuration,
          ),
        ),
    })
  },

  async activateAndPublish(
    policyId: string,
  ) {
    await policiesApi.activate(
      policyId,
    )

    return policiesApi.publishAndroid(
      policyId,
    )
  },

  async assignDevice(
    policyId: string,
    deviceId: string,
  ) {
    return policiesApi.assignAndroid(
      policyId,
      deviceId,
    )
  },
}