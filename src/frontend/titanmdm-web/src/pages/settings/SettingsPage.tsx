import { ArrowRight, CloudCog, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function SettingsPage() {
  const { hasPermission } = useAuth()

  const canManageEntra =
    hasPermission('settings.manage') ||
    hasPermission('helpdesk.manage')

  return (
    <main className="titan-page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <header
        style={{
          padding: 28,
          borderRadius: 20,
          border: '1px solid #dfe6f3',
          background: 'linear-gradient(115deg, #fff, #f0f3ff)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: '#5364e9',
            fontWeight: 800,
            fontSize: 12,
            textTransform: 'uppercase',
          }}
        >
          <Settings size={16} />
          Administración
        </span>

        <h1 style={{ margin: '12px 0 6px' }}>
          Configuración
        </h1>
        <p style={{ margin: 0, color: '#64748b' }}>
          Integraciones y parámetros administrativos de TitanMDM.
        </p>
      </header>

      <section
        style={{
          marginTop: 20,
          padding: 26,
          borderRadius: 20,
          border: '1px solid #dfe6f3',
          background: '#fff',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Integraciones</h2>

        {canManageEntra && (
          <Link
            to="/helpdesk/entra?workspace=administration"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              maxWidth: 560,
              minHeight: 96,
              padding: 18,
              border: '1px solid #dce4f7',
              borderRadius: 15,
              background: '#f8faff',
              color: '#17233b',
              textDecoration: 'none',
            }}
          >
            <CloudCog size={26} color="#5364e9" />

            <span style={{ display: 'grid', gap: 5, flex: 1 }}>
              <strong>Microsoft Entra ID</strong>
              <small style={{ color: '#64748b', lineHeight: 1.5 }}>
                Sincronización del directorio y acceso individual
                a TitanMDM.
              </small>
            </span>

            <ArrowRight size={18} color="#5364e9" />
          </Link>
        )}
      </section>
    </main>
  )
}