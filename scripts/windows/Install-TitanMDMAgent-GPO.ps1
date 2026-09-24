param(
    [string]$ConfigPath = "",
    [switch]$ForceReinstall
)

$ErrorActionPreference = "Stop"

$ProgramDataRoot =
    Join-Path `
        $env:ProgramData `
        "TitanMDM"

$LogDirectory =
    Join-Path `
        $ProgramDataRoot `
        "logs"

$LogPath =
    Join-Path `
        $LogDirectory `
        "gpo-bootstrap.log"

function Write-GpoLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    try {
        if (!(Test-Path $LogDirectory)) {
            New-Item `
                -ItemType Directory `
                -Path $LogDirectory `
                -Force |
            Out-Null
        }

        $timestamp =
            Get-Date `
                -Format "yyyy-MM-dd HH:mm:ss"

        Add-Content `
            -Path $LogPath `
            -Value "[$timestamp][$Level] $Message" `
            -Encoding UTF8
    }
    catch {
    }
}

try {
    Write-GpoLog "Inicio de bootstrap GPO TitanMDM."

    $currentIdentity =
        [Security.Principal.WindowsIdentity]::GetCurrent()

    Write-GpoLog `
        "Contexto=$($currentIdentity.Name)"

    if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
        $ConfigPath =
            Join-Path `
                $PSScriptRoot `
                "config.json"
    }

    if (!(Test-Path $ConfigPath)) {
        throw "No existe config.json: $ConfigPath"
    }

    $mainInstaller =
        Join-Path `
            $PSScriptRoot `
            "Install-TitanMDMAgent.ps1"

    if (!(Test-Path $mainInstaller)) {
        throw "No existe Install-TitanMDMAgent.ps1."
    }

    $arguments =
        @(
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "`"$mainInstaller`"",
            "-ConfigPath",
            "`"$ConfigPath`"",
            "-Silent"
        )

    if ($ForceReinstall) {
        $arguments +=
            "-ForceReinstall"
    }

    Write-GpoLog `
        "Ejecutando instalador principal TitanMDM."

    $process =
        Start-Process `
            -FilePath "powershell.exe" `
            -ArgumentList $arguments `
            -WindowStyle Hidden `
            -Wait `
            -PassThru

    Write-GpoLog `
        "Install-TitanMDMAgent.ps1 terminó con código $($process.ExitCode)."

    if ($process.ExitCode -ne 0) {
        throw "Instalador TitanMDM devolvió código $($process.ExitCode)."
    }

    $service =
        Get-Service `
            -Name "TitanMDMWindowsAgent" `
            -ErrorAction SilentlyContinue

    if ($null -eq $service) {
        throw "El servicio TitanMDMWindowsAgent no existe después de la instalación."
    }

    $service.Refresh()

    if ($service.Status -ne "Running") {
        Write-GpoLog `
            "Servicio encontrado pero estado=$($service.Status)." `
            "WARN"
    }
    else {
        Write-GpoLog `
            "TitanMDMWindowsAgent está Running."
    }

    $identityPath =
        Join-Path `
            $ProgramDataRoot `
            "device.json"

    if (Test-Path $identityPath) {
        Write-GpoLog `
            "Dispositivo enrolado correctamente."
    }
    else {
        Write-GpoLog `
            "device.json todavía no existe. El enrolamiento podría continuar en segundo plano." `
            "WARN"
    }

    Write-GpoLog `
        "Bootstrap GPO TitanMDM finalizado."

    exit 0
}
catch {
    Write-GpoLog `
        $_.Exception.Message `
        "ERROR"

    exit 1
}