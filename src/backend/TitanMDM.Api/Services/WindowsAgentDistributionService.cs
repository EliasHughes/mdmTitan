using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace TitanMDM.Api.Services;

public sealed class WindowsAgentDistributionService
    : IWindowsAgentDistributionService
{
    private readonly WindowsAgentDistributionOptions
        _options;

    private readonly IWebHostEnvironment
        _environment;

    public WindowsAgentDistributionService(
        IOptions<WindowsAgentDistributionOptions>
            options,
        IWebHostEnvironment environment)
    {
        _options =
            options.Value;

        _environment =
            environment;
    }

    public string GetPackagePath()
    {
        var configuredPath =
            _options.PackagePath;

        if (
            string.IsNullOrWhiteSpace(
                configuredPath)
        )
        {
            throw new InvalidOperationException(
                "WindowsAgentDistribution:PackagePath no está configurado.");
        }

        string path;

        if (
            Path.IsPathRooted(
                configuredPath)
        )
        {
            path =
                configuredPath;
        }
        else
        {
            path =
                Path.GetFullPath(
                    Path.Combine(
                        _environment.ContentRootPath,
                        configuredPath));
        }

        if (
            !File.Exists(
                path)
        )
        {
            throw new FileNotFoundException(
                "No se encontró el paquete Windows Agent. Ejecuta Build-TitanMDMAgentPackage.ps1 primero.",
                path);
        }

        return path;
    }

    public string GetPackageFileName()
    {
        return string.IsNullOrWhiteSpace(
            _options.PackageFileName)
            ? "TitanMDM-WindowsAgent-x64.zip"
            : _options.PackageFileName.Trim();
    }

    public async Task<string>
        GetPackageSha256Async(
            CancellationToken cancellationToken =
                default)
    {
        var path =
            GetPackagePath();

        await using var stream =
            File.OpenRead(
                path);

        var hash =
            await SHA256.HashDataAsync(
                stream,
                cancellationToken);

        return Convert
            .ToHexString(
                hash);
    }

    public async Task<string>
        BuildBootstrapScriptAsync(
            string enrollmentToken,
            string deploymentMode,
            CancellationToken cancellationToken =
                default)
    {
        if (
            string.IsNullOrWhiteSpace(
                enrollmentToken)
        )
        {
            throw new ArgumentException(
                "EnrollmentToken es obligatorio.",
                nameof(enrollmentToken));
        }

        deploymentMode =
            deploymentMode
                .Trim()
                .ToLowerInvariant();

        if (
            deploymentMode !=
                "individual"
            &&
            deploymentMode !=
                "gpo"
        )
        {
            throw new ArgumentException(
                "DeploymentMode debe ser individual o gpo.",
                nameof(deploymentMode));
        }

        var serverUrl =
            NormalizeServerUrl(
                _options.PublicServerUrl);

        var packageHash =
            await GetPackageSha256Async(
                cancellationToken);

        var escapedServer =
            EscapePowerShell(
                serverUrl);

        var escapedToken =
            EscapePowerShell(
                enrollmentToken);

        var escapedHash =
            EscapePowerShell(
                packageHash);

        var isGpo =
            deploymentMode ==
            "gpo";

        return $$"""
$ErrorActionPreference = "Stop"

$ServerUrl = '{{escapedServer}}'
$EnrollmentToken = '{{escapedToken}}'
$ExpectedPackageSha256 = '{{escapedHash}}'

$ServiceName = "TitanMDMWindowsAgent"

$InstallRoot =
    Join-Path $env:ProgramFiles "TitanMDM"

$AgentInstallPath =
    Join-Path $InstallRoot "Agent"

$RemoteHostInstallPath =
    Join-Path $InstallRoot "RemoteHost"

$ProgramDataRoot =
    Join-Path $env:ProgramData "TitanMDM"

$SettingsPath =
    Join-Path $ProgramDataRoot "agentsettings.json"

$IdentityPath =
    Join-Path $ProgramDataRoot "device.json"

$LogDirectory =
    Join-Path $ProgramDataRoot "logs"

$LogPath =
    Join-Path $LogDirectory "installer.log"

$TempRoot =
    Join-Path $ProgramDataRoot "Temp"

$ZipPath =
    Join-Path $TempRoot "TitanMDM-WindowsAgent-x64.zip"

$ExtractPath =
    Join-Path $TempRoot "Package"

$PackageUrl =
    "$ServerUrl/api/enrollment/windows/package"

$GpoMode =
    ${{isGpo.ToString().ToLowerInvariant()}}

function Write-TitanLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    New-Item `
        -ItemType Directory `
        -Path $LogDirectory `
        -Force |
        Out-Null

    $timestamp =
        Get-Date `
            -Format "yyyy-MM-dd HH:mm:ss"

    $line =
        "[$timestamp][$Level] $Message"

    Write-Host $line

    Add-Content `
        -Path $LogPath `
        -Value $line `
        -Encoding UTF8
}

function Assert-Administrator {
    $identity =
        [Security.Principal.WindowsIdentity]::GetCurrent()

    $principal =
        New-Object `
            Security.Principal.WindowsPrincipal(
                $identity
            )

    if (
        !$principal.IsInRole(
            [Security.Principal.WindowsBuiltInRole]::Administrator
        )
    ) {
        throw "TitanMDM debe instalarse con privilegios de administrador."
    }
}

function Test-TitanServer {
    Write-TitanLog `
        "Comprobando conexión con $ServerUrl."

    $health =
        Invoke-RestMethod `
            -Uri "$ServerUrl/api/health" `
            -Method Get `
            -TimeoutSec 15

    if (
        $health.status -ne
        "Healthy"
    ) {
        throw "TitanMDM API no reporta estado Healthy."
    }

    Write-TitanLog `
        "TitanMDM API disponible."
}

function Test-ExistingInstallation {
    $service =
        Get-Service `
            -Name $ServiceName `
            -ErrorAction SilentlyContinue

    $agentExe =
        Join-Path `
            $AgentInstallPath `
            "TitanMDM.WindowsAgent.exe"

    if (
        $service -and
        (Test-Path $agentExe) -and
        (Test-Path $IdentityPath)
    )
    
     {
        return $true
    }

    return $false
}

function Stop-ExistingInstallation {
    $service =
        Get-Service `
            -Name $ServiceName `
            -ErrorAction SilentlyContinue

    if (!$service) {
        return
    }

    Write-TitanLog `
        "Instalación previa detectada."

    if (
        $service.Status -ne
        "Stopped"
    ) {
        Stop-Service `
            -Name $ServiceName `
            -Force `
            -ErrorAction SilentlyContinue

        Start-Sleep `
            -Seconds 2
    }

    sc.exe delete `
        $ServiceName |
        Out-Null

    Start-Sleep `
        -Seconds 2
}

function Download-Package {
    New-Item `
        -ItemType Directory `
        -Path $TempRoot `
        -Force |
        Out-Null

    if (
        Test-Path $ZipPath
    ) {
        Remove-Item `
            $ZipPath `
            -Force
    }

    Write-TitanLog `
        "Descargando Windows Agent desde $PackageUrl."

    Invoke-WebRequest `
        -Uri $PackageUrl `
        -OutFile $ZipPath `
        -UseBasicParsing `
        -TimeoutSec 180

    if (
        !(Test-Path $ZipPath)
    ) {
        throw "No fue posible descargar TitanMDM Windows Agent."
    }

    $actualHash =
        (
            Get-FileHash `
                -Path $ZipPath `
                -Algorithm SHA256
        ).Hash

    if (
        $actualHash -ne
        $ExpectedPackageSha256
    ) {
        throw "El SHA-256 del paquete descargado no coincide con el paquete publicado por TitanMDM."
    }

    Write-TitanLog `
        "Paquete validado. SHA256=$actualHash"
}

function Expand-Package {
    if (
        Test-Path $ExtractPath
    ) {
        Remove-Item `
            $ExtractPath `
            -Recurse `
            -Force
    }

    Expand-Archive `
        -Path $ZipPath `
        -DestinationPath $ExtractPath `
        -Force

    $agentSource =
        Join-Path $ExtractPath "Agent"

    $remoteSource =
        Join-Path $ExtractPath "RemoteHost"

    if (
        !(Test-Path $agentSource)
    ) {
        throw "El paquete no contiene Agent."
    }

    if (
        !(Test-Path $remoteSource)
    ) {
        throw "El paquete no contiene RemoteHost."
    }
}

function Install-Binaries {
    $agentSource =
        Join-Path $ExtractPath "Agent"

    $remoteSource =
        Join-Path $ExtractPath "RemoteHost"

    New-Item `
        -ItemType Directory `
        -Path $AgentInstallPath `
        -Force |
        Out-Null

    New-Item `
        -ItemType Directory `
        -Path $RemoteHostInstallPath `
        -Force |
        Out-Null

    Copy-Item `
        (Join-Path $agentSource "*") `
        $AgentInstallPath `
        -Recurse `
        -Force

    Copy-Item `
        (Join-Path $remoteSource "*") `
        $RemoteHostInstallPath `
        -Recurse `
        -Force

    $agentExe =
        Join-Path `
            $AgentInstallPath `
            "TitanMDM.WindowsAgent.exe"

    $remoteExe =
        Join-Path `
            $RemoteHostInstallPath `
            "TitanMDM.RemoteHost.exe"

    if (
        !(Test-Path $agentExe)
    ) {
        throw "TitanMDM.WindowsAgent.exe no fue instalado."
    }

    if (
        !(Test-Path $remoteExe)
    ) {
        throw "TitanMDM.RemoteHost.exe no fue instalado."
    }

    Write-TitanLog `
        "Binarios instalados."
}

function Write-AgentSettings {
    New-Item `
        -ItemType Directory `
        -Path $ProgramDataRoot `
        -Force |
        Out-Null

    $settings =
        [ordered]@{
            serverUrl =
                $ServerUrl

            enrollmentToken =
                $EnrollmentToken

            heartbeatIntervalSeconds =
                60

            commandPollingIntervalSeconds =
                10

            requestTimeoutSeconds =
                30
        }

    $settings |
        ConvertTo-Json `
            -Depth 4 |
        Set-Content `
            -Path $SettingsPath `
            -Encoding UTF8

    Write-TitanLog `
        "Configuración creada en $SettingsPath."
}

function Install-WindowsService {
    $agentExe =
        Join-Path `
            $AgentInstallPath `
            "TitanMDM.WindowsAgent.exe"

    $quotedBinary =
        "`"$agentExe`""

    sc.exe create `
        $ServiceName `
        binPath= $quotedBinary `
        start= auto `
        obj= LocalSystem `
        DisplayName= "TitanMDM Windows Agent" |
        Out-Null

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "No fue posible crear TitanMDMWindowsAgent."
    }

    sc.exe description `
        $ServiceName `
        "TitanMDM Enterprise Windows Management Agent" |
        Out-Null

    sc.exe failure `
        $ServiceName `
        reset= 86400 `
        actions= restart/5000/restart/15000/restart/30000 |
        Out-Null

    sc.exe failureflag `
        $ServiceName `
        1 |
        Out-Null

    Write-TitanLog `
        "Servicio Windows creado."
}

function Start-TitanAgent {
    Start-Service `
        -Name $ServiceName

    $service =
        Get-Service `
            -Name $ServiceName

    $service.WaitForStatus(
        "Running",
        [TimeSpan]::FromSeconds(30)
    )

    $service.Refresh()

    if (
        $service.Status -ne
        "Running"
    ) {
        throw "TitanMDM Windows Agent no pudo iniciar."
    }

    Write-TitanLog `
        "Servicio TitanMDMWindowsAgent ejecutándose."
}

function Wait-Enrollment {
    Write-TitanLog `
        "Esperando inscripción del dispositivo."

    $deadline =
        (Get-Date).AddSeconds(90)

    while (
        (Get-Date) -lt
        $deadline
    ) {
        if (
            Test-Path $IdentityPath
        ) {
            Write-TitanLog `
                "Identidad TitanMDM creada correctamente."

            return
        }

        Start-Sleep `
            -Seconds 3
    }

    Write-TitanLog `
        "El servicio está instalado, pero la identidad todavía no apareció. Revisa logs del agente." `
        "WARN"
}

function Cleanup {
    try {
        if (
            Test-Path $TempRoot
        ) {
            Remove-Item `
                $TempRoot `
                -Recurse `
                -Force
        }
    }
    catch {
        Write-TitanLog `
            "No fue posible limpiar temporales." `
            "WARN"
    }
}

try {
    Assert-Administrator

    Write-TitanLog `
        "Inicio de instalación TitanMDM."

    Write-TitanLog `
        "Servidor: $ServerUrl"

    if (
        $GpoMode -and
        (Test-ExistingInstallation)
    ) {
        Write-TitanLog `
            "TitanMDM ya está instalado y enrolado. GPO no realizará cambios."

        exit 0
    }

    Test-TitanServer

    Stop-ExistingInstallation

    Download-Package

    Expand-Package

    Install-Binaries

    Write-AgentSettings

    Install-WindowsService

    Start-TitanAgent

    Wait-Enrollment

    Cleanup

    Write-TitanLog `
        "Instalación TitanMDM completada."

    Write-Host ""
    Write-Host "TitanMDM instalado correctamente." -ForegroundColor Green
    Write-Host "Servidor: $ServerUrl"
    Write-Host "Servicio: $ServiceName"
    Write-Host ""

    exit 0
}
catch {
    try {
        Write-TitanLog `
            $_.Exception.Message `
            "ERROR"
    }
    catch {
        Write-Host $_.Exception.Message
    }

    exit 1
}
""";
    }

    private static string NormalizeServerUrl(
        string serverUrl)
    {
        if (
            string.IsNullOrWhiteSpace(
                serverUrl)
        )
        {
            throw new InvalidOperationException(
                "WindowsAgentDistribution:PublicServerUrl no está configurado.");
        }

        serverUrl =
            serverUrl
                .Trim()
                .TrimEnd('/');

        if (
            !Uri.TryCreate(
                serverUrl,
                UriKind.Absolute,
                out var uri)
        )
        {
            throw new InvalidOperationException(
                "PublicServerUrl no es una URL válida.");
        }

        if (
            uri.Scheme !=
                Uri.UriSchemeHttp
            &&
            uri.Scheme !=
                Uri.UriSchemeHttps)
        {
            throw new InvalidOperationException(
                "PublicServerUrl debe utilizar HTTP o HTTPS.");
        }

        return serverUrl;
    }

    private static string EscapePowerShell(
        string value)
    {
        return value.Replace(
            "'",
            "''",
            StringComparison.Ordinal);
    }
}