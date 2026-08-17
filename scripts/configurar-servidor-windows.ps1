<#
.SYNOPSIS
    Prepara o banco PostgreSQL e a API da Central de Servicos MadePinus em um servidor Windows.

.DESCRIPTION
    Cria o usuario e o banco no PostgreSQL local, gera o arquivo apps/api/.env com um
    JWT_SECRET aleatorio, aplica as migracoes do Prisma e executa o seed inicial.

.EXAMPLE
    .\scripts\configurar-servidor-windows.ps1 -SenhaBanco 'senha-forte' -SenhaAdmin 'outra-senha'
#>

[CmdletBinding()]
param(
    [string]$UsuarioBanco = 'madepinus',
    [Parameter(Mandatory = $true)][string]$SenhaBanco,
    [string]$NomeBanco = 'cortemadepinus',
    [string]$HostBanco = 'localhost',
    [int]$PortaBanco = 5432,
    [string]$SuperUsuario = 'postgres',
    [string]$EmailAdmin = 'admin@madepinus.com.br',
    [Parameter(Mandatory = $true)][string]$SenhaAdmin,
    [string]$OrigensCors = 'https://cortemadepinus.netlify.app,http://localhost:5173',
    [string]$CaminhoPsql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

if (-not (Test-Path $CaminhoPsql)) {
    throw "psql nao encontrado em '$CaminhoPsql'. Informe o caminho com -CaminhoPsql."
}

Write-Host '==> Criando usuario e banco no PostgreSQL' -ForegroundColor Cyan
$sql = @"
DO `$`$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$UsuarioBanco') THEN
      CREATE ROLE $UsuarioBanco LOGIN PASSWORD '$SenhaBanco';
   ELSE
      ALTER ROLE $UsuarioBanco WITH PASSWORD '$SenhaBanco';
   END IF;
END
`$`$;
"@
$sql | & $CaminhoPsql -U $SuperUsuario -h $HostBanco -p $PortaBanco -v ON_ERROR_STOP=1 -f -

$existe = & $CaminhoPsql -U $SuperUsuario -h $HostBanco -p $PortaBanco -tAc "SELECT 1 FROM pg_database WHERE datname='$NomeBanco'"
if ($existe -ne '1') {
    & $CaminhoPsql -U $SuperUsuario -h $HostBanco -p $PortaBanco -v ON_ERROR_STOP=1 -c "CREATE DATABASE $NomeBanco OWNER $UsuarioBanco"
    Write-Host "    banco '$NomeBanco' criado" -ForegroundColor Green
}
else {
    Write-Host "    banco '$NomeBanco' ja existia" -ForegroundColor Yellow
}

Write-Host '==> Gerando apps/api/.env' -ForegroundColor Cyan
$segredo = -join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 256) })
$conexao = "postgresql://${UsuarioBanco}:${SenhaBanco}@${HostBanco}:${PortaBanco}/${NomeBanco}?schema=public"

@"
NODE_ENV=production
PORT=4000
DATABASE_URL="$conexao"
JWT_SECRET="$segredo"
JWT_EXPIRES_IN=7d
CORS_ORIGINS=$OrigensCors
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=20
ADMIN_NOME="Central de Servicos MadePinus"
ADMIN_EMAIL=$EmailAdmin
ADMIN_SENHA=$SenhaAdmin
"@ | Set-Content -Path 'apps/api/.env' -Encoding UTF8

Write-Host '==> Instalando dependencias' -ForegroundColor Cyan
npm install

Write-Host '==> Aplicando migracoes' -ForegroundColor Cyan
npm run prisma:deploy --workspace @cortemadepinus/api

Write-Host '==> Criando usuario administrador' -ForegroundColor Cyan
npm run seed --workspace @cortemadepinus/api

Write-Host '==> Compilando a API' -ForegroundColor Cyan
npm run build:api

Write-Host ''
Write-Host 'Pronto. Para iniciar a API:' -ForegroundColor Green
Write-Host '    npm start --workspace @cortemadepinus/api'
Write-Host "Acesso administrador: $EmailAdmin"
