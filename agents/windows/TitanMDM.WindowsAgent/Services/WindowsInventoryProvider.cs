using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Microsoft.Win32;

namespace TitanMDM.WindowsAgent.Services;

[SupportedOSPlatform("windows")]
public sealed class WindowsInventoryProvider
{
    public WindowsInventorySnapshot Collect()
    {
        return new WindowsInventorySnapshot(
            Device: CollectDevice(),
            Network: CollectNetwork(),
            Applications: CollectApplications(),
            Processes: CollectProcesses(),
            Services: CollectServices(),
            CollectedAtUtc: DateTime.UtcNow);
    }

    public WindowsDeviceSnapshot CollectDevice()
    {
        var systemDrive =
            Path.GetPathRoot(
                Environment.SystemDirectory)
            ?? @"C:\";

        var drive =
            new DriveInfo(systemDrive);

        return new WindowsDeviceSnapshot(
            ComputerName:
                Environment.MachineName,

            UserName:
                Environment.UserName,

            DomainName:
                Environment.UserDomainName,

            OperatingSystem:
                RuntimeInformation.OSDescription,

            OperatingSystemVersion:
                Environment.OSVersion
                    .Version
                    .ToString(),

            OsArchitecture:
                RuntimeInformation
                    .OSArchitecture
                    .ToString(),

            ProcessArchitecture:
                RuntimeInformation
                    .ProcessArchitecture
                    .ToString(),

            Framework:
                RuntimeInformation
                    .FrameworkDescription,

            ProcessorCount:
                Environment.ProcessorCount,

            Is64BitOperatingSystem:
                Environment
                    .Is64BitOperatingSystem,

            MachineGuid:
                ReadRegistryString(
                    Registry.LocalMachine,
                    @"SOFTWARE\Microsoft\Cryptography",
                    "MachineGuid"),

            ProductName:
                ReadRegistryString(
                    Registry.LocalMachine,
                    @"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
                    "ProductName"),

            DisplayVersion:
                ReadRegistryString(
                    Registry.LocalMachine,
                    @"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
                    "DisplayVersion"),

            CurrentBuild:
                ReadRegistryString(
                    Registry.LocalMachine,
                    @"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
                    "CurrentBuild"),

            InstallDateUtc:
                ReadInstallDate(),

            SystemDrive:
                drive.Name,

            SystemDriveTotalBytes:
                SafeDriveValue(
                    () => drive.TotalSize),

            SystemDriveFreeBytes:
                SafeDriveValue(
                    () => drive.AvailableFreeSpace),

            AgentVersion:
                typeof(WindowsInventoryProvider)
                    .Assembly
                    .GetName()
                    .Version?
                    .ToString()
                ?? "1.0.0");
    }

    public IReadOnlyCollection<
        WindowsNetworkAdapterSnapshot>
        CollectNetwork()
    {
        var adapters =
            new List<
                WindowsNetworkAdapterSnapshot>();

        foreach (
            var networkInterface
            in NetworkInterface
                .GetAllNetworkInterfaces())
        {
            try
            {
                var properties =
                    networkInterface
                        .GetIPProperties();

                var addresses =
                    properties
                        .UnicastAddresses
                        .Where(
                            address =>
                                address.Address
                                    .AddressFamily ==
                                AddressFamily.InterNetwork
                                ||
                                address.Address
                                    .AddressFamily ==
                                AddressFamily.InterNetworkV6)
                        .Select(
                            address =>
                                address.Address
                                    .ToString())
                        .Distinct()
                        .ToArray();

                var gateways =
                    properties
                        .GatewayAddresses
                        .Select(
                            gateway =>
                                gateway.Address
                                    .ToString())
                        .Where(
                            value =>
                                !string.IsNullOrWhiteSpace(
                                    value))
                        .Distinct()
                        .ToArray();

                var dns =
                    properties
                        .DnsAddresses
                        .Select(
                            address =>
                                address.ToString())
                        .Distinct()
                        .ToArray();

                adapters.Add(
                    new WindowsNetworkAdapterSnapshot(
                        Name:
                            networkInterface.Name,

                        Description:
                            networkInterface
                                .Description,

                        InterfaceType:
                            networkInterface
                                .NetworkInterfaceType
                                .ToString(),

                        OperationalStatus:
                            networkInterface
                                .OperationalStatus
                                .ToString(),

                        MacAddress:
                            FormatMacAddress(
                                networkInterface
                                    .GetPhysicalAddress()),

                        Speed:
                            networkInterface.Speed,

                        IpAddresses:
                            addresses,

                        Gateways:
                            gateways,

                        DnsServers:
                            dns));
            }
            catch
            {
                // Un adaptador defectuoso no debe
                // invalidar el inventario completo.
            }
        }

        return adapters;
    }

