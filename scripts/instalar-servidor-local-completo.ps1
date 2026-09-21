<#
.SYNOPSIS
    Servidor MadePinus 100% local e gratuito (sem Cloudflare/ngrok).

.DESCRIPTION
    Compila o site + API no mesmo processo Windows:
      http://IP-DO-PC:4000  -> interface + API + SQLite

    Sem pontes, sem assinatura, sem URL de terceiro.
    Clientes na mesma rede (Wi-Fi/LAN) usam o sistema direto no PC servidor.

    O Netlify NAO consegue falar com um PC sem IP publico. Por isso este modo
    nao depende do Netlify para funcionar.

.PARAMETER SenhaAdmin
    Senha do administrador (obrigatoria na primeira configuracao).

.PARAMETER Porta
    Porta HTTP (padrao 4000).

.EXAMPLE
    .\scripts\instalar-servidor-local-completo.ps1 -SenhaAdmin 'SuaSenhaForte123'
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SenhaAdmin,
    [string]$EmailAdmin = 'admin@madepinus.com.br',
    [int]$Porta = 4000,
    [string]$NomeTarefa = 'MadePinus-API'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

$publicoRel = Join-Path 'apps' (Join-Path 'web' 'dist')
$publicoAbs = Join-Path $raiz $publicoRel
$segredo = -join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })

New-Item -ItemType Directory -Force -Path (Join-Path $raiz 'apps\api\dados') | Out-Null

Write-Host '==> Gerando apps/api/.env (SQLite + site na mesma origem)' -ForegroundColor Cyan
@"
NODE_ENV=production
PORT=$Porta
HOST=0.0.0.0
DB_PROVIDER=sqlite
JWT_SECRET="$segredo"
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:$Porta,http://127.0.0.1:$Porta,https://cortemadepinus.netlify.app
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=20
PUBLICO_DIR=$publicoRel
ADMIN_NOME="Central de Servicos MadePinus"
ADMIN_EMAIL=$EmailAdmin
ADMIN_SENHA=$SenhaAdmin
"@ | Set-Content -Path (Join-Path $raiz 'apps\api\.env') -Encoding UTF8

Write-Host '==> Instalando dependencias' -ForegroundColor Cyan
npm install

Write-Host '==> Compilando shared + API' -ForegroundColor Cyan
npm run build --workspace @cortemadepinus/shared
npm run build --workspace @cortemadepinus/api

Write-Host '==> Compilando site (mesma origem, VITE_API_URL vazio)' -ForegroundColor Cyan
$env:VITE_API_URL = ''
npm run build --workspace @cortemadepinus/web
if (-not (Test-Path (Join-Path $publicoAbs 'index.html'))) {
    throw "Build do site falhou: $publicoAbs\index.html nao encontrado"
}

Write-Host '==> Banco SQLite + migracoes + admin' -ForegroundColor Cyan
npm run prisma:deploy --workspace @cortemadepinus/api
npm run seed --workspace @cortemadepinus/api

Write-Host '==> Instalando servico Windows 24/7' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'instalar-servico-windows.ps1') -NomeTarefa $NomeTarefa

# Descobre IPs locais para mostrar ao usuario
$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -ExpandProperty IPAddress -Unique)

Write-Host ''
Write-Host 'Servidor MadePinus local instalado (sem tunel, sem custo).' -ForegroundColor Green
Write-Host "  Local:   http://127.0.0.1:$Porta"
foreach ($ip in $ips) {
    Write-Host "  Rede:    http://${ip}:$Porta"
}
Write-Host "  Saude:   http://127.0.0.1:$Porta/saude"
Write-Host "  Admin:   $EmailAdmin"
Write-Host ''
Write-Host 'Abra no navegador de qualquer PC da mesma rede Wi-Fi/LAN.'
Write-Host 'Firewall: permita Node.js ou a porta' $Porta 'na rede privada se pedir.'
Write-Host ''
Write-Host 'Netlify continua opcional (site institucional). O sistema de corte'
Write-Host 'funciona neste endereco local — banco e arquivos ficam neste PC.'
