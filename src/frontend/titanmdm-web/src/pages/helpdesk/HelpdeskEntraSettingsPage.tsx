
import { useEffect, useState } from 'react'
import { CloudCog, RefreshCw } from 'lucide-react'
import { TitanPageHeader } from '../../components/ui/TitanPageHeader'
import {
  helpdeskApi,
  type EntraDirectoryUser,
  type EntraIdSettings,
} from '../../api/helpdeskApi'
import './HelpdeskPages.css'

export function HelpdeskEntraSettingsPage() {
  const [settings, setSettings] = useState<EntraIdSettings | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [allowedGroupIds, setAllowedGroupIds] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)
  const [syncRequestersOnly, setSyncRequestersOnly] = useState(true)
  const [users, setUsers] = useState<EntraDirectoryUser[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const current = await helpdeskApi.getEntraSettings()
      setSettings(current)
      setTenantId(current.tenantId ?? '')
      setClientId(current.clientId ?? '')
      setAllowedGroupIds(current.allowedGroupIds ?? '')
      setIsEnabled(current.isEnabled)
      setSyncRequestersOnly(current.syncRequestersOnly)
      setUsers(await helpdeskApi.searchEntraUsers())
    } catch {
      setError('Solo un administrador Titan puede configurar Entra ID.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save() {
    setError(null)
    try {
      const saved = await helpdeskApi.saveEntraSettings({
        isEnabled,
        tenantId,
        clientId,
        clientSecret: clientSecret || undefined,
        allowedGroupIds,
        syncRequestersOnly,
      })
      setSettings(saved)
      setClientSecret('')
      setMessage('Configuración Entra ID guardada. Los administradores de Titan no cambian.')
    } catch {
      setError('No se pudo guardar Entra ID.')
    }
  }

  async function sync() {
    setError(null)
    try {
      const result = await helpdeskApi.syncEntra()
      setMessage(`Sincronización lista. Importados ${result.imported}, actualizados ${result.updated}, vinculados a usuarios Titan ${result.linkedToExistingUsers}.`)
      setUsers(await helpdeskApi.searchEntraUsers())
      const current = await helpdeskApi.getEntraSettings()
      setSettings(current)
    } catch {
      setError('Fallo la sincronización. Revisa Tenant, Client y permisos Graph User.Read.All.')
    }
  }

  return (
    <div className="titan-page helpdesk-page">
      <TitanPageHeader
        eyebrow="Directorio empresarial"
        title="Entra ID"
        description="Conecta el tenant de la empresa para importar solicitantes. No se crean admins nuevos: el RBAC sigue en SuperAdmin / roles actuales de Titan."
        icon={<CloudCog size={16} />}
      />

      <section className="titan-section-card helpdesk-entra-form">
        <label>
          Tenant ID
          <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
        </label>
        <label>
          Application (client) ID
          <input value={clientId} onChange={(event) => setClientId(event.target.value)} />
        </label>
        <label>
          Client secret
          <input
            type="password"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder={settings?.hasClientSecret ? 'Secret ya configurado' : 'Nuevo secret'}
          />
        </label>
        <label>
          Object IDs de grupos permitidos (opcional, separados por coma)
          <input
            value={allowedGroupIds}
            onChange={(event) => setAllowedGroupIds(event.target.value)}
          />
        </label>
        <label className="helpdesk-check">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          Habilitar Entra ID
        </label>
        <label className="helpdesk-check">
          <input
            type="checkbox"
            checked={syncRequestersOnly}
            onChange={(event) => setSyncRequestersOnly(event.target.checked)}
          />
          Sincronizar solo como solicitantes (recomendado)
        </label>
        <div className="helpdesk-create__row">
          <button className="titan-button" onClick={() => void save()}>
            Guardar
          </button>
          <button className="titan-button titan-button--ghost" onClick={() => void sync()}>
            <RefreshCw size={16} />
            Sincronizar directorio
          </button>
        </div>
        {settings?.lastSyncStatus && (
          <p>Última sync: {settings.lastSyncStatus}</p>
        )}
      </section>

      {message && <div className="helpdesk-ok">{message}</div>}
      {error && <div className="helpdesk-error">{error}</div>}

      <section className="titan-section-card">
        <h2>Usuarios empresariales sincronizados</h2>
        <table className="helpdesk-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>UPN</th>
              <th>Correo</th>
              <th>Departamento</th>
              <th>Vinculado a Titan</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.displayName}</td>
                <td>{item.userPrincipalName}</td>
                <td>{item.mail ?? '—'}</td>
                <td>{item.department ?? '—'}</td>
                <td>{item.linkedTitanUserId ? 'Sí (usuario actual)' : 'Solo solicitante'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
