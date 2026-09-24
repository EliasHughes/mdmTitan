param(
    [Parameter(Mandatory = $true)]
    [string]$ServerUrl,

    [Parameter(Mandatory = $true)]
    [string]$EnrollmentToken,

    [string]$PackageUrl = "",

    [string]$ServiceName = "TitanMDMWindowsAgent",

    [switch]$ForceReinstall
)

$ErrorActionPreference = "Stop"

$InstallRoot =
    Join-Path `
        $env:ProgramFiles `
        "TitanMDM"

$AgentInstallPath =
    Join-Path `
        $InstallRoot `
        "Agent"

$RemoteHostInstallPath =
    Join-Path `
        $InstallRoot `
        "RemoteHost"

$ProgramDataRoot =
    Join-Path `
        $env:ProgramData `
        "TitanMDM"

$SettingsPath =
    Join-Path `
        $ProgramDataRoot `
        "agentsettings.json"

$LogDirectory =
    Join-Path `
        $ProgramDataRoot `
        "logs"

$LogPath =
    Join-Path `
        $LogDirectory `
        "gpo-install.log"

$TempRoot =
    Join-Path `
        $env:ProgramData `
        "TitanMDM\Temp"

$DownloadPath =
    Join-Path `
        $TempRoot `
        "TitanMDM-WindowsAgent.zip"

$ExtractPath =
    Join-Path `
        $TempRoot `
        "Package"

function Write-InstallerLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    $timestamp =
        Get-Date `
            -Format "yyyy-MM-dd HH:mm:ss"

    $line =
        "[$timestamp][$Level] $Message"

    Write-Output $line

    try {
        Add-Content `
            -Path $LogPath `
            -Value $line `
            -Encoding UTF8
    }
    catch {
        # Logging must never stop installation.
    }
}

function Normalize-ServerUrl {
    param(
        [string]$Value
    )

    $normalized =
        $Value
            .Trim()
            .TrimEnd("/")

    $uri =
        $null

    if (
        ![Uri]::TryCreate(
            $normalized,
            [UriKind]::Absolute,
            [ref]$uri
        )
    ) {
        throw "ServerUrl inválido: $Value"
    }

    if (
        $uri.Scheme -ne "http" `
        -and `
        $uri.Scheme -ne "https"
    ) {
        throw "ServerUrl debe usar HTTP o HTTPS."
    }

    return $normalized
}

function Test-TitanServer {
    param(
        [string]$BaseUrl
    )

    $healthUrl =
        "$BaseUrl/api/health"

    Write-InstallerLog `
        "Verificando TitanMDM API: $healthUrl"

    try {
        $health =
            Invoke-RestMethod `
                -Uri $healthUrl `
                -Method Get `
                -TimeoutSec 20

        if (
            $health.status -ne
            "Healthy"
        ) {
            throw "El servidor respondió pero no está Healthy."
        }

        Write-InstallerLog `
            "TitanMDM API disponible."

        return $true
    }
    catch {
        Write-InstallerLog `
            "TitanMDM API no disponible: $($_.Exception.Message)" `
            "ERROR"

        return $false
    }
}

function Test-AgentInstalled {
    $service =
        Get-Service `
            -Name $ServiceName `
            -ErrorAction SilentlyContinue

    $agentExe =
        Join-Path `
            $AgentInstallPath `
            "TitanMDM.WindowsAgent.exe"

    return (
        $service -ne $null `
        -and `
        (Test-Path $agentExe)
    )
}

function Stop-AndRemoveExistingAgent {
    $service =
        Get-Service `
            -Name $ServiceName `
            -ErrorAction SilentlyContinue

    if ($service) {
        Write-InstallerLog `
            "Instalación anterior detectada."

        if (
            $service.Status -ne
            "Stopped"
        ) {
            try {
                Stop-Service `
                    -Name $ServiceName `
                    -Force `
                    -ErrorAction Stop
            }
            catch {
                Write-InstallerLog `
                    "No fue posible detener el servicio: $($_.Exception.Message)" `
                    "WARN"
            }

            Start-Sleep `
                -Seconds 2
        }

        sc.exe delete `
            $ServiceName |
            Out-Null

        Start-Sleep `
            -Seconds 2
    }
}

