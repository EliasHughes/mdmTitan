using System.Text.RegularExpressions;

namespace TitanMDM.Application.Devices.Naming;

public static partial class DeviceNameParser
{
    /*
     * Ejemplos:
     *
     * CILSPMCEDI01
     * CIDSPMFACT01
     *
     * Org     = CI
     * Type    = L / D
     * City    = SPM
     * Area    = CEDI / FACT
     * Number  = 01
     */

    [GeneratedRegex(
        @"^(?<org>[A-Z]{2})(?<type>[A-Z])(?<city>[A-Z]{3})(?<area>[A-Z]{2,12})(?<number>\d{2,4})$",
        RegexOptions.IgnoreCase |
        RegexOptions.CultureInvariant)]
    private static partial Regex
        DeviceNameRegex();

    public static DeviceNameParseResult
        Parse(
            string? deviceName,
            DeviceNamingOptions options)
    {
        if (
            !options.Enabled
            ||
            string.IsNullOrWhiteSpace(
                deviceName))
        {
            return DeviceNameParseResult
                .NotMatched(
                    deviceName);
        }

        var normalized =
            deviceName
                .Trim()
                .ToUpperInvariant();

        var match =
            DeviceNameRegex()
                .Match(
                    normalized);

        if (!match.Success)
        {
            return DeviceNameParseResult
                .NotMatched(
                    normalized);
        }

        var organization =
            match.Groups["org"]
                .Value;

        var type =
            match.Groups["type"]
                .Value;

        var city =
            match.Groups["city"]
                .Value;

        var area =
            match.Groups["area"]
                .Value;

        var numberText =
            match.Groups["number"]
                .Value;

        if (
            !organization.Equals(
                options.OrganizationPrefix,
                StringComparison.OrdinalIgnoreCase))
        {
            return DeviceNameParseResult
                .Invalid(
                    normalized,
                    $"Prefijo de organización no válido: {organization}.");
        }

        if (
            !options.DeviceTypes
                .TryGetValue(
                    type,
                    out var deviceType))
        {
            return DeviceNameParseResult
                .Invalid(
                    normalized,
                    $"Tipo de equipo desconocido: {type}.");
        }

        options.Cities.TryGetValue(
            city,
            out var cityName);

        options.Areas.TryGetValue(
            area,
            out var areaMapping);

        return new DeviceNameParseResult(
            true,
            true,
            normalized,
            organization,
            type,
            deviceType,
            city,
            cityName,
            area,
            areaMapping?.SiteName,
            areaMapping?.SiteLocationName,
            int.Parse(
                numberText),
            null);
    }
}

public sealed record DeviceNameParseResult(
    bool Matched,
    bool Valid,
    string? DeviceName,
    string? OrganizationCode,
    string? DeviceTypeCode,
    string? DeviceType,
    string? CityCode,
    string? City,
    string? AreaCode,
    string? SuggestedSiteName,
    string? SuggestedSiteLocationName,
    int? Sequence,
    string? Error)
{
    public static DeviceNameParseResult
        NotMatched(
            string? name)
    {
        return new(
            false,
            false,
            name,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            "El nombre no coincide con la nomenclatura corporativa.");
    }

    public static DeviceNameParseResult
        Invalid(
            string? name,
            string error)
    {
        return new(
            true,
            false,
            name,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            error);
    }
}