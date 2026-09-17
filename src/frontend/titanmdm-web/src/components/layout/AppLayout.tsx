import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false)

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() =>
          setSidebarCollapsed((value) => !value)
        }
      />

      <div className="app-layout__main">
        <Header />

        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}