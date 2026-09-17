import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false)

  return (
    <div
      className={
        sidebarCollapsed
          ? 'application-shell sidebar-is-collapsed'
          : 'application-shell'
      }
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() =>
          setSidebarCollapsed((value) => !value)
        }
      />

      <div className="application-main">
        <Header />

        <main className="application-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}