import * as signalR
  from '@microsoft/signalr'

import {
  tokenStorage,
} from '../auth/tokenStorage'

/*
 * ============================================================
 * REMOTE FRAME
 * ============================================================
 */

export interface RemoteFrame {
  sessionId: string
  sequence: number
  width: number
  height: number
  mimeType: string
  base64Data: string
  capturedAtUtc: string

  displayIndex: number
  displayCount: number
  displayLabel: string
}

/*
 * ============================================================
 * SESSION
 * ============================================================
 */

export interface RemoteSessionChanged {
  sessionId: string
  status: string
  connectedAtUtc?: string | null
}

/*
 * ============================================================
 * MONITORS
 * ============================================================
 */

export interface RemoteMonitorInfo {
  index: number
  deviceName: string
  width: number
  height: number
  isPrimary: boolean
  label: string
}

export interface RemoteMonitorState {
  sessionId: string
  selectedMonitorIndex: number
  monitors: RemoteMonitorInfo[]
}

/*
 * ============================================================
 * HANDLERS
 * ============================================================
 */

export interface RemoteSupportSignalRHandlers {
  onFrame?: (
    frame: RemoteFrame,
  ) => void

  onSessionChanged?: (
    update: RemoteSessionChanged,
  ) => void

  onMonitorState?: (
    state: RemoteMonitorState,
  ) => void

  onReconnecting?: (
    error?: Error,
  ) => void

  onReconnected?: (
    connectionId?: string,
  ) => void

  onClosed?: (
    error?: Error,
  ) => void
}

/*
 * ============================================================
 * ERROR HELPER
 * ============================================================
 */

function extractSignalRError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message
  }

  if (
    typeof error ===
    'string'
  ) {
    return error
  }

  try {
    return JSON.stringify(
      error,
    )
  } catch {
    return (
      'Error SignalR desconocido.'
    )
  }
}

/*
 * ============================================================
 * CLIENT
 * ============================================================
 */

export class RemoteSupportSignalRClient {
  private connection:
    signalR.HubConnection | null =
      null

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  public get isConnected():
    boolean {
    return (
      this.connection?.state ===
      signalR.HubConnectionState
        .Connected
    )
  }

  public get state():
    signalR.HubConnectionState |
    null {
    return (
      this.connection?.state ??
      null
    )
  }

  /*
   * ==========================================================
   * CONNECT
   * ==========================================================
   */

  public async connect(
    handlers:
      RemoteSupportSignalRHandlers =
        {},
  ): Promise<void> {
    /*
     * Evitar conexiones duplicadas.
     */
    if (
      this.connection
    ) {
      if (
        this.connection.state ===
        signalR.HubConnectionState
          .Connected
      ) {
        return
      }

      if (
        this.connection.state ===
        signalR.HubConnectionState
          .Connecting
      ) {
        return
      }
    }

    const connection =
      new signalR.HubConnectionBuilder()
        .withUrl(
          '/hubs/remote-support',
          {
            accessTokenFactory:
              () =>
                tokenStorage
                  .getAccessToken()
                ??
                '',
          },
        )
        .withAutomaticReconnect(
          [
            0,
            2000,
            5000,
            10000,
          ],
        )
        .configureLogging(
          signalR.LogLevel
            .Information,
        )
        .build()

    this.connection =
      connection

    /*
     * ========================================================
     * SERVER EVENTS
     * ========================================================
     */

    connection.on(
      'RemoteFrame',
      (
        frame:
          RemoteFrame,
      ) => {
        handlers
          .onFrame
          ?.(
            frame,
          )
      },
    )

    connection.on(
      'RemoteSessionUpdated',
      (
        update:
          RemoteSessionChanged,
      ) => {
        handlers
          .onSessionChanged
          ?.(
            update,
          )
      },
    )

    connection.on(
      'RemoteMonitorState',
      (
        state:
          RemoteMonitorState,
      ) => {
        handlers
          .onMonitorState
          ?.(
            state,
          )
      },
    )

    /*
     * ========================================================
     * CONNECTION EVENTS
     * ========================================================
     */

    connection.onreconnecting(
      (
        error,
      ) => {
        console.warn(
          '[TitanMDM SignalR] Reconectando...',
          error,
        )

        handlers
          .onReconnecting
          ?.(
            error ??
            undefined,
          )
      },
    )

    connection.onreconnected(
      (
        connectionId,
      ) => {
        console.info(
          '[TitanMDM SignalR] Reconectado.',
          {
            connectionId,
          },
        )

        handlers
          .onReconnected
          ?.(
            connectionId ??
            undefined,
          )
      },
    )

    connection.onclose(
      (
        error,
      ) => {
        console.warn(
          '[TitanMDM SignalR] Cerrado.',
          error,
        )

        handlers
          .onClosed
          ?.(
            error ??
            undefined,
          )
      },
    )

    /*
     * ========================================================
     * START
     * ========================================================
     */

    try {
      await connection
        .start()

      console.info(
        '[TitanMDM SignalR] Conectado.',
        {
          connectionId:
            connection.connectionId,

          state:
            connection.state,
        },
      )
    } catch (
      error
    ) {
      const message =
        extractSignalRError(
          error,
        )

      console.error(
        '[TitanMDM SignalR] Error iniciando conexión:',
        message,
        error,
      )

      this.connection =
        null

      throw new Error(
        `No fue posible conectar SignalR: ${message}`,
      )
    }
  }

