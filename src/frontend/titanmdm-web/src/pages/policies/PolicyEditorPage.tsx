import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Laptop,
  LockKeyhole,
  Save,
  Shield,
  ShieldCheck,
  Smartphone,
  Usb,
  Wifi,
  XCircle,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  policiesApi,
  type PolicyPlatform,
} from '../../api/policiesApi'

import './PolicyEditorPage.css'

interface WindowsPolicyConfiguration {
  password: {
    enabled: boolean
    minimumLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumber: boolean
    requireSpecialCharacter: boolean
    maximumAgeDays: number
  }
  screenLock: {
    enabled: boolean
    timeoutMinutes: number
  }
  defender: {
    enabled: boolean
    realTimeProtection: boolean
    cloudProtection: boolean
  }
  firewall: {
    enabled: boolean
    domainProfile: boolean
    privateProfile: boolean
    publicProfile: boolean
  }
  usb: {
    blockRemovableStorage: boolean
  }
  windowsUpdate: {
    enabled: boolean
    automaticUpdates: boolean
    restartOutsideActiveHours: boolean
  }
}

interface AndroidPolicyConfiguration {
  password: {
    enabled: boolean
    minimumLength: number
    requireNumeric: boolean
    requireComplex: boolean
  }
  restrictions: {
    blockCamera: boolean
    blockScreenCapture: boolean
    blockUsbFileTransfer: boolean
    blockBluetooth: boolean
    blockUnknownSources: boolean
  }
  applications: {
    allowAppInstallation: boolean
    allowAppUninstallation: boolean
  }
  kiosk: {
    enabled: boolean
  }
}

interface PolicyConfiguration {
  schemaVersion: number
  windows: WindowsPolicyConfiguration
  android: AndroidPolicyConfiguration
}

const defaultConfiguration =
  (): PolicyConfiguration => ({
    schemaVersion: 1,

    windows: {
      password: {
        enabled: false,
        minimumLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialCharacter: false,
        maximumAgeDays: 90,
      },

      screenLock: {
        enabled: false,
        timeoutMinutes: 15,
      },

      defender: {
        enabled: false,
        realTimeProtection: true,
        cloudProtection: true,
      },

      firewall: {
        enabled: false,
        domainProfile: true,
        privateProfile: true,
        publicProfile: true,
      },

      usb: {
        blockRemovableStorage: false,
      },

      windowsUpdate: {
        enabled: false,
        automaticUpdates: true,
        restartOutsideActiveHours: true,
      },
    },

    android: {
      password: {
        enabled: false,
        minimumLength: 6,
        requireNumeric: true,
        requireComplex: false,
      },

      restrictions: {
        blockCamera: false,
        blockScreenCapture: false,
        blockUsbFileTransfer: false,
        blockBluetooth: false,
        blockUnknownSources: true,
      },

      applications: {
        allowAppInstallation: true,
        allowAppUninstallation: true,
      },

      kiosk: {
        enabled: false,
      },
    },
  })

function parseConfiguration(
  value: string,
): PolicyConfiguration {
  const defaults = defaultConfiguration()

  try {
    const parsed =
      JSON.parse(value) as Partial<PolicyConfiguration>

    return {
      schemaVersion:
        parsed.schemaVersion ?? 1,

      windows: {
        password: {
          ...defaults.windows.password,
          ...parsed.windows?.password,
        },

        screenLock: {
          ...defaults.windows.screenLock,
          ...parsed.windows?.screenLock,
        },

        defender: {
          ...defaults.windows.defender,
          ...parsed.windows?.defender,
        },

        firewall: {
          ...defaults.windows.firewall,
          ...parsed.windows?.firewall,
        },

        usb: {
          ...defaults.windows.usb,
          ...parsed.windows?.usb,
        },

        windowsUpdate: {
          ...defaults.windows.windowsUpdate,
          ...parsed.windows?.windowsUpdate,
        },
      },

      android: {
        password: {
          ...defaults.android.password,
          ...parsed.android?.password,
        },

        restrictions: {
          ...defaults.android.restrictions,
          ...parsed.android?.restrictions,
        },

        applications: {
          ...defaults.android.applications,
          ...parsed.android?.applications,
        },

        kiosk: {
          ...defaults.android.kiosk,
          ...parsed.android?.kiosk,
        },
      },
    }
  } catch {
    return defaults
  }
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response =
      (
        error as {
          response?: {
            data?: {
              message?: string
            }
          }
        }
      ).response

    if (response?.data?.message) {
      return response.data.message
    }
  }

  return 'No fue posible completar la operación.'
}

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      className={
        checked
          ? 'policy-toggle policy-toggle--active'
          : 'policy-toggle'
      }
      disabled={disabled}
      aria-pressed={checked}
      onClick={() =>
        onChange(!checked)
      }
    >
      <span />
    </button>
  )
}

