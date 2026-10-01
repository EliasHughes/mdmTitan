import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'
import { canUseHelpdeskConsole } from './helpdeskAccess'

interface PermissionRouteProps {
  children: ReactNode
  anyOf?: string[]
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
  } = useAuth()

  const location = useLocation()

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading__logo">T</div>
        <div className="app-loading__spinner" />
        <p>Verificando autorización…</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search,
        }}
      />
    )
  }

  const helpdeskConsole =
    location.pathname === '/helpdesk' ||
    location.pathname.startsWith('/helpdesk/')

  if (
    helpdeskConsole &&
    !canUseHelpdeskConsole(hasPermission)
  ) {
    return (
      <Navigate
        to="/my-support?workspace=helpdesk"
        replace
      />
    )
  }

  const ponches =
    location.pathname === '/ponches' ||
    location.pathname.startsWith('/ponches/')

  const effectiveAnyOf = ponches
    ? ['workspace.ponches.view', 'ponches.manage']
    : anyOf

  const hasAny =
    effectiveAnyOf.length === 0 ||
    effectiveAnyOf.some(hasPermission)

  const hasAll = allOf.every(hasPermission)

  if (!hasAny || !hasAll) {
    return (
      <Navigate
        to="/forbidden"
        replace
        state={{
          from: location.pathname + location.search,
        }}
      />
    )
  }

  return <>{children}</>
}