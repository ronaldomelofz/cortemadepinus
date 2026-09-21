<#
.SYNOPSIS
    Instala o Tunel MadePinus 24/7 (cloudflared sob controle local).

.DESCRIPTION
    Sobe o binario open-source cloudflared como tarefa do Windows (boot + reinicio
    automatico). O token e o hostname ficam no SEU .env — a API continua no PC
    MadePinus; o tunel so publica HTTPS estavel para o Netlify.

    Pre-requisitos:
      1. Conta Cloudflare gratuita
      2. Zero Trust -> Networks -> Tunnels -> Create -> copie o token
      3. No painel do tunel, Public Hostname apontando para http://127.0.0.1:4000
      4. No .env da raiz: TUNNEL_TOKEN=... e API_PUBLIC_URL=https://seu-host

.PARAMETER IntegrarNetlify
    Apos instalar, atualiza VITE_API_URL e faz deploy (precisa API_PUBLIC_URL).

.EXAMPLE
    .\scripts\instalar-tunel-madepinus.ps1
.EXAMPLE
    .\scripts\instalar-tunel-madepinus.ps1 -IntegrarNetlify
#>

[CmdletBinding()]
param(
    [string]$NomeTarefa = 'MadePinus-Tunel',
    [switch]$IntegrarNetlify
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Ler-Env([string]$caminho) {
    $mapa = @{}
    if (-not (Test-Path $caminho)) { return $mapa }
    Get-Content $caminho | ForEach-Object {
        $linha = $_.Trim()
        if ($linha -eq '' -or $linha.StartsWith('#')) { return }
        $i = $linha.IndexOf('=')
        if ($i -lt 1) { return }
        $chave = $linha.Substring(0, $i).Trim()
        $valor = $linha.Substring($i + 1).Trim().Trim('"').Trim("'")
        $mapa[$chave] = $valor
    }
    return $mapa
}

$envRaiz = Ler-Env (Join-Path $raiz '.env')
$envApi = Ler-Env (Join-Path $raiz 'apps\api\.env')
$token = $env:TUNNEL_TOKEN
if (-not $token) { $token = $envRaiz['TUNNEL_TOKEN'] }
if (-not $token) { $token = $envApi['TUNNEL_TOKEN'] }

$urlPublica = $env:API_PUBLIC_URL
if (-not $urlPublica) { $urlPublica = $envRaiz['API_PUBLIC_URL'] }
if (-not $urlPublica) { $urlPublica = $envApi['API_PUBLIC_URL'] }
if ($urlPublica) { $urlPublica = $urlPublica.Trim().TrimEnd('/') }

if (-not $token -or $token.Length -lt 20) {
    throw @"
TUNNEL_TOKEN nao encontrado.

1) Abra https://one.dash.cloudflare.com/ -> Zero Trust -> Networks -> Tunnels
2) Create a tunnel (Cloudflared) e copie o token
3) No painel do tunel, adicione Public Hostname -> http://127.0.0.1:4000
4) Grave no arquivo .env na raiz do projeto:

TUNNEL_TOKEN=eyJ...seu-token...
API_PUBLIC_URL=https://api.seudominio.com.br

Depois rode de novo: .\scripts\instalar-tunel-madepinus.ps1
"@
}

Write-Host '==> Conferindo API local em http://127.0.0.1:4000/saude ...' -ForegroundColor Cyan
try {
    $saude = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/saude' -TimeoutSec 5
    if (-not $saude.ok) { throw 'API sem ok=true' }
} catch {
    throw "API local offline. Instale/suba a API antes (.\scripts\instalar-servico-windows.ps1). Detalhe: $($_.Exception.Message)"
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host '==> Instalando cloudflared (open source, gratuito)...' -ForegroundColor Cyan
    winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $cloudflared = Get-Command cloudflared -ErrorAction Stop
}

$pastaDados = Join-Path $raiz 'apps\api\dados'
New-Item -ItemType Directory -Force -Path $pastaDados | Out-Null
$tokenFile = Join-Path $pastaDados 'tunel.token'
# Arquivo local (nao versionar) — so o servico Windows le
Set-Content -Path $tokenFile -Value $token -Encoding ascii -NoNewline

$log = Join-Path $pastaDados 'tunel.log'
$wrapper = Join-Path $raiz 'scripts\manter-tunel-no-ar.ps1'
$bin = $cloudflared.Source

@"
`$ErrorActionPreference = 'Continue'
`$tokenFile = '$tokenFile'
`$log = '$log'
`$bin = '$bin'
while (`$true) {
    if (-not (Test-Path `$tokenFile)) {
        Add-Content -Path `$log -Value ("[`$(Get-Date -Format o)] token ausente em `$tokenFile")
        Start-Sleep -Seconds 15
        continue
    }
    `$token = (Get-Content `$tokenFile -Raw).Trim()
    Add-Content -Path `$log -Value ("[`$(Get-Date -Format o)] iniciando Tunel MadePinus")
    & `$bin tunnel --no-autoupdate run --token `$token *>> `$log
    Add-Content -Path `$log -Value ("[`$(Get-Date -Format o)] tunel encerrou (codigo `$LASTEXITCODE). Relancando em 5s.")
    Start-Sleep -Seconds 5
}
"@ | Set-Content -Path $wrapper -Encoding UTF8

# Para tarefa antiga se existir e reinstala
Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false -ErrorAction SilentlyContinue

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wrapper`""
$gatilho = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$ajustes = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit 0 `
    -StartWhenAvailable

Register-ScheduledTask -TaskName $NomeTarefa -Action $acao -Trigger $gatilho -Principal $principal -Settings $ajustes -Force | Out-Null
Start-ScheduledTask -TaskName $NomeTarefa

$estado = @{
    tarefa = $NomeTarefa
    cloudflared = $bin
    tokenFile = $tokenFile
    log = $log
    apiPublicUrl = $urlPublica
    instaladoEm = (Get-Date).ToString('o')
}
$estado | ConvertTo-Json | Set-Content -Path (Join-Path $pastaDados 'tunel-madepinus.json') -Encoding UTF8

Write-Host ''
Write-Host "Tunel MadePinus instalado (tarefa '$NomeTarefa')." -ForegroundColor Green
Write-Host "  Sobe no boot do Windows e reinicia sozinho se cair."
Write-Host "  Log: $log"
Write-Host ''
if ($urlPublica) {
    Write-Host "  API_PUBLIC_URL: $urlPublica"
    Write-Host "  Teste (aguarde ~10s): Invoke-RestMethod $urlPublica/saude"
} else {
    Write-Host '  Defina API_PUBLIC_URL no .env com o hostname do painel Cloudflare.'
}

if ($IntegrarNetlify) {
    if (-not $urlPublica) {
        throw 'Para -IntegrarNetlify, defina API_PUBLIC_URL no .env (hostname HTTPS fixo do tunel).'
    }
    Start-Sleep -Seconds 8
    & (Join-Path $PSScriptRoot 'integrar-api-netlify.ps1') -ApiUrl $urlPublica
}

Write-Host ''
Write-Host 'Status:  .\scripts\status-tunel-madepinus.ps1'
Write-Host "Parar:   Stop-ScheduledTask -TaskName '$NomeTarefa'"
Write-Host "Remover: Unregister-ScheduledTask -TaskName '$NomeTarefa' -Confirm:`$false"
