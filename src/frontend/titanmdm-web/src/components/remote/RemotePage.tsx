import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  CircleStop,
  Clock3,
  Keyboard,
  Maximize2,
  Monitor,
  MousePointer2,
  Play,
  RadioTower,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import {
  devicesApi,
} from '../../api/devicesApi'

import {
  createRemoteSession,
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

import RemoteDesktopViewer
  from '../../components/remote/RemoteDesktopViewer'

import type {
  DeviceListItem,
} from '../../types/device'

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return '—'
  }

  return new Date(
    value,
  ).toLocaleString()
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
      return 'Conectada'

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
      return (
        status ??
        'Sin sesión'
      )
  }
}

function isTerminal(
  status: string,
): boolean {
  return [
    'Completed',
    'Failed',
    'Expired',
    'Cancelled',
  ].includes(
    status,
  )
}

export function RemotePage() {
  /*
   * ============================================================
   * SIGNALR / REFERENCES
   * ============================================================
   */

  const signalRRef =
    useRef<
      RemoteSupportSignalRClient | null
    >(
      null,
    )

  /*
   * Este ref mantiene siempre el SessionId actual sin obligar
   * a reconstruir la conexión SignalR cuando cambia la sesión.
   */
  const selectedSessionIdRef =
    useRef<string>(
      '',
    )

  const viewerContainerRef =
    useRef<
      HTMLDivElement | null
    >(
      null,
    )

  /*
   * ============================================================
   * DATA
   * ============================================================
   */

  const [
    devices,
    setDevices,
  ] =
    useState<
      DeviceListItem[]
    >(
      [],
    )

  const [
    sessions,
    setSessions,
  ] =
    useState<
      RemoteSession[]
    >(
      [],
    )

  const [
    activeSession,
    setActiveSession,
  ] =
    useState<
      RemoteSession | null
    >(
      null,
    )

  /*
   * ============================================================
   * SELECTION
   * ============================================================
   */

  const [
    selectedSessionId,
    setSelectedSessionId,
  ] =
    useState(
      '',
    )

  const [
    selectedDeviceId,
    setSelectedDeviceId,
  ] =
    useState(
      '',
    )

  /*
   * Mantener sincronizado el ref con el state.
   */
  useEffect(
    () => {
      selectedSessionIdRef.current =
        selectedSessionId
    },
    [
      selectedSessionId,
    ],
  )

  /*
   * ============================================================
   * NEW SESSION FORM
   * ============================================================
   */

  const [
    reason,
    setReason,
  ] =
    useState(
      'Soporte técnico remoto',
    )

  const [
    maximumDurationMinutes,
    setMaximumDurationMinutes,
  ] =
    useState(
      120,
    )

  const [
    allowMouse,
    setAllowMouse,
  ] =
    useState(
      true,
    )

  const [
    allowKeyboard,
    setAllowKeyboard,
  ] =
    useState(
      true,
    )

  const [
    allowClipboard,
    setAllowClipboard,
  ] =
    useState(
      false,
    )

  const [
    allowFileTransfer,
    setAllowFileTransfer,
  ] =
    useState(
      false,
    )

  /*
   * ============================================================
   * REMOTE FRAME
   * ============================================================
   */

  const [
    frame,
    setFrame,
  ] =
    useState<
      RemoteFrame | null
    >(
      null,
    )

  /*
   * ============================================================
   * UI STATE
   * ============================================================
   */

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    creating,
    setCreating,
  ] =
    useState(
      false,
    )

  const [
    terminating,
    setTerminating,
  ] =
    useState(
      false,
    )

  const [
    channelConnected,
    setChannelConnected,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    )

  /*
   * ============================================================
   * FRAME URL
   * ============================================================
   */

  const frameUrl =
    useMemo(
      () => {
        if (!frame) {
          return null
        }

        return (
          `data:${frame.mimeType};base64,` +
          frame.base64Data
        )
      },
      [
        frame,
      ],
    )

  /*
   * ============================================================
   * WINDOWS DEVICES
   * ============================================================
   */

  const windowsDevices =
    useMemo(
      () =>
        devices.filter(
          (
            device,
          ) =>
            device.platform ===
              'Windows'
            &&
            device.isManaged,
        ),
      [
        devices,
      ],
    )

  /*
   * ============================================================
   * ACTIVE SESSIONS
   * ============================================================
   */

  const activeSessions =
    useMemo(
      () =>
        sessions.filter(
          (
            session,
          ) =>
            !isTerminal(
              session.status,
            ),
        ),
      [
        sessions,
      ],
    )

  /*
   * ============================================================
   * SELECTED DEVICE
   * ============================================================
   */

  const selectedDevice =
    useMemo(
      () =>
        windowsDevices.find(
          (
            device,
          ) =>
            device.id ===
            selectedDeviceId,
        )
        ??
        null,
      [
        windowsDevices,
        selectedDeviceId,
      ],
    )

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */

  const loadData =
    useCallback(
      async () => {
        try {
          setError(
            null,
          )

          const [
            deviceResult,
            sessionResult,
          ] =
            await Promise.all(
              [
                devicesApi
                  .getDevices(
                    {
                      platform:
                        'Windows',

                      page:
                        1,

                      pageSize:
                        200,
                    },
                  ),

                listRemoteSessions(
                  200,
                ),
              ],
            )

          setDevices(
            deviceResult.items,
          )

          setSessions(
            sessionResult,
          )
        } catch (
          requestError
        ) {
          console.error(
            requestError,
          )

          setError(
            'No fue posible cargar los dispositivos o las sesiones remotas.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  /*
   * Initial load
   */

  useEffect(
    () => {
      void loadData()
    },
    [
      loadData,
    ],
  )

  /*
   * Background refresh.
   */

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            void loadData()
          },
          15000,
        )

      return () => {
        window.clearInterval(
          timer,
        )
      }
    },
    [
      loadData,
    ],
  )

  /*
   * ============================================================
   * REFRESH ACTIVE SESSION
   * ============================================================
   */

  const refreshActiveSession =
    useCallback(
      async (
        sessionId:
          string,
      ) => {
        try {
          const updated =
            await getRemoteSession(
              sessionId,
            )

          /*
           * Solo modificar activeSession si seguimos visualizando
           * esa misma sesión.
           */
          if (
            selectedSessionIdRef.current ===
            updated.id
          ) {
            setActiveSession(
              updated,
            )
          }

          setSessions(
            (
              current,
            ) => {
              const exists =
                current.some(
                  (
                    item,
                  ) =>
                    item.id ===
                    updated.id,
                )

              if (
                !exists
              ) {
                return [
                  updated,
                  ...current,
                ]
              }

              return current.map(
                (
                  item,
                ) =>
                  item.id ===
                  updated.id
                    ? updated
                    : item,
              )
            },
          )
        } catch (
          requestError
        ) {
          console.error(
            'No fue posible actualizar la sesión remota.',
            requestError,
          )
        }
      },
      [],
    )

  /*
   * ============================================================
   * SIGNALR
   * ============================================================
   *
   * IMPORTANT:
   *
   * Este effect NO depende de selectedSessionId.
   *
   * Queremos una sola conexión SignalR durante toda la vida
   * de RemotePage.
   * ============================================================
   */

  useEffect(
    () => {
      let disposed =
        false

      const client =
        new RemoteSupportSignalRClient()

      signalRRef.current =
        client

      const joinCurrentSession =
        async () => {
          const sessionId =
            selectedSessionIdRef.current

          if (
            !sessionId
          ) {
            return
          }

          try {
            await client
              .joinSession(
                sessionId,
              )
          } catch (
            joinError
          ) {
            console.error(
              'SignalR está conectado, pero JoinSession falló.',
              joinError,
            )

            /*
             * IMPORTANTE:
             *
             * No ponemos channelConnected=false aquí.
             *
             * El websocket puede estar perfectamente conectado
             * aunque JoinSession haya fallado por permisos,
             * autenticación o estado de la sesión.
             */
            if (
              !disposed
            ) {
              setError(
                'SignalR está conectado, pero TitanMDM no pudo unirse a la sesión remota. Revisa autenticación, permisos remote.view y el estado de la sesión.',
              )
            }
          }
        }

      void client
        .connect(
          {
            onFrame:
              (
                nextFrame,
              ) => {
                /*
                 * Ignorar frames pertenecientes a otra sesión.
                 */
                if (
                  nextFrame.sessionId !==
                  selectedSessionIdRef.current
                ) {
                  return
                }

                setFrame(
                  (
                    current,
                  ) => {
                    /*
                     * Ignorar frames viejos o duplicados.
                     */
                    if (
                      current
                      &&
                      current.sessionId ===
                        nextFrame.sessionId
                      &&
                      nextFrame.sequence <=
                        current.sequence
                    ) {
                      return current
                    }

                    return nextFrame
                  },
                )
              },

            onSessionChanged:
              (
                update:
                  RemoteSessionChanged,
              ) => {
                /*
                 * Actualizamos siempre la colección local.
                 * activeSession solo se modifica dentro de
                 * refreshActiveSession si corresponde.
                 */
                void refreshActiveSession(
                  update.sessionId,
                )
              },

            onReconnecting:
              () => {
                if (
                  disposed
                ) {
                  return
                }

                setChannelConnected(
                  false,
                )
              },

            onReconnected:
              () => {
                if (
                  disposed
                ) {
                  return
                }

                setChannelConnected(
                  true,
                )

                /*
                 * La conexión SignalR recibe un ConnectionId nuevo
                 * después de reconectarse, por lo que el técnico
                 * debe volver al grupo de la sesión.
                 */
                void joinCurrentSession()
              },

            onClosed:
              (
                closeError,
              ) => {
                if (
                  disposed
                ) {
                  return
                }

                setChannelConnected(
                  false,
                )

                if (
                  closeError
                ) {
                  console.error(
                    'SignalR Remote Support cerrado.',
                    closeError,
                  )
                }
              },
          },
        )
        .then(
          async () => {
            if (
              disposed
            ) {
              return
            }

            /*
             * El socket ya está realmente conectado.
             */
            setChannelConnected(
              true,
            )

            /*
             * Si entramos a la pantalla con una sesión ya elegida,
             * volver a unirnos.
             */
            await joinCurrentSession()
          },
        )
        .catch(
          (
            connectionError,
          ) => {
            if (
              disposed
            ) {
              return
            }

            console.error(
              'No fue posible conectar SignalR Remote Support.',
              connectionError,
            )

            setChannelConnected(
              false,
            )

            setError(
              'No fue posible establecer el canal SignalR de soporte remoto.',
            )
          },
        )

      return () => {
        disposed =
          true

        if (
          signalRRef.current ===
          client
        ) {
          signalRRef.current =
            null
        }

        void client
          .disconnect()
      }
    },
    [
      refreshActiveSession,
    ],
  )

  /*
   * ============================================================
   * SELECT SESSION
   * ============================================================
   */

  const selectSession =
    async (
      sessionId:
        string,
    ) => {
      try {
        setError(
          null,
        )

        setFrame(
          null,
        )

        const previousSessionId =
          selectedSessionIdRef.current

        /*
         * Salir del grupo SignalR anterior antes de seleccionar
         * la siguiente sesión.
         */
        if (
          previousSessionId
          &&
          previousSessionId !==
            sessionId
          &&
          signalRRef.current
        ) {
          try {
            await signalRRef.current
              .leaveSession(
                previousSessionId,
              )
          } catch (
            leaveError
          ) {
            console.warn(
              'No fue posible abandonar el grupo SignalR anterior.',
              leaveError,
            )
          }
        }

        /*
         * Actualizamos ref inmediatamente para evitar races.
         */
        selectedSessionIdRef.current =
          sessionId

        setSelectedSessionId(
          sessionId,
        )

        if (
          !sessionId
        ) {
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

        setSelectedDeviceId(
          session.deviceId,
        )

        if (
          signalRRef.current
          &&
          channelConnected
        ) {
          try {
            await signalRRef.current
              .joinSession(
                sessionId,
              )
          } catch (
            joinError
          ) {
            console.error(
              'No fue posible unirse a la sesión SignalR seleccionada.',
              joinError,
            )

            setError(
              'El canal SignalR está disponible, pero no fue posible unirse a esta sesión remota.',
            )
          }
        }
      } catch (
        requestError
      ) {
        console.error(
          requestError,
        )

        setError(
          'No fue posible abrir la sesión seleccionada.',
        )
      }
    }

  /*
   * ============================================================
   * START SESSION
   * ============================================================
   */

  const startSession =
    async () => {
      if (
        !selectedDeviceId
      ) {
        setError(
          'Selecciona un equipo Windows.',
        )

        return
      }

      if (
        reason
          .trim()
          .length <
        3
      ) {
        setError(
          'Indica el motivo de la conexión remota.',
        )

        return
      }

      try {
        setCreating(
          true,
        )

        setError(
          null,
        )

        setFrame(
          null,
        )

        const session =
          await createRemoteSession(
            {
              deviceId:
                selectedDeviceId,

              reason:
                reason.trim(),

              allowKeyboard,

              allowMouse,

              allowClipboard,

              allowFileTransfer,

              maximumDurationMinutes,
            },
          )

        setSessions(
          (
            current,
          ) => [
            session,

            ...current.filter(
              (
                item,
              ) =>
                item.id !==
                session.id,
            ),
          ],
        )

        /*
         * Actualizamos el ref antes del estado React para que
         * cualquier evento SignalR inmediato conozca la sesión.
         */
        selectedSessionIdRef.current =
          session.id

        setSelectedSessionId(
          session.id,
        )

        setActiveSession(
          session,
        )

        /*
         * Si SignalR ya está conectado, unir al técnico al grupo.
         */
        if (
          signalRRef.current
          &&
          channelConnected
        ) {
          try {
            await signalRRef.current
              .joinSession(
                session.id,
              )
          } catch (
            joinError
          ) {
            console.error(
              'Sesión creada, pero JoinSession falló.',
              joinError,
            )

            setError(
              'La sesión fue creada, pero el canal SignalR no pudo unirse a ella. Revisa autenticación y permisos remote.view.',
            )
          }
        }
      } catch (
        requestError
      ) {
        console.error(
          requestError,
        )

        setError(
          'No fue posible crear la sesión remota. Verifica que el dispositivo esté administrado y que no tenga otra sesión activa.',
        )
      } finally {
        setCreating(
          false,
        )
      }
    }

  /*
   * ============================================================
   * END SESSION
   * ============================================================
   */

  const endSession =
    async () => {
      if (
        !activeSession
      ) {
        return
      }

      const sessionId =
        activeSession.id

      try {
        setTerminating(
          true,
        )

        setError(
          null,
        )

        await terminateRemoteSession(
          sessionId,
        )

        setFrame(
          null,
        )

        await refreshActiveSession(
          sessionId,
        )

        await loadData()
      } catch (
        requestError
      ) {
        console.error(
          requestError,
        )

        setError(
          'No fue posible finalizar la sesión remota.',
        )
      } finally {
        setTerminating(
          false,
        )
      }
    }

  /*
   * ============================================================
   * REMOTE INPUT
   * ============================================================
   */

  const pointerMove =
    useCallback(
      (
        x:
          number,

        y:
          number,
      ) => {
        if (
          !activeSession
          ||
          !signalRRef.current
          ||
          !channelConnected
          ||
          activeSession.status !==
            'Connected'
        ) {
          return
        }

        void signalRRef.current
          .pointerMove(
            activeSession.id,
            x,
            y,
          )
          .catch(
            (
              inputError,
            ) => {
              console.error(
                'PointerMove falló.',
                inputError,
              )
            },
          )
      },
      [
        activeSession,
        channelConnected,
      ],
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
          !activeSession
          ||
          !signalRRef.current
          ||
          !channelConnected
          ||
          activeSession.status !==
            'Connected'
        ) {
          return
        }

        void signalRRef.current
          .pointerButton(
            activeSession.id,
            action,
          )
          .catch(
            (
              inputError,
            ) => {
              console.error(
                'PointerButton falló.',
                inputError,
              )
            },
          )
      },
      [
        activeSession,
        channelConnected,
      ],
    )

  const wheel =
    useCallback(
      (
        delta:
          number,
      ) => {
        if (
          !activeSession
          ||
          !signalRRef.current
          ||
          !channelConnected
          ||
          activeSession.status !==
            'Connected'
        ) {
          return
        }

        void signalRRef.current
          .pointerWheel(
            activeSession.id,
            delta,
          )
          .catch(
            (
              inputError,
            ) => {
              console.error(
                'PointerWheel falló.',
                inputError,
              )
            },
          )
      },
      [
        activeSession,
        channelConnected,
      ],
    )

  const keyboard =
    useCallback(
      (
        virtualKey:
          number,

        keyDown:
          boolean,
      ) => {
        if (
          !activeSession
          ||
          !signalRRef.current
          ||
          !channelConnected
          ||
          activeSession.status !==
            'Connected'
        ) {
          return
        }

        void signalRRef.current
          .keyboard(
            activeSession.id,
            virtualKey,
            keyDown,
          )
          .catch(
            (
              inputError,
            ) => {
              console.error(
                'Keyboard remoto falló.',
                inputError,
              )
            },
          )
      },
      [
        activeSession,
        channelConnected,
      ],
    )

  /*
   * ============================================================
   * FULLSCREEN
   * ============================================================
   */

  const toggleFullscreen =
    async () => {
      const element =
        viewerContainerRef.current

      if (
        !element
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

      await element
        .requestFullscreen()
    }

  /*
   * Una sesión solamente permite periféricos cuando el servidor
   * confirma realmente el estado Connected.
   */
  const connected =
    activeSession
      ?.status ===
    'Connected'

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div
      style={{
        display:
          'grid',

        gap:
          20,
      }}
    >
      <header>
        <div
          style={{
            display:
              'flex',

            alignItems:
              'center',

            gap:
              12,
          }}
        >
          <RadioTower
            size={
              30
            }
          />

          <div>
            <h1
              style={{
                margin:
                  0,
              }}
            >
              Soporte remoto
            </h1>

            <div
              style={{
                marginTop:
                  5,

                opacity:
                  0.72,
              }}
            >
              Control remoto de
              endpoints Windows
              administrados por
              TitanMDM.
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div
          style={{
            padding:
              14,

            borderRadius:
              12,

            border:
              '1px solid rgba(239,68,68,.35)',

            background:
              'rgba(239,68,68,.10)',
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          display:
            'grid',

          gridTemplateColumns:
            '320px minmax(0, 1fr)',

          gap:
            18,
        }}
      >
        <aside
          style={{
            display:
              'grid',

            alignContent:
              'start',

            gap:
              16,
          }}
        >
          <div
            style={{
              padding:
                16,

              borderRadius:
                14,

              border:
                '1px solid rgba(148,163,184,.2)',
            }}
          >
            <strong>
              Nueva conexión
            </strong>

            <div
              style={{
                display:
                  'grid',

                gap:
                  12,

                marginTop:
                  14,
              }}
            >
              <label>
                Equipo Windows

                <select
                  value={
                    selectedDeviceId
                  }
                  disabled={
                    creating
                    ||
                    connected
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedDeviceId(
                      event.target.value,
                    )
                  }
                  style={{
                    width:
                      '100%',

                    marginTop:
                      6,

                    padding:
                      9,
                  }}
                >
                  <option
                    value=""
                  >
                    Seleccionar
                  </option>

                  {windowsDevices.map(
                    (
                      device,
                    ) => (
                      <option
                        key={
                          device.id
                        }
                        value={
                          device.id
                        }
                      >
                        {
                          device.deviceName
                        }
                        {' · '}
                        {
                          device.status
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              {selectedDevice && (
                <div
                  style={{
                    fontSize:
                      12,

                    opacity:
                      0.72,
                  }}
                >
                  {
                    selectedDevice
                      .manufacturer
                    ??
                    'Windows'
                  }
                  {' '}
                  {
                    selectedDevice
                      .model
                    ??
                    ''
                  }

                  <br />

                  Último contacto:{' '}

                  {formatDate(
                    selectedDevice
                      .lastSeenAtUtc,
                  )}
                </div>
              )}

              <label>
                Motivo

                <textarea
                  value={
                    reason
                  }
                  disabled={
                    creating
                    ||
                    connected
                  }
                  onChange={(
                    event,
                  ) =>
                    setReason(
                      event.target.value,
                    )
                  }
                  rows={
                    3
                  }
                  style={{
                    width:
                      '100%',

                    marginTop:
                      6,

                    padding:
                      9,

                    resize:
                      'vertical',
                  }}
                />
              </label>

              <label>
                Duración máxima

                <select
                  value={
                    maximumDurationMinutes
                  }
                  disabled={
                    creating
                    ||
                    connected
                  }
                  onChange={(
                    event,
                  ) =>
                    setMaximumDurationMinutes(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                  style={{
                    width:
                      '100%',

                    marginTop:
                      6,

                    padding:
                      9,
                  }}
                >
                  <option
                    value={
                      30
                    }
                  >
                    30 minutos
                  </option>

                  <option
                    value={
                      60
                    }
                  >
                    1 hora
                  </option>

                  <option
                    value={
                      120
                    }
                  >
                    2 horas
                  </option>

                  <option
                    value={
                      240
                    }
                  >
                    4 horas
                  </option>

                  <option
                    value={
                      480
                    }
                  >
                    8 horas
                  </option>
                </select>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    allowMouse
                  }
                  disabled={
                    creating
                    ||
                    connected
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllowMouse(
                      event.target.checked,
                    )
                  }
                />{' '}
                Control de mouse
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    allowKeyboard
                  }
                  disabled={
                    creating
                    ||
                    connected
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllowKeyboard(
                      event.target.checked,
                    )
                  }
                />{' '}
                Control de teclado
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    allowClipboard
                  }
                  disabled={
                    creating
                    ||
                    connected
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllowClipboard(
                      event.target.checked,
                    )
                  }
                />{' '}
                Portapapeles
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    allowFileTransfer
                  }
                  disabled={
                    creating
                    ||
                    connected
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllowFileTransfer(
                      event.target.checked,
                    )
                  }
                />{' '}
                Transferencia de archivos
              </label>

              <button
                type="button"
                disabled={
                  creating
                  ||
                  !selectedDeviceId
                  ||
                  connected
                }
                onClick={
                  () =>
                    void startSession()
                }
                style={{
                  padding:
                    11,

                  cursor:
                    creating
                      ? 'wait'
                      : 'pointer',
                }}
              >
                <Play
                  size={
                    15
                  }
                />{' '}

                {
                  creating
                    ? 'Creando...'
                    : 'Iniciar soporte remoto'
                }
              </button>
            </div>
          </div>

          <div
            style={{
              padding:
                16,

              borderRadius:
                14,

              border:
                '1px solid rgba(148,163,184,.2)',
            }}
          >
            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'space-between',
              }}
            >
              <strong>
                Sesiones activas
              </strong>

              <button
                type="button"
                onClick={
                  () =>
                    void loadData()
                }
                title="Actualizar sesiones"
              >
                <RefreshCw
                  size={
                    15
                  }
                />
              </button>
            </div>

            <select
              value={
                selectedSessionId
              }
              disabled={
                loading
              }
              onChange={(
                event,
              ) =>
                void selectSession(
                  event.target.value,
                )
              }
              style={{
                width:
                  '100%',

                marginTop:
                  12,

                padding:
                  9,
              }}
            >
              <option
                value=""
              >
                Seleccionar sesión
              </option>

              {activeSessions.map(
                (
                  session,
                ) => (
                  <option
                    key={
                      session.id
                    }
                    value={
                      session.id
                    }
                  >
                    {
                      statusLabel(
                        session.status,
                      )
                    }

                    {' · '}

                    {
                      session
                        .technicianName
                    }
                  </option>
                ),
              )}
            </select>
          </div>
        </aside>

        <main
          style={{
            minWidth:
              0,
          }}
        >
          <div
            style={{
              padding:
                14,

              borderRadius:
                14,

              border:
                '1px solid rgba(148,163,184,.2)',

              marginBottom:
                12,

              display:
                'flex',

              justifyContent:
                'space-between',

              gap:
                16,

              flexWrap:
                'wrap',
            }}
          >
            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  16,

                flexWrap:
                  'wrap',
              }}
            >
              <span>
                <Monitor
                  size={
                    16
                  }
                />{' '}

                {
                  selectedDevice
                    ?.deviceName
                  ??
                  'Sin equipo'
                }
              </span>

              <span>
                <ShieldCheck
                  size={
                    16
                  }
                />{' '}

                {statusLabel(
                  activeSession
                    ?.status,
                )}
              </span>

              <span>
                <RadioTower
                  size={
                    16
                  }
                />{' '}

                {
                  channelConnected
                    ? 'SignalR conectado'
                    : 'SignalR desconectado'
                }
              </span>

              <span>
                <MousePointer2
                  size={
                    16
                  }
                />{' '}

                {
                  activeSession
                    ?.allowMouse
                    ? 'Mouse'
                    : 'Mouse deshabilitado'
                }
              </span>

              <span>
                <Keyboard
                  size={
                    16
                  }
                />{' '}

                {
                  activeSession
                    ?.allowKeyboard
                    ? 'Teclado'
                    : 'Teclado deshabilitado'
                }
              </span>
            </div>

            <div
              style={{
                display:
                  'flex',

                gap:
                  8,
              }}
            >
              <button
                type="button"
                disabled={
                  !activeSession
                }
                onClick={
                  () =>
                    void toggleFullscreen()
                }
              >
                <Maximize2
                  size={
                    15
                  }
                />{' '}

                Pantalla completa
              </button>

              <button
                type="button"
                disabled={
                  !activeSession
                  ||
                  isTerminal(
                    activeSession.status,
                  )
                  ||
                  terminating
                }
                onClick={
                  () =>
                    void endSession()
                }
              >
                <CircleStop
                  size={
                    15
                  }
                />{' '}

                {
                  terminating
                    ? 'Finalizando...'
                    : 'Finalizar'
                }
              </button>
            </div>
          </div>

          {activeSession && (
            <div
              style={{
                display:
                  'flex',

                gap:
                  18,

                flexWrap:
                  'wrap',

                marginBottom:
                  12,

                fontSize:
                  13,

                opacity:
                  0.8,
              }}
            >
              <span>
                Técnico:{' '}

                {
                  activeSession
                    .technicianName
                }
              </span>

              <span>
                <Clock3
                  size={
                    14
                  }
                />{' '}

                Inicio:{' '}

                {formatDate(
                  activeSession
                    .connectedAtUtc
                  ??
                  activeSession
                    .requestedAtUtc,
                )}
              </span>

              <span>
                Motivo:{' '}

                {
                  activeSession.reason
                }
              </span>
            </div>
          )}

          <div
            ref={
              viewerContainerRef
            }
            style={{
              minHeight:
                560,
            }}
          >
            <RemoteDesktopViewer
              frameUrl={
                frameUrl
              }
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
                  ?.allowMouse
                ??
                false
              }
              allowKeyboard={
                activeSession
                  ?.allowKeyboard
                ??
                false
              }
              onPointerMove={
                pointerMove
              }
              onPointerButton={
                pointerButton
              }
              onWheel={
                wheel
              }
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