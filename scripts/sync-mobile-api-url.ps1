$ErrorActionPreference = 'Stop'

$mobileDir = 'C:\Projects\CharBookReact-main'
$envPath = Join-Path $mobileDir '.env'

if (-not (Test-Path -LiteralPath $mobileDir)) {
    Write-Host "No se encontro la app movil en $mobileDir"
    exit 0
}

$ip = $null

try {
    $ipConfig = Get-NetIPConfiguration |
        Where-Object {
            $_.IPv4DefaultGateway -and
            $_.NetAdapter.Status -eq 'Up' -and
            $_.IPv4Address.IPAddress -notmatch '^(127|169\.254)\.'
        } |
        Select-Object -First 1

    $ip = $ipConfig.IPv4Address.IPAddress
} catch {
    $ip = $null
}

if (-not $ip) {
    $raw = (ipconfig) -join "`n"
    $sections = $raw -split "(`r?`n){2,}"

    foreach ($section in $sections) {
        $hasGateway = $section -match '(Default Gateway|Puerta de enlace predeterminada)[^\r\n]*:\s*\S'
        $hasIPv4 = $section -match 'IPv4[^\r\n]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)'
        if ($hasGateway -and $hasIPv4 -and $Matches[1] -notmatch '^(127|169\.254)\.') {
            $ip = $Matches[1]
            break
        }
    }
}

if (-not $ip) {
    $ip = (ipconfig |
        Select-String -Pattern 'IPv4[^\r\n]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)' |
        ForEach-Object { $_.Matches[0].Groups[1].Value } |
        Where-Object { $_ -notmatch '^(127|169\.254)\.' } |
        Select-Object -First 1)
}

if (-not $ip) {
    Write-Host 'No pude detectar una IP LAN valida. Revisa tu conexion Wi-Fi/hotspot.'
    exit 1
}

$apiUrl = "http://$ip`:8000"

if (Test-Path -LiteralPath $envPath) {
    $lines = Get-Content -LiteralPath $envPath
    if ($lines -match '^EXPO_PUBLIC_API_URL=') {
        $lines = $lines -replace '^EXPO_PUBLIC_API_URL=.*', "EXPO_PUBLIC_API_URL=$apiUrl"
    } else {
        $lines += "EXPO_PUBLIC_API_URL=$apiUrl"
    }
} else {
    $lines = @("EXPO_PUBLIC_API_URL=$apiUrl")
}

Set-Content -LiteralPath $envPath -Value $lines -Encoding ASCII

Write-Host "Expo usara EXPO_PUBLIC_API_URL=$apiUrl"
Write-Host "Prueba desde el telefono: $apiUrl/api/books"
