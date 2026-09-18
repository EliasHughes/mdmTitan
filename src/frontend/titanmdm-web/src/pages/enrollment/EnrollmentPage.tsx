import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import QRCode from 'qrcode'

import { enrollmentApi } from '../../api/enrollmentApi'
import { androidEnterpriseApi } from '../../api/androidEnterpriseApi'

import type {
  CreatedEnrollmentToken,
  EnrollmentToken,
} from '../../types/enrollment'

import type {
  AndroidEnterpriseStatus,
  AndroidEnrollment,
  AndroidEnrollmentMode,
  CreatedAndroidEnrollment,
} from '../../types/androidEnterprise'

import './EnrollmentPage.css'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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

    case 'Pending':
      return 'Pendiente'

    case 'NotConfigured':
      return 'No configurado'

    case 'Suspended':
      return 'Suspendido'

    case 'Error':
      return 'Error'

    default:
      return status
  }
}

function getAndroidModeLabel(
  mode: AndroidEnrollmentMode | string,
): string {
  switch (mode) {
    case 'FullyManaged':
      return 'Totalmente administrado'

    case 'Dedicated':
      return 'Dedicado / Kiosk'

    case 'WorkProfile':
      return 'Perfil de trabajo'

    default:
      return mode
  }
}

function getAndroidModeDescription(
  mode: AndroidEnrollmentMode,
): string {
  switch (mode) {
    case 'FullyManaged':
      return 'Dispositivo corporativo completamente administrado por TitanMDM. Recomendado para teléfonos y tabletas propiedad de la empresa.'

    case 'Dedicated':
      return 'Dispositivo corporativo destinado a una función específica. Será la base para terminales Kiosk, POS, recepción y dispositivos compartidos.'

    case 'WorkProfile':
      return 'Separa aplicaciones y datos empresariales de la información personal del usuario mediante un perfil de trabajo administrado.'

    default:
      return ''
  }
}

function isAndroidEnterpriseActive(
  status: AndroidEnterpriseStatus | null,
): boolean {
  return (
    status?.status === 'Active' &&
    Boolean(status.enterpriseName)
  )
}

