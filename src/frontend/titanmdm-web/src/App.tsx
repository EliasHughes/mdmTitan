import type { ReactNode } from 'react'

import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import { ProtectedRoute } from './auth/ProtectedRoute'
import { PermissionRoute } from './auth/PermissionRoute'

import { AppLayout } from './components/layout/AppLayout'

import { AccessDeniedPage } from './pages/AccessDeniedPage'
import { DashboardPage } from './pages/DashboardPage'
import { EntraLoginCallbackPage } from './pages/EntraLoginCallbackPage'
import { LoginPage } from './pages/LoginPage'

import { LaunchpadPage } from './pages/launchpad/LaunchpadPage'

import { DevicesPage } from './pages/devices/DevicesPage'
import { DeviceEntryPage } from './pages/devices/DeviceEntryPage'
import { DeviceDetailPage } from './pages/devices/DeviceDetailPage'
import { WindowsControlCenterPage } from './pages/devices/WindowsControlCenterPage'

import EnrollmentPage from './pages/enrollment/EnrollmentPage'

import { PoliciesPage } from './pages/policies/PoliciesPage'
import { PolicyEditorPage } from './pages/policies/PolicyEditorPage'

import { DeviceGroupsPage } from './pages/groups/DeviceGroupsPage'
import { AppsPage } from './pages/apps/AppsPage'
import { SecurityPage } from './pages/security/SecurityPage'
import { CompliancePage } from './pages/compliance/CompliancePage'
import { KioskPage } from './pages/kiosk/KioskPage'
import { GeofencingPage } from './pages/geofencing/GeofencingPage'
import { AutomationPage } from './pages/automation/AutomationPage'
import { RemotePage } from './pages/remote/RemotePage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { AuditPage } from './pages/audit/AuditPage'

import { UsersPage } from './pages/users/UsersPage'
import { RolesPage } from './pages/roles/RolesPage'

import { SitesPage } from './pages/sites/SitesPage'

import { SettingsPage } from './pages/settings/SettingsPage'

import { MyHelpdeskPage } from './pages/helpdesk/MyHelpdeskPage'
import { HelpdeskInboxPage } from './pages/helpdesk/HelpdeskInboxPage'
import { HelpdeskTicketPage } from './pages/helpdesk/HelpdeskTicketPage'
import { HelpdeskEntraSettingsPage } from './pages/helpdesk/HelpdeskEntraSettingsPage'
import { HelpdeskOperationsPage } from './pages/helpdesk/HelpdeskOperationsPage'
import { HelpdeskSpecialtiesPage } from './pages/helpdesk/HelpdeskSpecialtiesPage'
import { HelpdeskReportsPage } from './pages/helpdesk/HelpdeskReportsPage'
import { HelpdeskCoveragePage } from './pages/helpdesk/HelpdeskCoveragePage'
import { HelpdeskFollowupPage } from './pages/helpdesk/HelpdeskFollowupPage'
import { HelpdeskCenterPage } from './pages/helpdesk/HelpdeskCenterPage'
import { MyHelpdeskActionsPanel } from './pages/helpdesk/MyHelpdeskActionsPanel'

import { PonchesPage } from './pages/ponches/PonchesPage'

interface ApplicationRoute {
  path: string
  page: ReactNode
  permissions: string[]
}

