import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

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

  const ponches =
    location.pathname === '/ponches' ||
    location.pathname.startsWith('/ponches/')

  // Sustituye el acceso provisional de Ponches por su
  // permiso propio, aunque App.tsx conserve settings.view.
  const any = ponches
    ? ['workspace.ponches.view', 'ponches.manage']
    : anyOf

  const all = allOf

  const hasAny =
    any.length === 0 ||
    any.some(hasPermission)

  const hasAll = all.every(hasPermission)

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