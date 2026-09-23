import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  useLocation,
} from 'react-router-dom'

import {
  getTitanModule,
  type TitanModuleDefinition,
  type TitanModuleId,
} from '../config/moduleRegistry'

/*
 * ================================================================
 * STORAGE
 * ================================================================
 */

const WORKSPACE_STORAGE_KEY =
  'titanmdm:active-workspace'

/*
 * ================================================================
 * CONTEXT CONTRACT
 * ================================================================
 */

interface WorkspaceContextValue {
  activeWorkspaceId:
    TitanModuleId | null

  activeModule:
    TitanModuleDefinition | null

  selectWorkspace: (
    workspaceId: TitanModuleId,
  ) => void

  clearWorkspace: () => void

  isWorkspace: (
    workspaceId: TitanModuleId,
  ) => boolean
}

const WorkspaceContext =
  createContext<
    WorkspaceContextValue | undefined
  >(undefined)

/*
 * ================================================================
 * HELPERS
 * ================================================================
 */

function readStoredWorkspace():
  TitanModuleId | null {
  try {
    const value =
      window.localStorage.getItem(
        WORKSPACE_STORAGE_KEY,
      )

    if (
      value === 'windows' ||
      value === 'android' ||
      value === 'helpdesk' ||
      value === 'administration'
    ) {
      return value
    }
  } catch {
    /*
     * El navegador podría bloquear localStorage.
     * TitanMDM seguirá funcionando sin persistencia.
     */
  }

  return null
}

function storeWorkspace(
  workspaceId: TitanModuleId,
): void {
  try {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      workspaceId,
    )
  } catch {
    // Persistencia opcional.
  }
}

function removeStoredWorkspace():
  void {
  try {
    window.localStorage.removeItem(
      WORKSPACE_STORAGE_KEY,
    )
  } catch {
    // Persistencia opcional.
  }
}

/*
 * ================================================================
 * URL RESOLUTION
 * ================================================================
 */

function getWorkspaceFromUrl(
  pathname: string,
  search: string,
):
  TitanModuleId | null {
  /*
   * El Launchpad no pertenece a ningún módulo.
   */
  if (
    pathname === '/'
  ) {
    return null
  }

  const params =
    new URLSearchParams(
      search,
    )

  const workspace =
    params.get(
      'workspace',
    )

  if (
    workspace === 'windows' ||
    workspace === 'android' ||
    workspace === 'helpdesk' ||
    workspace === 'administration'
  ) {
    return workspace
  }

  /*
   * Rutas administrativas poseen una identidad
   * suficientemente clara para resolverlas sin query.
   */
  if (
    pathname.startsWith(
      '/users',
    )
    ||
    pathname.startsWith(
      '/roles',
    )
    ||
    pathname.startsWith(
      '/settings',
    )
    ||
    pathname.startsWith(
      '/audit',
    )
  ) {
    return 'administration'
  }

  /*
   * Remote Support actual pertenece únicamente
   * al workspace Windows.
   */
  if (
    pathname.startsWith(
      '/remote',
    )
  ) {
    return 'windows'
  }

  /*
   * Kiosk y Geofencing actualmente son principalmente
   * funcionalidades Android.
   */
  if (
    pathname.startsWith(
      '/kiosk',
    )
    ||
    pathname.startsWith(
      '/geofencing',
    )
  ) {
    return 'android'
  }

  /*
   * Detectar plataforma en Devices.
   */
  if (
    pathname.startsWith(
      '/devices',
    )
  ) {
    const platform =
      params
        .get('platform')
        ?.toLowerCase()

    if (
      platform ===
      'windows'
    ) {
      return 'windows'
    }

    if (
      platform ===
      'android'
    ) {
      return 'android'
    }
  }

  return null
}

/*
 * ================================================================
 * CSS THEME
 * ================================================================
 */

