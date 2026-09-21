<#
.SYNOPSIS
    Mostra se o Tunel MadePinus 24/7 e a API estao no ar.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
$estadoPath = Join-Path $raiz 'apps\api\dados\tunel-madepinus.json'
$tarefa = 'MadePinus-Tunel'

Write-Host '=== MadePinus Tunel / API ===' -ForegroundColor Cyan

$apiLocal = $null
try {
    $apiLocal = Invoke-RestMethod 'http://127.0.0.1:4000/saude' -TimeoutSec 3
    Write-Host ("API local:  OK  banco={0}" -f $apiLocal.banco) -ForegroundColor Green
} catch {
    Write-Host 'API local:  OFFLINE (porta 4000)' -ForegroundColor Red
}

$task = Get-ScheduledTask -TaskName $tarefa -ErrorAction SilentlyContinue
if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName $tarefa
    Write-Host ("Tarefa:     {0}  estado={1}  ultimoResultado={2}" -f $tarefa, $task.State, $info.LastTaskResult)
} else {
    Write-Host "Tarefa:     $tarefa NAO instalada" -ForegroundColor Yellow
}

$url = $null
if (Test-Path $estadoPath) {
    $estado = Get-Content $estadoPath -Raw | ConvertFrom-Json
    $url = $estado.apiPublicUrl
    Write-Host ("Config:     instaladoEm={0}" -f $estado.instaladoEm)
    if ($estado.log -and (Test-Path $estado.log)) {
        Write-Host '--- ultimas linhas do log ---'
        Get-Content $estado.log -Tail 8
    }
}

if ($url) {
    try {
        $remoto = Invoke-RestMethod "$url/saude" -TimeoutSec 15
        Write-Host ("API publica: OK  {0}" -f $url) -ForegroundColor Green
        Write-Host ("             banco={0} conexao={1}" -f $remoto.banco, $remoto.conexao)
    } catch {
        Write-Host ("API publica: FALHOU  {0}" -f $url) -ForegroundColor Red
        Write-Host ("             {0}" -f $_.Exception.Message)
    }
} else {
    Write-Host 'API publica: API_PUBLIC_URL ainda nao definida no .env / tunel-madepinus.json' -ForegroundColor Yellow
}
