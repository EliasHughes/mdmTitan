param(
    [Parameter(Mandatory = $true)]
    [string]$ServerUrl,

    [Parameter(Mandatory = $true)]
    [string]$EnrollmentToken
)

$ErrorActionPreference = "Stop"

$ServiceName =
    "TitanMDMWindowsAgent"

$ServiceDisplayName =
    "TitanMDM Windows Agent"

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

$AgentExe =
    Join-Path `
        $AgentInstallPath `
        "TitanMDM.WindowsAgent.exe"

$PackageRoot =
    $PSScriptRoot

$PackageAgent =
    Join-Path `
        $PackageRoot `
        "Agent"

$PackageRemoteHost =
    Join-Path `
        $PackageRoot `
        "RemoteHost"

function Assert-Administrator {
    $identity =
        [Security.Principal.WindowsIdentity]::GetCurrent()

    $principal =
        New-Object `
            Security.Principal.WindowsPrincipal(
                $identity
            )

    $isAdmin =
        $principal.IsInRole(
            [Security.Principal.WindowsBuiltInRole]::Administrator
        )

    if (!$isAdmin) {
        throw "Ejecuta PowerShell como Administrador."
    }
}

function Normalize-ServerUrl {
    param(
        [string]$Value
    )

    $normalized =
        $Value.Trim().TrimEnd("/")

    $uri =
        $null

    if (
        ![Uri]::TryCreate(
            $normalized,
            [UriKind]::Absolute,
            [ref]$uri
        )
    ) {
        throw "ServerUrl no es válido: $Value"
    }

    if (
        $uri.Scheme -ne "http" `
        -and `
        $uri.Scheme -ne "https"
    ) {
        throw "ServerUrl debe utilizar HTTP o HTTPS."
    }

    return $normalized
}

Assert-Administrator

$ServerUrl =
    Normalize-ServerUrl `
        $ServerUrl

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " TitanMDM Windows Agent Installer" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Servidor: $ServerUrl"
Write-Host ""

if (!(Test-Path $PackageAgent)) {
    throw "No existe la carpeta Agent en el paquete."
}

if (!(Test-Path $PackageRemoteHost)) {
    throw "No existe la carpeta RemoteHost en el paquete."
}

Write-Host "[1/8] Validando TitanMDM Server..." -ForegroundColor Yellow

try {
    $health =
        Invoke-RestMethod `
            -Uri "$ServerUrl/api/health" `
            -Method Get `
            -TimeoutSec 10

    if ($health.status -ne "Healthy") {
        throw "TitanMDM API no reporta estado Healthy."
    }

    Write-Host "Servidor TitanMDM disponible." -ForegroundColor Green
}
catch {
    throw "No fue posible conectar con $ServerUrl/api/health. $($_.Exception.Message)"
}

Write-Host ""
Write-Host "[2/8] Deteniendo instalación anterior..." -ForegroundColor Yellow

$existingService =
    Get-Service `
        -Name $ServiceName `
        -ErrorAction SilentlyContinue

if ($existingService) {
    if ($existingService.Status -ne "Stopped") {
        Stop-Service `
            -Name $ServiceName `
            -Force

        $existingService.WaitForStatus(
            "Stopped",
            [TimeSpan]::FromSeconds(20)
        )
    }

    sc.exe delete $ServiceName |
        Out-Null

    Start-Sleep `
        -Seconds 2
}

Write-Host ""
Write-Host "[3/8] Creando directorios..." -ForegroundColor Yellow

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

New-Item `
    -ItemType Directory `
    -Path $ProgramDataRoot `
    -Force |
    Out-Null

Write-Host ""
Write-Host "[4/8] Instalando binarios..." -ForegroundColor Yellow

Copy-Item `
    (Join-Path $PackageAgent "*") `
    $AgentInstallPath `
    -Recurse `
    -Force

Copy-Item `
    (Join-Path $PackageRemoteHost "*") `
    $RemoteHostInstallPath `
    -Recurse `
    -Force

if (!(Test-Path $AgentExe)) {
    throw "TitanMDM.WindowsAgent.exe no fue instalado."
}

$RemoteHostExe =
    Join-Path `
        $RemoteHostInstallPath `
        "TitanMDM.RemoteHost.exe"

if (!(Test-Path $RemoteHostExe)) {
    throw "TitanMDM.RemoteHost.exe no fue instalado."
}

Write-Host ""
Write-Host "[5/8] Creando configuración..." -ForegroundColor Yellow

$settings =
    [ordered]@{
        serverUrl = $ServerUrl
        enrollmentToken = $EnrollmentToken
        heartbeatIntervalSeconds = 60
        commandPollingIntervalSeconds = 10
        requestTimeoutSeconds = 30
    }

$settings |
    ConvertTo-Json `
        -Depth 5 |
    Set-Content `
        -Path $SettingsPath `
        -Encoding UTF8

Write-Host "Configuración: $SettingsPath"

Write-Host ""
Write-Host "[6/8] Creando Windows Service..." -ForegroundColor Yellow

$quotedBinary =
    "`"$AgentExe`""

$result =
    sc.exe create `
        $ServiceName `
        binPath= $quotedBinary `
        start= auto `
        obj= LocalSystem `
        DisplayName= $ServiceDisplayName

if ($LASTEXITCODE -ne 0) {
    throw "No fue posible crear el servicio TitanMDM."
}

sc.exe description `
    $ServiceName `
    "TitanMDM Enterprise Windows Management Agent" |
    Out-Null

Write-Host ""
Write-Host "[7/8] Configurando recuperación..." -ForegroundColor Yellow

sc.exe failure `
    $ServiceName `
    reset= 86400 `
    actions= restart/5000/restart/15000/restart/30000 |
    Out-Null

sc.exe failureflag `
    $ServiceName `
    1 |
    Out-Null

Write-Host ""
Write-Host "[8/8] Iniciando servicio..." -ForegroundColor Yellow

Start-Service `
    -Name $ServiceName

$service =
    Get-Service `
        -Name $ServiceName

$service.WaitForStatus(
    "Running",
    [TimeSpan]::FromSeconds(20)
)

$service.Refresh()

if ($service.Status -ne "Running") {
    throw "TitanMDM Windows Agent no pudo iniciar."
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " TITANMDM INSTALADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

Write-Host ""
Write-Host "Servicio:" $ServiceName
Write-Host "Estado:" $service.Status
Write-Host "Servidor:" $ServerUrl
Write-Host "Agent:" $AgentExe
Write-Host "RemoteHost:" $RemoteHostExe
Write-Host "Configuración:" $SettingsPath

Write-Host ""
Write-Host "El agente comenzará ahora el enrolamiento."
Write-Host ""