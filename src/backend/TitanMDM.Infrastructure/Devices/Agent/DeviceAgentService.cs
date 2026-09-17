using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Devices.Agent;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Devices.Agent;

public sealed class DeviceAgentService
    : IDeviceAgentService
{
    private readonly TitanMdmDbContext _dbContext;

    public DeviceAgentService(
        TitanMdmDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<DeviceHeartbeatResultDto> HeartbeatAsync(
        DeviceHeartbeatRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.DeviceId == Guid.Empty)
        {
            throw new DeviceAuthenticationException(
                "INVALID_DEVICE_ID",
                "DeviceId no es válido.");
        }

        if (string.IsNullOrWhiteSpace(request.DeviceSecret))
        {
            throw new DeviceAuthenticationException(
                "INVALID_CREDENTIAL",
                "DeviceSecret es obligatorio.");
        }

        var device =
            await _dbContext.Devices
                .SingleOrDefaultAsync(
                    x =>
                        x.Id == request.DeviceId &&
                        !x.IsDeleted,
                    cancellationToken);

        if (device is null)
        {
            throw new DeviceAuthenticationException(
                "DEVICE_NOT_FOUND",
                "El dispositivo no existe.");
        }

        var credential =
            await _dbContext.DeviceCredentials
                .SingleOrDefaultAsync(
                    x =>
                        x.DeviceId == request.DeviceId &&
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

        credential.RegisterAuthentication();

        device.RegisterHeartbeat(
            Normalize(request.IpAddress),
            request.BatteryLevel);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

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
                Encoding.UTF8.GetBytes(value));

        return Convert.ToHexString(bytes);
    }

    private static bool FixedTimeEquals(
        string expectedHash,
        string suppliedHash)
    {
        try
        {
            var expected =
                Convert.FromHexString(expectedHash);

            var supplied =
                Convert.FromHexString(suppliedHash);

            return CryptographicOperations.FixedTimeEquals(
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
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}