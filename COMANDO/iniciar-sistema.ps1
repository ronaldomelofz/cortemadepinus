<#
.SYNOPSIS
  Motor de inicializacao MadePinus (chamado pelo INICIAR-SISTEMA.bat).
  Sobe API, tunel HTTPS (ngrok com fallback Cloudflare), confere saude
  e atualiza Netlify se a URL publica mudou.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Raiz,
    [Parameter(Mandatory = $true)][string]$LogDir
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $LogDir "iniciar-$stamp.log"
$errFile = Join-Path $LogDir "erros-$stamp.log"
$estadoFile = Join-Path $LogDir 'estado-atual.json'
$tunelEstadoApi = Join-Path $Raiz 'apps\api\dados\tunel-https.json'
$configFile = Join-Path $PSScriptRoot 'config.env'

function Write-Log {
    param([string]$Mensagem, [ValidateSet('INFO','OK','WARN','ERRO')]$Nivel = 'INFO')
    $linha = "[{0}] [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Nivel, $Mensagem
    $cor = switch ($Nivel) {
        'OK'   { 'Green' }
        'WARN' { 'Yellow' }
        'ERRO' { 'Red' }
        default { 'Cyan' }
    }
    Write-Host $linha -ForegroundColor $cor
    Add-Content -Path $logFile -Value $linha -Encoding UTF8
    if ($Nivel -eq 'ERRO') {
        Add-Content -Path $errFile -Value $linha -Encoding UTF8
    }
}

function Ler-Config {
    $cfg = @{
        PORTA            = '4000'
        SITE_NETLIFY     = 'https://cortemadepinus.netlify.app'
        ATUALIZAR_NETLIFY = '1'
        PREFERIR_TUNEL   = 'ngrok'  # ngrok | cloudflare
    }
    if (Test-Path $configFile) {
        Get-Content $configFile | ForEach-Object {
            $l = $_.Trim()
            if ($l -eq '' -or $l.StartsWith('#')) { return }
            $i = $l.IndexOf('=')
            if ($i -lt 1) { return }
            $k = $l.Substring(0, $i).Trim().ToUpperInvariant()
            $v = $l.Substring($i + 1).Trim().Trim('"').Trim("'")
            if ($cfg.ContainsKey($k) -or $k -in @('PORTA','SITE_NETLIFY','ATUALIZAR_NETLIFY','PREFERIR_TUNEL')) {
                $cfg[$k] = $v
            }
        }
    }
    return $cfg
}

function Test-ApiLocal([int]$Porta) {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Porta/saude" -TimeoutSec 4
        return [bool]$r.ok
    } catch {
        return $false
    }
}

function Test-ApiPublica([string]$Url) {
    if (-not $Url) { return $false }
    try {
        $h = @{}
        if ($Url -match 'ngrok') { $h['ngrok-skip-browser-warning'] = 'true' }
        $r = Invoke-RestMethod -Uri "$Url/saude" -TimeoutSec 20 -Headers $h
        return [bool]$r.ok
    } catch {
        return $false
    }
}

