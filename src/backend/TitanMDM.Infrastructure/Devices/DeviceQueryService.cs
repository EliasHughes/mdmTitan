using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Devices;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Devices;

public sealed class DeviceQueryService : IDeviceQueryService
{
    private readonly TitanMdmDbContext _dbContext;

    public DeviceQueryService(
        TitanMdmDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<DeviceListResultDto> GetDevicesAsync(
        Guid organizationId,
        string? search,
        string? platform,
        string? status,
        string? compliance,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 10, 100);

        var query = _dbContext.Devices
            .AsNoTracking()
            .Where(device =>
                device.OrganizationId == organizationId &&
                !device.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            query = query.Where(device =>
                device.DeviceName.Contains(term) ||
                device.SerialNumber.Contains(term) ||
                (device.Manufacturer != null &&
                 device.Manufacturer.Contains(term)) ||
                (device.Model != null &&
                 device.Model.Contains(term)) ||
                (device.AssignedUser != null &&
                 device.AssignedUser.Contains(term)) ||
                (device.Department != null &&
                 device.Department.Contains(term)) ||
                (device.IpAddress != null &&
                 device.IpAddress.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(platform) &&
            Enum.TryParse<DevicePlatform>(
                platform,
                true,
                out var parsedPlatform))
        {
            query = query.Where(device =>
                device.Platform == parsedPlatform);
        }

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<DeviceStatus>(
                status,
                true,
                out var parsedStatus))
        {
            query = query.Where(device =>
                device.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(compliance) &&
            Enum.TryParse<ComplianceStatus>(
                compliance,
                true,
                out var parsedCompliance))
        {
            query = query.Where(device =>
                device.ComplianceStatus == parsedCompliance);
        }

        var totalCount = await query.CountAsync(
            cancellationToken);

        var totalPages = totalCount == 0
            ? 0
            : (int)Math.Ceiling(
                totalCount / (double)pageSize);

        var items = await query
            .OrderByDescending(device =>
                device.LastSeenAtUtc ?? device.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(device =>
                new DeviceListItemDto(
                    device.Id,
                    device.DeviceName,
                    device.Platform.ToString(),
                    device.Status.ToString(),
                    device.ComplianceStatus.ToString(),
                    device.SerialNumber,
                    device.Manufacturer,
                    device.Model,
                    device.OperatingSystem,
                    device.OperatingSystemVersion,
                    device.AssignedUser,
                    device.Department,
                    device.IpAddress,
                    device.BatteryLevel,
                    device.IsManaged,
                    device.EnrolledAtUtc,
                    device.LastSeenAtUtc))
            .ToListAsync(cancellationToken);

        return new DeviceListResultDto(
            items,
            totalCount,
            page,
            pageSize,
            totalPages);
    }

    public async Task<DeviceDetailsDto?> GetDeviceByIdAsync(
        Guid organizationId,
        Guid deviceId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Devices
            .AsNoTracking()
            .Where(device =>
                device.OrganizationId == organizationId &&
                device.Id == deviceId &&
                !device.IsDeleted)
            .Select(device =>
                new DeviceDetailsDto(
                    device.Id,
                    device.OrganizationId,
                    device.DeviceName,
                    device.Platform.ToString(),
                    device.Status.ToString(),
                    device.ComplianceStatus.ToString(),
                    device.SerialNumber,
                    device.Imei,
                    device.Manufacturer,
                    device.Model,
                    device.OperatingSystem,
                    device.OperatingSystemVersion,
                    device.AgentVersion,
                    device.IpAddress,
                    device.MacAddress,
                    device.AssignedUser,
                    device.Department,
                    device.BatteryLevel,
                    device.IsManaged,
                    device.EnrolledAtUtc,
                    device.LastSeenAtUtc,
                    device.CreatedAtUtc,
                    device.UpdatedAtUtc))
            .FirstOrDefaultAsync(cancellationToken);
    }
}