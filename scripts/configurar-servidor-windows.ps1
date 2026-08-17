<#
.SYNOPSIS
    Prepara a API da Central de Servicos MadePinus no Windows, com SQLite (sem custo).

.DESCRIPTION
    Gera apps/api/.env, instala dependencias, cria o arquivo SQLite, aplica as
    migracoes e cria o usuario administrador. Nao precisa de PostgreSQL.

.EXAMPLE
    .\scripts\configurar-servidor-windows.ps1 -SenhaAdmin 'UmaSenhaForte123'
#>

[CmdletBinding()]
param(
    [string]$EmailAdmin = 'admin@madepinus.com.br',
    [Parameter(Mandatory = $true)][string]$SenhaAdmin,
    [string]$OrigensCors = 'https://cortemadepinus.netlify.app,http://localhost:5173'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

Write-Host '==> Gerando apps/api/.env (SQLite, sem senha de banco)' -ForegroundColor Cyan
$segredo = -join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
New-Item -ItemType Directory -Force -Path 'apps\api\dados' | Out-Null

@"
NODE_ENV=production
PORT=4000
DB_PROVIDER=sqlite
JWT_SECRET="$segredo"
JWT_EXPIRES_IN=7d
CORS_ORIGINS=$OrigensCors
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=20
ADMIN_NOME="Central de Servicos MadePinus"
ADMIN_EMAIL=$EmailAdmin
ADMIN_SENHA=$SenhaAdmin
"@ | Set-Content -Path 'apps\api\.env' -Encoding UTF8

Write-Host '==> Instalando dependencias' -ForegroundColor Cyan
npm install

Write-Host '==> Compilando pacote compartilhado e API' -ForegroundColor Cyan
npm run build --workspace @cortemadepinus/shared
npm run build --workspace @cortemadepinus/api

Write-Host '==> Criando o arquivo SQLite e aplicando migracoes' -ForegroundColor Cyan
npm run prisma:deploy --workspace @cortemadepinus/api

Write-Host '==> Criando usuario administrador' -ForegroundColor Cyan
npm run seed --workspace @cortemadepinus/api

Write-Host ''
Write-Host 'Pronto. Banco: apps\api\dados\cortemadepinus.db (SQLite, open source, sem custo).' -ForegroundColor Green
Write-Host "Administrador: $EmailAdmin"
Write-Host ''
Write-Host 'Para deixar a API no ar 24/7 (sobe com o Windows):'
Write-Host '    .\scripts\instalar-servico-windows.ps1'
Write-Host 'Para testar agora, sem instalar o servico:'
Write-Host '    npm start --workspace @cortemadepinus/api'
