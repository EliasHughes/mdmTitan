import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  CircleStop,
  Keyboard,
  Maximize2,
  Monitor,
  MousePointer2,
  RadioTower,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import RemoteDesktopViewer from '../../components/remote/RemoteDesktopViewer'

import {
  getRemoteSession,
  listRemoteSessions,
  terminateRemoteSession,
} from '../../api/remoteSupportApi'

import type {
  RemoteSession,
} from '../../api/remoteSupportApi'

import {
  RemoteSupportSignalRClient,
} from '../../api/remoteSupportSignalR'

import type {
  RemoteFrame,
  RemoteSessionChanged,
} from '../../api/remoteSupportSignalR'

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return '—'
  }

  return new Date(value)
    .toLocaleString()
}

function statusLabel(
  status?: string,
): string {
  switch (status) {
    case 'Requested':
      return 'Solicitada'

    case 'Connecting':
      return 'Conectando'

    case 'Connected':
      return 'Conectado'

    case 'Disconnecting':
      return 'Desconectando'

    case 'Completed':
      return 'Finalizada'

    case 'Failed':
      return 'Error'

    case 'Expired':
      return 'Expirada'

    case 'Cancelled':
      return 'Cancelada'

    default:
      return status ?? 'Sin sesión'
  }
}

export function RemotePage() {
  const signalRRef =
    useRef<RemoteSupportSignalRClient | null>(
      null,
    )

  const viewerContainerRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const [
    sessions,
    setSessions,
  ] =
    useState<RemoteSession[]>([])

  const [
    selectedSessionId,
    setSelectedSessionId,
  ] =
    useState<string>('')

  const [
    activeSession,
    setActiveSession,
  ] =
    useState<RemoteSession | null>(
      null,
    )

  const [
    frame,
    setFrame,
  ] =
    useState<RemoteFrame | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    channelConnected,
    setChannelConnected,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const frameUrl =
    useMemo(() => {
      if (!frame) {
        return null
      }

      return (
        `data:${frame.mimeType};base64,` +
        frame.base64Data
      )
    }, [frame])

  const refreshSessions =
    useCallback(async () => {
      try {
        setError(null)

        const result =
          await listRemoteSessions()

        setSessions(result)

        if (
          selectedSessionId
        ) {
          const selected =
            result.find(
              (item) =>
                item.id ===
                selectedSessionId,
            )

          if (selected) {
            setActiveSession(
              selected,
            )
          }
        }
      } catch (requestError) {
        console.error(
          requestError,
        )

        setError(
          'No fue posible obtener las sesiones remotas.',
        )
      } finally {
        setLoading(false)
      }
    }, [selectedSessionId])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          void refreshSessions()
        },
        10000,
      )

    return () =>
      window.clearInterval(
        interval,
      )
  }, [refreshSessions])

  useEffect(() => {
    const client =
      new RemoteSupportSignalRClient()

    signalRRef.current =
      client

    const onSessionChanged =
      async (
        update:
          RemoteSessionChanged,
      ) => {
        if (
          update.sessionId !==
          selectedSessionId
        ) {
          return
        }

        try {
          const updated =
            await getRemoteSession(
              update.sessionId,
            )

          setActiveSession(
            updated,
          )

          setSessions(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  updated.id
                    ? updated
                    : item,
              ),
          )
        } catch (requestError) {
          console.error(
            requestError,
          )
        }
      }

    void client
      .connect({
        onFrame:
          (nextFrame) => {
            if (
              nextFrame.sessionId ===
              selectedSessionId
            ) {
              setFrame(
                nextFrame,
              )
            }
          },

        onSessionChanged,

        onReconnecting:
          () => {
            setChannelConnected(
              false,
            )
          },

        onReconnected:
          () => {
            setChannelConnected(
              true,
            )

            if (
              selectedSessionId
            ) {
              void client.joinSession(
                selectedSessionId,
              )
            }
          },

        onClosed:
          () => {
            setChannelConnected(
              false,
            )
          },
      })
      .then(() => {
        setChannelConnected(
          true,
        )
      })
      .catch(
        (connectionError) => {
          console.error(
            connectionError,
          )

          setChannelConnected(
            false,
          )
        },
      )

    return () => {
      void client.disconnect()
    }
  }, [selectedSessionId])

  const selectSession =
    async (
      sessionId: string,
    ) => {
      try {
        setError(null)
        setFrame(null)

        const previousId =
          selectedSessionId

        if (
          previousId &&
          signalRRef.current
        ) {
          await signalRRef.current
            .leaveSession(
              previousId,
            )
        }

        setSelectedSessionId(
          sessionId,
        )

        if (!sessionId) {
          setActiveSession(
            null,
          )

          return
        }

        const session =
          await getRemoteSession(
            sessionId,
          )

        setActiveSession(
          session,
        )

        if (
          signalRRef.current
        ) {
          await signalRRef.current
            .joinSession(
              sessionId,
            )
        }
      } catch (requestError) {
        console.error(
          requestError,
        )

        setError(
          'No fue posible abrir la sesión remota.',
        )
      }
    }

  const terminate =
    async () => {
      if (!activeSession) {
        return
      }

      try {
        setError(null)

        await terminateRemoteSession(
          activeSession.id,
        )

        setFrame(null)

        await refreshSessions()

        const updated =
          await getRemoteSession(
            activeSession.id,
          )

        setActiveSession(
          updated,
        )
      } catch (requestError) {
        console.error(
          requestError,
        )

        setError(
          'No fue posible finalizar la sesión.',
        )
      }
    }

  const pointerMove =
    useCallback(
      (
        x: number,
        y: number,
      ) => {
        if (
          !activeSession ||
          !signalRRef.current
        ) {
          return
        }

        void signalRRef.current
          .pointerMove(
            activeSession.id,
            x,
            y,
          )
      },
      [activeSession],
    )

  const pointerButton =
    useCallback(
      (
        action:
          | 'left-down'
          | 'left-up'
          | 'right-down'
          | 'right-up',
      ) => {
        if (
          !activeSession ||
          !signalRRef.current
        ) {
          return
        }

        void signalRRef.current
          .pointerButton(
            activeSession.id,
            action,
          )
      },
      [activeSession],
    )

  const wheel =
    useCallback(
      (
        delta: number,
      ) => {
        if (
          !activeSession ||
          !signalRRef.current
        ) {
          return
        }

        void signalRRef.current
          .pointerWheel(
            activeSession.id,
            delta,
          )
      },
      [activeSession],
    )

  const keyboard =
    useCallback(
      (
        virtualKey: number,
        keyDown: boolean,
      ) => {
        if (
          !activeSession ||
          !signalRRef.current
        ) {
          return
        }

        void signalRRef.current
          .keyboard(
            activeSession.id,
            virtualKey,
            keyDown,
          )
      },
      [activeSession],
    )

  const fullscreen =
    async () => {
      if (
        !viewerContainerRef
          .current
      ) {
        return
      }

      if (
        document.fullscreenElement
      ) {
        await document
          .exitFullscreen()

        return
      }

      await viewerContainerRef
        .current
        .requestFullscreen()
    }

  const connected =
    activeSession?.status ===
    'Connected'

  const activeSessions =
    sessions.filter(
      (session) =>
        ![
          'Completed',
          'Failed',
          'Expired',
          'Cancelled',
        ].includes(
          session.status,
        ),
    )

  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
      }}
    >
      <header>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <RadioTower
            size={28}
          />

          <div>
            <h1
              style={{
                margin: 0,
              }}
            >
              Soporte remoto
            </h1>

            <div
              style={{
                opacity: 0.7,
                marginTop: 4,
              }}
            >
              Consola de asistencia
              remota para endpoints
              Windows administrados.
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background:
              'rgba(220,38,38,.12)',
            border:
              '1px solid rgba(220,38,38,.3)',
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(250px, 320px) minmax(0, 1fr)',
          gap: 18,
        }}
      >
        <aside
          style={{
            border:
              '1px solid rgba(148,163,184,.2)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <strong>
              Sesiones
            </strong>

            <button
              type="button"
              onClick={() =>
                void refreshSessions()
              }
              style={{
                cursor: 'pointer',
              }}
            >
              <RefreshCw
                size={15}
              />
            </button>
          </div>

          <select
            value={
              selectedSessionId
            }
            disabled={loading}
            onChange={(event) =>
              void selectSession(
                event.target.value,
              )
            }
            style={{
              width: '100%',
              marginTop: 14,
              padding: 10,
            }}
          >
            <option value="">
              Seleccionar sesión
            </option>

            {activeSessions.map(
              (session) => (
                <option
                  key={
                    session.id
                  }
                  value={
                    session.id
                  }
                >
                  {session.technicianName}
                  {' · '}
                  {statusLabel(
                    session.status,
                  )}
                </option>
              ),
            )}
          </select>

          {activeSession && (
            <div
              style={{
                marginTop: 18,
                display: 'grid',
                gap: 12,
                fontSize: 13,
              }}
            >
              <div>
                <strong>
                  Estado
                </strong>

                <div>
                  {statusLabel(
                    activeSession.status,
                  )}
                </div>
              </div>

              <div>
                <strong>
                  Técnico
                </strong>

                <div>
                  {
                    activeSession
                      .technicianName
                  }
                </div>
              </div>

              <div>
                <strong>
                  Motivo
                </strong>

                <div>
                  {
                    activeSession
                      .reason
                  }
                </div>
              </div>

              <div>
                <strong>
                  Solicitada
                </strong>

                <div>
                  {formatDate(
                    activeSession
                      .requestedAtUtc,
                  )}
                </div>
              </div>

              <div>
                <strong>
                  Expira
                </strong>

                <div>
                  {formatDate(
                    activeSession
                      .expiresAtUtc,
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <MousePointer2
                    size={14}
                  />{' '}
                  {activeSession
                    .allowMouse
                    ? 'Mouse'
                    : 'Sin mouse'}
                </span>

                <span>
                  <Keyboard
                    size={14}
                  />{' '}
                  {activeSession
                    .allowKeyboard
                    ? 'Teclado'
                    : 'Sin teclado'}
                </span>
              </div>

              {![
                'Completed',
                'Failed',
                'Expired',
                'Cancelled',
              ].includes(
                activeSession.status,
              ) && (
                <button
                  type="button"
                  onClick={() =>
                    void terminate()
                  }
                  style={{
                    padding: 10,
                    cursor:
                      'pointer',
                  }}
                >
                  <CircleStop
                    size={15}
                  />{' '}
                  Finalizar sesión
                </button>
              )}
            </div>
          )}
        </aside>

        <main
          style={{
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Monitor
                size={18}
              />

              <strong>
                Escritorio remoto
              </strong>

              <span
                style={{
                  fontSize: 12,
                  opacity: 0.75,
                }}
              >
                {channelConnected
                  ? '● Canal SignalR conectado'
                  : '○ Canal desconectado'}
              </span>

              {connected && (
                <span
                  style={{
                    fontSize: 12,
                  }}
                >
                  <ShieldCheck
                    size={14}
                  />{' '}
                  Sesión activa
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                void fullscreen()
              }
              disabled={
                !activeSession
              }
              style={{
                cursor:
                  activeSession
                    ? 'pointer'
                    : 'not-allowed',
              }}
            >
              <Maximize2
                size={15}
              />{' '}
              Pantalla completa
            </button>
          </div>

          <div
            ref={
              viewerContainerRef
            }
            style={{
              minHeight: 520,
            }}
          >
            <RemoteDesktopViewer
              frameUrl={frameUrl}
              width={
                frame?.width
              }
              height={
                frame?.height
              }
              connected={
                connected
              }
              allowMouse={
                activeSession
                  ?.allowMouse ??
                false
              }
              allowKeyboard={
                activeSession
                  ?.allowKeyboard ??
                false
              }
              onPointerMove={
                pointerMove
              }
              onPointerButton={
                pointerButton
              }
              onWheel={wheel}
              onKeyboard={
                keyboard
              }
            />
          </div>
        </main>
      </section>
    </div>
  )
}