export function PolicyEditorPage() {
  const navigate = useNavigate()

  const { policyId } =
    useParams<{ policyId: string }>()

  const editing =
    Boolean(policyId)

  const [name, setName] =
    useState('')

  const [description, setDescription] =
    useState('')

  const [platform, setPlatform] =
    useState<PolicyPlatform>('Windows')

  const [configuration, setConfiguration] =
    useState<PolicyConfiguration>(
      defaultConfiguration,
    )

  const [loading, setLoading] =
    useState(editing)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [message, setMessage] =
    useState<string | null>(null)

  const loadPolicy =
    useCallback(async () => {
      if (!policyId) {
        return
      }

      try {
        setLoading(true)
        setError(null)

        const policy =
          await policiesApi.getById(
            policyId,
          )

        setName(policy.name)

        setDescription(
          policy.description ?? '',
        )

        setPlatform(policy.platform)

        setConfiguration(
          parseConfiguration(
            policy.configurationJson,
          ),
        )
      } catch (loadError) {
        console.error(loadError)

        setError(
          getErrorMessage(loadError),
        )
      } finally {
        setLoading(false)
      }
    }, [policyId])

  useEffect(() => {
    void loadPolicy()
  }, [loadPolicy])

  useEffect(() => {
    document.title = editing
      ? 'Editar política | TitanMDM'
      : 'Nueva política | TitanMDM'
  }, [editing])

  const configurationJson =
    useMemo(
      () =>
        JSON.stringify(
          configuration,
          null,
          2,
        ),
      [configuration],
    )

  const updateWindows =
    <
      K extends keyof WindowsPolicyConfiguration,
    >(
      section: K,
      values: Partial<
        WindowsPolicyConfiguration[K]
      >,
    ) => {
      setConfiguration(
        (current) => ({
          ...current,

          windows: {
            ...current.windows,

            [section]: {
              ...current.windows[
                section
              ],

              ...values,
            },
          },
        }),
      )
    }

  const updateAndroid =
    <
      K extends keyof AndroidPolicyConfiguration,
    >(
      section: K,
      values: Partial<
        AndroidPolicyConfiguration[K]
      >,
    ) => {
      setConfiguration(
        (current) => ({
          ...current,

          android: {
            ...current.android,

            [section]: {
              ...current.android[
                section
              ],

              ...values,
            },
          },
        }),
      )
    }

  const savePolicy =
    async () => {
      if (!name.trim()) {
        setError(
          'El nombre de la política es obligatorio.',
        )
        return
      }

      try {
        setSaving(true)
        setError(null)
        setMessage(null)

        if (editing && policyId) {
          const result =
            await policiesApi.update(
              policyId,
              {
                name: name.trim(),

                description:
                  description.trim() ||
                  null,

                configurationJson,
              },
            )

          setMessage(
            `Política guardada. Nueva versión: v${result.currentVersion}.`,
          )

          return
        }

        const result =
          await policiesApi.create({
            name: name.trim(),

            description:
              description.trim() ||
              null,

            platform,

            configurationJson,
          })

        navigate(
          `/policies/${result.id}`,
          {
            replace: true,
          },
        )
      } catch (saveError) {
        console.error(saveError)

        setError(
          getErrorMessage(saveError),
        )
      } finally {
        setSaving(false)
      }
    }

  if (loading) {
    return (
      <div className="policy-editor-loading">
        Cargando política...
      </div>
    )
  }

  return (
    <div className="policy-editor-page">
      <button
        type="button"
        className="policy-editor-back"
        onClick={() =>
          navigate('/policies')
        }
      >
        <ArrowLeft size={16} />
        Políticas
      </button>

      <header className="policy-editor-header">
        <div>
          <h1>
            {editing
              ? 'Editar política'
              : 'Nueva política'}
          </h1>

          <p>
            Define la configuración que
            TitanMDM aplicará a los
            dispositivos administrados.
          </p>
        </div>

        <button
          type="button"
          className="policy-editor-save"
          disabled={saving}
          onClick={() => {
            void savePolicy()
          }}
        >
          <Save size={16} />

          {saving
            ? 'Guardando...'
            : 'Guardar política'}
        </button>
      </header>

      {error && (
        <div className="policy-editor-notice policy-editor-notice--error">
          <XCircle size={17} />
          {error}
        </div>
      )}

      {message && (
        <div className="policy-editor-notice policy-editor-notice--success">
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}

      <section className="policy-editor-card">
        <div className="policy-editor-card__header">
          <ShieldCheck size={18} />

          <div>
            <h2>
              Información general
            </h2>

            <p>
              Identificación y plataforma
              de administración.
            </p>
          </div>
        </div>

        <div className="policy-form-grid">
          <label>
            <span>
              Nombre de la política
            </span>

            <input
              value={name}
              maxLength={200}
              placeholder="Ej. Seguridad Windows corporativa"
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Plataforma</span>

            <select
              value={platform}
              disabled={editing}
              onChange={(event) =>
                setPlatform(
                  event.target
                    .value as PolicyPlatform,
                )
              }
            >
              <option value="Windows">
                Windows
              </option>

              <option value="Android">
                Android
              </option>
            </select>
          </label>

          <label className="policy-form-full">
            <span>Descripción</span>

            <textarea
              value={description}
              maxLength={1000}
              rows={3}
              placeholder="Describe el objetivo de esta política..."
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </section>

      <div className="policy-editor-platform">
        <button
          type="button"
          className={
            platform === 'Windows'
              ? 'active'
              : ''
          }
          disabled={editing}
          onClick={() =>
            setPlatform('Windows')
          }
        >
          <Laptop size={18} />
          Windows
        </button>

        <button
          type="button"
          className={
            platform === 'Android'
              ? 'active'
              : ''
          }
          disabled={editing}
          onClick={() =>
            setPlatform('Android')
          }
        >
          <Smartphone size={18} />
          Android
        </button>
      </div>

      {platform === 'Windows' ? (
        <div className="policy-settings-grid">
          <section className="policy-setting-card">
            <div className="policy-setting-heading">
              <div>
                <LockKeyhole size={18} />

                <span>
                  <strong>
                    Contraseña
                  </strong>

                  <small>
                    Requisitos de
                    contraseña local.
                  </small>
                </span>
              </div>

              <Toggle
                checked={
                  configuration.windows
                    .password.enabled
                }
                onChange={(value) =>
                  updateWindows(
                    'password',
                    { enabled: value },
                  )
                }
              />
            </div>

            <div className="policy-setting-body">
              <label>
                Longitud mínima

                <input
                  type="number"
                  min={4}
                  max={64}
                  disabled={
                    !configuration.windows
                      .password.enabled
                  }
                  value={
                    configuration.windows
                      .password.minimumLength
                  }
                  onChange={(event) =>
                    updateWindows(
                      'password',
                      {
                        minimumLength:
                          Number(
                            event.target
                              .value,
                          ),
                      },
                    )
                  }
                />
              </label>

              <label>
                Vigencia máxima (días)

                <input
                  type="number"
                  min={0}
                  max={365}
                  disabled={
                    !configuration.windows
                      .password.enabled
                  }
                  value={
                    configuration.windows
                      .password.maximumAgeDays
                  }
                  onChange={(event) =>
                    updateWindows(
                      'password',
                      {
                        maximumAgeDays:
                          Number(
                            event.target
                              .value,
                          ),
                      },
                    )
                  }
                />
              </label>

              <CheckOption
                label="Mayúsculas"
                checked={
                  configuration.windows
                    .password
                    .requireUppercase
                }
                disabled={
                  !configuration.windows
                    .password.enabled
                }
                onChange={(value) =>
                  updateWindows(
                    'password',
                    {
                      requireUppercase:
                        value,
                    },
                  )
                }
              />

              <CheckOption
                label="Minúsculas"
                checked={
                  configuration.windows
                    .password
                    .requireLowercase
                }
                disabled={
                  !configuration.windows
                    .password.enabled
                }
                onChange={(value) =>
                  updateWindows(
                    'password',
                    {
                      requireLowercase:
                        value,
                    },
                  )
                }
              />

              <CheckOption
                label="Números"
                checked={
                  configuration.windows
                    .password.requireNumber
                }
                disabled={
                  !configuration.windows
                    .password.enabled
                }
                onChange={(value) =>
                  updateWindows(
                    'password',
                    {
                      requireNumber:
                        value,
                    },
                  )
                }
              />

              <CheckOption
                label="Caracteres especiales"
                checked={
                  configuration.windows
                    .password
                    .requireSpecialCharacter
                }
                disabled={
                  !configuration.windows
                    .password.enabled
                }
                onChange={(value) =>
                  updateWindows(
                    'password',
                    {
                      requireSpecialCharacter:
                        value,
                    },
                  )
                }
              />
            </div>
          </section>

          <SimpleToggleCard
            icon={<Shield size={18} />}
            title="Microsoft Defender"
            description="Protección antimalware y supervisión en tiempo real."
            checked={
              configuration.windows
                .defender.enabled
            }
            onChange={(value) =>
              updateWindows(
                'defender',
                { enabled: value },
              )
            }
          >
            <CheckOption
              label="Protección en tiempo real"
              checked={
                configuration.windows
                  .defender
                  .realTimeProtection
              }
              disabled={
                !configuration.windows
                  .defender.enabled
              }
              onChange={(value) =>
                updateWindows(
                  'defender',
                  {
                    realTimeProtection:
                      value,
                  },
                )
              }
            />

            <CheckOption
              label="Protección en la nube"
              checked={
                configuration.windows
                  .defender
                  .cloudProtection
              }
              disabled={
                !configuration.windows
                  .defender.enabled
              }
              onChange={(value) =>
                updateWindows(
                  'defender',
                  {
                    cloudProtection:
                      value,
                  },
                )
              }
            />
          </SimpleToggleCard>

          <SimpleToggleCard
            icon={<Wifi size={18} />}
            title="Firewall"
            description="Control de los perfiles de Windows Firewall."
            checked={
              configuration.windows
                .firewall.enabled
            }
            onChange={(value) =>
              updateWindows(
                'firewall',
                { enabled: value },
              )
            }
          >
            <CheckOption
              label="Perfil de dominio"
              checked={
                configuration.windows
                  .firewall.domainProfile
              }
              disabled={
                !configuration.windows
                  .firewall.enabled
              }
              onChange={(value) =>
                updateWindows(
                  'firewall',
                  {
                    domainProfile: value,
                  },
                )
              }
            />

            <CheckOption
              label="Perfil privado"
              checked={
                configuration.windows
                  .firewall.privateProfile
              }
              disabled={
                !configuration.windows
                  .firewall.enabled
              }
              onChange={(value) =>
                updateWindows(
                  'firewall',
                  {
                    privateProfile: value,
                  },
                )
              }
            />

            <CheckOption
              label="Perfil público"
              checked={
                configuration.windows
                  .firewall.publicProfile
              }
              disabled={
                !configuration.windows
                  .firewall.enabled
              }
              onChange={(value) =>
                updateWindows(
                  'firewall',
                  {
                    publicProfile: value,
                  },
                )
              }
            />
          </SimpleToggleCard>

          <SimpleToggleCard
            icon={<Usb size={18} />}
            title="Almacenamiento USB"
            description="Restringe almacenamiento extraíble."
            checked={
              configuration.windows.usb
                .blockRemovableStorage
            }
            onChange={(value) =>
              updateWindows(
                'usb',
                {
                  blockRemovableStorage:
                    value,
                },
              )
            }
          />

          <SimpleToggleCard
            icon={
              <LockKeyhole size={18} />
            }
            title="Bloqueo de pantalla"
            description="Bloqueo automático por inactividad."
            checked={
              configuration.windows
                .screenLock.enabled
            }
            onChange={(value) =>
              updateWindows(
                'screenLock',
                { enabled: value },
              )
            }
          >
            <label>
              Tiempo de espera (minutos)

              <input
                type="number"
                min={1}
                max={120}
                disabled={
                  !configuration.windows
                    .screenLock.enabled
                }
                value={
                  configuration.windows
                    .screenLock
                    .timeoutMinutes
                }
                onChange={(event) =>
                  updateWindows(
                    'screenLock',
                    {
                      timeoutMinutes:
                        Number(
                          event.target
                            .value,
                        ),
                    },
                  )
                }
              />
            </label>
          </SimpleToggleCard>

          <SimpleToggleCard
            icon={
              <ChevronRight size={18} />
            }
            title="Windows Update"
            description="Administración de actualizaciones."
            checked={
              configuration.windows
                .windowsUpdate.enabled
            }
            onChange={(value) =>
              updateWindows(
                'windowsUpdate',
                { enabled: value },
              )
            }
          >
            <CheckOption
              label="Actualizaciones automáticas"
              checked={
                configuration.windows
                  .windowsUpdate
                  .automaticUpdates
              }
              disabled={
                !configuration.windows
                  .windowsUpdate.enabled
              }
              onChange={(value) =>
                updateWindows(
                  'windowsUpdate',
                  {
                    automaticUpdates:
                      value,
                  },
                )
              }
            />

            <CheckOption
              label="Reinicio fuera de horas activas"
              checked={
                configuration.windows
                  .windowsUpdate
                  .restartOutsideActiveHours
              }
              disabled={
                !configuration.windows
                  .windowsUpdate.enabled
              }
              onChange={(value) =>
                updateWindows(
                  'windowsUpdate',
                  {
                    restartOutsideActiveHours:
                      value,
                  },
                )
              }
            />
          </SimpleToggleCard>
        </div>
      ) : (
        <div className="policy-settings-grid">
          <section className="policy-setting-card">
            <div className="policy-setting-heading">
              <div>
                <LockKeyhole size={18} />

                <span>
                  <strong>
                    Contraseña Android
                  </strong>

                  <small>
                    Requisitos de acceso
                    al dispositivo.
                  </small>
                </span>
              </div>

              <Toggle
                checked={
                  configuration.android
                    .password.enabled
                }
                onChange={(value) =>
                  updateAndroid(
                    'password',
                    { enabled: value },
                  )
                }
              />
            </div>

            <div className="policy-setting-body">
              <label>
                Longitud mínima

                <input
                  type="number"
                  min={4}
                  max={32}
                  disabled={
                    !configuration.android
                      .password.enabled
                  }
                  value={
                    configuration.android
                      .password.minimumLength
                  }
                  onChange={(event) =>
                    updateAndroid(
                      'password',
                      {
                        minimumLength:
                          Number(
                            event.target
                              .value,
                          ),
                      },
                    )
                  }
                />
              </label>

              <CheckOption
                label="Requerir PIN numérico"
                checked={
                  configuration.android
                    .password.requireNumeric
                }
                disabled={
                  !configuration.android
                    .password.enabled
                }
                onChange={(value) =>
                  updateAndroid(
                    'password',
                    {
                      requireNumeric:
                        value,
                    },
                  )
                }
              />

              <CheckOption
                label="Requerir contraseña compleja"
                checked={
                  configuration.android
                    .password.requireComplex
                }
                disabled={
                  !configuration.android
                    .password.enabled
                }
                onChange={(value) =>
                  updateAndroid(
                    'password',
                    {
                      requireComplex:
                        value,
                    },
                  )
                }
              />
            </div>
          </section>

          <SimpleToggleCard
            icon={<Smartphone size={18} />}
            title="Cámara"
            description="Impide utilizar la cámara del dispositivo."
            checked={
              configuration.android
                .restrictions.blockCamera
            }
            onChange={(value) =>
              updateAndroid(
                'restrictions',
                { blockCamera: value },
              )
            }
          />

          <SimpleToggleCard
            icon={<Shield size={18} />}
            title="Capturas de pantalla"
            description="Bloquea screenshots y captura de pantalla."
            checked={
              configuration.android
                .restrictions
                .blockScreenCapture
            }
            onChange={(value) =>
              updateAndroid(
                'restrictions',
                {
                  blockScreenCapture:
                    value,
                },
              )
            }
          />

          <SimpleToggleCard
            icon={<Usb size={18} />}
            title="Transferencia USB"
            description="Bloquea transferencia de archivos mediante USB."
            checked={
              configuration.android
                .restrictions
                .blockUsbFileTransfer
            }
            onChange={(value) =>
              updateAndroid(
                'restrictions',
                {
                  blockUsbFileTransfer:
                    value,
                },
              )
            }
          />

          <SimpleToggleCard
            icon={<Wifi size={18} />}
            title="Bluetooth"
            description="Restringe el uso de Bluetooth."
            checked={
              configuration.android
                .restrictions
                .blockBluetooth
            }
            onChange={(value) =>
              updateAndroid(
                'restrictions',
                {
                  blockBluetooth:
                    value,
                },
              )
            }
          />

          <SimpleToggleCard
            icon={<ShieldCheck size={18} />}
            title="Fuentes desconocidas"
            description="Bloquea instalaciones fuera de las fuentes administradas."
            checked={
              configuration.android
                .restrictions
                .blockUnknownSources
            }
            onChange={(value) =>
              updateAndroid(
                'restrictions',
                {
                  blockUnknownSources:
                    value,
                },
              )
            }
          />

          <SimpleToggleCard
            icon={<Smartphone size={18} />}
            title="Modo Kiosk"
            description="Prepara el dispositivo para modo dedicado."
            checked={
              configuration.android.kiosk
                .enabled
            }
            onChange={(value) =>
              updateAndroid(
                'kiosk',
                { enabled: value },
              )
            }
          />
        </div>
      )}

      <section className="policy-json-preview">
        <div>
          <strong>
            Configuración generada
          </strong>

          <span>
            Vista técnica del payload
            versionado.
          </span>
        </div>

        <pre>
          {configurationJson}
        </pre>
      </section>
    </div>
  )
}

interface CheckOptionProps {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

function CheckOption({
  label,
  checked,
  disabled = false,
  onChange,
}: CheckOptionProps) {
  return (
    <label className="policy-check-option">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />

      <span>{label}</span>
    </label>
  )
}

interface SimpleToggleCardProps {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  children?: React.ReactNode
}

function SimpleToggleCard({
  icon,
  title,
  description,
  checked,
  onChange,
  children,
}: SimpleToggleCardProps) {
  return (
    <section className="policy-setting-card">
      <div className="policy-setting-heading">
        <div>
          {icon}

          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </div>

        <Toggle
          checked={checked}
          onChange={onChange}
        />
      </div>

      {children && (
        <div className="policy-setting-body">
          {children}
        </div>
      )}
    </section>
  )
}