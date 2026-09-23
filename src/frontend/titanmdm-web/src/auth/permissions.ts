/*
 * ================================================================
 * TITANMDM PERMISSIONS
 * ================================================================
 *
 * Catálogo central de permisos utilizados por el frontend.
 *
 * Estos códigos deben coincidir exactamente con los permisos
 * definidos por TitanMdmSeeder en el backend.
 * ================================================================
 */

export const Permissions = {
  /*
   * ==============================================================
   * DASHBOARD
   * ==============================================================
   */

  dashboard: {
    view:
      'dashboard.view',

    globalView:
      'dashboard.global.view',
  },

  /*
   * ==============================================================
   * WORKSPACES
   * ==============================================================
   */

  workspace: {
    windows: {
      view:
        'workspace.windows.view',
    },

    android: {
      view:
        'workspace.android.view',
    },

    administration: {
      view:
        'workspace.administration.view',
    },
  },

  /*
   * ==============================================================
   * DEVICES
   * ==============================================================
   */

  devices: {
    view:
      'devices.view',

    create:
      'devices.create',

    update:
      'devices.update',

    delete:
      'devices.delete',

    commands:
      'devices.commands',
  },

  /*
   * ==============================================================
   * ENROLLMENT
   * ==============================================================
   */

  enrollment: {
    view:
      'enrollment.view',

    manage:
      'enrollment.manage',
  },

  /*
   * ==============================================================
   * POLICIES
   * ==============================================================
   */

  policies: {
    view:
      'policies.view',

    manage:
      'policies.manage',
  },

  /*
   * ==============================================================
   * APPLICATIONS
   * ==============================================================
   */

  applications: {
    view:
      'apps.view',

    manage:
      'apps.manage',
  },

  /*
   * ==============================================================
   * COMPLIANCE
   * ==============================================================
   */

  compliance: {
    view:
      'compliance.view',

    manage:
      'compliance.manage',
  },

  /*
   * ==============================================================
   * SECURITY
   * ==============================================================
   */

  security: {
    view:
      'security.view',

    manage:
      'security.manage',
  },

  /*
   * ==============================================================
   * KIOSK
   * ==============================================================
   */

  kiosk: {
    view:
      'kiosk.view',

    manage:
      'kiosk.manage',
  },

  /*
   * ==============================================================
   * GEOFENCING
   * ==============================================================
   */

  geofencing: {
    view:
      'geofencing.view',

    manage:
      'geofencing.manage',
  },

  /*
   * ==============================================================
   * REMOTE SUPPORT
   * ==============================================================
   */

  remote: {
    view:
      'remote.view',

    manage:
      'remote.manage',
  },

  /*
   * ==============================================================
   * REPORTS
   * ==============================================================
   */

  reports: {
    view:
      'reports.view',

    export:
      'reports.export',
  },

  /*
   * ==============================================================
   * USERS
   * ==============================================================
   */

  users: {
    view:
      'users.view',

    manage:
      'users.manage',
  },

  /*
   * ==============================================================
   * ROLES
   * ==============================================================
   */

  roles: {
    view:
      'roles.view',

    manage:
      'roles.manage',
  },

  /*
   * ==============================================================
   * AUDIT
   * ==============================================================
   */

  audit: {
    view:
      'audit.view',
  },

  /*
   * ==============================================================
   * SETTINGS
   * ==============================================================
   */

  settings: {
    view:
      'settings.view',

    manage:
      'settings.manage',
  },
} as const

/*
 * ================================================================
 * TYPE HELPERS
 * ================================================================
 */

export type PermissionCatalog =
  typeof Permissions