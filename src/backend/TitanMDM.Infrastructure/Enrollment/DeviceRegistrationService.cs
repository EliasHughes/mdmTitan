using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Enrollment.DeviceRegistration;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Enrollment;

public sealed class DeviceRegistrationService
    : IDeviceRegistrationService
{
    private readonly TitanMdmDbContext _dbContext;

    public DeviceRegistrationService(
        TitanMdmDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RegisterDeviceResultDto> RegisterAsync(
        RegisterDeviceRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(request);

        var normalizedToken =
            request.EnrollmentToken.Trim();

        var tokenHash =
            ComputeSha256(normalizedToken);

        await using var transaction =
            await _dbContext.Database.BeginTransactionAsync(
                cancellationToken);

        try
        {
            var enrollmentToken =
                await _dbContext.EnrollmentTokens
                    .SingleOrDefaultAsync(
                        x => x.TokenHash == tokenHash,
                        cancellationToken);

            if (enrollmentToken is null)
            {
                throw new DeviceRegistrationException(
                    "INVALID_TOKEN",
                    "La credencial de inscripción no es válida.");
            }

            ValidateEnrollmentToken(
                enrollmentToken,
                request.Platform);

            var serialNumber =
                request.SerialNumber.Trim();

            var duplicateExists =
                await _dbContext.Devices.AnyAsync(
                    x =>
                        x.OrganizationId ==
                            enrollmentToken.OrganizationId &&
                        x.SerialNumber == serialNumber &&
                        !x.IsDeleted,
                    cancellationToken);

            if (duplicateExists)
            {
                throw new DeviceRegistrationException(
                    "SERIAL_ALREADY_REGISTERED",
                    "Ya existe un dispositivo con este número de serie.");
            }

            var device =
                new Device(
                    enrollmentToken.OrganizationId,
                    request.DeviceName.Trim(),
                    enrollmentToken.Platform,
                    serialNumber);

            device.UpdateInventory(
                Normalize(request.Manufacturer),
                Normalize(request.Model),
                Normalize(request.OperatingSystem),
                Normalize(request.OperatingSystemVersion),
                Normalize(request.AgentVersion),
                null,
                Normalize(request.MacAddress));

            device.RegisterHeartbeat(
                Normalize(request.IpAddress),
                null);

            device.CompleteEnrollment();

            enrollmentToken.RegisterUse();

            _dbContext.Devices.Add(device);

            await _dbContext.SaveChangesAsync(
                cancellationToken);

            await transaction.CommitAsync(
                cancellationToken);

            return new RegisterDeviceResultDto(
                device.Id,
                device.OrganizationId,
                device.DeviceName,
                device.Platform.ToString(),
                device.Status.ToString(),
                device.ComplianceStatus.ToString(),
                device.IsManaged,
                device.EnrolledAtUtc
                    ?? DateTime.UtcNow);
        }
        catch
        {
            await transaction.RollbackAsync(
                cancellationToken);

            throw;
        }
    }

    private static void ValidateRequest(
        RegisterDeviceRequest request)
    {
        if (string.IsNullOrWhiteSpace(
                request.EnrollmentToken))
        {
            throw new DeviceRegistrationException(
                "INVALID_REQUEST",
                "EnrollmentToken es obligatorio.");
        }

        if (string.IsNullOrWhiteSpace(
                request.DeviceName))
        {
            throw new DeviceRegistrationException(
                "INVALID_REQUEST",
                "DeviceName es obligatorio.");
        }

        if (string.IsNullOrWhiteSpace(
                request.SerialNumber))
        {
            throw new DeviceRegistrationException(
                "INVALID_REQUEST",
                "SerialNumber es obligatorio.");
        }

        if (!Enum.TryParse<DevicePlatform>(
                request.Platform,
                true,
                out var platform) ||
            platform == DevicePlatform.Unknown)
        {
            throw new DeviceRegistrationException(
                "INVALID_PLATFORM",
                "La plataforma debe ser Windows o Android.");
        }
    }

    private static void ValidateEnrollmentToken(
        EnrollmentToken token,
        string requestedPlatform)
    {
        if (token.Status ==
            EnrollmentStatus.Revoked)
        {
            throw new DeviceRegistrationException(
                "TOKEN_REVOKED",
                "La credencial de inscripción fue revocada.");
        }

        if (DateTime.UtcNow >=
            token.ExpiresAtUtc)
        {
            throw new DeviceRegistrationException(
                "TOKEN_EXPIRED",
                "La credencial de inscripción ha expirado.");
        }

        if (token.Status ==
                EnrollmentStatus.Completed ||
            token.UsedCount >= token.MaxUses)
        {
            throw new DeviceRegistrationException(
                "TOKEN_EXHAUSTED",
                "La credencial alcanzó el máximo de usos permitidos.");
        }

        if (token.Status !=
            EnrollmentStatus.Active)
        {
            throw new DeviceRegistrationException(
                "TOKEN_NOT_ACTIVE",
                "La credencial de inscripción no está activa.");
        }

        if (!Enum.TryParse<DevicePlatform>(
                requestedPlatform,
                true,
                out var platform) ||
            platform != token.Platform)
        {
            throw new DeviceRegistrationException(
                "PLATFORM_MISMATCH",
                $"La credencial pertenece a {token.Platform}.");
        }
    }

    private static string ComputeSha256(
        string value)
    {
        var bytes =
            SHA256.HashData(
                Encoding.UTF8.GetBytes(value));

        return Convert.ToHexString(bytes);
    }

    private static string? Normalize(
        string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}