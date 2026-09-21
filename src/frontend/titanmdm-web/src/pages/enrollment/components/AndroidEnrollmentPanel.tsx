import {
  useState,
} from 'react'

import AndroidAgentEnrollment from './AndroidAgentEnrollment'
import AndroidEnterpriseEnrollment from './AndroidEnterpriseEnrollment'

import type {
  AndroidAgentEnrollmentController,
} from '../hooks/useAndroidAgentEnrollment'

import type {
  AndroidEnterpriseEnrollmentController,
} from '../hooks/useAndroidEnterpriseEnrollment'

type AndroidEnrollmentTechnology =
  | 'enterprise'
  | 'agent'

interface AndroidEnrollmentPanelProps {
  enterprise:
    AndroidEnterpriseEnrollmentController

  agent:
    AndroidAgentEnrollmentController

  canViewEnterprise?: boolean
  canViewAgent?: boolean

  canCreateEnterprise?: boolean
  canRevokeEnterprise?: boolean
  canConnectEnterprise?: boolean

  canCreateAgent?: boolean
  canRevokeAgent?: boolean
}

export default function AndroidEnrollmentPanel({
  enterprise,
  agent,

  canViewEnterprise = true,
  canViewAgent = true,

  canCreateEnterprise = true,
  canRevokeEnterprise = true,
  canConnectEnterprise = true,

  canCreateAgent = true,
  canRevokeAgent = true,
}: AndroidEnrollmentPanelProps) {
  const defaultTechnology:
    AndroidEnrollmentTechnology =
      canViewEnterprise
        ? 'enterprise'
        : 'agent'

  const [
    activeTechnology,
    setActiveTechnology,
  ] =
    useState<AndroidEnrollmentTechnology>(
      defaultTechnology,
    )

  return (
    <div className="android-enrollment-panel">
      <div className="android-technology-tabs">
        {canViewEnterprise && (
          <button
            type="button"
            className={
              activeTechnology ===
              'enterprise'
                ? 'android-technology-tab android-technology-tab-active'
                : 'android-technology-tab'
            }
            onClick={() =>
              setActiveTechnology(
                'enterprise',
              )
            }
          >
            <strong>
              Android Enterprise
            </strong>

            <small>
              Google AMAPI
            </small>
          </button>
        )}

        {canViewAgent && (
          <button
            type="button"
            className={
              activeTechnology ===
              'agent'
                ? 'android-technology-tab android-technology-tab-active'
                : 'android-technology-tab'
            }
            onClick={() =>
              setActiveTechnology(
                'agent',
              )
            }
          >
            <strong>
              TitanMDM Agent
            </strong>

            <small>
              Agente Kotlin
            </small>
          </button>
        )}
      </div>

      {activeTechnology ===
        'enterprise' &&
        canViewEnterprise && (
          <AndroidEnterpriseEnrollment
            controller={enterprise}
            canCreate={
              canCreateEnterprise
            }
            canRevoke={
              canRevokeEnterprise
            }
            canConnect={
              canConnectEnterprise
            }
          />
        )}

      {activeTechnology ===
        'agent' &&
        canViewAgent && (
          <AndroidAgentEnrollment
            controller={agent}
            canCreate={canCreateAgent}
            canRevoke={canRevokeAgent}
          />
        )}
    </div>
  )
}