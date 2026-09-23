import type {
  ReactNode,
} from 'react'

import {
  Navigate,
  useLocation,
} from 'react-router-dom'

import {
  useAuth,
} from './AuthContext'

interface PermissionRouteProps {
  children: ReactNode

  /*
   * El usuario necesita como mínimo
   * uno de los permisos indicados.
   */
  anyOf?: string[]

  /*
   * El usuario debe poseer todos
   * los permisos indicados.
   */
  allOf?: string[]
}

export function PermissionRoute({
  children,
  anyOf = [],
  allOf = [],
}: PermissionRouteProps) {
  const {
    user,
    isAuthenticated,
    isLoading,
    hasPermission,
  } =
    useAuth()

  const location =
    useLocation()

  /*
   * ============================================================
   * SESSION RESTORE
   * ============================================================
   */

  if (
    isLoading
  ) {
    return (
      <div className="app-loading">
        <div className="app-loading__logo">
          T
        </div>

        <div className="app-loading__spinner" />

        <p>
          Verificando autorización...
        </p>
      </div>
    )
  }

  /*
   * ============================================================
   * AUTHENTICATION
   * ============================================================
   */

  if (
    !isAuthenticated ||
    !user
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            location.pathname
            +
            location.search,
        }}
      />
    )
  }

  /*
   * ============================================================
   * ANY-OF
   * ============================================================
   */

  const hasAnyPermission =
    anyOf.length ===
      0
      ||
      anyOf.some(
        permission =>
          hasPermission(
            permission,
          ),
      )

  /*
   * ============================================================
   * ALL-OF
   * ============================================================
   */

  const hasAllPermissions =
    allOf.every(
      permission =>
        hasPermission(
          permission,
        ),
    )

  /*
   * ============================================================
   * AUTHORIZATION
   * ============================================================
   */

  if (
    !hasAnyPermission ||
    !hasAllPermissions
  ) {
    return (
      <Navigate
        to="/forbidden"
        replace
        state={{
          from:
            location.pathname
            +
            location.search,
        }}
      />
    )
  }

  return (
    <>
      {children}
    </>
  )
}