    public IReadOnlyCollection<
        WindowsApplicationSnapshot>
        CollectApplications()
    {
        var applications =
            new Dictionary<
                string,
                WindowsApplicationSnapshot>(
                    StringComparer.OrdinalIgnoreCase);

        ReadApplications(
            Registry.LocalMachine,
            RegistryView.Registry64,
            applications);

        ReadApplications(
            Registry.LocalMachine,
            RegistryView.Registry32,
            applications);

        ReadApplications(
            Registry.CurrentUser,
            RegistryView.Default,
            applications);

        return applications
            .Values
            .OrderBy(
                application =>
                    application.Name)
            .ToArray();
    }

    public IReadOnlyCollection<
        WindowsProcessSnapshot>
        CollectProcesses()
    {
        var processes =
            new List<
                WindowsProcessSnapshot>();

        foreach (
            var process
            in Process.GetProcesses())
        {
            try
            {
                processes.Add(
                    new WindowsProcessSnapshot(
                        ProcessId:
                            process.Id,

                        Name:
                            process.ProcessName,

                        WorkingSetBytes:
                            process.WorkingSet64,

                        StartTimeUtc:
                            TryGetProcessStartTime(
                                process)));
            }
            catch
            {
                // Algunos procesos del sistema
                // pueden negar acceso.
            }
            finally
            {
                process.Dispose();
            }
        }

        return processes
            .OrderBy(
                process =>
                    process.Name)
            .ToArray();
    }

    public IReadOnlyCollection<
        WindowsServiceSnapshot>
        CollectServices()
    {
        var services =
            new List<
                WindowsServiceSnapshot>();

        using var servicesKey =
            Registry.LocalMachine
                .OpenSubKey(
                    @"SYSTEM\CurrentControlSet\Services");

        if (servicesKey is null)
        {
            return services;
        }

        foreach (
            var serviceName
            in servicesKey.GetSubKeyNames())
        {
            try
            {
                using var serviceKey =
                    servicesKey.OpenSubKey(
                        serviceName);

                if (serviceKey is null)
                {
                    continue;
                }

                var imagePath =
                    serviceKey
                        .GetValue("ImagePath")
                        ?.ToString();

                var displayName =
                    serviceKey
                        .GetValue("DisplayName")
                        ?.ToString();

                var start =
                    serviceKey
                        .GetValue("Start");

                var type =
                    serviceKey
                        .GetValue("Type");

                services.Add(
                    new WindowsServiceSnapshot(
                        Name:
                            serviceName,

                        DisplayName:
                            displayName,

                        ImagePath:
                            imagePath,

                        StartType:
                            start?.ToString(),

                        ServiceType:
                            type?.ToString()));
            }
            catch
            {
                // Continuar con el resto.
            }
        }

        return services
            .OrderBy(
                service =>
                    service.Name)
            .ToArray();
    }

