using System.Runtime.InteropServices;

namespace TitanMDM.WindowsAgent.Services;

public sealed class WindowsDeviceInfoProvider
{
    public WindowsDeviceInformation GetDeviceInformation()
    {
        var version =
            typeof(WindowsDeviceInfoProvider)
                .Assembly
                .GetName()
                .Version?
                .ToString()
            ?? "1.0.0";

        return new WindowsDeviceInformation(
            Environment.MachineName,
            GetSerialNumber(),
            GetManufacturer(),
            GetModel(),
            RuntimeInformation.OSDescription,
            Environment.OSVersion.Version.ToString(),
            version);
    }

    private static string GetSerialNumber()
    {
        return GetMachineGuid()
            ?? Environment.MachineName;
    }

    private static string? GetManufacturer()
    {
        return Environment.GetEnvironmentVariable(
            "COMPUTERNAME");
    }

    private static string? GetModel()
    {
        return RuntimeInformation.OSArchitecture
            .ToString();
    }

    private static string? GetMachineGuid()
    {
        try
        {
            using var key =
                Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\Cryptography");

            return key?
                .GetValue("MachineGuid")?
                .ToString();
        }
        catch
        {
            return null;
        }
    }
}

public sealed record WindowsDeviceInformation(
    string DeviceName,
    string SerialNumber,
    string? Manufacturer,
    string? Model,
    string OperatingSystem,
    string OperatingSystemVersion,
    string AgentVersion);