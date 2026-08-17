<#
.SYNOPSIS
    Instala a API MadePinus como tarefa do Windows (sobe no boot, reinicia se cair).

.DESCRIPTION
    Usa o Agendador de Tarefas nativo do Windows — sem software pago.
    A API fica ouvindo em http://localhost:4000 mesmo apos reiniciar o servidor.

    Para os clientes acessarem 24/7 pela internet, instale tambem o Cloudflare
    Tunnel (gratuito, binario open source): veja o README.

.EXAMPLE
    .\scripts\instalar-servico-windows.ps1
#>

[CmdletBinding()]
param(
    [string]$NomeTarefa = 'MadePinus-API'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$entrada = Join-Path $raiz 'apps\api\dist\index.js'
$pastaApi = Join-Path $raiz 'apps\api'
$log = Join-Path $raiz 'apps\api\dados\api.log'

if (-not (Test-Path $entrada)) {
    throw "API ainda nao foi compilada. Rode primeiro: .\scripts\configurar-servidor-windows.ps1 -SenhaAdmin 'sua-senha'"
}

New-Item -ItemType Directory -Force -Path (Join-Path $raiz 'apps\api\dados') | Out-Null

$wrapper = Join-Path $raiz 'scripts\manter-api-no-ar.ps1'
@"
`$ErrorActionPreference = 'Continue'
Set-Location '$pastaApi'
while (`$true) {
    Add-Content -Path '$log' -Value ("[`$(Get-Date -Format o)] iniciando API")
    & '$node' '$entrada' *>> '$log'
    Add-Content -Path '$log' -Value ("[`$(Get-Date -Format o)] API encerrou (codigo `$LASTEXITCODE). Relancando em 5s.")
    Start-Sleep -Seconds 5
}
"@ | Set-Content -Path $wrapper -Encoding UTF8

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wrapper`""
$gatilho = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit 0 -StartWhenAvailable

Register-ScheduledTask -TaskName $NomeTarefa -Action $acao -Trigger $gatilho -Principal $principal -Settings $ajustes -Force | Out-Null
Start-ScheduledTask -TaskName $NomeTarefa

Write-Host "Tarefa '$NomeTarefa' instalada e iniciada." -ForegroundColor Green
Write-Host "A API sobe automaticamente quando o Windows liga."
Write-Host "Log: $log"
Write-Host ''
Write-Host "Teste local:  http://localhost:4000/saude"
Write-Host "Para parar:   Stop-ScheduledTask -TaskName '$NomeTarefa'"
Write-Host "Para remover: Unregister-ScheduledTask -TaskName '$NomeTarefa' -Confirm:`$false"
