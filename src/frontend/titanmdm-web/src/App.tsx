import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import {
  AccessDeniedPage,
} from './pages/AccessDeniedPage'

import {
  ProtectedRoute,
} from './auth/ProtectedRoute'

import {
  PermissionRoute,
} from './auth/PermissionRoute'

import {
  AppLayout,
} from './components/layout/AppLayout'

import {
  LoginPage,
} from './pages/LoginPage'

import {
  LaunchpadPage,
} from './pages/launchpad/LaunchpadPage'

import {
  DashboardPage,
} from './pages/DashboardPage'

import {
  DevicesPage,
} from './pages/devices/DevicesPage'

import {
  DeviceDetailPage,
} from './pages/devices/DeviceDetailPage'

import {
  WindowsControlCenterPage,
} from './pages/devices/WindowsControlCenterPage'

import EnrollmentPage
  from './pages/enrollment/EnrollmentPage'

import {
  PoliciesPage,
} from './pages/policies/PoliciesPage'

import {
  PolicyEditorPage,
} from './pages/policies/PolicyEditorPage'

import {
  DeviceGroupsPage,
} from './pages/groups/DeviceGroupsPage'

import {
  AppsPage,
} from './pages/apps/AppsPage'

import {
  SecurityPage,
} from './pages/security/SecurityPage'

import {
  CompliancePage,
} from './pages/compliance/CompliancePage'

import {
  KioskPage,
} from './pages/kiosk/KioskPage'

import {
  GeofencingPage,
} from './pages/geofencing/GeofencingPage'

import {
  AutomationPage,
} from './pages/automation/AutomationPage'

import {
  RemotePage,
} from './pages/remote/RemotePage'

import {
  ReportsPage,
} from './pages/reports/ReportsPage'

import {
  AuditPage,
} from './pages/audit/AuditPage'

import {
  UsersPage,
} from './pages/users/UsersPage'

import {
  RolesPage,
} from './pages/roles/RolesPage'

import {
  SettingsPage,
} from './pages/settings/SettingsPage'

function App() {
  return (
    <Routes>
      {/* =======================================================
          PUBLIC
         ======================================================= */}

      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />

      {/* =======================================================
          AUTHENTICATED
         ======================================================= */}

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

        {/* =====================================================
            DASHBOARD
           ===================================================== */}

        <Route
          path="dashboard"
          element={
            <PermissionRoute
              anyOf={[
                'dashboard.view',
              ]}
            >
              <DashboardPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            DEVICES
           ===================================================== */}

        <Route
          path="devices"
          element={
            <PermissionRoute
              anyOf={[
                'devices.view',
              ]}
            >
              <DevicesPage />
            </PermissionRoute>
          }
        />

        <Route
          path="devices/:deviceId"
          element={
            <PermissionRoute
              anyOf={[
                'devices.view',
              ]}
            >
              <DeviceDetailPage />
            </PermissionRoute>
          }
        />

        <Route
          path="devices/:deviceId/control-center"
          element={
            <PermissionRoute
              anyOf={[
                'devices.commands',
              ]}
            >
              <WindowsControlCenterPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            ENROLLMENT
           ===================================================== */}

        <Route
          path="enrollment"
          element={
            <PermissionRoute
              anyOf={[
                'enrollment.view',
              ]}
            >
              <EnrollmentPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            POLICIES
           ===================================================== */}

        <Route
          path="policies"
          element={
            <PermissionRoute
              anyOf={[
                'policies.view',
              ]}
            >
              <PoliciesPage />
            </PermissionRoute>
          }
        />

        <Route
          path="policies/new"
          element={
            <PermissionRoute
              anyOf={[
                'policies.manage',
              ]}
            >
              <PolicyEditorPage />
            </PermissionRoute>
          }
        />

        <Route
          path="policies/:policyId"
          element={
            <PermissionRoute
              anyOf={[
                'policies.view',
                'policies.manage',
              ]}
            >
              <PolicyEditorPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            GROUPS
           ===================================================== */}

        <Route
          path="groups"
          element={
            <PermissionRoute
              anyOf={[
                'devices.view',
              ]}
            >
              <DeviceGroupsPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            APPLICATIONS
           ===================================================== */}

        <Route
          path="apps"
          element={
            <PermissionRoute
              anyOf={[
                'apps.view',
              ]}
            >
              <AppsPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            SECURITY
           ===================================================== */}

        <Route
          path="security"
          element={
            <PermissionRoute
              anyOf={[
                'security.view',
              ]}
            >
              <SecurityPage />
            </PermissionRoute>
          }
        />

        <Route
          path="compliance"
          element={
            <PermissionRoute
              anyOf={[
                'compliance.view',
              ]}
            >
              <CompliancePage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            ADVANCED MDM
           ===================================================== */}

        <Route
          path="kiosk"
          element={
            <PermissionRoute
              anyOf={[
                'kiosk.view',
              ]}
            >
              <KioskPage />
            </PermissionRoute>
          }
        />

        <Route
          path="geofencing"
          element={
            <PermissionRoute
              anyOf={[
                'geofencing.view',
              ]}
            >
              <GeofencingPage />
            </PermissionRoute>
          }
        />

        <Route
          path="automation"
          element={
            <PermissionRoute
              anyOf={[
                'devices.commands',
              ]}
            >
              <AutomationPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            REMOTE SUPPORT
           ===================================================== */}

        <Route
          path="remote"
          element={
            <PermissionRoute
              anyOf={[
                'remote.view',
              ]}
            >
              <RemotePage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            REPORTING
           ===================================================== */}

        <Route
          path="reports"
          element={
            <PermissionRoute
              anyOf={[
                'reports.view',
              ]}
            >
              <ReportsPage />
            </PermissionRoute>
          }
        />

        <Route
          path="audit"
          element={
            <PermissionRoute
              anyOf={[
                'audit.view',
              ]}
            >
              <AuditPage />
            </PermissionRoute>
          }
        />

        {/* =====================================================
            ADMINISTRATION
           ===================================================== */}

        <Route
          path="users"
          element={
            <PermissionRoute
              anyOf={[
                'users.view',
              ]}
            >
              <UsersPage />
            </PermissionRoute>
          }
        />

        <Route
          path="roles"
          element={
            <PermissionRoute
              anyOf={[
                'roles.view',
              ]}
            >
              <RolesPage />
            </PermissionRoute>
          }
        />

        <Route
          path="settings"
          element={
            <PermissionRoute
              anyOf={[
                'settings.view',
              ]}
            >
              <SettingsPage />
            </PermissionRoute>
          }
        />
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