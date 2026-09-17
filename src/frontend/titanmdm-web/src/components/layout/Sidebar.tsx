import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'
import { useAuth } from '../../auth/AuthContext'

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
          ? 'app-sidebar app-sidebar-collapsed'
          : 'app-sidebar'
      }
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          T
        </div>

        {!collapsed && (
          <div className="sidebar-brand-copy">
            <strong>TitanMDM</strong>
            <span>ENTERPRISE</span>
          </div>
        )}

        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={
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

      <div className="sidebar-section-label">
        {!collapsed && 'ADMINISTRACIÓN'}
      </div>

      <nav className="sidebar-navigation">
        {allowedItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                isActive
                  ? 'sidebar-link sidebar-link-active'
                  : 'sidebar-link'
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon size={19} />

              {!collapsed && (
                <span>{item.label}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-security">
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