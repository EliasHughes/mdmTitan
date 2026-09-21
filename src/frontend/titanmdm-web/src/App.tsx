import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'

import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

import { DevicesPage } from './pages/devices/DevicesPage'
import EnrollmentPage from './pages/enrollment/EnrollmentPage'
import { PoliciesPage } from './pages/policies/PoliciesPage'
import { AppsPage } from './pages/apps/AppsPage'
import { SecurityPage } from './pages/security/SecurityPage'
import { CompliancePage } from './pages/compliance/CompliancePage'
import { KioskPage } from './pages/kiosk/KioskPage'
import { GeofencingPage } from './pages/geofencing/GeofencingPage'
import { RemotePage } from './pages/remote/RemotePage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { AuditPage } from './pages/audit/AuditPage'
import { UsersPage } from './pages/users/UsersPage'
import { RolesPage } from './pages/roles/RolesPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { DeviceDetailPage } from './pages/devices/DeviceDetailPage'
import { PolicyEditorPage } from './pages/policies/PolicyEditorPage'
import { DeviceGroupsPage } from './pages/groups/DeviceGroupsPage'



function App() {
  return (
    <Routes>
      {/* =========================================================
          PUBLIC ROUTES
         ========================================================= */}

      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* =========================================================
          PROTECTED TITANMDM CONSOLE
         ========================================================= */}

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route
          index
          element={<DashboardPage />}
        />

          <Route
          path="devices/:deviceId"
          element={<DeviceDetailPage />}
        />

        {/* Device Management */}
        <Route
          path="devices"
          element={<DevicesPage />}
        />

        <Route
          path="enrollment"
          element={<EnrollmentPage />}
        />

        {/* Configuration */}
        <Route
          path="policies"
          element={<PoliciesPage />}
        />

        <Route
          path="policies/new"
          element={<PolicyEditorPage />}
        />

        <Route
          path="policies/:policyId"
          element={<PolicyEditorPage />}
        />

        <Route
          path="groups"
          element={<DeviceGroupsPage />}
        />

        <Route
          path="apps"
          element={<AppsPage />}
        />

        {/* Security */}
        <Route
          path="security"
          element={<SecurityPage />}
        />

        <Route
          path="compliance"
          element={<CompliancePage />}
        />

        {/* Advanced MDM */}
        <Route
          path="kiosk"
          element={<KioskPage />}
        />

        <Route
          path="geofencing"
          element={<GeofencingPage />}
        />

        <Route
          path="remote"
          element={<RemotePage />}
        />

        {/* Reporting */}
        <Route
          path="reports"
          element={<ReportsPage />}
        />

        <Route
          path="audit"
          element={<AuditPage />}
        />

        {/* Administration */}
        <Route
          path="users"
          element={<UsersPage />}
        />

        <Route
          path="roles"
          element={<RolesPage />}
        />

        <Route
          path="settings"
          element={<SettingsPage />}
        />
      </Route>

      {/* =========================================================
          UNKNOWN ROUTES
         ========================================================= */}

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