function extractRequestError(
  error: unknown,
  fallback: string,
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (
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

  return fallback
}

export default function EnrollmentPage() {
  // ============================================================
  // WINDOWS / TITANMDM ENROLLMENT
  // ============================================================

  const [tokens, setTokens] =
    useState<EnrollmentToken[]>([])

  const [
    windowsExpirationMinutes,
    setWindowsExpirationMinutes,
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

  const [
    windowsLoading,
    setWindowsLoading,
  ] = useState(true)

  const [
    windowsCreating,
    setWindowsCreating,
  ] = useState(false)

  const [
    windowsError,
    setWindowsError,
  ] = useState<string | null>(null)

  const [
    windowsCopied,
    setWindowsCopied,
  ] = useState(false)

  // ============================================================
  // ANDROID ENTERPRISE
  // ============================================================

  const [
    androidStatus,
    setAndroidStatus,
  ] =
    useState<AndroidEnterpriseStatus | null>(
      null,
    )

  const [
    androidEnrollments,
    setAndroidEnrollments,
  ] = useState<AndroidEnrollment[]>([])

  const [
    androidMode,
    setAndroidMode,
  ] =
    useState<AndroidEnrollmentMode>(
      'FullyManaged',
    )

  const [
    androidExpirationMinutes,
    setAndroidExpirationMinutes,
  ] = useState(60)

  const [
    createdAndroidEnrollment,
    setCreatedAndroidEnrollment,
  ] =
    useState<CreatedAndroidEnrollment | null>(
      null,
    )

  const [
    androidQrDataUrl,
    setAndroidQrDataUrl,
  ] = useState<string | null>(null)

  const [
    androidLoading,
    setAndroidLoading,
  ] = useState(true)

  const [
    androidCreating,
    setAndroidCreating,
  ] = useState(false)

  const [
    androidConnecting,
    setAndroidConnecting,
  ] = useState(false)

  const [
    androidError,
    setAndroidError,
  ] = useState<string | null>(null)

  const [
    androidSuccess,
    setAndroidSuccess,
  ] = useState<string | null>(null)

  const [
    androidCopied,
    setAndroidCopied,
  ] = useState(false)

  // ============================================================
  // LOAD WINDOWS
  // ============================================================

  const loadWindowsTokens =
    useCallback(async () => {
      try {
        setWindowsLoading(true)
        setWindowsError(null)

        const response =
          await enrollmentApi.getTokens()

        setTokens(response)
      } catch (requestError) {
        console.error(requestError)

        setWindowsError(
          'No fue posible cargar las credenciales de inscripción.',
        )
      } finally {
        setWindowsLoading(false)
      }
    }, [])

  // ============================================================
  // LOAD ANDROID
  // ============================================================

  const loadAndroid =
    useCallback(async () => {
      try {
        setAndroidLoading(true)
        setAndroidError(null)

        const status =
          await androidEnterpriseApi.getStatus()

        setAndroidStatus(status)

        if (
          status.status === 'Active' &&
          status.enterpriseName
        ) {
          const enrollments =
            await androidEnterpriseApi
              .getEnrollments()

          setAndroidEnrollments(enrollments)
        } else {
          setAndroidEnrollments([])
        }
      } catch (requestError) {
        console.error(requestError)

        setAndroidError(
          extractRequestError(
            requestError,
            'No fue posible consultar Android Enterprise.',
          ),
        )
      } finally {
        setAndroidLoading(false)
      }
    }, [])

  // ============================================================
  // INITIALIZATION
  // ============================================================

  useEffect(() => {
    document.title =
      'Inscripción | TitanMDM'

    void Promise.all([
      loadWindowsTokens(),
      loadAndroid(),
    ])
  }, [
    loadWindowsTokens,
    loadAndroid,
  ])

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        window.location.search,
      )

    const result =
      parameters.get(
        'androidEnterprise',
      )

    if (result === 'connected') {
      setAndroidSuccess(
        'Android Enterprise fue conectado correctamente.',
      )

      void loadAndroid()
    }

    if (result === 'error') {
      setAndroidError(
        'Google no pudo completar la vinculación con Android Enterprise.',
      )
    }
  }, [loadAndroid])

  // ============================================================
  // QR GENERATION
  // ============================================================

  useEffect(() => {
    let cancelled = false

    async function generateQr() {
      if (
        !createdAndroidEnrollment?.qrCode
      ) {
        setAndroidQrDataUrl(null)
        return
      }

      try {
        const dataUrl =
          await QRCode.toDataURL(
            createdAndroidEnrollment.qrCode,
            {
              width: 360,
              margin: 2,
              errorCorrectionLevel: 'M',
            },
          )

        if (!cancelled) {
          setAndroidQrDataUrl(dataUrl)
        }
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setAndroidQrDataUrl(null)

          setAndroidError(
            'Google generó la inscripción, pero TitanMDM no pudo representar el código QR.',
          )
        }
      }
    }

    void generateQr()

    return () => {
      cancelled = true
    }
  }, [createdAndroidEnrollment])

  // ============================================================
  // STATISTICS
  // ============================================================

  const windowsStatistics =
    useMemo(() => {
      const windowsTokens =
        tokens.filter(
          (token) =>
            token.platform === 'Windows',
        )

      return {
        total: windowsTokens.length,

        active:
          windowsTokens.filter(
            (token) =>
              token.status === 'Active' &&
              new Date(
                token.expiresAtUtc,
              ) > new Date(),
          ).length,

        expired:
          windowsTokens.filter(
            (token) =>
              token.status ===
                'Expired' ||
              (
                token.status ===
                  'Active' &&
                new Date(
                  token.expiresAtUtc,
                ) <= new Date()
              ),
          ).length,

        revoked:
          windowsTokens.filter(
            (token) =>
              token.status ===
              'Revoked',
          ).length,
      }
    }, [tokens])

  const androidStatistics =
    useMemo(() => {
      return {
        total:
          androidEnrollments.length,

        active:
          androidEnrollments.filter(
            (item) =>
              !item.isRevoked &&
              !item.isExpired,
          ).length,

        expired:
          androidEnrollments.filter(
            (item) =>
              item.isExpired &&
              !item.isRevoked,
          ).length,

        revoked:
          androidEnrollments.filter(
            (item) =>
              item.isRevoked,
          ).length,
      }
    }, [androidEnrollments])

  const androidActive =
    isAndroidEnterpriseActive(
      androidStatus,
    )

  const androidReadyForSignup =
    Boolean(
      androidStatus?.isConfigured &&
      androidStatus?.canAuthenticate &&
      androidStatus?.hasPublicCallback,
    )

  // ============================================================
  // WINDOWS CREATE
  // ============================================================

  async function handleCreateWindowsToken() {
    try {
      setWindowsCreating(true)
      setWindowsError(null)
      setCreatedToken(null)
      setWindowsCopied(false)

      const response =
        await enrollmentApi.createToken({
          platform: 'Windows',
          expirationMinutes:
            windowsExpirationMinutes,
          maxUses,
        })

      setCreatedToken(response)

      await loadWindowsTokens()
    } catch (requestError) {
      console.error(requestError)

      setWindowsError(
        extractRequestError(
          requestError,
          'No fue posible crear el token Windows.',
        ),
      )
    } finally {
      setWindowsCreating(false)
    }
  }

  async function handleRevokeWindowsToken(
    token: EnrollmentToken,
  ) {
    if (token.status !== 'Active') {
      return
    }

    const confirmed =
      window.confirm(
        '¿Deseas revocar esta credencial Windows?',
      )

    if (!confirmed) {
      return
    }

    try {
      setWindowsError(null)

      await enrollmentApi.revokeToken(
        token.id,
      )

      await loadWindowsTokens()
    } catch (requestError) {
      console.error(requestError)

      setWindowsError(
        'No fue posible revocar la credencial.',
      )
    }
  }

  async function handleCopyWindowsToken() {
    if (!createdToken) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        createdToken.token,
      )

      setWindowsCopied(true)

      window.setTimeout(
        () => setWindowsCopied(false),
        2500,
      )
    } catch (error) {
      console.error(error)

      setWindowsError(
        'No fue posible copiar el token.',
      )
    }
  }

  // ============================================================
  // ANDROID ENTERPRISE CONNECTION
  // ============================================================

  async function handleConnectAndroidEnterprise() {
    try {
      setAndroidConnecting(true)
      setAndroidError(null)
      setAndroidSuccess(null)

      const response =
        await androidEnterpriseApi
          .createSignup()

      window.location.assign(
        response.signupUrl,
      )
    } catch (requestError) {
      console.error(requestError)

      setAndroidError(
        extractRequestError(
          requestError,
          'No fue posible iniciar la conexión con Android Enterprise.',
        ),
      )

      setAndroidConnecting(false)
    }
  }

  // ============================================================
  // ANDROID ENROLLMENT
  // ============================================================

  async function handleCreateAndroidEnrollment() {
    try {
      setAndroidCreating(true)
      setAndroidError(null)
      setAndroidSuccess(null)
      setAndroidCopied(false)
      setCreatedAndroidEnrollment(null)
      setAndroidQrDataUrl(null)

      const response =
        await androidEnterpriseApi
          .createEnrollment({
            mode: androidMode,
            expirationMinutes:
              androidExpirationMinutes,
            policyId: null,
          })

      setCreatedAndroidEnrollment(
        response,
      )

      setAndroidSuccess(
        'La credencial Android Enterprise fue creada correctamente.',
      )

      const enrollments =
        await androidEnterpriseApi
          .getEnrollments()

      setAndroidEnrollments(
        enrollments,
      )
    } catch (requestError) {
      console.error(requestError)

      setAndroidError(
        extractRequestError(
          requestError,
          'No fue posible generar la inscripción Android Enterprise.',
        ),
      )
    } finally {
      setAndroidCreating(false)
    }
  }

  async function handleRevokeAndroidEnrollment(
    enrollment: AndroidEnrollment,
  ) {
    if (
      enrollment.isRevoked ||
      enrollment.isExpired
    ) {
      return
    }

    const confirmed =
      window.confirm(
        '¿Deseas revocar esta inscripción Android Enterprise?',
      )

    if (!confirmed) {
      return
    }

    try {
      setAndroidError(null)
      setAndroidSuccess(null)

      await androidEnterpriseApi
        .revokeEnrollment(
          enrollment.id,
        )

      setAndroidSuccess(
        'La inscripción Android fue revocada.',
      )

      const enrollments =
        await androidEnterpriseApi
          .getEnrollments()

      setAndroidEnrollments(
        enrollments,
      )
    } catch (requestError) {
      console.error(requestError)

      setAndroidError(
        extractRequestError(
          requestError,
          'No fue posible revocar la inscripción Android.',
        ),
      )
    }
  }

  async function handleCopyAndroidToken() {
    if (!createdAndroidEnrollment) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        createdAndroidEnrollment
          .enrollmentToken,
      )

      setAndroidCopied(true)

      window.setTimeout(
        () => setAndroidCopied(false),
        2500,
      )
    } catch (error) {
      console.error(error)

      setAndroidError(
        'No fue posible copiar el token Android.',
      )
    }
  }

  async function handleRefreshAll() {
    await Promise.all([
      loadWindowsTokens(),
      loadAndroid(),
    ])
  }

  const windowsTokens =
    tokens.filter(
      (token) =>
        token.platform === 'Windows',
    )

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="enrollment-page">
      <section className="enrollment-heading">
        <div>
          <p className="enrollment-eyebrow">
            Gestión de dispositivos
          </p>

          <h1>
            Centro de inscripción
          </h1>

          <p className="enrollment-description">
            Incorpora dispositivos Windows y
            Android Enterprise a TitanMDM desde
            un único centro de administración.
          </p>
        </div>

        <button
          className="enrollment-refresh-button"
          type="button"
          onClick={() =>
            void handleRefreshAll()
          }
          disabled={
            windowsLoading ||
            androidLoading
          }
        >
          {windowsLoading ||
          androidLoading
            ? 'Actualizando...'
            : 'Actualizar'}
        </button>
      </section>

      {/* ====================================================== */}
      {/* ANDROID ENTERPRISE */}
      {/* ====================================================== */}

      <section className="android-enterprise-hero">
        <div>
          <div className="android-enterprise-title-row">
            <div className="android-enterprise-logo">
              A
            </div>

            <div>
              <p className="enrollment-eyebrow">
                Google Android Enterprise
              </p>

              <h2>
                Administración Android
              </h2>

              <p>
                Inscribe y administra teléfonos,
                tabletas y dispositivos dedicados
                mediante Android Management API.
              </p>
            </div>
          </div>
        </div>

        <span
          className={`android-enterprise-state ${
            androidActive
              ? 'android-enterprise-state-active'
              : 'android-enterprise-state-inactive'
          }`}
        >
          {androidLoading
            ? 'Consultando...'
            : androidActive
              ? 'Enterprise conectado'
              : getStatusLabel(
                  androidStatus?.status ??
                    'NotConfigured',
                )}
        </span>
      </section>

      {androidError && (
        <div
          className="enrollment-alert enrollment-alert-error"
          role="alert"
        >
          <strong>
            Android Enterprise:
          </strong>{' '}
          {androidError}
        </div>
      )}

      {androidSuccess && (
        <div
          className="enrollment-alert enrollment-alert-success"
          role="status"
        >
          {androidSuccess}
        </div>
      )}

      <section className="android-readiness-grid">
        <article className="android-readiness-card">
          <span
            className={
              androidStatus?.isConfigured
                ? 'android-indicator android-indicator-ok'
                : 'android-indicator android-indicator-error'
            }
          />

          <div>
            <strong>
              Proyecto Google
            </strong>

            <small>
              {androidStatus?.googleProjectId ||
                'No configurado'}
            </small>
          </div>
        </article>

        <article className="android-readiness-card">
          <span
            className={
              androidStatus?.canAuthenticate
                ? 'android-indicator android-indicator-ok'
                : 'android-indicator android-indicator-error'
            }
          />

          <div>
            <strong>
              Autenticación ADC
            </strong>

            <small>
              {androidStatus?.canAuthenticate
                ? 'Autenticación disponible'
                : 'Sin autenticación'}
            </small>
          </div>
        </article>

        <article className="android-readiness-card">
          <span
            className={
              androidStatus?.hasPublicCallback
                ? 'android-indicator android-indicator-ok'
                : 'android-indicator android-indicator-warning'
            }
          />

          <div>
            <strong>
              Callback público
            </strong>

            <small>
              {androidStatus?.hasPublicCallback
                ? 'Disponible'
                : 'Pendiente'}
            </small>
          </div>
        </article>

        <article className="android-readiness-card">
          <span
            className={
              androidActive
                ? 'android-indicator android-indicator-ok'
                : 'android-indicator android-indicator-warning'
            }
          />

          <div>
            <strong>
              Enterprise
            </strong>

            <small>
              {androidActive
                ? androidStatus
                    ?.enterpriseDisplayName ||
                  androidStatus
                    ?.enterpriseName ||
                  'Conectado'
                : 'Sin vincular'}
            </small>
          </div>
        </article>
      </section>

      {!androidActive && (
        <section className="enrollment-panel android-connect-panel">
          <div className="android-connect-content">
            <div>
              <h2>
                Conectar Android Enterprise
              </h2>

              <p>
                Vincula esta organización de
                TitanMDM con Google Android
                Enterprise. Este procedimiento
                solamente debe realizarse una
                vez por organización.
              </p>

              {!androidStatus?.hasPublicCallback && (
                <div className="android-callback-warning">
                  El backend está preparado,
                  pero todavía necesitamos
                  publicar temporalmente el
                  callback HTTPS antes de
                  realizar la vinculación con
                  Google.
                </div>
              )}
            </div>

            <button
              type="button"
              className="android-connect-button"
              disabled={
                androidConnecting ||
                !androidReadyForSignup
              }
              onClick={() =>
                void handleConnectAndroidEnterprise()
              }
            >
              {androidConnecting
                ? 'Conectando...'
                : 'Conectar con Google'}
            </button>
          </div>
        </section>
      )}

      {androidActive && (
        <>
          <section className="enrollment-stats">
            <article className="enrollment-stat-card">
              <span>
                Inscripciones Android
              </span>

              <strong>
                {androidStatistics.total}
              </strong>

              <small>
                Credenciales registradas
              </small>
            </article>

            <article className="enrollment-stat-card">
              <span>Activas</span>

              <strong>
                {androidStatistics.active}
              </strong>

              <small>
                Disponibles para inscripción
              </small>
            </article>

            <article className="enrollment-stat-card">
              <span>Expiradas</span>

              <strong>
                {androidStatistics.expired}
              </strong>

              <small>
                Vigencia finalizada
              </small>
            </article>

            <article className="enrollment-stat-card">
              <span>Revocadas</span>

              <strong>
                {androidStatistics.revoked}
              </strong>

              <small>
                Deshabilitadas manualmente
              </small>
            </article>
          </section>

          <div className="enrollment-main-grid">
            <section className="enrollment-panel">
              <div className="enrollment-panel-header">
                <div>
                  <h2>
                    Nueva inscripción Android
                  </h2>

                  <p>
                    Selecciona cómo TitanMDM
                    administrará el dispositivo.
                  </p>
                </div>
              </div>

              <div className="enrollment-form">
                <div className="android-mode-grid">
                  {(
                    [
                      'FullyManaged',
                      'Dedicated',
                      'WorkProfile',
                    ] as AndroidEnrollmentMode[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`android-mode-card ${
                        androidMode === mode
                          ? 'android-mode-card-selected'
                          : ''
                      }`}
                      onClick={() =>
                        setAndroidMode(mode)
                      }
                    >
                      <strong>
                        {getAndroidModeLabel(
                          mode,
                        )}
                      </strong>

                      <span>
                        {mode ===
                        'FullyManaged'
                          ? 'Corporativo'
                          : mode ===
                              'Dedicated'
                            ? 'Kiosk'
                            : 'BYOD'}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="enrollment-platform-info">
                  <strong>
                    {getAndroidModeLabel(
                      androidMode,
                    )}
                  </strong>

                  <p>
                    {getAndroidModeDescription(
                      androidMode,
                    )}
                  </p>
                </div>

                <div className="enrollment-field">
                  <label htmlFor="androidExpiration">
                    Vigencia del QR
                  </label>

                  <select
                    id="androidExpiration"
                    value={
                      androidExpirationMinutes
                    }
                    onChange={(event) =>
                      setAndroidExpirationMinutes(
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

                <button
                  type="button"
                  className="enrollment-primary-button"
                  disabled={androidCreating}
                  onClick={() =>
                    void handleCreateAndroidEnrollment()
                  }
                >
                  {androidCreating
                    ? 'Generando con Google...'
                    : 'Generar QR de inscripción'}
                </button>
              </div>
            </section>

            <section className="enrollment-panel">
              <div className="enrollment-panel-header">
                <div>
                  <h2>
                    QR de aprovisionamiento
                  </h2>

                  <p>
                    Código generado a partir del
                    provisioning data entregado
                    por Android Management API.
                  </p>
                </div>
              </div>

              {!createdAndroidEnrollment ? (
                <div className="enrollment-empty-secret">
                  <div className="enrollment-secret-icon">
                    ▦
                  </div>

                  <h3>
                    Esperando inscripción
                  </h3>

                  <p>
                    Selecciona un modo y genera
                    una nueva credencial Android.
                  </p>
                </div>
              ) : (
                <div className="android-qr-result">
                  <div className="enrollment-secret-warning">
                    Esta credencial contiene
                    información sensible de
                    aprovisionamiento. Utilízala
                    únicamente en el dispositivo
                    que vas a administrar.
                  </div>

                  {androidQrDataUrl ? (
                    <div className="android-qr-container">
                      <img
                        src={androidQrDataUrl}
                        alt="Código QR de inscripción Android Enterprise"
                      />
                    </div>
                  ) : (
                    <div className="enrollment-loading">
                      Generando QR...
                    </div>
                  )}

                  <div className="android-token-summary">
                    <span>
                      Token Android Enterprise
                    </span>

                    <code>
                      {
                        createdAndroidEnrollment
                          .enrollmentToken
                      }
                    </code>
                  </div>

                  <button
                    type="button"
                    className="enrollment-copy-button"
                    onClick={() =>
                      void handleCopyAndroidToken()
                    }
                  >
                    {androidCopied
                      ? 'Token copiado'
                      : 'Copiar token'}
                  </button>

                  <dl className="enrollment-secret-details">
                    <div>
                      <dt>Modo</dt>

                      <dd>
                        {getAndroidModeLabel(
                          createdAndroidEnrollment
                            .mode,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Creado</dt>

                      <dd>
                        {formatDate(
                          createdAndroidEnrollment
                            .createdAtUtc,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Expira</dt>

                      <dd>
                        {formatDate(
                          createdAndroidEnrollment
                            .expiresAtUtc,
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </section>
          </div>

          <section className="enrollment-panel">
            <div className="enrollment-panel-header">
              <div>
                <h2>
                  Historial Android Enterprise
                </h2>

                <p>
                  Credenciales de
                  aprovisionamiento generadas
                  para esta organización.
                </p>
              </div>
            </div>

            {androidLoading ? (
              <div className="enrollment-loading">
                Cargando inscripciones...
              </div>
            ) : androidEnrollments.length ===
              0 ? (
              <div className="enrollment-empty-table">
                Todavía no existen
                inscripciones Android.
              </div>
            ) : (
              <div className="enrollment-table-wrapper">
                <table className="enrollment-table">
                  <thead>
                    <tr>
                      <th>Modo</th>
                      <th>Estado</th>
                      <th>Creado</th>
                      <th>Expira</th>
                      <th>Política</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {androidEnrollments.map(
                      (item) => {
                        const status =
                          item.isRevoked
                            ? 'Revoked'
                            : item.isExpired
                              ? 'Expired'
                              : 'Active'

                        return (
                          <tr key={item.id}>
                            <td>
                              <span className="enrollment-platform">
                                {getAndroidModeLabel(
                                  item.mode,
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`enrollment-status enrollment-status-${status.toLowerCase()}`}
                              >
                                {getStatusLabel(
                                  status,
                                )}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                item.createdAtUtc,
                              )}
                            </td>

                            <td>
                              {formatDate(
                                item.expiresAtUtc,
                              )}
                            </td>

                            <td>
                              {item.policyId
                                ? 'Asignada'
                                : 'Predeterminada'}
                            </td>

                            <td>
                              <button
                                type="button"
                                className="enrollment-action-button"
                                disabled={
                                  item.isRevoked ||
                                  item.isExpired
                                }
                                onClick={() =>
                                  void handleRevokeAndroidEnrollment(
                                    item,
                                  )
                                }
                              >
                                Revocar
                              </button>
                            </td>
                          </tr>
                        )
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ====================================================== */}
      {/* WINDOWS */}
      {/* ====================================================== */}

      <section className="enrollment-section-divider">
        <div>
          <p className="enrollment-eyebrow">
            Windows
          </p>

          <h2>
            Inscripción de dispositivos Windows
          </h2>

          <p>
            Flujo de credenciales TitanMDM para
            equipos Windows administrados por el
            agente.
          </p>
        </div>
      </section>

      {windowsError && (
        <div
          className="enrollment-alert enrollment-alert-error"
          role="alert"
        >
          {windowsError}
        </div>
      )}

      <section className="enrollment-stats">
        <article className="enrollment-stat-card">
          <span>Total Windows</span>
          <strong>
            {windowsStatistics.total}
          </strong>
          <small>
            Credenciales registradas
          </small>
        </article>

        <article className="enrollment-stat-card">
          <span>Activas</span>
          <strong>
            {windowsStatistics.active}
          </strong>
          <small>
            Disponibles para inscripción
          </small>
        </article>

        <article className="enrollment-stat-card">
          <span>Expiradas</span>
          <strong>
            {windowsStatistics.expired}
          </strong>
          <small>
            Fuera de vigencia
          </small>
        </article>

        <article className="enrollment-stat-card">
          <span>Revocadas</span>
          <strong>
            {windowsStatistics.revoked}
          </strong>
          <small>
            Deshabilitadas
          </small>
        </article>
      </section>

      <div className="enrollment-main-grid">
        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <div>
              <h2>
                Nueva inscripción Windows
              </h2>

              <p>
                Genera una credencial temporal
                para el agente TitanMDM.
              </p>
            </div>
          </div>

          <div className="enrollment-form">
            <div className="enrollment-field">
              <label htmlFor="windowsExpiration">
                Vigencia
              </label>

              <select
                id="windowsExpiration"
                value={
                  windowsExpirationMinutes
                }
                onChange={(event) =>
                  setWindowsExpirationMinutes(
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
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />
            </div>

            <button
              className="enrollment-primary-button"
              type="button"
              disabled={
                windowsCreating ||
                maxUses < 1 ||
                maxUses > 1000
              }
              onClick={() =>
                void handleCreateWindowsToken()
              }
            >
              {windowsCreating
                ? 'Generando...'
                : 'Generar token Windows'}
            </button>
          </div>
        </section>

        <section className="enrollment-panel">
          <div className="enrollment-panel-header">
            <div>
              <h2>
                Credencial Windows
              </h2>

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
                Genera una credencial Windows
                para visualizarla aquí.
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
                  void handleCopyWindowsToken()
                }
              >
                {windowsCopied
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
          <div>
            <h2>
              Historial Windows
            </h2>

            <p>
              Credenciales Windows asociadas a
              esta organización.
            </p>
          </div>
        </div>

        {windowsLoading ? (
          <div className="enrollment-loading">
            Cargando credenciales...
          </div>
        ) : windowsTokens.length === 0 ? (
          <div className="enrollment-empty-table">
            Todavía no existen tokens Windows.
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
                {windowsTokens.map(
                  (token) => {
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
                          <span
                            className={`enrollment-status enrollment-status-${effectiveStatus.toLowerCase()}`}
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
                              'Active'
                            }
                            onClick={() =>
                              void handleRevokeWindowsToken(
                                token,
                              )
                            }
                          >
                            Revocar
                          </button>
                        </td>
                      </tr>
                    )
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}