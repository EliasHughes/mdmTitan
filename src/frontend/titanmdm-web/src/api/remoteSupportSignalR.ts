import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";

export interface RemoteFrame {
  sessionId: string;
  sequence: number;
  width: number;
  height: number;
  mimeType: string;
  base64Data: string;
  capturedAtUtc: string;
}

export interface RemoteSessionUpdate {
  sessionId: string;
  status: string;
  connectedAtUtc?: string | null;
}

export interface RemoteSupportHandlers {
  onFrame?: (frame: RemoteFrame) => void;
  onSessionUpdated?: (update: RemoteSessionUpdate) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onDisconnected?: (error?: Error) => void;
}

function getApiBaseUrl(): string {
  const configured =
    import.meta.env.VITE_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/api\/?$/, "");
  }

  return "http://localhost:8020";
}

function getAccessToken(): string {
  const candidates = [
    localStorage.getItem("accessToken"),
    localStorage.getItem("token"),
    sessionStorage.getItem("accessToken"),
    sessionStorage.getItem("token"),
  ];

  const token =
    candidates.find(
      (value) =>
        typeof value === "string" &&
        value.trim().length > 0,
    ) ?? "";

  return token.replace(/^Bearer\s+/i, "");
}

export class RemoteSupportSignalRClient {
  private connection: HubConnection | null = null;

  private currentSessionId: string | null = null;

  public get state(): HubConnectionState {
    return (
      this.connection?.state ??
      HubConnectionState.Disconnected
    );
  }

  public async connect(
    sessionId: string,
    handlers: RemoteSupportHandlers,
  ): Promise<void> {
    await this.disconnect();

    this.currentSessionId = sessionId;

    const connection =
      new HubConnectionBuilder()
        .withUrl(
          `${getApiBaseUrl()}/hubs/remote-support`,
          {
            accessTokenFactory: () =>
              getAccessToken(),
          },
        )
        .withAutomaticReconnect([
          0,
          2000,
          5000,
          10000,
        ])
        .configureLogging(
          LogLevel.Warning,
        )
        .build();

    connection.on(
      "RemoteFrame",
      (frame: RemoteFrame) => {
        if (
          frame.sessionId ===
          this.currentSessionId
        ) {
          handlers.onFrame?.(
            frame,
          );
        }
      },
    );

    connection.on(
      "RemoteSessionUpdated",
      (update: RemoteSessionUpdate) => {
        if (
          update.sessionId ===
          this.currentSessionId
        ) {
          handlers.onSessionUpdated?.(
            update,
          );
        }
      },
    );

    connection.onreconnecting(
      () => {
        handlers.onReconnecting?.();
      },
    );

    connection.onreconnected(
      async () => {
        handlers.onReconnected?.();

        if (this.currentSessionId) {
          await connection.invoke(
            "JoinSession",
            this.currentSessionId,
          );
        }
      },
    );

    connection.onclose(
      (error) => {
        handlers.onDisconnected?.(
          error,
        );
      },
    );

    await connection.start();

    await connection.invoke(
      "JoinSession",
      sessionId,
    );

    this.connection =
      connection;
  }

  public async disconnect(): Promise<void> {
    const connection =
      this.connection;

    const sessionId =
      this.currentSessionId;

    this.connection =
      null;

    this.currentSessionId =
      null;

    if (!connection) {
      return;
    }

    try {
      if (
        sessionId &&
        connection.state ===
          HubConnectionState.Connected
      ) {
        await connection.invoke(
          "LeaveSession",
          sessionId,
        );
      }
    } catch {
      // La sesión puede haber terminado ya.
    }

    try {
      await connection.stop();
    } catch {
      // No bloqueamos el desmontaje de la UI.
    }
  }

  private requireConnection(): {
    connection: HubConnection;
    sessionId: string;
  } {
    if (
      !this.connection ||
      this.connection.state !==
        HubConnectionState.Connected ||
      !this.currentSessionId
    ) {
      throw new Error(
        "El canal de soporte remoto no está conectado.",
      );
    }

    return {
      connection:
        this.connection,

      sessionId:
        this.currentSessionId,
    };
  }

  public async pointerMove(
    normalizedX: number,
    normalizedY: number,
  ): Promise<void> {
    const {
      connection,
      sessionId,
    } =
      this.requireConnection();

    await connection.invoke(
      "PointerMove",
      sessionId,
      Math.max(
        0,
        Math.min(
          1,
          normalizedX,
        ),
      ),
      Math.max(
        0,
        Math.min(
          1,
          normalizedY,
        ),
      ),
    );
  }

  public async pointerButton(
    action:
      | "left-down"
      | "left-up"
      | "right-down"
      | "right-up",
  ): Promise<void> {
    const {
      connection,
      sessionId,
    } =
      this.requireConnection();

    await connection.invoke(
      "PointerButton",
      sessionId,
      action,
    );
  }

  public async pointerWheel(
    delta: number,
  ): Promise<void> {
    const {
      connection,
      sessionId,
    } =
      this.requireConnection();

    await connection.invoke(
      "PointerWheel",
      sessionId,
      delta,
    );
  }

  public async keyboard(
    virtualKey: number,
    keyDown: boolean,
  ): Promise<void> {
    const {
      connection,
      sessionId,
    } =
      this.requireConnection();

    await connection.invoke(
      "Keyboard",
      sessionId,
      virtualKey,
      keyDown,
    );
  }
}