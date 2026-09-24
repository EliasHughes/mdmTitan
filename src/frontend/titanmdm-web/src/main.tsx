import {
  StrictMode,
} from 'react'

import {
  createRoot,
} from 'react-dom/client'

import {
  BrowserRouter,
} from 'react-router-dom'

import App from './App'

import {
  AuthProvider,
} from './auth/AuthContext'

/*
 * ============================================================
 * TITANMDM GLOBAL DESIGN SYSTEM
 * ============================================================
 */

import './index.css'

/*
 * ============================================================
 * MODULE ROLLOUT LAYERS
 * ============================================================
 *
 * A:
 * Devices
 * Groups & Fleet
 * Enrollment
 * Policies
 *
 * B:
 * Apps
 * Security
 * Compliance
 * Kiosk
 *
 * C:
 * Geofencing
 * Automation
 * Remote Support
 * Reports
 *
 * D:
 * Audit
 * Users
 * Roles
 * Settings
 *
 * Estas hojas se cargan al final deliberadamente para que
 * actúen como capa visual sobre el CSS funcional legado.
 */

import './styles/titan-modules-a.css'
import './styles/titan-modules-b.css'
import './styles/titan-modules-c.css'
import './styles/titan-modules-d.css'

createRoot(
  document.getElementById(
    'root',
  )!,
).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)