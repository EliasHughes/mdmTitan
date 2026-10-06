import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import axios
  from 'axios'

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MailCheck,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ServerCog,
  ShieldCheck,
  UserCog,
  XCircle,
} from 'lucide-react'

import apiClient
  from '../../api/apiClient'

import {
  useAuth,
} from '../../auth/AuthContext'

import {
  helpdeskPermissions,
} from '../../auth/helpdeskAccess'

import './HelpdeskMailSettingsPage.css'

interface MailStatistics {
  received: number
  sent: number
  pending: number
  retry: number
  sending: number
  deadLetter: number
}

interface MailSettings {
  mailbox: string | null

  actorUserId:
    string | null

  actorName:
    string | null

  inboundEnabled:
    boolean

  outboundEnabled:
    boolean

  inboundPollSeconds:
    number

  outboundPollSeconds:
    number

  batchSize:
    number

  maxAttempts:
    number

  lastInboundAttemptAtUtc:
    string | null

  lastInboundSuccessAtUtc:
    string | null

  lastInboundError:
    string | null

  lastOutboundAttemptAtUtc:
    string | null

  lastOutboundSuccessAtUtc:
    string | null

  lastOutboundError:
    string | null

  revision:
    number

  updatedAtUtc:
    string | null

  statistics:
    MailStatistics
}

interface MailActor {
  id: string
  name: string
  email: string | null
}

interface GraphDiagnostic {
  success: boolean

  message: string

  mailbox?: string

  inbox?: string

  totalItemCount?: number

  unreadItemCount?: number

  inboundVerified:
    boolean

  outboundConfigured:
    boolean
}

function errorMessage(
  exception: unknown,
  fallback: string,
) {
  if (
    axios.isAxiosError(
      exception,
    )
    &&
    typeof exception
      .response
      ?.data
      ?.message ===
      'string'
  ) {
    return exception
      .response
      .data
      .message
  }

  return fallback
}

function formatDate(
  value:
    string |
    null |
    undefined,
) {
  if (!value) {
    return 'Nunca'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'No disponible'
  }

  return new Intl
    .DateTimeFormat(
      'es-DO',
      {
        dateStyle:
          'medium',

        timeStyle:
          'short',
      },
    )
    .format(
      date,
    )
}

