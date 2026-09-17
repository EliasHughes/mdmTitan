import { useEffect } from 'react'

import {
  LogOut,
  ShieldCheck,
} from 'lucide-react'

import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const {
    user,
    logout,
  } = useAuth()

  useEffect(() => {
    document.title =
      'Dashboard | TitanMDM'
  }, [])

  const handleLogout =
    async () => {
      await logout()
    }

  return (
    <main className="temporary-dashboard">
      <header className="temporary-dashboard__header">
        <div className="brand">
          <div className="brand__mark">
            T
          </div>

          <div>
            <strong>
              TitanMDM
            </strong>

            <span>
              Enterprise
            </span>
          </div>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={() =>
            void handleLogout()
          }
        >
          <LogOut size={18} />

          Cerrar sesión
        </button>
      </header>

      <section className="temporary-dashboard__content">
        <div className="success-card">
          <div className="success-card__icon">
            <ShieldCheck size={34} />
          </div>

          <span className="eyebrow">
            AUTENTICACIÓN COMPLETADA
          </span>

          <h1>
            Bienvenido a TitanMDM
          </h1>

          <p>
            La consola ya está conectada
            al sistema real de
            autenticación.
          </p>

          <div className="user-information">
            <div>
              <span>Usuario</span>
              <strong>
                {user?.firstName}{' '}
                {user?.lastName}
              </strong>
            </div>

            <div>
              <span>Correo</span>
              <strong>
                {user?.email}
              </strong>
            </div>

            <div>
              <span>Rol</span>
              <strong>
                {user?.roles.join(
                  ', ',
                )}
              </strong>
            </div>

            <div>
              <span>Permisos</span>
              <strong>
                {user?.permissions
                  .length ?? 0}
              </strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}