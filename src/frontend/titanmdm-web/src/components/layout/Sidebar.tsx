import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '../../auth/AuthContext'
import { navigationItems } from '../../config/navigation'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({
  collapsed,
  onToggle,
}: SidebarProps) {
  const { hasPermission } = useAuth()

  const allowedItems = navigationItems.filter((item) =>
    hasPermission(item.permission),
  )

  return (
    <aside
      className={
        collapsed
          ? 'sidebar sidebar--collapsed'
          : 'sidebar'
      }
    >
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">
          T
        </div>

        {!collapsed && (
          <div className="sidebar__brand-text">
            <strong>TitanMDM</strong>
            <span>Enterprise</span>
          </div>
        )}

        <button
          type="button"
          className="sidebar__collapse"
          onClick={onToggle}
          aria-label={
            collapsed
              ? 'Expandir menú'
              : 'Contraer menú'
          }
          title={
            collapsed
              ? 'Expandir menú'
              : 'Contraer menú'
          }
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>

      <div className="sidebar__section-title">
        {!collapsed && 'Administración'}
      </div>

      <nav className="sidebar__nav">
        {allowedItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={
                collapsed
                  ? item.label
                  : undefined
              }
              className={({ isActive }) =>
                isActive
                  ? 'sidebar__link sidebar__link--active'
                  : 'sidebar__link'
              }
            >
              <Icon size={19} />

              {!collapsed && (
                <span>{item.label}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__security">
          <ShieldCheck size={18} />

          {!collapsed && (
            <div>
              <strong>Sistema protegido</strong>
              <span>TitanMDM Security</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}