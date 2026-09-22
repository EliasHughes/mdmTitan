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

    public async Task ConnectAsync(
        CancellationToken cancellationToken = default)
    {
        if (_connection is not null)
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
                                _session.SessionId
                                    .ToString();

                        options.Headers[
                            "X-Titan-Remote-Token"] =
                                _session.AccessToken;
                    })
                .WithAutomaticReconnect(
                    new[]
                    {
                        TimeSpan.Zero,
                        TimeSpan.FromSeconds(2),
                        TimeSpan.FromSeconds(5),
                        TimeSpan.FromSeconds(10)
                    })
                .Build();

        RegisterHandlers(
            _connection);

        _connection.Reconnecting +=
            _ =>
            {
                StatusChanged?.Invoke(
                    "Reconectando");

                return Task.CompletedTask;
            };

        _connection.Reconnected +=
            _ =>
            {
                StatusChanged?.Invoke(
                    "Conectado");

                return Task.CompletedTask;
            };

        _connection.Closed +=
            _ =>
            {
                StatusChanged?.Invoke(
                    "Desconectado");

                return Task.CompletedTask;
            };

        StatusChanged?.Invoke(
            "Conectando");

        await _connection.StartAsync(
            cancellationToken);

        await _connection.InvokeAsync(
            "RegisterRemoteHost",
            _session.SessionId,
            cancellationToken);

        StatusChanged?.Invoke(
            "Conectado");

        StartStreaming();
    }

    private void RegisterHandlers(
        HubConnection connection)
    {
        connection.On<double, double>(
            "PointerMove",
            (x, y) =>
            {
                if (_session.AllowMouse)
                {
                    _inputController
                        .MovePointer(
                            x,
                            y);
                }
            });

        connection.On<string>(
            "PointerButton",
            action =>
            {
                if (!_session.AllowMouse)
                {
                    return;
                }

                switch (action)
                {
                    case "left-down":
                        _inputController.LeftDown();
                        break;

                    case "left-up":
                        _inputController.LeftUp();
                        break;

                    case "right-down":
                        _inputController.RightDown();
                        break;

                    case "right-up":
                        _inputController.RightUp();
                        break;
                }
            });

        connection.On<int>(
            "PointerWheel",
            delta =>
            {
                if (_session.AllowMouse)
                {
                    _inputController.Wheel(
                        delta);
                }
            });

        connection.On<int, bool>(
            "Keyboard",
            (virtualKey, keyDown) =>
            {
                if (!_session.AllowKeyboard)
                {
                    return;
                }

                var key =
                    checked(
                        (ushort)virtualKey);

                if (keyDown)
                {
                    _inputController.KeyDown(
                        key);
                }
                else
                {
                    _inputController.KeyUp(
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

    private void StartStreaming()
    {
        _streamCancellation =
            new CancellationTokenSource();

        _streamTask =
            Task.Run(
                () =>
                    StreamLoopAsync(
                        _streamCancellation.Token));
    }

    private async Task StreamLoopAsync(
        CancellationToken cancellationToken)
    {
        while (!cancellationToken
            .IsCancellationRequested)
        {
            if (_connection?.State !=
                HubConnectionState.Connected)
            {
                await Task.Delay(
                    250,
                    cancellationToken);

                continue;
            }

            try
            {
                var frame =
                    _captureService.Capture(
                        jpegQuality: 65);

                var base64 =
                    Convert.ToBase64String(
                        frame.Data);

                await _connection.InvokeAsync(
                    "PublishFrame",
                    _session.SessionId,
                    frame.Sequence,
                    frame.Width,
                    frame.Height,
                    frame.MimeType,
                    base64,
                    frame.CapturedAtUtc,
                    cancellationToken);
            }
            catch (Exception)
                when (!cancellationToken
                    .IsCancellationRequested)
            {
            }

            await Task.Delay(
                150,
                cancellationToken);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_streamCancellation is not null)
        {
            await _streamCancellation
                .CancelAsync();

            _streamCancellation.Dispose();
        }

        if (_streamTask is not null)
        {
            try
            {
                await _streamTask;
            }
            catch
            {
            }
        }

        if (_connection is not null)
        {
            try
            {
                await _connection.StopAsync();
            }
            catch
            {
            }

            await _connection.DisposeAsync();
        }
    }
}