function applyWorkspaceTheme(
  module:
    TitanModuleDefinition | null,
): void {
  const root =
    document.documentElement

  if (
    !module
  ) {
    root.style.setProperty(
      '--workspace-primary',
      '#4169e1',
    )

    root.style.setProperty(
      '--workspace-primary-dark',
      '#315edb',
    )

    root.style.setProperty(
      '--workspace-soft',
      '#edf2ff',
    )

    root.style.setProperty(
      '--workspace-border',
      '#dbe4ff',
    )

    root.dataset.workspace =
      'home'

    return
  }

  root.style.setProperty(
    '--workspace-primary',
    module.theme.primary,
  )

  root.style.setProperty(
    '--workspace-primary-dark',
    module.theme.primaryDark,
  )

  root.style.setProperty(
    '--workspace-soft',
    module.theme.soft,
  )

  root.style.setProperty(
    '--workspace-border',
    module.theme.border,
  )

  root.dataset.workspace =
    module.id
}

/*
 * ================================================================
 * PROVIDER
 * ================================================================
 */

interface WorkspaceProviderProps {
  children: ReactNode
}

export function WorkspaceProvider({
  children,
}: WorkspaceProviderProps) {
  const location =
    useLocation()

  const [
    activeWorkspaceId,
    setActiveWorkspaceId,
  ] =
    useState<
      TitanModuleId | null
    >(
      () =>
        readStoredWorkspace(),
    )

  /*
   * ============================================================
   * ROUTE SYNCHRONIZATION
   * ============================================================
   */

  useEffect(
    () => {
      if (
        location.pathname ===
        '/'
      ) {
        setActiveWorkspaceId(
          null,
        )

        applyWorkspaceTheme(
          null,
        )

        return
      }

      const resolved =
        getWorkspaceFromUrl(
          location.pathname,
          location.search,
        )

      if (
        resolved
      ) {
        setActiveWorkspaceId(
          resolved,
        )

        storeWorkspace(
          resolved,
        )

        return
      }

      /*
       * Si una pantalla compartida como /policies
       * no declara workspace, conservamos el último
       * seleccionado.
       */
      const stored =
        readStoredWorkspace()

      if (
        stored
      ) {
        setActiveWorkspaceId(
          stored,
        )
      }
    },
    [
      location.pathname,
      location.search,
    ],
  )

  /*
   * ============================================================
   * MODULE RESOLUTION
   * ============================================================
   */

  const activeModule =
    useMemo(
      () => {
        if (
          !activeWorkspaceId
        ) {
          return null
        }

        return (
          getTitanModule(
            activeWorkspaceId,
          )
          ??
          null
        )
      },
      [
        activeWorkspaceId,
      ],
    )

  /*
   * ============================================================
   * THEME APPLICATION
   * ============================================================
   */

  useEffect(
    () => {
      applyWorkspaceTheme(
        activeModule,
      )
    },
    [
      activeModule,
    ],
  )

  /*
   * ============================================================
   * ACTIONS
   * ============================================================
   */

  const selectWorkspace =
    useCallback(
      (
        workspaceId:
          TitanModuleId,
      ) => {
        setActiveWorkspaceId(
          workspaceId,
        )

        storeWorkspace(
          workspaceId,
        )
      },
      [],
    )

  const clearWorkspace =
    useCallback(
      () => {
        setActiveWorkspaceId(
          null,
        )

        removeStoredWorkspace()

        applyWorkspaceTheme(
          null,
        )
      },
      [],
    )

  const isWorkspace =
    useCallback(
      (
        workspaceId:
          TitanModuleId,
      ) =>
        activeWorkspaceId ===
        workspaceId,
      [
        activeWorkspaceId,
      ],
    )

  const value =
    useMemo<
      WorkspaceContextValue
    >(
      () => ({
        activeWorkspaceId,
        activeModule,
        selectWorkspace,
        clearWorkspace,
        isWorkspace,
      }),
      [
        activeWorkspaceId,
        activeModule,
        selectWorkspace,
        clearWorkspace,
        isWorkspace,
      ],
    )

  return (
    <WorkspaceContext.Provider
      value={
        value
      }
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

/*
 * ================================================================
 * HOOK
 * ================================================================
 */

export function useWorkspace():
  WorkspaceContextValue {
  const context =
    useContext(
      WorkspaceContext,
    )

  if (
    !context
  ) {
    throw new Error(
      'useWorkspace debe utilizarse dentro de WorkspaceProvider.',
    )
  }

  return context
}