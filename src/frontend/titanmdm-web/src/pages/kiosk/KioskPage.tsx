import {
  AppWindow,
  CheckCircle2,
  LockKeyhole,
  MonitorSmartphone,
  PackagePlus,
  PanelsTopLeft,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  kioskApi,
  type KioskApplication,
  type KioskMode,
} from '../../api/kioskApi'

import type {
  Policy,
} from '../../api/policiesApi'

import './KioskPage.css'

const initialApps:
  KioskApplication[] = []

export function KioskPage() {
  const [profiles, setProfiles] =
    useState<Policy[]>([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [message, setMessage] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  const [name, setName] =
    useState('')

  const [description, setDescription] =
    useState('')

  const [mode, setMode] =
    useState<KioskMode>(
      'singleApp',
    )

  const [applications, setApplications] =
    useState<KioskApplication[]>(
      initialApps,
    )

  const [packageName, setPackageName] =
    useState('')

  const [displayName, setDisplayName] =
    useState('')

  const [screenCaptureDisabled,
    setScreenCaptureDisabled] =
    useState(true)

  const [cameraDisabled,
    setCameraDisabled] =
    useState(false)

  const [bluetoothDisabled,
    setBluetoothDisabled] =
    useState(false)

  const [usbDisabled,
    setUsbDisabled] =
    useState(true)

  const load =
    useCallback(async () => {
      try {
        setLoading(true)
        setError(null)

        setProfiles(
          await kioskApi.getProfiles(),
        )
      } catch {
        setError(
          'No fue posible cargar los perfiles Kiosk.',
        )
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    void load()
  }, [load])

  function addApplication() {
    const cleanPackage =
      packageName.trim()

    if (!cleanPackage) {
      setError(
        'Escribe el package name de la aplicación.',
      )
      return
    }

    if (
      applications.some(
        (application) =>
          application.packageName ===
          cleanPackage,
      )
    ) {
      setError(
        'La aplicación ya está incluida.',
      )
      return
    }

    const newApplication:
      KioskApplication = {
        packageName:
          cleanPackage,

        displayName:
          displayName.trim() ||
          cleanPackage,

        installType:
          'FORCE_INSTALLED',

        defaultApp:
          applications.length === 0,
      }

    setApplications(
      (current) => [
        ...current,
        newApplication,
      ],
    )

    setPackageName('')
    setDisplayName('')
    setError(null)
  }

  function removeApplication(
    packageToRemove: string,
  ) {
    const remaining =
      applications.filter(
        (application) =>
          application.packageName !==
          packageToRemove,
      )

    if (
      remaining.length > 0 &&
      !remaining.some(
        (application) =>
          application.defaultApp,
      )
    ) {
      remaining[0] = {
        ...remaining[0],
        defaultApp: true,
      }
    }

    setApplications(remaining)
  }

  function setDefaultApplication(
    packageValue: string,
  ) {
    setApplications(
      applications.map(
        (application) => ({
          ...application,
          defaultApp:
            application.packageName ===
            packageValue,
        }),
      ),
    )
  }

  async function createProfile() {
    if (!name.trim()) {
      setError(
        'El perfil necesita un nombre.',
      )
      return
    }

    if (
      applications.length === 0
    ) {
      setError(
        'Agrega al menos una aplicación.',
      )
      return
    }

    if (
      mode === 'singleApp' &&
      applications.length !== 1
    ) {
      setError(
        'Single App Kiosk debe contener exactamente una aplicación.',
      )
      return
    }

    try {
      setSaving(true)
      setError(null)
      setMessage(null)

      const created =
        await kioskApi.createProfile({
          name: name.trim(),

          description:
            description.trim() ||
            undefined,

          configuration: {
            titanProfileType:
              'kiosk',

            kioskMode:
              mode,

            applications,

            systemNavigation: {
              homeButton: false,
              overviewButton: false,
              statusBar: false,
              notifications: false,
            },

            deviceRestrictions: {
              factoryResetDisabled:
                true,

              safeBootDisabled:
                true,

              screenCaptureDisabled,

              usbFileTransferDisabled:
                usbDisabled,

              outgoingCallsDisabled:
                true,

              smsDisabled:
                true,

              bluetoothDisabled,

              cameraDisabled,
            },

            display: {
              screenTimeoutSeconds:
                300,

              stayOnWhilePluggedIn:
                true,
            },
          },
        })

      await kioskApi
        .activateAndPublish(
          created.id,
        )

      setMessage(
        'Perfil Kiosk creado, activado y enviado al motor Android Enterprise.',
      )

      setName('')
      setDescription('')
      setApplications([])

      await load()
    } catch {
      setError(
        'No fue posible crear/publicar el perfil Kiosk.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="kiosk-page">
      <header className="kiosk-header">
        <div>
          <span className="kiosk-eyebrow">
            ANDROID ENTERPRISE
          </span>

          <h1>
            Kiosk & Dedicated Devices
          </h1>

          <p>
            Configura dispositivos
            corporativos para uso
            dedicado Single-App o
            Multi-App.
          </p>
        </div>

        <button
          type="button"
          className="kiosk-secondary"
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </header>

      {message && (
        <div className="kiosk-message success">
          {message}
        </div>
      )}

      {error && (
        <div className="kiosk-message error">
          {error}
        </div>
      )}

      <section className="kiosk-summary">
        <Summary
          icon={
            <PanelsTopLeft
              size={20}
            />
          }
          label="Perfiles Kiosk"
          value={profiles.length}
        />

        <Summary
          icon={
            <LockKeyhole
              size={20}
            />
          }
          label="Modo"
          value="Enterprise"
        />

        <Summary
          icon={
            <ShieldCheck
              size={20}
            />
          }
          label="Control"
          value="Android Policy"
        />

        <Summary
          icon={
            <MonitorSmartphone
              size={20}
            />
          }
          label="Tipo"
          value="Dedicated"
        />
      </section>

      <div className="kiosk-layout">
        <section className="kiosk-editor">
          <div className="kiosk-section-title">
            <div>
              <Plus size={18} />
              <strong>
                Nuevo perfil
              </strong>
            </div>

            <span>
              Política especializada
              para Android Enterprise
            </span>
          </div>

          <label>
            Nombre
            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              placeholder="Kiosk Recepción"
            />
          </label>

          <label>
            Descripción
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Dispositivos dedicados de recepción"
            />
          </label>

          <div className="kiosk-mode-grid">
            <button
              type="button"
              className={
                mode === 'singleApp'
                  ? 'kiosk-mode selected'
                  : 'kiosk-mode'
              }
              onClick={() => {
                setMode('singleApp')

                if (
                  applications.length > 1
                ) {
                  setApplications([
                    applications[0],
                  ])
                }
              }}
            >
              <AppWindow size={22} />
              <strong>
                Single App
              </strong>
              <span>
                Una aplicación ocupa
                todo el dispositivo.
              </span>
            </button>

            <button
              type="button"
              className={
                mode === 'multiApp'
                  ? 'kiosk-mode selected'
                  : 'kiosk-mode'
              }
              onClick={() =>
                setMode('multiApp')
              }
            >
              <PanelsTopLeft
                size={22}
              />
              <strong>
                Multi App
              </strong>
              <span>
                Launcher dedicado con
                aplicaciones autorizadas.
              </span>
            </button>
          </div>

          <div className="kiosk-app-builder">
            <h3>
              Aplicaciones permitidas
            </h3>

            <div className="kiosk-app-inputs">
              <input
                value={displayName}
                onChange={(event) =>
                  setDisplayName(
                    event.target.value,
                  )
                }
                placeholder="Nombre visible"
              />

              <input
                value={packageName}
                onChange={(event) =>
                  setPackageName(
                    event.target.value,
                  )
                }
                placeholder="com.empresa.app"
              />

              <button
                type="button"
                onClick={
                  addApplication
                }
              >
                <PackagePlus
                  size={16}
                />
                Agregar
              </button>
            </div>

            {applications.map(
              (application) => (
                <div
                  className="kiosk-app-row"
                  key={
                    application.packageName
                  }
                >
                  <div>
                    <strong>
                      {
                        application.displayName
                      }
                    </strong>
                    <span>
                      {
                        application.packageName
                      }
                    </span>
                  </div>

                  <label>
                    <input
                      type="radio"
                      name="defaultKioskApp"
                      checked={
                        application.defaultApp
                      }
                      onChange={() =>
                        setDefaultApplication(
                          application.packageName,
                        )
                      }
                    />
                    Principal
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      removeApplication(
                        application.packageName,
                      )
                    }
                  >
                    <Trash2
                      size={15}
                    />
                  </button>
                </div>
              ),
            )}
          </div>

          <div className="kiosk-restrictions">
            <h3>
              Restricciones
            </h3>

            <Toggle
              label="Bloquear capturas de pantalla"
              checked={
                screenCaptureDisabled
              }
              onChange={
                setScreenCaptureDisabled
              }
            />

            <Toggle
              label="Bloquear transferencia USB"
              checked={usbDisabled}
              onChange={setUsbDisabled}
            />

            <Toggle
              label="Deshabilitar cámara"
              checked={cameraDisabled}
              onChange={setCameraDisabled}
            />

            <Toggle
              label="Deshabilitar Bluetooth"
              checked={
                bluetoothDisabled
              }
              onChange={
                setBluetoothDisabled
              }
            />
          </div>

          <button
            type="button"
            className="kiosk-create"
            disabled={saving}
            onClick={() =>
              void createProfile()
            }
          >
            <Rocket size={17} />
            {saving
              ? 'Publicando...'
              : 'Crear y publicar perfil'}
          </button>
        </section>

        <section className="kiosk-profiles">
          <div className="kiosk-section-title">
            <div>
              <PanelsTopLeft
                size={18}
              />
              <strong>
                Perfiles existentes
              </strong>
            </div>
          </div>

          {loading ? (
            <div className="kiosk-empty">
              Cargando...
            </div>
          ) : profiles.length === 0 ? (
            <div className="kiosk-empty">
              No existen perfiles
              Kiosk.
            </div>
          ) : (
            profiles.map(
              (profile) => (
                <article
                  className="kiosk-profile"
                  key={profile.id}
                >
                  <div className="kiosk-profile-icon">
                    <PanelsTopLeft
                      size={20}
                    />
                  </div>

                  <div>
                    <strong>
                      {profile.name}
                    </strong>

                    <span>
                      {profile.description ??
                        'Sin descripción'}
                    </span>

                    <small>
                      Versión{' '}
                      {
                        profile.currentVersion
                      }
                      {' · '}
                      {
                        profile.assignedDevices
                      }{' '}
                      dispositivos
                    </small>
                  </div>

                  <div className="kiosk-profile-status">
                    <CheckCircle2
                      size={14}
                    />
                    {profile.status}
                  </div>
                </article>
              ),
            )
          )}
        </section>
      </div>
    </div>
  )
}

function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <article className="kiosk-summary-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="kiosk-toggle">
      <span>{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />
    </label>
  )
}