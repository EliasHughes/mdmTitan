using System.Security.Cryptography;
using System.Text;

using Microsoft.EntityFrameworkCore;

using TitanMDM.Application.Automation;
using TitanMDM.Application.Devices.Agent;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Devices.Agent;

public sealed class DeviceAgentService
    : IDeviceAgentService
{
    private const int LowBatteryThreshold =
        20;

    private const int BatteryRecoveryThreshold =
        25;

    private readonly TitanMdmDbContext
        _dbContext;

    private readonly IAutomationEventDispatcher
        _automation;

    public DeviceAgentService(
        TitanMdmDbContext dbContext,
        IAutomationEventDispatcher automation)
    {
        _dbContext = dbContext;
        _automation = automation;
    }

    public async Task<DeviceHeartbeatResultDto>
        HeartbeatAsync(
            DeviceHeartbeatRequest request,
            CancellationToken cancellationToken = default)
    {
        if (request.DeviceId == Guid.Empty)
        {
            throw new DeviceAuthenticationException(
                "INVALID_DEVICE_ID",
                "DeviceId no es válido.");
        }

        if (string.IsNullOrWhiteSpace(
                request.DeviceSecret))
        {
            throw new DeviceAuthenticationException(
                "INVALID_CREDENTIAL",
                "DeviceSecret es obligatorio.");
        }

        var device =
            await _dbContext.Devices
                .SingleOrDefaultAsync(
                    x =>
                        x.Id ==
                            request.DeviceId &&
                        !x.IsDeleted,
                    cancellationToken);

        if (device is null)
        {
            throw new DeviceAuthenticationException(
                "DEVICE_NOT_FOUND",
                "El dispositivo no existe.");
        }

        var credential =
            await _dbContext
                .DeviceCredentials
                .SingleOrDefaultAsync(
                    x =>
                        x.DeviceId ==
                            request.DeviceId &&
                        x.IsActive,
                    cancellationToken);

        if (credential is null)
        {
            throw new DeviceAuthenticationException(
                "CREDENTIAL_NOT_FOUND",
                "El dispositivo no posee una credencial activa.");
        }

        var suppliedSecretHash =
            ComputeSha256(
                request.DeviceSecret.Trim());

        if (!FixedTimeEquals(
                credential.SecretHash,
                suppliedSecretHash))
        {
            throw new DeviceAuthenticationException(
                "INVALID_CREDENTIAL",
                "La credencial del dispositivo no es válida.");
        }

        /*
         * Capturamos el estado ANTES de registrar
         * el heartbeat porque RegisterHeartbeat()
         * cambia automáticamente el dispositivo
         * a Online.
         */
        var previousStatus =
            device.Status;

        var previousBatteryLevel =
            device.BatteryLevel;

        credential.RegisterAuthentication();

        device.RegisterHeartbeat(
            Normalize(
                request.IpAddress),
            request.BatteryLevel);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        /*
         * DEVICE ONLINE
         *
         * Solo publicamos la transición:
         *
         * Offline -> Online
         *
         * No publicamos DeviceOnline en cada
         * heartbeat.
         */
        if (
            previousStatus ==
                DeviceStatus.Offline &&
            device.Status ==
                DeviceStatus.Online)
        {
            await _automation.DispatchAsync(
                device.OrganizationId,
                device.Id,
                "DeviceOnline",
                new
                {
                    platform =
                        device.Platform.ToString(),

                    deviceName =
                        device.DeviceName,

                    previousStatus =
                        previousStatus.ToString(),

                    currentStatus =
                        device.Status.ToString(),

                    lastSeenAtUtc =
                        device.LastSeenAtUtc
                },
                cancellationToken:
                    cancellationToken);
        }

        /*
         * LOW BATTERY
         *
         * Se dispara únicamente cuando se cruza
         * el umbral desde >20 hacia <=20.
         *
         * Esto evita generar una automatización
         * en cada heartbeat.
         */
        if (
            request.BatteryLevel.HasValue &&
            request.BatteryLevel.Value <=
                LowBatteryThreshold &&
            (
                !previousBatteryLevel.HasValue ||
                previousBatteryLevel.Value >
                    LowBatteryThreshold
            ))
        {
            await _automation.DispatchAsync(
                device.OrganizationId,
                device.Id,
                "LowBattery",
                new
                {
                    platform =
                        device.Platform.ToString(),

                    deviceName =
                        device.DeviceName,

                    batteryLevel =
                        request.BatteryLevel.Value,

                    threshold =
                        LowBatteryThreshold,

                    previousBatteryLevel
                },
                cancellationToken:
                    cancellationToken);
        }

        /*
         * La recuperación por encima de 25%
         * no genera evento todavía, pero deja
         * preparado el comportamiento de
         * histéresis para futuras reglas.
         *
         * Como BatteryLevel queda persistido,
         * una caída posterior desde >20%
         * volverá a generar LowBattery.
         */
        _ =
            request.BatteryLevel.HasValue &&
            request.BatteryLevel.Value >=
                BatteryRecoveryThreshold;

        return new DeviceHeartbeatResultDto(
            device.Id,
            device.Status.ToString(),
            device.ComplianceStatus.ToString(),
            DateTime.UtcNow,
            device.LastSeenAtUtc);
    }

    private static string ComputeSha256(
        string value)
    {
        var bytes =
            SHA256.HashData(
                Encoding.UTF8.GetBytes(
                    value));

        return Convert.ToHexString(
            bytes);
    }

    private static bool FixedTimeEquals(
        string expectedHash,
        string suppliedHash)
    {
        try
        {
            var expected =
                Convert.FromHexString(
                    expectedHash);

            var supplied =
                Convert.FromHexString(
                    suppliedHash);

            return CryptographicOperations
                .FixedTimeEquals(
                    expected,
                    supplied);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static string? Normalize(
        string? value)
    {
        return string.IsNullOrWhiteSpace(
            value)
            ? null
            : value.Trim();
    }
}