function Find-Bin([string]$Nome) {
    $cmd = Get-Command $Nome -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidatos = @(
        "C:\Program Files\nodejs\$Nome.exe",
        "C:\Program Files\nodejs\$Nome.cmd",
        "$env:APPDATA\npm\$Nome.cmd",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\$Nome.exe",
        "C:\Program Files (x86)\cloudflared\$Nome.exe",
        "C:\Program Files\cloudflared\$Nome.exe"
    )
    foreach ($c in $candidatos) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

function Ensure-ApiBuild {
    $entrada = Join-Path $Raiz 'apps\api\dist\index.js'
    if (Test-Path $entrada) { return $entrada }

    Write-Log 'dist da API ausente - compilando shared + api...' 'WARN'
    Push-Location $Raiz
    try {
        npm run build --workspace @cortemadepinus/shared *>> $logFile
        if ($LASTEXITCODE -ne 0) { throw "build shared falhou ($LASTEXITCODE)" }
        npm run build --workspace @cortemadepinus/api *>> $logFile
        if ($LASTEXITCODE -ne 0) { throw "build api falhou ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
    if (-not (Test-Path $entrada)) {
        throw "Ainda sem $entrada apos o build"
    }
    return $entrada
}

function Start-Api([int]$Porta) {
    if (Test-ApiLocal $Porta) {
        Write-Log "API ja responde em :$Porta" 'OK'
        return
    }

    $node = Find-Bin 'node'
    if (-not $node) { throw 'Node.js nao encontrado no PATH' }

    $entrada = Ensure-ApiBuild
    $pastaApi = Join-Path $Raiz 'apps\api'
    $envFile = Join-Path $pastaApi '.env'
    if (-not (Test-Path $envFile)) {
        throw "Falta apps\api\.env - rode antes: .\scripts\configurar-servidor-windows.ps1"
    }

    # Migracoes rapidas (idempotente)
    Write-Log 'Aplicando migracoes Prisma (se necessario)...'
    Push-Location $pastaApi
    try {
        node (Join-Path $pastaApi 'scripts\prisma.mjs') migrate deploy *>> $logFile 2>> $errFile
    } catch {
        Write-Log "Migracao: $($_.Exception.Message) (seguindo)" 'WARN'
    } finally {
        Pop-Location
    }

    $apiOut = Join-Path $LogDir "api-stdout-$stamp.log"
    $apiErr = Join-Path $LogDir "api-stderr-$stamp.log"
    Write-Log "Iniciando API: $node $entrada"
    $p = Start-Process -FilePath $node -ArgumentList @($entrada) `
        -WorkingDirectory $pastaApi `
        -RedirectStandardOutput $apiOut `
        -RedirectStandardError $apiErr `
        -WindowStyle Hidden `
        -PassThru

    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-ApiLocal $Porta) {
            Write-Log "API no ar (PID $($p.Id)) apos ${i}s" 'OK'
            return
        }
        if ($p.HasExited) {
            $tail = ''
            if (Test-Path $apiErr) { $tail = (Get-Content $apiErr -Tail 15) -join "`n" }
            throw "API encerrou cedo (exit $($p.ExitCode)). Log: $apiErr`n$tail"
        }
    }
    throw "API nao respondeu /saude em 30s. Veja $apiErr"
}

function Get-NgrokUrl {
    try {
        $t = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 3
        $https = $t.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1
        if ($https) { return $https.public_url.TrimEnd('/') }
    } catch {}
    return $null
}

function Start-Ngrok([int]$Porta) {
    $url = Get-NgrokUrl
    if ($url -and (Test-ApiPublica $url)) {
        Write-Log "ngrok ja ativo: $url" 'OK'
        return $url
    }

    $ngrok = Find-Bin 'ngrok'
    if (-not $ngrok) {
        Write-Log 'ngrok nao encontrado' 'WARN'
        return $null
    }

    Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    $out = Join-Path $LogDir "ngrok-stdout-$stamp.log"
    $err = Join-Path $LogDir "ngrok-stderr-$stamp.log"
    Write-Log "Iniciando ngrok http $Porta ..."
    Start-Process -FilePath $ngrok -ArgumentList @('http', "$Porta", '--log=stdout') `
        -RedirectStandardOutput $out `
        -RedirectStandardError $err `
        -WindowStyle Hidden | Out-Null

    for ($i = 1; $i -le 40; $i++) {
        Start-Sleep -Seconds 1
        $url = Get-NgrokUrl
        if ($url) {
            if (Test-ApiPublica $url) {
                Write-Log "ngrok OK: $url" 'OK'
                return $url
            }
            Write-Log "ngrok URL obtida mas /saude ainda falha ($i)..." 'WARN'
        }
    }
    Write-Log 'ngrok nao ficou saudavel a tempo' 'ERRO'
    return $null
}

function Start-CloudflareQuick([int]$Porta) {
    $cf = Find-Bin 'cloudflared'
    if (-not $cf) {
        Write-Log 'cloudflared nao encontrado' 'WARN'
        return $null
    }

    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    $out = Join-Path $LogDir "cf-stdout-$stamp.log"
    $err = Join-Path $LogDir "cf-stderr-$stamp.log"
    Write-Log 'Iniciando cloudflared (tunel rapido)...'
    $proc = Start-Process -FilePath $cf `
        -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$Porta", '--no-autoupdate') `
        -RedirectStandardOutput $out `
        -RedirectStandardError $err `
        -WindowStyle Hidden `
        -PassThru

    $url = $null
    for ($i = 1; $i -le 45; $i++) {
        Start-Sleep -Seconds 1
        foreach ($f in @($err, $out)) {
            if (-not (Test-Path $f)) { continue }
            $txt = Get-Content $f -Raw -ErrorAction SilentlyContinue
            if ($txt -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
                $url = $Matches[0]
                break
            }
        }
        if ($url) {
            # DNS do trycloudflare pode demorar
            if (Test-ApiPublica $url) {
                Write-Log "cloudflared OK: $url" 'OK'
                return $url
            }
            Write-Log "cloudflared URL $url - aguardando DNS/saude ($i)..." 'WARN'
        }
        if ($proc.HasExited) {
            Write-Log "cloudflared encerrou (exit $($proc.ExitCode))" 'ERRO'
            return $null
        }
    }
    if ($url) {
        Write-Log "Usando URL cloudflared mesmo sem saude confirmada: $url" 'WARN'
        return $url
    }
    Write-Log 'cloudflared falhou' 'ERRO'
    return $null
}

function Update-NetlifyIfNeeded([string]$Url, [hashtable]$Cfg) {
    if ($Cfg.ATUALIZAR_NETLIFY -ne '1') {
        Write-Log 'ATUALIZAR_NETLIFY=0 - pulando Netlify' 'WARN'
        return
    }

    $anterior = $null
    if (Test-Path $estadoFile) {
        try { $anterior = (Get-Content $estadoFile -Raw | ConvertFrom-Json).urlPublica } catch {}
    }
    if ($anterior -and $anterior -eq $Url) {
        Write-Log "URL publica inalterada ($Url) - Netlify OK" 'OK'
        return
    }

    Write-Log "URL mudou ($anterior -> $Url). Atualizando Netlify..." 'WARN'
    $script = Join-Path $Raiz 'scripts\integrar-api-netlify.ps1'
    if (-not (Test-Path $script)) {
        Write-Log "Script ausente: $script" 'ERRO'
        return
    }

    $netlifyLog = Join-Path $LogDir "netlify-$stamp.log"
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -ApiUrl $Url *>> $netlifyLog
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Netlify deploy retornou codigo $LASTEXITCODE - veja $netlifyLog" 'ERRO'
        } else {
            Write-Log 'Netlify atualizado com sucesso' 'OK'
        }
    } catch {
        Write-Log "Falha ao atualizar Netlify: $($_.Exception.Message)" 'ERRO'
    }
}

# ---------------------------------------------------------------------------
Write-Log "=== MadePinus init | raiz=$Raiz ==="
$cfg = Ler-Config
$porta = [int]$cfg.PORTA
Write-Log "Config: porta=$porta preferir=$($cfg.PREFERIR_TUNEL) netlify=$($cfg.ATUALIZAR_NETLIFY)"

$codigoSaida = 0
$urlPublica = $null

try {
    # 1) API
    $tentativasApi = 0
    while ($tentativasApi -lt 3) {
        $tentativasApi++
        try {
            Start-Api -Porta $porta
            break
        } catch {
            Write-Log "Tentativa API $tentativasApi falhou: $($_.Exception.Message)" 'ERRO'
            if ($tentativasApi -ge 3) { throw }
            Start-Sleep -Seconds 3
        }
    }

    # 2) Tunel
    $preferencia = @()
    if ($cfg.PREFERIR_TUNEL -eq 'cloudflare') {
        $preferencia = @('cloudflare', 'ngrok')
    } else {
        $preferencia = @('ngrok', 'cloudflare')
    }

    foreach ($tipo in $preferencia) {
        if ($tipo -eq 'ngrok') {
            $urlPublica = Start-Ngrok -Porta $porta
        } else {
            $urlPublica = Start-CloudflareQuick -Porta $porta
        }
        if ($urlPublica -and (Test-ApiPublica $urlPublica)) { break }
        if ($urlPublica) {
            Write-Log "URL $urlPublica obtida mas saude publica instavel - tentando outro tunel" 'WARN'
        }
    }

    if (-not $urlPublica) {
        Write-Log "Nenhum tunel publico subiu. Sistema LOCAL funciona em http://127.0.0.1:$porta" 'WARN'
        $ipLan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -like '192.168.*' } |
            Select-Object -First 1 -ExpandProperty IPAddress
        if ($ipLan) {
            Write-Log "Acesse na rede: http://${ipLan}:$porta" 'WARN'
        }
        $codigoSaida = 2
    } else {
        # 3) Netlify
        Update-NetlifyIfNeeded -Url $urlPublica -Cfg $cfg
    }

    # 4) Persistencia de estado
    $estado = @{
        ok           = ($codigoSaida -eq 0)
        horario      = (Get-Date).ToString('o')
        porta        = $porta
        urlPublica   = $urlPublica
        apiLocal     = "http://127.0.0.1:$porta"
        siteNetlify  = $cfg.SITE_NETLIFY
        log          = $logFile
        erros        = $errFile
    }
    $estado | ConvertTo-Json | Set-Content -Path $estadoFile -Encoding UTF8
    New-Item -ItemType Directory -Force -Path (Split-Path $tunelEstadoApi) | Out-Null
    @{
        url         = $urlPublica
        iniciadoEm  = $estado.horario
        provider    = $(if ($urlPublica -match 'ngrok') { 'ngrok' } elseif ($urlPublica) { 'cloudflare' } else { 'nenhum' })
        logInicio   = $logFile
    } | ConvertTo-Json | Set-Content -Path $tunelEstadoApi -Encoding UTF8

    Write-Log '=== Resumo ==='
    Write-Log ("API local:  http://127.0.0.1:{0}/saude" -f $porta) 'OK'
    if ($urlPublica) {
        Write-Log ("API publica: {0}/saude" -f $urlPublica) 'OK'
        Write-Log ("Site:        {0}" -f $cfg.SITE_NETLIFY) 'OK'
    }
    Write-Log "Log completo: $logFile"
}
catch {
    Write-Log $_.Exception.Message 'ERRO'
    Write-Log $_.ScriptStackTrace 'ERRO'
    $codigoSaida = 1
}

exit $codigoSaida
