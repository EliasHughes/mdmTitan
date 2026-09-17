using System.Text.Json;

namespace TitanMDM.WindowsAgent.Storage;

public sealed class DeviceIdentityStore
{
    private readonly string _directoryPath;
    private readonly string _identityFilePath;

    public DeviceIdentityStore()
    {
        _directoryPath = Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.CommonApplicationData),
            "TitanMDM");

        _identityFilePath = Path.Combine(
            _directoryPath,
            "device.json");
    }

    public bool Exists()
    {
        return File.Exists(_identityFilePath);
    }

    public async Task<DeviceIdentity?> LoadAsync(
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(_identityFilePath))
        {
            return null;
        }

        try
        {
            var json = await File.ReadAllTextAsync(
                _identityFilePath,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            return JsonSerializer.Deserialize<DeviceIdentity>(
                json,
                JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public async Task SaveAsync(
        DeviceIdentity identity,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(identity);

        if (identity.DeviceId == Guid.Empty)
        {
            throw new ArgumentException(
                "DeviceId no puede estar vacío.",
                nameof(identity));
        }

        if (string.IsNullOrWhiteSpace(
                identity.DeviceSecret))
        {
            throw new ArgumentException(
                "DeviceSecret no puede estar vacío.",
                nameof(identity));
        }

        Directory.CreateDirectory(
            _directoryPath);

        var json = JsonSerializer.Serialize(
            identity,
            JsonOptions);

        var temporaryFilePath =
            _identityFilePath + ".tmp";

        await File.WriteAllTextAsync(
            temporaryFilePath,
            json,
            cancellationToken);

        File.Move(
            temporaryFilePath,
            _identityFilePath,
            true);
    }

    public Task DeleteAsync()
    {
        if (File.Exists(_identityFilePath))
        {
            File.Delete(
                _identityFilePath);
        }

        return Task.CompletedTask;
    }

    public string GetIdentityFilePath()
    {
        return _identityFilePath;
    }

    private static readonly JsonSerializerOptions
        JsonOptions = new()
        {
            PropertyNamingPolicy =
                JsonNamingPolicy.CamelCase,

            PropertyNameCaseInsensitive = true,

            WriteIndented = true
        };
}

public sealed record DeviceIdentity(
    Guid DeviceId,
    string DeviceSecret);