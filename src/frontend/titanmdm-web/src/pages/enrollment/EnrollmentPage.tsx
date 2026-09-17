import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { enrollmentApi } from '../../api/enrollmentApi'

import type {
  CreatedEnrollmentToken,
  EnrollmentPlatform,
  EnrollmentToken,
} from '../../types/enrollment'

import './EnrollmentPage.css'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(
    'es-DO',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(new Date(value))
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'Active':
      return 'Activo'

    case 'Completed':
      return 'Completado'

    case 'Expired':
      return 'Expirado'

    case 'Revoked':
      return 'Revocado'

    default:
      return status
  }
}

function getPlatformLabel(
  platform: string,
): string {
  switch (platform) {
    case 'Windows':
      return 'Windows'

    case 'Android':
      return 'Android'

    default:
      return platform
  }
}

export default function EnrollmentPage() {
  const [tokens, setTokens] =
    useState<EnrollmentToken[]>([])

  const [platform, setPlatform] =
    useState<EnrollmentPlatform>('Windows')

  const [
    expirationMinutes,
    setExpirationMinutes,
  ] = useState(60)

  const [maxUses, setMaxUses] =
    useState(1)

  const [
    createdToken,
    setCreatedToken,
  ] =
    useState<CreatedEnrollmentToken | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [creating, setCreating] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [copied, setCopied] =
    useState(false)

  const loadTokens =
    useCallback(async () => {
      try {
        setLoading(true)
        setError(null)

        const response =
          await enrollmentApi.getTokens()

        setTokens(response)
      } catch (requestError) {
        console.error(requestError)

        setError(
          'No fue posible cargar los tokens de inscripción.',
        )
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    document.title =
      'Inscripción | TitanMDM'

    void loadTokens()
  }, [loadTokens])

  const statistics =
    useMemo(() => {
      return {
        total: tokens.length,

        active: tokens.filter(
          (token) =>
            token.status === 'Active' &&
            new Date(token.expiresAtUtc) >
              new Date(),
        ).length,

        expired: tokens.filter(
          (token) =>
            token.status === 'Expired' ||
            (
              token.status === 'Active' &&
              new Date(token.expiresAtUtc) <=
                new Date()
            ),
        ).length,

        revoked: tokens.filter(
          (token) =>
            token.status === 'Revoked',
        ).length,
      }
    }, [tokens])

  async function handleCreateToken() {
    try {
      setCreating(true)
      setError(null)
      setCreatedToken(null)
      setCopied(false)

      const response =
        await enrollmentApi.createToken({
          platform,
          expirationMinutes,
          maxUses,
        })

      setCreatedToken(response)

      await loadTokens()
    } catch (requestError) {
      console.error(requestError)

      setError(
        'No fue posible crear el token de inscripción.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleRevokeToken(
    token: EnrollmentToken,
  ) {
    if (token.status !== 'Active') {
      return
    }

    const confirmed =
      window.confirm(
        '¿Deseas revocar este token de inscripción?',
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await enrollmentApi.revokeToken(
        token.id,
      )

      await loadTokens()
    } catch (requestError) {
      console.error(requestError)

      setError(
        'No fue posible revocar el token.',
      )
    }
  }

  async function handleCopyToken() {
    if (!createdToken) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        createdToken.token,
      )

      setCopied(true)

      window.setTimeout(
        () => setCopied(false),
        2500,
      )
    } catch (clipboardError) {
      console.error(clipboardError)

      setError(
        'No fue posible copiar el token al portapapeles.',
      )
    }
  }

  return (
    <div className="enrollment-page">
      <section className="enrollment-heading">
        <div>
          <p className="enrollment-eyebrow">
            Gestión de dispositivos
          </p>

          <h1>Centro de inscripción</h1>

          <p className="enrollment-description">
            Genera credenciales temporales para
            incorporar dispositivos Windows y
            Android a TitanMDM.
          </p>
        </div>

        <button
          className="enrollment-refresh-button"
          type="button"
          onClick={() => void loadTokens()}
          disabled={loading}
        >
          {loading
            ? 'Actualizando...'
            : 'Actualizar'}
        </button>
      </section>

      {error && (
        <div
          className="enrollment-alert enrollment-alert-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="enrollment-stats">
        <article className="enrollment-stat-card">
          <span>Total</span>
          <strong>{statistics.total}</strong>
          <small>
            Tokens registrados
          </small>
        </article>

        <article className="enrollment-stat-card">
          <span>Activos</span>
          <strong>{statistics.active}</strong>
          <small>
            Disponibles para inscripción
          </small>
        </article>

        <article className="enrollment-stat-card">
          <span>Expirados</span>
          <strong>{statistics.expired}</strong>
          <small>
            Fuera del período permitido
          </small>
        </article>

        <article className="enrollment-stat-card">
          <span>Revocados</span>
          <strong>{statistics.revoked}</strong>
          <small>
            Deshabilitados manualmente
          </small>
        </article>
      </section>

      <div className="enrollment-main-grid">
        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <div>
              <h2>Nueva inscripción</h2>

              <p>
                Crea una credencial temporal
                para un dispositivo o grupo
                controlado de dispositivos.
              </p>
            </div>
          </div>

          <div className="enrollment-form">
            <div className="enrollment-field">
              <label htmlFor="platform">
                Plataforma
              </label>

              <select
                id="platform"
                value={platform}
                onChange={(event) =>
                  setPlatform(
                    event.target
                      .value as EnrollmentPlatform,
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
            </div>

            <div className="enrollment-field">
              <label htmlFor="expiration">
                Vigencia
              </label>

              <select
                id="expiration"
                value={expirationMinutes}
                onChange={(event) =>
                  setExpirationMinutes(
                    Number(event.target.value),
                  )
                }
              >
                <option value={15}>
                  15 minutos
                </option>

                <option value={30}>
                  30 minutos
                </option>

                <option value={60}>
                  1 hora
                </option>

                <option value={240}>
                  4 horas
                </option>

                <option value={1440}>
                  24 horas
                </option>

                <option value={10080}>
                  7 días
                </option>
              </select>
            </div>

            <div className="enrollment-field">
              <label htmlFor="maxUses">
                Usos permitidos
              </label>

              <input
                id="maxUses"
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                onChange={(event) =>
                  setMaxUses(
                    Number(event.target.value),
                  )
                }
              />

              <small>
                Para una inscripción individual
                recomendamos 1 uso.
              </small>
            </div>

            <div className="enrollment-platform-info">
              <strong>
                {platform === 'Windows'
                  ? 'Inscripción Windows'
                  : 'Inscripción Android'}
              </strong>

              <p>
                {platform === 'Windows'
                  ? 'El token será utilizado posteriormente por el flujo de inscripción Windows de TitanMDM.'
                  : 'El token será utilizado posteriormente por el flujo Android Enterprise de TitanMDM.'}
              </p>
            </div>

            <button
              className="enrollment-primary-button"
              type="button"
              disabled={
                creating ||
                maxUses < 1 ||
                maxUses > 1000
              }
              onClick={() =>
                void handleCreateToken()
              }
            >
              {creating
                ? 'Generando...'
                : 'Generar token de inscripción'}
            </button>
          </div>
        </section>

        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <div>
              <h2>Credencial generada</h2>

              <p>
                El secreto solamente se muestra
                durante su creación.
              </p>
            </div>
          </div>

          {!createdToken ? (
            <div className="enrollment-empty-secret">
              <div className="enrollment-secret-icon">
                🔐
              </div>

              <h3>
                Ningún token nuevo
              </h3>

              <p>
                Genera una credencial desde el
                formulario para visualizarla
                aquí.
              </p>
            </div>
          ) : (
            <div className="enrollment-secret">
              <div className="enrollment-secret-warning">
                Guarda esta credencial ahora.
                TitanMDM no volverá a mostrar
                este secreto.
              </div>

              <div className="enrollment-token-value">
                <code>
                  {createdToken.token}
                </code>
              </div>

              <button
                type="button"
                className="enrollment-copy-button"
                onClick={() =>
                  void handleCopyToken()
                }
              >
                {copied
                  ? 'Copiado'
                  : 'Copiar token'}
              </button>

              <dl className="enrollment-secret-details">
                <div>
                  <dt>Plataforma</dt>
                  <dd>
                    {getPlatformLabel(
                      createdToken.platform,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Expira</dt>
                  <dd>
                    {formatDate(
                      createdToken.expiresAtUtc,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Usos</dt>
                  <dd>
                    {createdToken.usedCount}
                    /
                    {createdToken.maxUses}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>

      <section className="enrollment-panel enrollment-history">
        <div className="enrollment-panel-header">
          <div>
            <h2>
              Credenciales de inscripción
            </h2>

            <p>
              Historial real de credenciales
              asociadas a tu organización.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="enrollment-loading">
            Cargando credenciales...
          </div>
        ) : tokens.length === 0 ? (
          <div className="enrollment-empty-table">
            Todavía no existen tokens de
            inscripción.
          </div>
        ) : (
          <div className="enrollment-table-wrapper">
            <table className="enrollment-table">
              <thead>
                <tr>
                  <th>Plataforma</th>
                  <th>Estado</th>
                  <th>Uso</th>
                  <th>Creado</th>
                  <th>Expira</th>
                  <th>Último uso</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {tokens.map((token) => {
                  const expired =
                    token.status ===
                      'Expired' ||
                    (
                      token.status ===
                        'Active' &&
                      new Date(
                        token.expiresAtUtc,
                      ) <= new Date()
                    )

                  const effectiveStatus =
                    expired
                      ? 'Expired'
                      : token.status

                  return (
                    <tr key={token.id}>
                      <td>
                        <span className="enrollment-platform">
                          {getPlatformLabel(
                            token.platform,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`enrollment-status enrollment-status-${effectiveStatus.toLowerCase()}`}
                        >
                          {getStatusLabel(
                            effectiveStatus,
                          )}
                        </span>
                      </td>

                      <td>
                        {token.usedCount}
                        /
                        {token.maxUses}
                      </td>

                      <td>
                        {formatDate(
                          token.createdAtUtc,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          token.expiresAtUtc,
                        )}
                      </td>

                      <td>
                        {token.lastUsedAtUtc
                          ? formatDate(
                              token.lastUsedAtUtc,
                            )
                          : 'Sin uso'}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="enrollment-action-button"
                          disabled={
                            effectiveStatus !==
                            'Active'
                          }
                          onClick={() =>
                            void handleRevokeToken(
                              token,
                            )
                          }
                        >
                          Revocar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}