<#
.SYNOPSIS
    Liga o site Netlify (cortemadepinus) a API HTTPS do servidor MadePinus.

.PARAMETER ApiUrl
    URL publica HTTPS da API, sem barra no fim.

.EXAMPLE
    .\scripts\integrar-api-netlify.ps1 -ApiUrl 'https://api.madepinus.com.br'
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

$ApiUrl = $ApiUrl.Trim().TrimEnd('/')
if ($ApiUrl -notmatch '^https://') {
    throw "Use uma URL HTTPS publica. Recebido: $ApiUrl"
}

$siteId = '41aaf07c-c6f0-4601-9243-ddd209e52a06'
$env:NETLIFY_SITE_ID = $siteId
$env:CI = 'true'

Write-Host "==> Testando API em $ApiUrl/saude ..." -ForegroundColor Cyan
try {
    $headers = @{}
    if ($ApiUrl -match 'ngrok') {
        $headers['ngrok-skip-browser-warning'] = 'true'
    }
    $saude = Invoke-RestMethod -Uri "$ApiUrl/saude" -TimeoutSec 20 -Headers $headers
    if (-not $saude.ok) { throw "Resposta inesperada: $($saude | ConvertTo-Json -Compress)" }
    Write-Host "    OK - banco=$($saude.banco) conexao=$($saude.conexao)" -ForegroundColor Green
} catch {
    throw "A API nao respondeu em $ApiUrl/saude. Suba o servidor/tunel antes. Detalhe: $($_.Exception.Message)"
}

Write-Host '==> Gravando VITE_API_URL no Netlify...' -ForegroundColor Cyan
netlify env:set VITE_API_URL $ApiUrl --context production --filter @cortemadepinus/web | Out-Host
netlify env:set VITE_API_URL $ApiUrl --filter @cortemadepinus/web | Out-Host

Write-Host '==> Build + deploy em https://cortemadepinus.netlify.app ...' -ForegroundColor Cyan
$env:VITE_API_URL = $ApiUrl
netlify deploy --build --prod --filter=@cortemadepinus/web --message "API propria: $ApiUrl" | Out-Host

Write-Host ''
Write-Host 'Pronto.' -ForegroundColor Green
Write-Host "  Site: https://cortemadepinus.netlify.app"
Write-Host "  API:  $ApiUrl"
Write-Host "  Teste: $ApiUrl/saude"
Write-Host ''
Write-Host 'Confirme o login em /entrar. CORS deve incluir https://cortemadepinus.netlify.app'