const applicationRoutes:
  ApplicationRoute[] = [
    {
      path:
        'helpdesk/centro/configuracion',
      page:
        <HelpdeskCenterPage />,
      permissions:
        [
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'helpdesk/centro/preparacion',
      page:
        <HelpdeskCenterPage />,
      permissions:
        [
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'helpdesk/centro/:section',
      page:
        <HelpdeskCenterPage />,
      permissions:
        [
          'helpdesk.view',
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'dashboard',
      page:
        <DashboardPage />,
      permissions:
        [
          'dashboard.view',
        ],
    },

    {
      path:
        'helpdesk/operations',
      page:
        <HelpdeskOperationsPage />,
      permissions:
        [
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'helpdesk',
      page:
        <HelpdeskInboxPage />,
      permissions:
        [
          'helpdesk.view',
          'tickets.view',
        ],
    },

    {
      path:
        'helpdesk/especialidades',
      page:
        <HelpdeskSpecialtiesPage />,
      permissions:
        [
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'helpdesk/cobertura',
      page:
        <HelpdeskCoveragePage />,
      permissions:
        [
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'helpdesk/entra',
      page:
        <HelpdeskEntraSettingsPage />,
      permissions:
        [
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'helpdesk/tickets/:ticketId',
      page:
        <HelpdeskTicketPage />,
      permissions:
        [
          'helpdesk.view',
          'tickets.view',
        ],
    },

    {
      path:
        'helpdesk/seguimiento',
      page:
        <HelpdeskFollowupPage />,
      permissions:
        [
          'tickets.comment',
          'tickets.assign',
          'helpdesk.manage',
          'settings.manage',
        ],
    },

    {
      path:
        'helpdesk/reportes',
      page:
        <HelpdeskReportsPage />,
      permissions:
        [
          'helpdesk.view',
          'tickets.view',
        ],
    },

    {
      path:
        'ponches',
      page:
        <PonchesPage />,
      permissions:
        [
          'settings.view',
        ],
    },

    {
      path:
        'devices',
      page:
        <DevicesPage />,
      permissions:
        [
          'devices.view',
        ],
    },

    {
      path:
        'devices/:deviceId',
      page:
        <DeviceEntryPage />,
      permissions:
        [
          'devices.view',
        ],
    },

    {
      path:
        'devices/:deviceId/android',
      page:
        <DeviceDetailPage />,
      permissions:
        [
          'devices.view',
        ],
    },

    {
      path:
        'devices/:deviceId/control-center',
      page:
        <WindowsControlCenterPage />,
      permissions:
        [
          'devices.commands',
        ],
    },

    {
      path:
        'enrollment',
      page:
        <EnrollmentPage />,
      permissions:
        [
          'enrollment.view',
        ],
    },

    {
      path:
        'policies',
      page:
        <PoliciesPage />,
      permissions:
        [
          'policies.view',
        ],
    },

    {
      path:
        'policies/new',
      page:
        <PolicyEditorPage />,
      permissions:
        [
          'policies.manage',
        ],
    },

    {
      path:
        'policies/:policyId',
      page:
        <PolicyEditorPage />,
      permissions:
        [
          'policies.view',
          'policies.manage',
        ],
    },

    {
      path:
        'groups',
      page:
        <DeviceGroupsPage />,
      permissions:
        [
          'devices.view',
        ],
    },

    {
      path:
        'apps',
      page:
        <AppsPage />,
      permissions:
        [
          'apps.view',
        ],
    },

    {
      path:
        'security',
      page:
        <SecurityPage />,
      permissions:
        [
          'security.view',
        ],
    },

    {
      path:
        'compliance',
      page:
        <CompliancePage />,
      permissions:
        [
          'compliance.view',
        ],
    },

    {
      path:
        'kiosk',
      page:
        <KioskPage />,
      permissions:
        [
          'kiosk.view',
        ],
    },

    {
      path:
        'geofencing',
      page:
        <GeofencingPage />,
      permissions:
        [
          'geofencing.view',
        ],
    },

    {
      path:
        'automation',
      page:
        <AutomationPage />,
      permissions:
        [
          'devices.commands',
        ],
    },

    {
      path:
        'remote',
      page:
        <RemotePage />,
      permissions:
        [
          'remote.view',
        ],
    },

    {
      path:
        'reports',
      page:
        <ReportsPage />,
      permissions:
        [
          'reports.view',
        ],
    },

    {
      path:
        'audit',
      page:
        <AuditPage />,
      permissions:
        [
          'audit.view',
        ],
    },

    {
      path:
        'users',
      page:
        <UsersPage />,
      permissions:
        [
          'users.view',
        ],
    },

    {
      path:
        'roles',
      page:
        <RolesPage />,
      permissions:
        [
          'roles.view',
        ],
    },

    {
      path:
        'sites',
      page:
        <SitesPage />,
      permissions:
        [
          'sites.view',
        ],
    },

    {
      path:
        'settings',
      page:
        <SettingsPage />,
      permissions:
        [
          'settings.view',
        ],
    },
  ]

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />

      <Route
        path="/login/entra"
        element={
          <EntraLoginCallbackPage />
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <LaunchpadPage />
          }
        />

        <Route
          path="forbidden"
          element={
            <AccessDeniedPage />
          }
        />

        <Route
          path="my-support"
          element={
            <MyHelpdeskPage />
          }
        />

        <Route
          path="my-support/:ticketId"
          element={
            <>
              <MyHelpdeskPage />
              <MyHelpdeskActionsPanel />
            </>
          }
        />

        {applicationRoutes.map(
          route => (
            <Route
              key={
                route.path
              }
              path={
                route.path
              }
              element={
                <PermissionRoute
                  anyOf={
                    route.permissions
                  }
                >
                  {route.page}
                </PermissionRoute>
              }
            />
          ),
        )}
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  )
}

export default App