function Download-Package {
    param(
        [string]$Url
    )

    if (
        Test-Path $TempRoot
    ) {
        Remove-Item `
            $TempRoot `
            -Recurse `
            -Force
    }

    New-Item `
        -ItemType Directory `
        -Path $TempRoot `
        -Force |
        Out-Null

    Write-InstallerLog `
        "Descargando paquete: $Url"

    Invoke-WebRequest `
        -Uri $Url `
        -OutFile $DownloadPath `
        -UseBasicParsing `
        -TimeoutSec 120

    if (
        !(Test-Path $DownloadPath)
    ) {
        throw "No se descargó el paquete TitanMDM."
    }

    Write-InstallerLog `
        "Paquete descargado correctamente."
}

function Expand-Package {
    Write-InstallerLog `
        "Extrayendo paquete."

    if (
        Test-Path $ExtractPath
    ) {
        Remove-Item `
            $ExtractPath `
            -Recurse `
            -Force
    }

    Expand-Archive `
        -Path $DownloadPath `
        -DestinationPath $ExtractPath `
        -Force

    $agentSource =
        Join-Path `
            $ExtractPath `
            "Agent"

    $remoteHostSource =
        Join-Path `
            $ExtractPath `
            "RemoteHost"

    if (
        !(Test-Path $agentSource)
    ) {
        throw "El ZIP no contiene la carpeta Agent."
    }

    if (
        !(Test-Path $remoteHostSource)
    ) {
        throw "El ZIP no contiene la carpeta RemoteHost."
    }
}

function Install-Binaries {
    $agentSource =
        Join-Path `
            $ExtractPath `
            "Agent"

    $remoteHostSource =
        Join-Path `
            $ExtractPath `
            "RemoteHost"

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

    Write-InstallerLog `
        "Copiando Windows Agent."

    Copy-Item `
        (Join-Path $agentSource "*") `
        $AgentInstallPath `
        -Recurse `
        -Force

    Write-InstallerLog `
        "Copiando RemoteHost."

    Copy-Item `
        (Join-Path $remoteHostSource "*") `
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
        throw "TitanMDM.WindowsAgent.exe no existe después de la copia."
    }

    if (
        !(Test-Path $remoteExe)
    ) {
        throw "TitanMDM.RemoteHost.exe no existe después de la copia."
    }
}

function Write-AgentConfiguration {
    New-Item `
        -ItemType Directory `
        -Path $ProgramDataRoot `
        -Force |
        Out-Null

    New-Item `
        -ItemType Directory `
        -Path $LogDirectory `
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
            -Depth 5 |
        Set-Content `
            -Path $SettingsPath `
            -Encoding UTF8

    Write-InstallerLog `
        "Configuración escrita en $SettingsPath"
}

function Install-AgentService {
    $agentExe =
        Join-Path `
            $AgentInstallPath `
            "TitanMDM.WindowsAgent.exe"

    $quotedBinary =
        "`"$agentExe`""

    Write-InstallerLog `
        "Creando Windows Service."

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
        throw "sc.exe create devolvió código $LASTEXITCODE"
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
}

function Start-AgentService {
    Write-InstallerLog `
        "Iniciando TitanMDM Windows Agent."

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
        throw "El servicio TitanMDM no quedó Running."
    }

    Write-InstallerLog `
        "TitanMDM Windows Agent está Running."
}

function Cleanup-TemporaryFiles {
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
        Write-InstallerLog `
            "No fue posible limpiar temporales: $($_.Exception.Message)" `
            "WARN"
    }
}

try {
    New-Item `
        -ItemType Directory `
        -Path $LogDirectory `
        -Force |
        Out-Null

    $ServerUrl =
        Normalize-ServerUrl `
            $ServerUrl

    Write-InstallerLog `
        "Inicio instalación GPO TitanMDM."

    Write-InstallerLog `
        "Servidor=$ServerUrl"

    if (
        -not (
            Test-TitanServer `
                $ServerUrl
        )
    ) {
        exit 20
    }

    if (
        [string]::IsNullOrWhiteSpace(
            $PackageUrl
        )
    ) {
        $PackageUrl =
            "$ServerUrl/api/enrollment/windows/package"
    }

    if (
        Test-AgentInstalled
        -and
        !$ForceReinstall
    ) {
        Write-InstallerLog `
            "TitanMDM ya está instalado. No se realizará reinstalación."

        exit 0
    }

    Stop-AndRemoveExistingAgent

    Download-Package `
        $PackageUrl

    Expand-Package

    Install-Binaries

    Write-AgentConfiguration

    Install-AgentService

    Start-AgentService

    Cleanup-TemporaryFiles

    Write-InstallerLog `
        "Instalación GPO TitanMDM completada correctamente."

    exit 0
}
catch {
    Write-InstallerLog `
        $_.Exception.Message `
        "ERROR"

    exit 1
}