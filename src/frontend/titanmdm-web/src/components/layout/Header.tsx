import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'

export function Header() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`
      .toUpperCase()

  return (
    <header className="app-header">
      <div className="header-search">
        <Search size={18} />

        <input
          type="search"
          placeholder="Buscar dispositivos, usuarios, aplicaciones..."
        />

        <span>Ctrl + K</span>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="header-icon-button"
          aria-label="Notificaciones"
        >
          <Bell size={19} />
        </button>

        <div className="header-divider" />

        <div className="user-menu-container">
          <button
            type="button"
            className="user-menu-trigger"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <div className="user-avatar">
              {initials || 'T'}
            </div>

            <div className="user-menu-copy">
              <strong>
                {user?.firstName} {user?.lastName}
              </strong>

              <span>
                {user?.roles?.[0] ?? 'Usuario'}
              </span>
            </div>

            <ChevronDown size={16} />
          </button>

          {menuOpen && (
            <div className="user-dropdown">
              <div className="user-dropdown-info">
                <strong>
                  {user?.firstName} {user?.lastName}
                </strong>

                <span>{user?.email}</span>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
              >
                <LogOut size={17} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}