  /*
   * ==========================================================
   * JOIN SESSION
   * ==========================================================
   */

  public async joinSession(
    sessionId: string,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    if (
      !sessionId
    ) {
      throw new Error(
        'JoinSession requiere un SessionId.',
      )
    }

    try {
      await connection.invoke(
        'JoinSession',
        sessionId,
      )

      console.info(
        '[TitanMDM SignalR] JoinSession correcto.',
        {
          sessionId,
        },
      )
    } catch (
      error
    ) {
      const message =
        extractSignalRError(
          error,
        )

      console.error(
        '[TitanMDM SignalR] JoinSession falló.',
        {
          sessionId,
          message,
          error,
        },
      )

      throw new Error(
        `JoinSession falló: ${message}`,
      )
    }
  }

  /*
   * ==========================================================
   * LEAVE SESSION
   * ==========================================================
   */

  public async leaveSession(
    sessionId: string,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    if (
      !sessionId
    ) {
      return
    }

    try {
      await connection.invoke(
        'LeaveSession',
        sessionId,
      )

      console.info(
        '[TitanMDM SignalR] LeaveSession correcto.',
        {
          sessionId,
        },
      )
    } catch (
      error
    ) {
      const message =
        extractSignalRError(
          error,
        )

      console.warn(
        '[TitanMDM SignalR] LeaveSession falló.',
        {
          sessionId,
          message,
          error,
        },
      )

      throw new Error(
        `LeaveSession falló: ${message}`,
      )
    }
  }

  /*
   * ==========================================================
   * MONITORS
   * ==========================================================
   */

  public async selectMonitor(
    sessionId: string,
    monitorIndex: number,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'SelectMonitor',
      sessionId,
      monitorIndex,
    )
  }

  public async nextMonitor(
    sessionId: string,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'NextMonitor',
      sessionId,
    )
  }

  public async previousMonitor(
    sessionId: string,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'PreviousMonitor',
      sessionId,
    )
  }

  public async requestMonitorState(
    sessionId: string,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'RequestMonitorState',
      sessionId,
    )
  }

  /*
   * ==========================================================
   * MOUSE
   * ==========================================================
   */

  public async pointerMove(
    sessionId: string,
    x: number,
    y: number,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'PointerMove',
      sessionId,
      x,
      y,
    )
  }

  public async pointerButton(
    sessionId: string,
    action:
      | 'left-down'
      | 'left-up'
      | 'right-down'
      | 'right-up',
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'PointerButton',
      sessionId,
      action,
    )
  }

  public async pointerWheel(
    sessionId: string,
    delta: number,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'PointerWheel',
      sessionId,
      delta,
    )
  }

  /*
   * ==========================================================
   * KEYBOARD
   * ==========================================================
   */

  public async keyboard(
    sessionId: string,
    virtualKey: number,
    keyDown: boolean,
  ): Promise<void> {
    const connection =
      this.requireConnection()

    await connection.invoke(
      'Keyboard',
      sessionId,
      virtualKey,
      keyDown,
    )
  }

  /*
   * ==========================================================
   * DISCONNECT
   * ==========================================================
   */

  public async disconnect():
    Promise<void> {
    const connection =
      this.connection

    this.connection =
      null

    if (
      !connection
    ) {
      return
    }

    try {
      if (
        connection.state !==
        signalR.HubConnectionState
          .Disconnected
      ) {
        await connection.stop()
      }
    } catch (
      error
    ) {
      console.warn(
        '[TitanMDM SignalR] Error cerrando conexión.',
        error,
      )
    }
  }

  /*
   * ==========================================================
   * HELPERS
   * ==========================================================
   */

  private requireConnection():
    signalR.HubConnection {
    if (
      !this.connection
    ) {
      throw new Error(
        'El cliente SignalR no está inicializado.',
      )
    }

    if (
      this.connection.state !==
      signalR.HubConnectionState
        .Connected
    ) {
      throw new Error(
        `SignalR no está conectado. Estado actual: ${this.connection.state}.`,
      )
    }

    return this.connection
  }
}