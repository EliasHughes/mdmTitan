using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using TitanMDM.WindowsAgent.Configuration;
using TitanMDM.WindowsAgent.Contracts;
using TitanMDM.WindowsAgent.Storage;

namespace TitanMDM.WindowsAgent.Services;

public sealed class EnrollmentService
{
    private readonly HttpClient _httpClient;
    private readonly DeviceIdentityStore _identityStore;
    private readonly WindowsDeviceInfoProvider
        _deviceInfoProvider;

    public EnrollmentService(
        HttpClient httpClient,
        DeviceIdentityStore identityStore,
        WindowsDeviceInfoProvider deviceInfoProvider)
    {
        _httpClient = httpClient;
        _identityStore = identityStore;
        _deviceInfoProvider = deviceInfoProvider;
    }

    public async Task<DeviceIdentity> EnrollAsync(
        string enrollmentToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(
                enrollmentToken))
        {
            throw new ArgumentException(
                "El token de inscripción es obligatorio.",
                nameof(enrollmentToken));
        }

        var existingIdentity =
            await _identityStore.LoadAsync(
                cancellationToken);

        if (existingIdentity is not null)
        {
            throw new InvalidOperationException(
                "Este equipo ya posee una identidad TitanMDM.");
        }

        var device =
            _deviceInfoProvider
                .GetDeviceInformation();

        var request =
            new AgentEnrollmentRequest(
                enrollmentToken.Trim(),
                device.DeviceName,
                "Windows",
                device.SerialNumber,
                device.Manufacturer,
                device.Model,
                device.OperatingSystem,
                device.OperatingSystemVersion,
                device.AgentVersion);

        using var response =
            await _httpClient.PostAsJsonAsync(
                "/api/enrollment/register",
                request,
                cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var responseBody =
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken);

            throw new InvalidOperationException(
                $"TitanMDM rechazó la inscripción. " +
                $"HTTP {(int)response.StatusCode}. " +
                $"{responseBody}");
        }

        var enrollment =
            await response.Content
                .ReadFromJsonAsync<
                    AgentEnrollmentResponse>(
                    cancellationToken);

        if (enrollment is null)
        {
            throw new InvalidOperationException(
                "TitanMDM devolvió una respuesta de inscripción vacía.");
        }

        if (enrollment.DeviceId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "TitanMDM no devolvió un DeviceId válido.");
        }

        if (string.IsNullOrWhiteSpace(
                enrollment.DeviceSecret))
        {
            throw new InvalidOperationException(
                "TitanMDM no devolvió DeviceSecret.");
        }

        var identity =
            new DeviceIdentity(
                enrollment.DeviceId,
                enrollment.DeviceSecret);

        await _identityStore.SaveAsync(
            identity,
            cancellationToken);

        return identity;
    }
}