export function HelpdeskMailSettingsPage() {
  const {
    hasPermission,
  } =
    useAuth()

  const canManage =
    hasPermission(
      helpdeskPermissions
        .mailManage,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )
    ||
    hasPermission(
      'helpdesk.manage',
    )
    ||
    hasPermission(
      'settings.manage',
    )

  const [
    settings,
    setSettings,
  ] =
    useState<
      MailSettings |
      null
    >(
      null,
    )

  const [
    actors,
    setActors,
  ] =
    useState<
      MailActor[]
    >(
      [],
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    )

  const [
    testing,
    setTesting,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    success,
    setSuccess,
  ] =
    useState(
      '',
    )

  const [
    diagnostic,
    setDiagnostic,
  ] =
    useState<
      GraphDiagnostic |
      null
    >(
      null,
    )

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const response =
            await apiClient
              .get<MailSettings>(
                '/helpdesk/mail',
              )

          setSettings(
            response.data,
          )

          if (canManage) {
            const actorResponse =
              await apiClient
                .get<
                  MailActor[]
                >(
                  '/helpdesk/mail/actors',
                )

            setActors(
              actorResponse.data,
            )
          }
        }
        catch (
          exception
        ) {
          setError(
            errorMessage(
              exception,
              'No se pudo cargar la configuración de correo.',
            ),
          )
        }
        finally {
          setLoading(
            false,
          )
        }
      },
      [
        canManage,
      ],
    )

  useEffect(
    () => {
      void load()
    },
    [
      load,
    ],
  )

  const selectedActor =
    useMemo(
      () =>
        actors.find(
          actor =>
            actor.id ===
            settings
              ?.actorUserId,
        )
        ??
        null,
      [
        actors,
        settings
          ?.actorUserId,
      ],
    )

  function validate() {
    if (!settings) {
      return 'No existe configuración para guardar.'
    }

    const mailbox =
      settings.mailbox
        ?.trim()
        ??
        ''

    if (
      (
        settings.inboundEnabled
        ||
        settings.outboundEnabled
      )
      &&
      !mailbox
    ) {
      return 'Debes configurar el buzón antes de habilitar el servicio.'
    }

    if (
      settings.inboundEnabled
      &&
      !settings.actorUserId
    ) {
      return 'Selecciona un usuario técnico para procesar correo entrante.'
    }

    if (
      settings.inboundPollSeconds <
        30
      ||
      settings.inboundPollSeconds >
        3600
    ) {
      return 'El intervalo de entrada debe estar entre 30 y 3600 segundos.'
    }

    if (
      settings.outboundPollSeconds <
        10
      ||
      settings.outboundPollSeconds >
        3600
    ) {
      return 'El intervalo de salida debe estar entre 10 y 3600 segundos.'
    }

    if (
      settings.batchSize <
        1
      ||
      settings.batchSize >
        100
    ) {
      return 'El tamaño de lote debe estar entre 1 y 100.'
    }

    if (
      settings.maxAttempts <
        1
      ||
      settings.maxAttempts >
        20
    ) {
      return 'Los reintentos deben estar entre 1 y 20.'
    }

    return ''
  }

  async function save(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !settings
      ||
      !canManage
      ||
      saving
    ) {
      return
    }

    const validation =
      validate()

    if (validation) {
      setError(
        validation,
      )

      setSuccess(
        '',
      )

      return
    }

    setSaving(
      true,
    )

    setError(
      '',
    )

    setSuccess(
      '',
    )

    try {
      const response =
        await apiClient
          .put<MailSettings>(
            '/helpdesk/mail',
            {
              mailbox:
                settings.mailbox,

              actorUserId:
                settings.actorUserId,

              inboundEnabled:
                settings
                  .inboundEnabled,

              outboundEnabled:
                settings
                  .outboundEnabled,

              inboundPollSeconds:
                settings
                  .inboundPollSeconds,

              outboundPollSeconds:
                settings
                  .outboundPollSeconds,

              batchSize:
                settings
                  .batchSize,

              maxAttempts:
                settings
                  .maxAttempts,

              revision:
                settings
                  .revision,
            },
          )

      setSettings(
        response.data,
      )

      setDiagnostic(
        null,
      )

      setSuccess(
        'Configuración de correo guardada correctamente.',
      )
    }
    catch (
      exception
    ) {
      setError(
        errorMessage(
          exception,
          'No se pudo guardar la configuración.',
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  async function testMailbox() {
    if (
      !canManage
      ||
      testing
    ) {
      return
    }

    setTesting(
      true,
    )

    setError(
      '',
    )

    setSuccess(
      '',
    )

    setDiagnostic(
      null,
    )

    try {
      const response =
        await apiClient
          .post<GraphDiagnostic>(
            '/helpdesk/mail/test',
          )

      setDiagnostic(
        response.data,
      )

      if (
        response.data
          .success
      ) {
        setSuccess(
          response.data
            .message,
        )
      }
    }
    catch (
      exception
    ) {
      setError(
        errorMessage(
          exception,
          'No se pudo validar Microsoft Graph.',
        ),
      )
    }
    finally {
      setTesting(
        false,
      )
    }
  }

  if (loading) {
    return (
      <main
        className="titan-page helpdesk-mail-page"
      >
        <div
          className="helpdesk-mail-loading"
        >
          <RefreshCw
            size={20}
          />

          Cargando configuración
          de correo…
        </div>
      </main>
    )
  }

  if (!settings) {
    return (
      <main
        className="titan-page helpdesk-mail-page"
      >
        <div
          className="helpdesk-mail-message helpdesk-mail-message--error"
        >
          <AlertTriangle
            size={18}
          />

          {error ||
            'No se pudo cargar la configuración.'}
        </div>
      </main>
    )
  }

  const statistics =
    settings.statistics

  return (
    <main
      className="titan-page helpdesk-mail-page"
    >
      <header
        className="helpdesk-mail-hero"
      >
        <div>
          <span
            className="helpdesk-mail-eyebrow"
          >
            <Mail
              size={14}
            />

            HELPDESK · MICROSOFT 365
          </span>

          <h1>
            Correo de Mesa de Ayuda
          </h1>

          <p>
            Administra el buzón que
            crea tickets, recibe
            respuestas y entrega
            notificaciones desde
            TitanMDM.
          </p>
        </div>

        <button
          type="button"
          className="helpdesk-mail-refresh"
          disabled={
            loading
            ||
            saving
            ||
            testing
          }
          onClick={
            () =>
              void load()
          }
        >
          <RefreshCw
            size={16}
          />

          Actualizar
        </button>
      </header>

      {error && (
        <div
          className="helpdesk-mail-message helpdesk-mail-message--error"
          role="alert"
        >
          <AlertTriangle
            size={18}
          />

          {error}
        </div>
      )}

      {success && (
        <div
          className="helpdesk-mail-message helpdesk-mail-message--success"
          role="status"
        >
          <CheckCircle2
            size={18}
          />

          {success}
        </div>
      )}

      <section
        className="helpdesk-mail-metrics"
      >
        <article>
          <Inbox
            size={18}
          />

          <span>
            Recibidos
          </span>

          <strong>
            {statistics.received}
          </strong>
        </article>

        <article>
          <Send
            size={18}
          />

          <span>
            Enviados
          </span>

          <strong>
            {statistics.sent}
          </strong>
        </article>

        <article>
          <Clock3
            size={18}
          />

          <span>
            Pendientes
          </span>

          <strong>
            {statistics.pending}
          </strong>
        </article>

        <article>
          <RotateCcw
            size={18}
          />

          <span>
            Reintento
          </span>

          <strong>
            {statistics.retry}
          </strong>
        </article>

        <article>
          <ServerCog
            size={18}
          />

          <span>
            Enviando
          </span>

          <strong>
            {statistics.sending}
          </strong>
        </article>

        <article
          className={
            statistics.deadLetter >
              0
              ? 'helpdesk-mail-metric--danger'
              : ''
          }
        >
          <XCircle
            size={18}
          />

          <span>
            Dead letter
          </span>

          <strong>
            {statistics.deadLetter}
          </strong>
        </article>
      </section>

      <form
        onSubmit={
          event =>
            void save(
              event,
            )
        }
      >
        <section
          className="helpdesk-mail-card"
        >
          <header
            className="helpdesk-mail-card__header"
          >
            <span>
              <Mail
                size={20}
              />
            </span>

            <div>
              <h2>
                Buzón corporativo
              </h2>

              <p>
                Cuenta de Microsoft
                365 utilizada por la
                Mesa de Ayuda.
              </p>
            </div>
          </header>

          <div
            className="helpdesk-mail-grid"
          >
            <label
              className="helpdesk-mail-field helpdesk-mail-field--wide"
            >
              <span>
                Dirección del buzón
              </span>

              <input
                type="email"
                maxLength={320}
                disabled={
                  !canManage
                  ||
                  saving
                }
                value={
                  settings.mailbox
                  ??
                  ''
                }
                placeholder="mesadeayuda@empresa.com"
                onChange={
                  event =>
                    setSettings(
                      {
                        ...settings,

                        mailbox:
                          event
                            .target
                            .value,
                      },
                    )
                }
              />

              <small>
                Debe existir en
                Microsoft 365 y ser
                accesible mediante
                Microsoft Graph.
              </small>
            </label>

            <label
              className="helpdesk-mail-field helpdesk-mail-field--wide"
            >
              <span>
                Usuario técnico del
                buzón
              </span>

              {canManage ? (
                <select
                  disabled={
                    saving
                  }
                  value={
                    settings.actorUserId
                    ??
                    ''
                  }
                  onChange={
                    event =>
                      setSettings(
                        {
                          ...settings,

                          actorUserId:
                            event
                              .target
                              .value
                            ||
                            null,
                        },
                      )
                  }
                >
                  <option value="">
                    Seleccionar usuario
                  </option>

                  {actors.map(
                    actor => (
                      <option
                        key={
                          actor.id
                        }
                        value={
                          actor.id
                        }
                      >
                        {actor.name}
                        {
                          actor.email
                            ? ` · ${actor.email}`
                            : ''
                        }
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <div
                  className="helpdesk-mail-readonly"
                >
                  {settings.actorName ||
                    'No configurado'}
                </div>
              )}

              <small>
                Este usuario se utiliza
                como actor de sistema
                para tickets recibidos
                por email.
              </small>
            </label>
          </div>
        </section>

        <section
          className="helpdesk-mail-card"
        >
          <header
            className="helpdesk-mail-card__header"
          >
            <span>
              <MailCheck
                size={20}
              />
            </span>

            <div>
              <h2>
                Entrada y salida
              </h2>

              <p>
                Activa cada dirección
                del flujo de correo de
                forma independiente.
              </p>
            </div>
          </header>

          <div
            className="helpdesk-mail-switches"
          >
            <label>
              <input
                type="checkbox"
                disabled={
                  !canManage
                  ||
                  saving
                }
                checked={
                  settings
                    .inboundEnabled
                }
                onChange={
                  event =>
                    setSettings(
                      {
                        ...settings,

                        inboundEnabled:
                          event
                            .target
                            .checked,
                      },
                    )
                }
              />

              <span
                className="helpdesk-mail-switch"
              />

              <div>
                <strong>
                  Correo entrante
                </strong>

                <small>
                  Crear tickets y
                  registrar respuestas
                  recibidas.
                </small>
              </div>
            </label>

            <label>
              <input
                type="checkbox"
                disabled={
                  !canManage
                  ||
                  saving
                }
                checked={
                  settings
                    .outboundEnabled
                }
                onChange={
                  event =>
                    setSettings(
                      {
                        ...settings,

                        outboundEnabled:
                          event
                            .target
                            .checked,
                      },
                    )
                }
              />

              <span
                className="helpdesk-mail-switch"
              />

              <div>
                <strong>
                  Correo saliente
                </strong>

                <small>
                  Enviar respuestas
                  públicas del personal
                  TIC.
                </small>
              </div>
            </label>
          </div>

          <div
            className="helpdesk-mail-grid"
          >
            <label
              className="helpdesk-mail-field"
            >
              <span>
                Polling entrada
              </span>

              <div
                className="helpdesk-mail-input-suffix"
              >
                <input
                  type="number"
                  min={30}
                  max={3600}
                  disabled={
                    !canManage
                    ||
                    saving
                  }
                  value={
                    settings
                      .inboundPollSeconds
                  }
                  onChange={
                    event =>
                      setSettings(
                        {
                          ...settings,

                          inboundPollSeconds:
                            Number(
                              event
                                .target
                                .value,
                            ),
                        },
                      )
                  }
                />

                <span>
                  s
                </span>
              </div>
            </label>

            <label
              className="helpdesk-mail-field"
            >
              <span>
                Polling salida
              </span>

              <div
                className="helpdesk-mail-input-suffix"
              >
                <input
                  type="number"
                  min={10}
                  max={3600}
                  disabled={
                    !canManage
                    ||
                    saving
                  }
                  value={
                    settings
                      .outboundPollSeconds
                  }
                  onChange={
                    event =>
                      setSettings(
                        {
                          ...settings,

                          outboundPollSeconds:
                            Number(
                              event
                                .target
                                .value,
                            ),
                        },
                      )
                  }
                />

                <span>
                  s
                </span>
              </div>
            </label>

            <label
              className="helpdesk-mail-field"
            >
              <span>
                Tamaño de lote
              </span>

              <input
                type="number"
                min={1}
                max={100}
                disabled={
                  !canManage
                  ||
                  saving
                }
                value={
                  settings.batchSize
                }
                onChange={
                  event =>
                    setSettings(
                      {
                        ...settings,

                        batchSize:
                          Number(
                            event
                              .target
                              .value,
                          ),
                      },
                    )
                }
              />
            </label>

            <label
              className="helpdesk-mail-field"
            >
              <span>
                Intentos máximos
              </span>

              <input
                type="number"
                min={1}
                max={20}
                disabled={
                  !canManage
                  ||
                  saving
                }
                value={
                  settings
                    .maxAttempts
                }
                onChange={
                  event =>
                    setSettings(
                      {
                        ...settings,

                        maxAttempts:
                          Number(
                            event
                              .target
                              .value,
                          ),
                      },
                    )
                }
              />
            </label>
          </div>
        </section>

        <section
          className="helpdesk-mail-card"
        >
          <header
            className="helpdesk-mail-card__header"
          >
            <span>
              <ServerCog
                size={20}
              />
            </span>

            <div>
              <h2>
                Estado operativo
              </h2>

              <p>
                Últimos ciclos de los
                workers de entrada y
                salida.
              </p>
            </div>
          </header>

          <div
            className="helpdesk-mail-runtime"
          >
            <article>
              <div
                className="helpdesk-mail-runtime__title"
              >
                <Inbox
                  size={17}
                />

                <strong>
                  Entrada
                </strong>
              </div>

              <dl>
                <div>
                  <dt>
                    Último intento
                  </dt>

                  <dd>
                    {formatDate(
                      settings
                        .lastInboundAttemptAtUtc,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Último éxito
                  </dt>

                  <dd>
                    {formatDate(
                      settings
                        .lastInboundSuccessAtUtc,
                    )}
                  </dd>
                </div>
              </dl>

              {settings
                .lastInboundError ? (
                <div
                  className="helpdesk-mail-runtime__error"
                >
                  <AlertTriangle
                    size={15}
                  />

                  {
                    settings
                      .lastInboundError
                  }
                </div>
              ) : (
                <div
                  className="helpdesk-mail-runtime__ok"
                >
                  <CheckCircle2
                    size={15}
                  />

                  Sin error registrado.
                </div>
              )}
            </article>

            <article>
              <div
                className="helpdesk-mail-runtime__title"
              >
                <Send
                  size={17}
                />

                <strong>
                  Salida
                </strong>
              </div>

              <dl>
                <div>
                  <dt>
                    Último intento
                  </dt>

                  <dd>
                    {formatDate(
                      settings
                        .lastOutboundAttemptAtUtc,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Último éxito
                  </dt>

                  <dd>
                    {formatDate(
                      settings
                        .lastOutboundSuccessAtUtc,
                    )}
                  </dd>
                </div>
              </dl>

              {settings
                .lastOutboundError ? (
                <div
                  className="helpdesk-mail-runtime__error"
                >
                  <AlertTriangle
                    size={15}
                  />

                  {
                    settings
                      .lastOutboundError
                  }
                </div>
              ) : (
                <div
                  className="helpdesk-mail-runtime__ok"
                >
                  <CheckCircle2
                    size={15}
                  />

                  Sin error registrado.
                </div>
              )}
            </article>
          </div>
        </section>

        <section
          className="helpdesk-mail-card"
        >
          <header
            className="helpdesk-mail-card__header"
          >
            <span>
              <ShieldCheck
                size={20}
              />
            </span>

            <div>
              <h2>
                Diagnóstico Microsoft
                Graph
              </h2>

              <p>
                Valida credenciales,
                permisos y acceso real
                al Inbox.
              </p>
            </div>
          </header>

          <div
            className="helpdesk-mail-diagnostic"
          >
            <button
              type="button"
              disabled={
                !canManage
                ||
                testing
                ||
                saving
              }
              onClick={
                () =>
                  void testMailbox()
              }
            >
              <ShieldCheck
                size={16}
              />

              {
                testing
                  ? 'Comprobando…'
                  : 'Probar conexión'
              }
            </button>

            {!canManage && (
              <span>
                Se requiere
                `helpdesk.mail.manage`
                para ejecutar pruebas.
              </span>
            )}
          </div>

          {diagnostic && (
            <div
              className={
                diagnostic.success
                  ? 'helpdesk-mail-test helpdesk-mail-test--success'
                  : 'helpdesk-mail-test helpdesk-mail-test--error'
              }
            >
              {
                diagnostic.success
                  ? (
                    <CheckCircle2
                      size={19}
                    />
                  )
                  : (
                    <AlertTriangle
                      size={19}
                    />
                  )
              }

              <div>
                <strong>
                  {
                    diagnostic
                      .message
                  }
                </strong>

                {diagnostic.mailbox && (
                  <span>
                    Buzón:
                    {' '}
                    {
                      diagnostic
                        .mailbox
                    }
                  </span>
                )}

                {diagnostic.inbox && (
                  <span>
                    Carpeta:
                    {' '}
                    {
                      diagnostic
                        .inbox
                    }
                  </span>
                )}

                <span>
                  Mensajes:
                  {' '}
                  {
                    diagnostic
                      .totalItemCount
                    ??
                    0
                  }
                  {' · '}
                  No leídos:
                  {' '}
                  {
                    diagnostic
                      .unreadItemCount
                    ??
                    0
                  }
                </span>
              </div>
            </div>
          )}
        </section>

        <section
          className="helpdesk-mail-card"
        >
          <header
            className="helpdesk-mail-card__header"
          >
            <span>
              <UserCog
                size={20}
              />
            </span>

            <div>
              <h2>
                Configuración actual
              </h2>

              <p>
                Control de revisión y
                trazabilidad.
              </p>
            </div>
          </header>

          <div
            className="helpdesk-mail-summary"
          >
            <article>
              <span>
                Revisión
              </span>

              <strong>
                {
                  settings.revision
                }
              </strong>
            </article>

            <article>
              <span>
                Actualizada
              </span>

              <strong>
                {formatDate(
                  settings
                    .updatedAtUtc,
                )}
              </strong>
            </article>

            <article>
              <span>
                Actor
              </span>

              <strong>
                {
                  selectedActor
                    ?.name
                  ??
                  settings.actorName
                  ??
                  'Sin configurar'
                }
              </strong>
            </article>

            <article>
              <span>
                Servicio
              </span>

              <strong>
                {
                  settings.inboundEnabled
                  ||
                  settings.outboundEnabled
                    ? 'Activo'
                    : 'Detenido'
                }
              </strong>
            </article>
          </div>
        </section>

        {canManage && (
          <div
            className="helpdesk-mail-savebar"
          >
            <div>
              <Save
                size={18}
              />

              <span>
                Los workers aplicarán
                esta configuración
                desde SQL Server.
              </span>
            </div>

            <button
              type="submit"
              disabled={
                saving
                ||
                testing
              }
            >
              <Save
                size={16}
              />

              {
                saving
                  ? 'Guardando…'
                  : 'Guardar configuración'
              }
            </button>
          </div>
        )}
      </form>
    </main>
  )
}