    private static void ReadApplications(
        RegistryKey hive,
        RegistryView view,
        IDictionary<
            string,
            WindowsApplicationSnapshot>
            applications)
    {
        const string uninstallPath =
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";

        try
        {
            using var baseKey =
                RegistryKey
                    .OpenBaseKey(
                        hive == Registry.LocalMachine
                            ? RegistryHive.LocalMachine
                            : RegistryHive.CurrentUser,
                        view);

            using var uninstallKey =
                baseKey.OpenSubKey(
                    uninstallPath);

            if (uninstallKey is null)
            {
                return;
            }

            foreach (
                var subKeyName
                in uninstallKey
                    .GetSubKeyNames())
            {
                using var applicationKey =
                    uninstallKey
                        .OpenSubKey(
                            subKeyName);

                if (applicationKey is null)
                {
                    continue;
                }

                var name =
                    applicationKey
                        .GetValue(
                            "DisplayName")
                        ?.ToString();

                if (string.IsNullOrWhiteSpace(
                        name))
                {
                    continue;
                }

                var version =
                    applicationKey
                        .GetValue(
                            "DisplayVersion")
                        ?.ToString();

                var publisher =
                    applicationKey
                        .GetValue(
                            "Publisher")
                        ?.ToString();

                var installLocation =
                    applicationKey
                        .GetValue(
                            "InstallLocation")
                        ?.ToString();

                var uninstallString =
                    applicationKey
                        .GetValue(
                            "UninstallString")
                        ?.ToString();

                var key =
                    $"{name}|{version}|{publisher}";

                applications[key] =
                    new WindowsApplicationSnapshot(
                        Name:
                            name,

                        Version:
                            version,

                        Publisher:
                            publisher,

                        InstallLocation:
                            installLocation,

                        UninstallString:
                            uninstallString);
            }
        }
        catch
        {
            // El inventario debe continuar aunque
            // una vista del registro no sea accesible.
        }
    }

    private static string?
        ReadRegistryString(
            RegistryKey root,
            string path,
            string valueName)
    {
        try
        {
            using var key =
                root.OpenSubKey(
                    path);

            return key?
                .GetValue(
                    valueName)
                ?.ToString();
        }
        catch
        {
            return null;
        }
    }

    private static DateTime?
        ReadInstallDate()
    {
        var raw =
            ReadRegistryString(
                Registry.LocalMachine,
                @"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
                "InstallDate");

        if (!long.TryParse(
                raw,
                out var unixSeconds))
        {
            return null;
        }

        try
        {
            return DateTimeOffset
                .FromUnixTimeSeconds(
                    unixSeconds)
                .UtcDateTime;
        }
        catch
        {
            return null;
        }
    }

    private static long?
        SafeDriveValue(
            Func<long> getter)
    {
        try
        {
            return getter();
        }
        catch
        {
            return null;
        }
    }

    private static DateTime?
        TryGetProcessStartTime(
            Process process)
    {
        try
        {
            return process
                .StartTime
                .ToUniversalTime();
        }
        catch
        {
            return null;
        }
    }

    private static string
        FormatMacAddress(
            PhysicalAddress address)
    {
        return string.Join(
            ":",
            address
                .GetAddressBytes()
                .Select(
                    value =>
                        value.ToString("X2")));
    }
}

public sealed record WindowsInventorySnapshot(
    WindowsDeviceSnapshot Device,
    IReadOnlyCollection<
        WindowsNetworkAdapterSnapshot> Network,
    IReadOnlyCollection<
        WindowsApplicationSnapshot> Applications,
    IReadOnlyCollection<
        WindowsProcessSnapshot> Processes,
    IReadOnlyCollection<
        WindowsServiceSnapshot> Services,
    DateTime CollectedAtUtc);

public sealed record WindowsDeviceSnapshot(
    string ComputerName,
    string UserName,
    string DomainName,
    string OperatingSystem,
    string OperatingSystemVersion,
    string OsArchitecture,
    string ProcessArchitecture,
    string Framework,
    int ProcessorCount,
    bool Is64BitOperatingSystem,
    string? MachineGuid,
    string? ProductName,
    string? DisplayVersion,
    string? CurrentBuild,
    DateTime? InstallDateUtc,
    string SystemDrive,
    long? SystemDriveTotalBytes,
    long? SystemDriveFreeBytes,
    string AgentVersion);

public sealed record WindowsNetworkAdapterSnapshot(
    string Name,
    string Description,
    string InterfaceType,
    string OperationalStatus,
    string MacAddress,
    long Speed,
    IReadOnlyCollection<string> IpAddresses,
    IReadOnlyCollection<string> Gateways,
    IReadOnlyCollection<string> DnsServers);

public sealed record WindowsApplicationSnapshot(
    string Name,
    string? Version,
    string? Publisher,
    string? InstallLocation,
    string? UninstallString);

public sealed record WindowsProcessSnapshot(
    int ProcessId,
    string Name,
    long WorkingSetBytes,
    DateTime? StartTimeUtc);

public sealed record WindowsServiceSnapshot(
    string Name,
    string? DisplayName,
    string? ImagePath,
    string? StartType,
    string? ServiceType);