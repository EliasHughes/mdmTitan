using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Location;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Location;

public sealed class DeviceLocationService
    : IDeviceLocationService
{
    private readonly TitanMdmDbContext _db;

    public DeviceLocationService(
        TitanMdmDbContext db)
    {
        _db = db;
    }

    public async Task ProcessLocationAsync(
        Guid deviceId,
        string resultJson,
        CancellationToken cancellationToken = default)
    {
        var device =
            await _db.Devices
                .SingleOrDefaultAsync(
                    x =>
                        x.Id == deviceId &&
                        !x.IsDeleted,
                    cancellationToken)
            ?? throw new InvalidOperationException(
                "Device not found.");

        var result =
            JsonSerializer.Deserialize<
                LocationResult>(
                resultJson,
                JsonOptions)
            ?? throw new InvalidOperationException(
                "Invalid location result.");

        var capturedAt =
            DateTime.TryParse(
                result.CapturedAtUtc,
                out var parsed)
                ? parsed.ToUniversalTime()
                : DateTime.UtcNow;

        _db.DeviceLocations.Add(
            new DeviceLocation(
                device.OrganizationId,
                device.Id,
                result.Latitude,
                result.Longitude,
                result.AccuracyMeters,
                result.AltitudeMeters,
                result.SpeedMetersPerSecond,
                result.Source ??
                    "AndroidAgent",
                capturedAt));

        await _db.SaveChangesAsync(
            cancellationToken);
    }

    public async Task<DeviceLocationDto?>
        GetLatestAsync(
            Guid organizationId,
            Guid deviceId,
            CancellationToken cancellationToken = default)
    {
        return await _db.DeviceLocations
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId ==
                    organizationId &&
                x.DeviceId == deviceId)
            .OrderByDescending(
                x => x.CapturedAtUtc)
            .Select(x =>
                new DeviceLocationDto(
                    x.Id,
                    x.DeviceId,
                    x.Latitude,
                    x.Longitude,
                    x.AccuracyMeters,
                    x.AltitudeMeters,
                    x.SpeedMetersPerSecond,
                    x.Source,
                    x.CapturedAtUtc,
                    x.ReceivedAtUtc))
            .FirstOrDefaultAsync(
                cancellationToken);
    }

    public async Task<
        IReadOnlyCollection<DeviceLocationDto>>
        GetHistoryAsync(
            Guid organizationId,
            Guid deviceId,
            int limit,
            CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(
            limit,
            1,
            500);

        return await _db.DeviceLocations
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId ==
                    organizationId &&
                x.DeviceId == deviceId)
            .OrderByDescending(
                x => x.CapturedAtUtc)
            .Take(limit)
            .Select(x =>
                new DeviceLocationDto(
                    x.Id,
                    x.DeviceId,
                    x.Latitude,
                    x.Longitude,
                    x.AccuracyMeters,
                    x.AltitudeMeters,
                    x.SpeedMetersPerSecond,
                    x.Source,
                    x.CapturedAtUtc,
                    x.ReceivedAtUtc))
            .ToListAsync(
                cancellationToken);
    }

    public async Task<
        IReadOnlyCollection<GeofenceDto>>
        GetGeofencesAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default)
    {
        return await _db.Geofences
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId ==
                    organizationId)
            .OrderBy(x => x.Name)
            .Select(x =>
                new GeofenceDto(
                    x.Id,
                    x.Name,
                    x.Description,
                    x.Latitude,
                    x.Longitude,
                    x.RadiusMeters,
                    x.AlertOnEnter,
                    x.AlertOnExit,
                    x.IsEnabled,
                    _db.GeofenceDeviceAssignments
                        .Count(a =>
                            a.GeofenceId ==
                            x.Id),
                    x.CreatedAtUtc))
            .ToListAsync(
                cancellationToken);
    }

    public async Task<GeofenceDto>
        CreateGeofenceAsync(
            Guid organizationId,
            CreateGeofenceRequest request,
            CancellationToken cancellationToken = default)
    {
        var geofence =
            new Geofence(
                organizationId,
                request.Name,
                request.Description,
                request.Latitude,
                request.Longitude,
                request.RadiusMeters,
                request.AlertOnEnter,
                request.AlertOnExit);

        _db.Geofences.Add(geofence);

        await _db.SaveChangesAsync(
            cancellationToken);

        return new GeofenceDto(
            geofence.Id,
            geofence.Name,
            geofence.Description,
            geofence.Latitude,
            geofence.Longitude,
            geofence.RadiusMeters,
            geofence.AlertOnEnter,
            geofence.AlertOnExit,
            geofence.IsEnabled,
            0,
            geofence.CreatedAtUtc);
    }

    public async Task DeleteGeofenceAsync(
        Guid organizationId,
        Guid geofenceId,
        CancellationToken cancellationToken = default)
    {
        var geofence =
            await _db.Geofences
                .SingleOrDefaultAsync(
                    x =>
                        x.Id == geofenceId &&
                        x.OrganizationId ==
                        organizationId,
                    cancellationToken)
            ?? throw new InvalidOperationException(
                "Geofence not found.");

        _db.Geofences.Remove(geofence);

        await _db.SaveChangesAsync(
            cancellationToken);
    }

    public async Task AssignDevicesAsync(
        Guid organizationId,
        Guid geofenceId,
        IReadOnlyCollection<Guid> deviceIds,
        CancellationToken cancellationToken = default)
    {
        var exists =
            await _db.Geofences.AnyAsync(
                x =>
                    x.Id == geofenceId &&
                    x.OrganizationId ==
                        organizationId,
                cancellationToken);

        if (!exists)
            throw new InvalidOperationException(
                "Geofence not found.");

        var valid =
            await _db.Devices
                .AsNoTracking()
                .Where(x =>
                    deviceIds.Contains(x.Id) &&
                    x.OrganizationId ==
                        organizationId &&
                    !x.IsDeleted)
                .Select(x => x.Id)
                .ToListAsync(
                    cancellationToken);

        var existing =
            await _db
                .GeofenceDeviceAssignments
                .AsNoTracking()
                .Where(x =>
                    x.GeofenceId ==
                    geofenceId)
                .Select(x => x.DeviceId)
                .ToListAsync(
                    cancellationToken);

        foreach (
            var deviceId in
            valid.Except(existing))
        {
            _db.GeofenceDeviceAssignments.Add(
                new GeofenceDeviceAssignment(
                    organizationId,
                    geofenceId,
                    deviceId));
        }

        await _db.SaveChangesAsync(
            cancellationToken);
    }

    private static readonly
        JsonSerializerOptions JsonOptions =
            new()
            {
                PropertyNameCaseInsensitive =
                    true
            };

    private sealed record LocationResult(
        double Latitude,
        double Longitude,
        double? AccuracyMeters,
        double? AltitudeMeters,
        double? SpeedMetersPerSecond,
        string? Source,
        string? CapturedAtUtc);
}