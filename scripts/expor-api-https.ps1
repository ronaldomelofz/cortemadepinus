<#
.SYNOPSIS
    Expoe a API local (porta 4000) em HTTPS via Cloudflare Tunnel.

.PARAMETER Porta
    Porta local da API (padrao 4000).

.PARAMETER IntegrarNetlify
    Se informado, apos obter a URL roda integrar-api-netlify.ps1.

.EXAMPLE
    .\scripts\expor-api-https.ps1 -IntegrarNetlify
#>

[CmdletBinding()]
param(
    [int]$Porta = 4000,
    [switch]$IntegrarNetlify
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

Write-Host "==> Conferindo API em http://127.0.0.1:$Porta/saude ..." -ForegroundColor Cyan
try {
    $saude = Invoke-RestMethod -Uri "http://127.0.0.1:$Porta/saude" -TimeoutSec 5
    if (-not $saude.ok) { throw 'API respondeu sem ok=true' }
} catch {
    throw "API local offline. Suba com npm start --workspace @cortemadepinus/api. Detalhe: $($_.Exception.Message)"
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host '==> Instalando Cloudflare.cloudflared via winget...' -ForegroundColor Cyan
    winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $cloudflared = Get-Command cloudflared -ErrorAction Stop
}

$logOut = Join-Path $env:TEMP "madepinus-cloudflared-$(Get-Date -Format 'yyyyMMdd-HHmmss').out.log"
$logErr = Join-Path $env:TEMP "madepinus-cloudflared-$(Get-Date -Format 'yyyyMMdd-HHmmss').err.log"
Write-Host "==> Iniciando tunel HTTPS -> http://127.0.0.1:$Porta" -ForegroundColor Cyan
Write-Host "    Log: $logErr"

$proc = Start-Process -FilePath $cloudflared.Source `
    -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$Porta", '--no-autoupdate') `
    -RedirectStandardError $logErr `
    -RedirectStandardOutput $logOut `
    -PassThru `
    -WindowStyle Hidden

$url = $null
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    foreach ($log in @($logErr, $logOut)) {
        if (-not (Test-Path $log)) { continue }
        $texto = Get-Content $log -Raw -ErrorAction SilentlyContinue
        if ($texto -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
            $url = $Matches[0]
            break
        }
    }
    if ($url) { break }
    if ($proc.HasExited) {
        throw "cloudflared encerrou cedo. Veja o log: $logErr"
    }
}

if (-not $url) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    throw "Nao foi possivel obter a URL do tunel. Veja: $logErr"
}

Write-Host ''
Write-Host "Tunel ativo (PID $($proc.Id))" -ForegroundColor Green
Write-Host "  URL publica: $url"
Write-Host "  Teste:       $url/saude"
Write-Host ''
Write-Host 'Mantenha este processo (ou o PC) ligado enquanto o Netlify usar esta URL.'
Write-Host "Para parar: Stop-Process -Id $($proc.Id)"
Write-Host ''

$estado = Join-Path $raiz 'apps\api\dados\tunel-https.json'
New-Item -ItemType Directory -Force -Path (Split-Path $estado) | Out-Null
@{ pid = $proc.Id; url = $url; iniciadoEm = (Get-Date).ToString('o'); log = $logErr } |
    ConvertTo-Json | Set-Content -Path $estado -Encoding UTF8

if ($IntegrarNetlify) {
    & (Join-Path $PSScriptRoot 'integrar-api-netlify.ps1') -ApiUrl $url
} else {
    Write-Host 'Proximo passo - integrar o Netlify:'
    Write-Host "  .\scripts\integrar-api-netlify.ps1 -ApiUrl '$url'"
}
