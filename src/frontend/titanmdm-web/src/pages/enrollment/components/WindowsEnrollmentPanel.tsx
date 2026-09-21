import type {
  WindowsEnrollmentController,
} from '../hooks/useWindowsEnrollment'

import {
  formatDate,
  getEffectiveTokenStatus,
  getStatusLabel,
} from '../utils/enrollmentFormatters'

interface WindowsEnrollmentPanelProps {
  controller:
    WindowsEnrollmentController

  canCreate?: boolean
  canRevoke?: boolean
}

export default function WindowsEnrollmentPanel({
  controller,
  canCreate = true,
  canRevoke = true,
}: WindowsEnrollmentPanelProps) {
  const {
    tokens,
    statistics,

    expirationMinutes,
    setExpirationMinutes,

    maxUses,
    setMaxUses,

    createdToken,

    loading,
    creating,
    copied,

    error,
    success,

    createToken,
    revokeToken,
    copyToken,
  } = controller

  return (
    <div className="enrollment-platform-content">
      <section className="windows-enrollment-hero">
        <div className="windows-enrollment-title-row">
          <div className="windows-enrollment-logo">
            W
          </div>

          <div>
            <p className="enrollment-eyebrow">
              TitanMDM Windows
            </p>

            <h2>
              Inscripción de dispositivos Windows
            </h2>

            <p>
              Genera credenciales temporales para
              registrar equipos Windows mediante
              TitanMDM Windows Agent.
            </p>
          </div>
        </div>

        <span className="windows-enrollment-state">
          Windows Agent
        </span>
      </section>

      {error && (
        <div
          className="enrollment-alert enrollment-alert-error"
          role="alert"
        >
          <strong>Windows:</strong>{' '}
          {error}
        </div>
      )}

      {success && (
        <div
          className="enrollment-alert enrollment-alert-success"
          role="status"
        >
          {success}
        </div>
      )}

      <section className="enrollment-stats">
        <article className="enrollment-stat-card">
          <span>Inscripciones Windows</span>
          <strong>{statistics.total}</strong>
          <small>Credenciales creadas</small>
        </article>

        <article className="enrollment-stat-card">
          <span>Activas</span>
          <strong>{statistics.active}</strong>
          <small>Disponibles</small>
        </article>

        <article className="enrollment-stat-card">
          <span>Expiradas</span>
          <strong>{statistics.expired}</strong>
          <small>Fuera de vigencia</small>
        </article>

        <article className="enrollment-stat-card">
          <span>Revocadas</span>
          <strong>{statistics.revoked}</strong>
          <small>Bloqueadas</small>
        </article>
      </section>

      <div className="enrollment-main-grid">
        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <h2>
              Nueva inscripción Windows
            </h2>

            <p>
              Configura la vigencia y cantidad
              máxima de usos de la credencial.
            </p>
          </div>

          <div className="enrollment-form">
            <div className="enrollment-field">
              <label htmlFor="windowsExpiration">
                Vigencia
              </label>

              <select
                id="windowsExpiration"
                value={expirationMinutes}
                disabled={
                  creating ||
                  !canCreate
                }
                onChange={(event) =>
                  setExpirationMinutes(
                    Number(
                      event.target.value,
                    ),
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
              <label htmlFor="windowsMaxUses">
                Usos permitidos
              </label>

              <input
                id="windowsMaxUses"
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                disabled={
                  creating ||
                  !canCreate
                }
                onChange={(event) =>
                  setMaxUses(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />

              <small>
                Para una inscripción individual
                utiliza un solo uso.
              </small>
            </div>

            <div className="enrollment-platform-info">
              <strong>
                Plataforma: Windows
              </strong>

              <p>
                La credencial será utilizada por
                TitanMDM Windows Agent durante
                el registro inicial del equipo.
              </p>
            </div>

            <button
              className="enrollment-primary-button"
              type="button"
              disabled={
                creating ||
                !canCreate ||
                maxUses < 1 ||
                maxUses > 1000
              }
              onClick={() =>
                void createToken()
              }
            >
              {!canCreate
                ? 'Sin permiso para crear'
                : creating
                  ? 'Generando...'
                  : 'Generar token Windows'}
            </button>
          </div>
        </section>

        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <h2>
              Credencial Windows
            </h2>

            <p>
              El secreto solamente se muestra
              durante su creación.
            </p>
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
                Genera una credencial para
                visualizarla aquí.
              </p>
            </div>
          ) : (
            <div className="enrollment-secret">
              <div className="enrollment-secret-warning">
                Copia esta credencial ahora.
                TitanMDM no volverá a mostrar
                el secreto después de abandonar
                esta vista.
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
                  void copyToken()
                }
              >
                {copied
                  ? 'Copiado'
                  : 'Copiar token'}
              </button>

              <dl className="enrollment-secret-details">
                <div>
                  <dt>Plataforma</dt>
                  <dd>Windows</dd>
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
                    {createdToken.usedCount}/
                    {createdToken.maxUses}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>

      <section className="enrollment-panel">
        <div className="enrollment-panel-header">
          <h2>
            Historial Windows
          </h2>

          <p>
            Credenciales Windows asociadas a
            esta organización.
          </p>
        </div>

        {loading ? (
          <div className="enrollment-loading">
            Cargando credenciales...
          </div>
        ) : tokens.length === 0 ? (
          <div className="enrollment-empty-table">
            Todavía no existen credenciales
            Windows.
          </div>
        ) : (
          <div className="enrollment-table-wrapper">
            <table className="enrollment-table">
              <thead>
                <tr>
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
                  const effectiveStatus =
                    getEffectiveTokenStatus(
                      token.status,
                      token.expiresAtUtc,
                    )

                  return (
                    <tr key={token.id}>
                      <td>
                        <span
                          className={
                            `enrollment-status ` +
                            `enrollment-status-${effectiveStatus.toLowerCase()}`
                          }
                        >
                          {getStatusLabel(
                            effectiveStatus,
                          )}
                        </span>
                      </td>

                      <td>
                        {token.usedCount}/
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
                              'Active' ||
                            !canRevoke
                          }
                          onClick={() =>
                            void revokeToken(
                              token,
                            )
                          }
                        >
                          {!canRevoke
                            ? 'Sin permiso'
                            : 'Revocar'}
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