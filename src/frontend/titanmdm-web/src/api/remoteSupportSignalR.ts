import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'

import { tokenStorage } from '../auth/tokenStorage'

export interface RemoteFrame {
  sessionId: string
  sequence: number
  width: number
  height: number
  mimeType: string
  base64Data: string
  capturedAtUtc: string
}

export interface RemoteSessionChanged {
  sessionId: string
  status: string
  deviceId?: string
  failureReason?: string | null
  terminationReason?: string | null
}

export interface RemoteSupportCallbacks {
  onFrame?: (frame: RemoteFrame) => void

  onSessionChanged?: (
    update: RemoteSessionChanged,
  ) => void

  onReconnecting?: () => void
  onReconnected?: () => void
  onClosed?: (error?: Error) => void
}

export class RemoteSupportSignalRClient {
  private connection: HubConnection | null = null

  private callbacks: RemoteSupportCallbacks = {}

  async connect(
    callbacks: RemoteSupportCallbacks = {},
  ): Promise<void> {
    this.callbacks = callbacks

    if (
      this.connection?.state ===
      HubConnectionState.Connected
    ) {
      return
    }

    const connection =
      new HubConnectionBuilder()
        .withUrl(
          '/hubs/remote-support',
          {
            accessTokenFactory: () =>
              tokenStorage.getAccessToken() ?? '',
          },
        )
        .withAutomaticReconnect([
          0,
          2000,
          5000,
          10000,
          30000,
        ])
        .configureLogging(
          LogLevel.Warning,
        )
        .build()

    connection.on(
      'RemoteFrame',
      (frame: RemoteFrame) => {
        this.callbacks.onFrame?.(frame)
      },
    )

    connection.on(
      'RemoteSessionUpdated',
      (update: RemoteSessionChanged) => {
        this.callbacks.onSessionChanged?.(
          update,
        )
      },
    )

    connection.on(
      'RemoteSessionChanged',
      (update: RemoteSessionChanged) => {
        this.callbacks.onSessionChanged?.(
          update,
        )
      },
    )

    connection.onreconnecting(() => {
      this.callbacks.onReconnecting?.()
    })

    connection.onreconnected(() => {
      this.callbacks.onReconnected?.()
    })

    connection.onclose((error) => {
      this.callbacks.onClosed?.(
        error ?? undefined,
      )
    })

    await connection.start()

    this.connection = connection
  }

  async joinSession(
    sessionId: string,
  ): Promise<void> {
    this.ensureConnected()

    await this.connection!.invoke(
      'JoinSession',
      sessionId,
    )
  }

  async leaveSession(
    sessionId: string,
  ): Promise<void> {
    if (
      !this.connection ||
      this.connection.state !==
        HubConnectionState.Connected
    ) {
      return
    }

    await this.connection.invoke(
      'LeaveSession',
      sessionId,
    )
  }

  async pointerMove(
    sessionId: string,
    x: number,
    y: number,
  ): Promise<void> {
    this.ensureConnected()

    await this.connection!.invoke(
      'PointerMove',
      sessionId,
      x,
      y,
    )
  }

  async pointerButton(
    sessionId: string,
    action: string,
  ): Promise<void> {
    this.ensureConnected()

    await this.connection!.invoke(
      'PointerButton',
      sessionId,
      action,
    )
  }

  async pointerWheel(
    sessionId: string,
    delta: number,
  ): Promise<void> {
    this.ensureConnected()

    await this.connection!.invoke(
      'PointerWheel',
      sessionId,
      delta,
    )
  }

  async keyboard(
    sessionId: string,
    virtualKey: number,
    keyDown: boolean,
  ): Promise<void> {
    this.ensureConnected()

    await this.connection!.invoke(
      'Keyboard',
      sessionId,
      virtualKey,
      keyDown,
    )
  }

  async disconnect(): Promise<void> {
    const connection =
      this.connection

    this.connection = null

    if (!connection) {
      return
    }

    if (
      connection.state !==
      HubConnectionState.Disconnected
    ) {
      await connection.stop()
    }
  }

  private ensureConnected(): void {
    if (
      !this.connection ||
      this.connection.state !==
        HubConnectionState.Connected
    ) {
      throw new Error(
        'El canal de soporte remoto no está conectado.',
      )
    }
  }
}