using System.Security.Cryptography;
using System.Text.Json;

using Microsoft.EntityFrameworkCore;

using TitanMDM.Application.Applications;
using TitanMDM.Application.Commands;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Applications;

public sealed class SoftwareDeploymentService
    : ISoftwareDeploymentService
{
    private readonly TitanMdmDbContext
        _dbContext;

    private readonly IDeviceCommandService
        _commandService;

    private readonly string
        _storageRoot;

    public SoftwareDeploymentService(
        TitanMdmDbContext dbContext,
        IDeviceCommandService commandService)
    {
        _dbContext =
            dbContext;

        _commandService =
            commandService;

        _storageRoot =
            Path.Combine(
                AppContext.BaseDirectory,
                "App_Data",
                "software");

        Directory.CreateDirectory(
            _storageRoot);
    }

    public async Task<SoftwarePackageDto>
        UploadPackageAsync(
            Guid organizationId,
            Guid userId,
            CreateSoftwarePackageRequest request,
            string fileName,
            Stream fileStream,
            CancellationToken cancellationToken = default)
    {
        if (
            string.IsNullOrWhiteSpace(
                fileName))
        {
            throw new InvalidOperationException(
                "El nombre del archivo es obligatorio.");
        }

        var extension =
            Path.GetExtension(
                fileName)
            .ToLowerInvariant();

        if (
            extension is not
                ".msi"
            and not
                ".exe"
            and not
                ".msix"
            and not
                ".appx")
        {
            throw new InvalidOperationException(
                "El tipo de paquete no está soportado.");
        }

        var packageId =
            Guid.NewGuid();

        var storedFileName =
            $"{packageId:N}{extension}";

        var organizationDirectory =
            Path.Combine(
                _storageRoot,
                organizationId
                    .ToString("N"));

        Directory.CreateDirectory(
            organizationDirectory);

        var fullPath =
            Path.Combine(
                organizationDirectory,
                storedFileName);

        await using (
            var output =
                File.Create(
                    fullPath))
        {
            await fileStream
                .CopyToAsync(
                    output,
                    cancellationToken);
        }

        var sha256 =
            await CalculateSha256Async(
                fullPath,
                cancellationToken);

        var fileInfo =
            new FileInfo(
                fullPath);

        var package =
            new SoftwarePackage(
                organizationId,
                request.Name,
                request.Version,
                request.PackageType,
                fileName,
                storedFileName,
                Path.Combine(
                    organizationId
                        .ToString("N"),
                    storedFileName),
                sha256,
                fileInfo.Length,
                request.InstallArguments,
                userId);

        typeof(SoftwarePackage)
            .GetProperty(
                nameof(
                    SoftwarePackage.Id))?
            .SetValue(
                package,
                packageId);

        _dbContext
            .SoftwarePackages
            .Add(
                package);

        await _dbContext
            .SaveChangesAsync(
                cancellationToken);

        return MapPackage(
            package);
    }

    public async Task<
        IReadOnlyCollection<SoftwarePackageDto>>
        GetPackagesAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default)
    {
        var items =
            await _dbContext
                .SoftwarePackages
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                        organizationId)
                .OrderByDescending(
                    x =>
                        x.CreatedAtUtc)
                .ToListAsync(
                    cancellationToken);

        return items
            .Select(
                MapPackage)
            .ToArray();
    }

    public async Task<
        IReadOnlyCollection<SoftwareDeploymentDto>>
        GetDeploymentsAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default)
    {
        var deployments =
            await _dbContext
                .SoftwareDeployments
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                        organizationId)
                .OrderByDescending(
                    x =>
                        x.CreatedAtUtc)
                .ToListAsync(
                    cancellationToken);

        var packages =
            await _dbContext
                .SoftwarePackages
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                        organizationId)
                .ToDictionaryAsync(
                    x => x.Id,
                    cancellationToken);

        var groups =
            await _dbContext
                .DeviceGroups
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                        organizationId)
                .ToDictionaryAsync(
                    x => x.Id,
                    cancellationToken);

        var devices =
            await _dbContext
                .Devices
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                        organizationId)
                .ToDictionaryAsync(
                    x => x.Id,
                    cancellationToken);

        return deployments
            .Select(
                deployment =>
                {
                    packages.TryGetValue(
                        deployment.PackageId,
                        out var package);

                    var targetName =
                        deployment.TargetType
                            .Equals(
                                "Group",
                                StringComparison
                                    .OrdinalIgnoreCase)
                            ? groups
                                .GetValueOrDefault(
                                    deployment.TargetId)
                                ?.Name
                            : devices
                                .GetValueOrDefault(
                                    deployment.TargetId)
                                ?.DeviceName;

                    return new SoftwareDeploymentDto(
                        deployment.Id,
                        deployment.PackageId,
                        package?.Name ??
                            "N/D",
                        package?.Version ??
                            "N/D",
                        deployment.TargetType,
                        deployment.TargetId,
                        targetName ??
                            "N/D",
                        deployment.Status,
                        deployment.QueuedDevices,
                        deployment.CreatedAtUtc);
                })
            .ToArray();
    }

    public async Task<SoftwareDeploymentDto>
        DeployAsync(
            Guid organizationId,
            Guid userId,
            Guid packageId,
            DeploySoftwarePackageRequest request,
            CancellationToken cancellationToken = default)
    {
        var package =
            await _dbContext
                .SoftwarePackages
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    x =>
                        x.Id ==
                            packageId
                        &&
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.IsActive,
                    cancellationToken)
            ??
            throw new InvalidOperationException(
                "El paquete no existe o está deshabilitado.");

        var targetType =
            request.TargetType
                .Trim();

        var deviceIds =
            new List<Guid>();

        string targetName;

        if (
            targetType.Equals(
                "Device",
                StringComparison
                    .OrdinalIgnoreCase))
        {
            var device =
                await _dbContext
                    .Devices
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        x =>
                            x.Id ==
                                request.TargetId
                            &&
                            x.OrganizationId ==
                                organizationId
                            &&
                            !x.IsDeleted,
                        cancellationToken)
                ??
                throw new InvalidOperationException(
                    "El dispositivo no existe.");

            if (
                device.Platform !=
                DevicePlatform.Windows)
            {
                throw new InvalidOperationException(
                    "Este deployment solo admite dispositivos Windows.");
            }

            deviceIds.Add(
                device.Id);

            targetName =
                device.DeviceName;
        }
        else if (
            targetType.Equals(
                "Group",
                StringComparison
                    .OrdinalIgnoreCase))
        {
            var group =
                await _dbContext
                    .DeviceGroups
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        x =>
                            x.Id ==
                                request.TargetId
                            &&
                            x.OrganizationId ==
                                organizationId
                            &&
                            x.IsEnabled,
                        cancellationToken)
                ??
                throw new InvalidOperationException(
                    "El grupo no existe.");

            deviceIds =
                await (
                    from member
                        in _dbContext
                            .DeviceGroupMembers
                            .AsNoTracking()

                    join device
                        in _dbContext
                            .Devices
                            .AsNoTracking()
                        on member.DeviceId
                        equals device.Id

                    where
                        member.GroupId ==
                            group.Id
                        &&
                        member.OrganizationId ==
                            organizationId
                        &&
                        device.Platform ==
                            DevicePlatform.Windows
                        &&
                        !device.IsDeleted

                    select device.Id
                )
                .Distinct()
                .ToListAsync(
                    cancellationToken);

            targetName =
                group.Name;
        }
        else
        {
            throw new InvalidOperationException(
                "TargetType debe ser Device o Group.");
        }

        var deployment =
            new SoftwareDeployment(
                organizationId,
                package.Id,
                targetType,
                request.TargetId,
                userId);

        _dbContext
            .SoftwareDeployments
            .Add(
                deployment);

        await _dbContext
            .SaveChangesAsync(
                cancellationToken);

        var queued =
            0;

        foreach (
            var deviceId
            in deviceIds)
        {
            var payload =
                JsonSerializer.Serialize(
                    new
                    {
                        packageId =
                            package.Id,

                        downloadUrl =
                            $"/api/device/software-packages/{package.Id}/download",

                        fileName =
                            package.OriginalFileName,

                        expectedSha256 =
                            package.Sha256,

                        arguments =
                            package.InstallArguments,

                        timeoutSeconds =
                            1800
                    });

            await _commandService
                .CreateAsync(
                    organizationId,
                    userId,
                    new CreateDeviceCommandRequest(
                        deviceId,
                        "SOFTWARE_INSTALL",
                        payload,
                        60),
                    cancellationToken);

            queued++;
        }

        deployment.MarkQueued(
            queued);

        await _dbContext
            .SaveChangesAsync(
                cancellationToken);

        return new SoftwareDeploymentDto(
            deployment.Id,
            package.Id,
            package.Name,
            package.Version,
            targetType,
            request.TargetId,
            targetName,
            deployment.Status,
            deployment.QueuedDevices,
            deployment.CreatedAtUtc);
    }

    public async Task<SoftwarePackageDownloadDto?>
        GetPackageDownloadAsync(
            Guid deviceId,
            Guid packageId,
            CancellationToken cancellationToken = default)
    {
        var device =
            await _dbContext
                .Devices
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    x =>
                        x.Id ==
                            deviceId
                        &&
                        !x.IsDeleted,
                    cancellationToken);

        if (device is null)
        {
            return null;
        }

        var package =
            await _dbContext
                .SoftwarePackages
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    x =>
                        x.Id ==
                            packageId
                        &&
                        x.OrganizationId ==
                            device.OrganizationId
                        &&
                        x.IsActive,
                    cancellationToken);

        if (package is null)
        {
            return null;
        }

        var fullPath =
            Path.Combine(
                _storageRoot,
                package.RelativePath);

        if (!File.Exists(
                fullPath))
        {
            return null;
        }

        return new SoftwarePackageDownloadDto(
            fullPath,
            package.OriginalFileName,
            "application/octet-stream");
    }

    private static SoftwarePackageDto
        MapPackage(
            SoftwarePackage package)
    {
        return new SoftwarePackageDto(
            package.Id,
            package.Name,
            package.Version,
            package.PackageType,
            package.OriginalFileName,
            package.Sha256,
            package.SizeBytes,
            package.InstallArguments,
            package.IsActive,
            package.CreatedAtUtc);
    }

    private static async Task<string>
        CalculateSha256Async(
            string fullPath,
            CancellationToken cancellationToken)
    {
        await using var stream =
            File.OpenRead(
                fullPath);

        var hash =
            await SHA256
                .HashDataAsync(
                    stream,
                    cancellationToken);

        return Convert
            .ToHexString(
                hash);
    }
}