import {
  useState,
} from 'react'

import {
  Outlet,
} from 'react-router-dom'

import {
  TitanAssistantProvider,
} from '../../assistant/context/TitanAssistantContext'

import {
  TitanAssistant,
} from '../../assistant/components/TitanAssistant'

import {
  WorkspaceProvider,
} from '../../workspace/WorkspaceContext'

import {
  Header,
} from './Header'

import {
  Sidebar,
} from './Sidebar'

export function AppLayout() {
  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] =
    useState(false)

  return (
    <WorkspaceProvider>
      <TitanAssistantProvider>
        <div className="app-layout">
          <Sidebar
            collapsed={
              sidebarCollapsed
            }
            onToggle={() =>
              setSidebarCollapsed(
                value =>
                  !value,
              )
            }
          />

          <div className="app-layout__main">
            <Header />

            <main className="app-layout__content">
              <Outlet />
            </main>
          </div>

          <TitanAssistant />
        </div>
      </TitanAssistantProvider>
    </WorkspaceProvider>
  )
}