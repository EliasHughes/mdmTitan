using Microsoft.AspNetCore.SignalR.Client;

using TitanMDM.RemoteHost.Capture;
using TitanMDM.RemoteHost.Input;
using TitanMDM.RemoteHost.Models;

namespace TitanMDM.RemoteHost.Transport;

public sealed class RemoteTransportClient
    : IAsyncDisposable
{
    private readonly RemoteHostSession
        _session;

    private readonly DesktopCaptureService
        _captureService;

    private readonly RemoteInputController
        _inputController;

    private HubConnection?
        _connection;

    private CancellationTokenSource?
        _streamCancellation;

    private Task?
        _streamTask;

    private long
        _framesPublished;

    private DateTime
        _lastFrameAtUtc;

    public event Action<string>?
        StatusChanged;

    public RemoteTransportClient(
        RemoteHostSession session)
    {
        _session =
            session;

        _captureService =
            new DesktopCaptureService();

        _inputController =
            new RemoteInputController();
    }

    public bool IsConnected =>
        _connection?.State ==
        HubConnectionState.Connected;

    /*
     * ============================================================
     * CONNECT
     * ============================================================
     */

    public async Task ConnectAsync(
        CancellationToken cancellationToken = default)
    {
        if (
            _connection is not null)
        {
            return;
        }

        var hubUrl =
            $"{_session.ServerUrl.TrimEnd('/')}/hubs/remote-support";

        _connection =
            new HubConnectionBuilder()
                .WithUrl(
                    hubUrl,
                    options =>
                    {
                        options.Headers[
                            "X-Titan-Remote-Session"] =
                                _session
                                    .SessionId
                                    .ToString();

                        options.Headers[
                            "X-Titan-Remote-Token"] =
                                _session
                                    .AccessToken;
                    })
                .WithAutomaticReconnect(
                    new[]
                    {
                        TimeSpan.Zero,
                        TimeSpan.FromSeconds(
                            2),
                        TimeSpan.FromSeconds(
                            5),
                        TimeSpan.FromSeconds(
                            10)
                    })
                .Build();

        RegisterHandlers(
            _connection);

        /*
         * ========================================================
         * SIGNALR RECONNECTING
         * ========================================================
         */

        _connection.Reconnecting +=
            error =>
            {
                var suffix =
                    error is null
                        ? string.Empty
                        : $" - {error.Message}";

                StatusChanged?.Invoke(
                    $"Reconectando{suffix}");

                return Task.CompletedTask;
            };

        /*
         * ========================================================
         * SIGNALR RECONNECTED
         * ========================================================
         *
         * IMPORTANTE:
         *
         * SignalR obtiene un ConnectionId nuevo después de una
         * reconexión.
         *
         * Por tanto RemoteHost debe volver a ejecutar
         * RegisterRemoteHost para reingresar a HostGroup.
         * ========================================================
         */

        _connection.Reconnected +=
            async connectionId =>
            {
                try
                {
                    StatusChanged?.Invoke(
                        "Re-registrando");

                    await RegisterRemoteHostAsync(
                        CancellationToken.None);
                    
                    await PublishMonitorStateAsync(
                            cancellationToken);

                    StatusChanged?.Invoke(
                        "Conectado");
                }
                catch (Exception ex)
                {
                    StatusChanged?.Invoke(
                        $"Error re-registro: {ex.Message}");
                }
            };

        /*
         * ========================================================
         * SIGNALR CLOSED
         * ========================================================
         */

        _connection.Closed +=
            error =>
            {
                var suffix =
                    error is null
                        ? string.Empty
                        : $" - {error.Message}";

                StatusChanged?.Invoke(
                    $"Desconectado{suffix}");

                return Task.CompletedTask;
            };

        /*
         * ========================================================
         * START
         * ========================================================
         */

        StatusChanged?.Invoke(
            "Conectando");

        await _connection
            .StartAsync(
                cancellationToken);

        StatusChanged?.Invoke(
            "Registrando RemoteHost");

        await RegisterRemoteHostAsync(
            cancellationToken);

        StatusChanged?.Invoke(
            "Conectado");

        StartStreaming();
    }

    /*
     * ============================================================
     * REGISTER REMOTE HOST
     * ============================================================
     */

    private async Task RegisterRemoteHostAsync(
        CancellationToken cancellationToken)
    {
        if (
            _connection is null
            ||
            _connection.State !=
                HubConnectionState.Connected)
        {
            throw new InvalidOperationException(
                "SignalR no está conectado para registrar RemoteHost.");
        }

        await _connection
            .InvokeAsync(
                "RegisterRemoteHost",
                _session.SessionId,
                cancellationToken);
    }

    /*
     * ============================================================
     * INPUT HANDLERS
     * ============================================================
     */

    private void RegisterHandlers(
        HubConnection connection)
    {
        connection.On<double, double>(
    "PointerMove",
    (
        x,
        y) =>
    {
        if (
            !_session.AllowMouse)
        {
            return;
        }

        var monitorBounds =
            _captureService
                .GetSelectedBounds();

        _inputController
            .MovePointer(
                x,
                y,
                monitorBounds);
    });

connection.On<int>(
    "SelectMonitor",
    async monitorIndex =>
    {
        var selected =
            _captureService
                .SelectDisplay(
                    monitorIndex);

        StatusChanged?.Invoke(
            $"Transmitiendo · {selected.Label}");

        await PublishMonitorStateAsync(
            CancellationToken.None);
    });

connection.On(
    "NextMonitor",
    async () =>
    {
        var selected =
            _captureService
                .SelectNextDisplay();

        StatusChanged?.Invoke(
            $"Transmitiendo · {selected.Label}");

        await PublishMonitorStateAsync(
            CancellationToken.None);
    });

connection.On(
    "PreviousMonitor",
    async () =>
    {
        var selected =
            _captureService
                .SelectPreviousDisplay();

        StatusChanged?.Invoke(
            $"Transmitiendo · {selected.Label}");

        await PublishMonitorStateAsync(
            CancellationToken.None);
    });

connection.On(
    "RequestMonitorState",
    async () =>
    {
        await PublishMonitorStateAsync(
            CancellationToken.None);
    });

        connection.On<string>(
            "PointerButton",
            action =>
            {
                if (
                    !_session.AllowMouse)
                {
                    return;
                }

                switch (
                    action)
                {
                    case "left-down":

                        _inputController
                            .LeftDown();

                        break;

                    case "left-up":

                        _inputController
                            .LeftUp();

                        break;

                    case "right-down":

                        _inputController
                            .RightDown();

                        break;

                    case "right-up":

                        _inputController
                            .RightUp();

                        break;
                }
            });

        connection.On<int>(
            "PointerWheel",
            delta =>
            {
                if (
                    _session.AllowMouse)
                {
                    _inputController
                        .Wheel(
                            delta);
                }
            });

        connection.On<int, bool>(
            "Keyboard",
            (
                virtualKey,
                keyDown) =>
            {
                if (
                    !_session.AllowKeyboard)
                {
                    return;
                }

                var key =
                    checked(
                        (ushort)
                        virtualKey);

                if (
                    keyDown)
                {
                    _inputController
                        .KeyDown(
                            key);
                }
                else
                {
                    _inputController
                        .KeyUp(
                            key);
                }
            });

        connection.On(
            "TerminateRemoteSession",
            () =>
            {
                _streamCancellation?
                    .Cancel();

                Application.Exit();
            });
    }

    private async Task PublishMonitorStateAsync(
    CancellationToken cancellationToken)
{
    if (
        _connection is null
        ||
        _connection.State !=
            HubConnectionState.Connected)
    {
        return;
    }

    var displays =
        _captureService
            .GetDisplays();

    var selected =
        _captureService
            .GetSelectedDisplay();

    var payload =
        displays
            .Select(
                display =>
                    new RemoteMonitorInfo(
                        Index:
                            display.Index,

                        DeviceName:
                            display.DeviceName,

                        Width:
                            display.Width,

                        Height:
                            display.Height,

                        IsPrimary:
                            display.IsPrimary,

                        Label:
                            display.Label))
            .ToArray();

    await _connection
        .InvokeAsync(
            "PublishMonitorState",
            _session.SessionId,
            selected.Index,
            payload,
            cancellationToken);
}

    /*
     * ============================================================
     * START STREAMING
     * ============================================================
     */

    private void StartStreaming()
    {
        if (
            _streamTask is not null)
        {
            return;
        }

        _streamCancellation =
            new CancellationTokenSource();

        _streamTask =
            Task.Run(
                () =>
                    StreamLoopAsync(
                        _streamCancellation.Token));
    }

    /*
     * ============================================================
     * STREAM LOOP
     * ============================================================
     */

    private async Task StreamLoopAsync(
        CancellationToken cancellationToken)
    {
        StatusChanged?.Invoke(
            "Iniciando captura");

        while (
            !cancellationToken
                .IsCancellationRequested)
        {
            if (
                _connection?.State !=
                HubConnectionState.Connected)
            {
                await DelaySafeAsync(
                    250,
                    cancellationToken);

                continue;
            }

            try
            {
                /*
                 * =================================================
                 * CAPTURE
                 * =================================================
                 */

                var frame =
                    _captureService
                        .Capture(
                            jpegQuality:
                                40,
                                maxWidth:
                                  1440);

                if (
                    frame.Data.Length ==
                    0)
                {
                    throw new InvalidOperationException(
                        "DesktopCapture devolvió un frame vacío.");
                }

                /*
                 * =================================================
                 * BASE64
                 * =================================================
                 */

                var base64 =
                    Convert
                        .ToBase64String(
                            frame.Data);

                /*
                 * =================================================
                 * SEND
                 * =================================================
                 */

                await _connection
                    .InvokeAsync(
                        "PublishFrame",
                        _session.SessionId,
                        frame.Sequence,
                        frame.Width,
                        frame.Height,
                        frame.MimeType,
                        base64,
                        frame.CapturedAtUtc,
                        frame.DisplayIndex,
                        frame.DisplayCount,
                        frame.DisplayLabel,
                        cancellationToken);

                _framesPublished++;

                _lastFrameAtUtc =
                    DateTime.UtcNow;

                /*
                 * No actualizar UI en cada frame.
                 *
                 * Solo cada 30 frames para evitar trabajo
                 * innecesario en WinForms.
                 */
                if (
                    _framesPublished ==
                        1
                    ||
                    _framesPublished %
                        30 ==
                        0)
                {
                    StatusChanged?.Invoke(
                         $"Transmitiendo · {frame.DisplayLabel} · {_framesPublished} frames");
                }
            }
            catch (
                OperationCanceledException)
                when (
                    cancellationToken
                        .IsCancellationRequested)
            {
                break;
            }
            catch (
                Exception ex)
            {
                /*
                 * Antes este error era ignorado completamente.
                 *
                 * Ahora veremos exactamente si falla:
                 *
                 * - CopyFromScreen
                 * - JPEG
                 * - SignalR PublishFrame
                 * - token
                 * - sesión
                 * - tamaño
                 */
                StatusChanged?.Invoke(
                    $"Error video: {ex.Message}");

                await DelaySafeAsync(
                    1000,
                    cancellationToken);

                continue;
            }

            /*
             * Aproximadamente 6 FPS.
             *
             * Cuando funcione correctamente podemos subir a:
             *
             * 8 FPS
             * 10 FPS
             * 12 FPS
             *
             * o implementar captura diferencial.
             */
            await DelaySafeAsync(
                110,
                cancellationToken);
        }
    }

    /*
     * ============================================================
     * SAFE DELAY
     * ============================================================
     */

    private static async Task
        DelaySafeAsync(
            int milliseconds,
            CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(
                milliseconds,
                cancellationToken);
        }
        catch (
            OperationCanceledException)
            when (
                cancellationToken
                    .IsCancellationRequested)
        {
        }
    }

    /*
     * ============================================================
     * DISPOSE
     * ============================================================
     */

    public async ValueTask DisposeAsync()
    {
        if (
            _streamCancellation is not null)
        {
            await _streamCancellation
                .CancelAsync();

            _streamCancellation
                .Dispose();

            _streamCancellation =
                null;
        }

        if (
            _streamTask is not null)
        {
            try
            {
                await _streamTask;
            }
            catch
            {
            }

            _streamTask =
                null;
        }

        if (
            _connection is not null)
        {
            try
            {
                if (
                    _connection.State !=
                    HubConnectionState.Disconnected)
                {
                    await _connection
                        .StopAsync();
                }
            }
            catch
            {
            }

            await _connection
                .DisposeAsync();

            _connection =
                null;
        }
    }
}