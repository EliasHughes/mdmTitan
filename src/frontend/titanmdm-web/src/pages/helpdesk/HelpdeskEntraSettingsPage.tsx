import { useEffect, useState } from 'react'
import { CloudCog, RefreshCw, Search, UserPlus } from 'lucide-react'
import { TitanPageHeader } from '../../components/ui/TitanPageHeader'
import {
  helpdeskApi,
  type EntraDirectoryUser,
  type EntraIdSettings,
} from '../../api/helpdeskApi'
import { rolesApi, type RoleListItem } from '../../api/rolesApi'
import { usersApi } from '../../api/usersApi'
import { useAuth } from '../../auth/AuthContext'
import './HelpdeskPages.css'

type ProvisionForm = {
  directoryUser: EntraDirectoryUser
  firstName: string
  lastName: string
  email: string
  roleId: string
  password: string
  confirmPassword: string
}

function nameParts(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)

  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = error.response as {
      data?: { message?: string }
    }

    if (response?.data?.message) {
      return response.data.message
    }
  }

  return fallback
}

export function HelpdeskEntraSettingsPage() {
  const { hasPermission } = useAuth()
  const canCreateUsers = hasPermission('users.manage')

  const [settings, setSettings] = useState<EntraIdSettings | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [allowedGroupIds, setAllowedGroupIds] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)
  const [syncRequestersOnly, setSyncRequestersOnly] = useState(true)

  const [users, setUsers] = useState<EntraDirectoryUser[]>([])
  const [roles, setRoles] = useState<RoleListItem[]>([])
  const [search, setSearch] = useState('')
  const [provisionForm, setProvisionForm] = useState<ProvisionForm | null>(null)

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadDirectory(searchTerm = '') {
    setUsers(await helpdeskApi.searchEntraUsers(searchTerm))
  }

  async function load() {
    setError(null)

    try {
      const current = await helpdeskApi.getEntraSettings()

      setSettings(current)
      setTenantId(current.tenantId ?? '')
      setClientId(current.clientId ?? '')
      setAllowedGroupIds(current.allowedGroupIds ?? '')
      setIsEnabled(current.isEnabled)
      setSyncRequestersOnly(current.syncRequestersOnly)

      await loadDirectory()

      if (canCreateUsers) {
        const availableRoles = await rolesApi.getRoles(true)

        setRoles(
          availableRoles.filter(
            (role) => role.isActive && !role.isSystemRole,
          ),
        )
      }
    } catch (loadError) {
      setError(
        getErrorMessage(
          loadError,
          'No se pudo cargar la configuración de Entra ID.',
        ),
      )
    }
  }

  useEffect(() => {
    void load()
    // Carga inicial con los permisos actuales de la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (busy) return

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const saved = await helpdeskApi.saveEntraSettings({
        isEnabled,
        tenantId: tenantId.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret || undefined,
        allowedGroupIds: allowedGroupIds.trim(),
        syncRequestersOnly,
      })

      setSettings(saved)
      setClientSecret('')
      setMessage('Configuración de Entra ID guardada.')
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          'No se pudo guardar la configuración de Entra ID.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    if (busy) return

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const result = await helpdeskApi.syncEntra()

      await loadDirectory(search.trim())
      setSettings(await helpdeskApi.getEntraSettings())

      setMessage(
        `Sincronización completada: ${result.imported} importados, ` +
          `${result.updated} actualizados y ` +
          `${result.linkedToExistingUsers} vinculados a TitanMDM.`,
      )
    } catch (syncError) {
      setError(
        getErrorMessage(
          syncError,
          'No se pudo sincronizar el directorio. Revisa la configuración y los permisos de Graph.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  async function searchUsers() {
    if (busy) return

    setBusy(true)
    setError(null)

    try {
      await loadDirectory(search.trim())
    } catch (searchError) {
      setError(
        getErrorMessage(
          searchError,
          'No se pudo consultar el directorio.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  function selectUser(directoryUser: EntraDirectoryUser) {
    if (!canCreateUsers || directoryUser.linkedTitanUserId) return

    const names = nameParts(directoryUser.displayName)

    setProvisionForm({
      directoryUser,
      firstName: names.firstName,
      lastName: names.lastName,
      email: directoryUser.mail || directoryUser.userPrincipalName,
      roleId: '',
      password: '',
      confirmPassword: '',
    })

    setError(null)
    setMessage(null)
  }

  async function createSelectedUser() {
    if (!provisionForm || busy || !canCreateUsers) return

    const firstName = provisionForm.firstName.trim()
    const lastName = provisionForm.lastName.trim()
    const email = provisionForm.email.trim().toLowerCase()

    if (!firstName || !lastName || !email) {
      setError('Nombre, apellido y correo son obligatorios.')
      return
    }

    if (!provisionForm.roleId) {
      setError('Selecciona el rol que tendrá esta persona en TitanMDM.')
      return
    }

    if (!roles.some((role) => role.id === provisionForm.roleId)) {
      setError('El rol seleccionado no está disponible.')
      return
    }

    if (provisionForm.password.length < 12) {
      setError('La contraseña inicial debe tener al menos 12 caracteres.')
      return
    }

    if (provisionForm.password !== provisionForm.confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      await usersApi.createUser({
        firstName,
        lastName,
        email,
        password: provisionForm.password,
        jobTitle: provisionForm.directoryUser.jobTitle ?? null,
        departmentId: null,
        mfaEnabled: false,
        roleIds: [provisionForm.roleId],
      })

      setProvisionForm(null)

      // El servicio de sincronización vincula la nueva cuenta
      // por correo o UPN; crear la cuenta no concede acceso a
      // ninguna otra persona del directorio.
      try {
        await helpdeskApi.syncEntra()
        await loadDirectory(search.trim())
        setSettings(await helpdeskApi.getEntraSettings())

        setMessage(
          `Cuenta creada y vinculada: ${email}. ` +
            'La persona puede acceder con su cuenta TitanMDM y el rol asignado.',
        )
      } catch {
        await loadDirectory(search.trim())

        setMessage(
          `La cuenta ${email} se creó con el rol elegido, ` +
            'pero no se pudo actualizar su vínculo con Entra. ' +
            'Usa «Sincronizar directorio» cuando Graph esté disponible.',
        )
      }
    } catch (createError) {
      setError(
        getErrorMessage(
          createError,
          'No se pudo crear la cuenta TitanMDM.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="titan-page helpdesk-page">
      <TitanPageHeader
        eyebrow="Directorio empresarial"
        title="Entra ID"
        description={
          'Sincroniza personas de César Iglesias y concede acceso ' +
          'a TitanMDM únicamente a quienes selecciones.'
        }
        icon={<CloudCog size={16} />}
      />

      <section className="titan-section-card helpdesk-entra-form">
        <h2>Conexión con Microsoft Graph</h2>

        <label>
          Tenant ID
          <input
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          />
        </label>

        <label>
          Application (client) ID
          <input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          />
        </label>

        <label>
          Client Secret
          <input
            type="password"
            autoComplete="new-password"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder={
              settings?.hasClientSecret
                ? 'Secreto configurado; escribe aquí para sustituirlo'
                : 'Introduce el secreto'
            }
          />
        </label>

        <label>
          Object IDs de grupos permitidos, separados por coma
          <input
            value={allowedGroupIds}
            onChange={(event) => setAllowedGroupIds(event.target.value)}
            placeholder="Opcional"
          />
        </label>

        <label className="helpdesk-check">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          Habilitar sincronización con Entra ID
        </label>

        <label className="helpdesk-check">
          <input
            type="checkbox"
            checked={syncRequestersOnly}
            onChange={(event) =>
              setSyncRequestersOnly(event.target.checked)
            }
          />
          Guardar la preferencia «solo solicitantes»
        </label>

        <p>
          La sincronización importa registros del directorio.
          Esta preferencia no asigna roles ni crea cuentas TitanMDM.
        </p>

        <div className="helpdesk-create__row">
          <button
            type="button"
            className="titan-button"
            disabled={busy}
            onClick={() => void save()}
          >
            Guardar configuración
          </button>

          <button
            type="button"
            className="titan-button titan-button--ghost"
            disabled={busy || !settings?.isEnabled}
            onClick={() => void sync()}
          >
            <RefreshCw size={16} />
            Sincronizar directorio
          </button>
        </div>

        {settings?.lastSyncStatus && (
          <p>Última sincronización: {settings.lastSyncStatus}</p>
        )}
      </section>

      {message && (
        <div className="helpdesk-ok" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="helpdesk-error" role="alert">
          {error}
        </div>
      )}

      <section className="titan-section-card">
        <h2>Personas sincronizadas</h2>
        <p>
          Busca una persona y asígnale un rol solo si debe utilizar TitanMDM.
          El inicio de sesión con Microsoft aún no está habilitado.
        </p>

        <div className="helpdesk-create__row">
          <input
            aria-label="Buscar persona sincronizada"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void searchUsers()
            }}
            placeholder="Nombre, correo o UPN"
          />

          <button
            type="button"
            className="titan-button titan-button--ghost"
            disabled={busy}
            onClick={() => void searchUsers()}
          >
            <Search size={16} />
            Buscar
          </button>
        </div>

        <table className="helpdesk-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>UPN</th>
              <th>Correo</th>
              <th>Departamento</th>
              <th>Acceso a TitanMDM</th>
              {canCreateUsers && <th>Acción</th>}
            </tr>
          </thead>

          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.displayName}</td>
                <td>{item.userPrincipalName}</td>
                <td>{item.mail ?? '—'}</td>
                <td>{item.department ?? '—'}</td>
                <td>
                  {item.linkedTitanUserId
                    ? 'Cuenta Titan vinculada'
                    : 'Sin cuenta Titan vinculada'}
                </td>

                {canCreateUsers && (
                  <td>
                    {!item.linkedTitanUserId && (
                      <button
                        type="button"
                        className="titan-button titan-button--ghost"
                        disabled={busy}
                        onClick={() => selectUser(item)}
                      >
                        <UserPlus size={16} />
                        Crear acceso
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={canCreateUsers ? 6 : 5}>
                  No hay personas para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {provisionForm && canCreateUsers && (
        <section className="titan-section-card helpdesk-entra-form">
          <h2>Crear acceso individual</h2>
          <p>
            Persona seleccionada: {provisionForm.directoryUser.displayName}.
            Confirma sus datos y el rol antes de crear la cuenta.
          </p>

          <label>
            Nombre
            <input
              value={provisionForm.firstName}
              onChange={(event) =>
                setProvisionForm({
                  ...provisionForm,
                  firstName: event.target.value,
                })
              }
            />
          </label>

          <label>
            Apellido
            <input
              value={provisionForm.lastName}
              onChange={(event) =>
                setProvisionForm({
                  ...provisionForm,
                  lastName: event.target.value,
                })
              }
            />
          </label>

          <label>
            Correo de acceso
            <input
              type="email"
              value={provisionForm.email}
              onChange={(event) =>
                setProvisionForm({
                  ...provisionForm,
                  email: event.target.value,
                })
              }
            />
          </label>

          <label>
            Rol en TitanMDM
            <select
              value={provisionForm.roleId}
              onChange={(event) =>
                setProvisionForm({
                  ...provisionForm,
                  roleId: event.target.value,
                })
              }
            >
              <option value="">Selecciona un rol</option>

              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>

          {roles.length === 0 && (
            <p>
              No hay roles no sistémicos disponibles. Crea primero
              los roles de solicitante y TIC en Administración → Roles.
            </p>
          )}

          <label>
            Contraseña inicial, mínimo 12 caracteres
            <input
              type="password"
              autoComplete="new-password"
              value={provisionForm.password}
              onChange={(event) =>
                setProvisionForm({
                  ...provisionForm,
                  password: event.target.value,
                })
              }
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={provisionForm.confirmPassword}
              onChange={(event) =>
                setProvisionForm({
                  ...provisionForm,
                  confirmPassword: event.target.value,
                })
              }
            />
          </label>

          <div className="helpdesk-create__row">
            <button
              type="button"
              className="titan-button"
              disabled={busy || roles.length === 0}
              onClick={() => void createSelectedUser()}
            >
              <UserPlus size={16} />
              Crear cuenta con este rol
            </button>

            <button
              type="button"
              className="titan-button titan-button--ghost"
              disabled={busy}
              onClick={() => setProvisionForm(null)}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
    </div>
  )
}