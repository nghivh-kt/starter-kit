<#
.SYNOPSIS
    Cài môi trường dev bằng một lệnh: kiểm tra .NET và Node, đặt user-secrets, tạo database, cài package npm.
    Chạy lại vẫn an toàn: secret đã có thì giữ nguyên (trừ khi truyền -Force), migration đã chạy thì bỏ qua.

.DESCRIPTION
    Secret nằm trong user-secrets của máy này (không nằm trong repo):
    - ConnectionStrings:DefaultConnection: đăng nhập SQL Server bằng tài khoản Windows đang dùng.
    - JwtSettings:SecretKey: chuỗi ngẫu nhiên 48 byte.
    - Seed:AdminPassword: mật khẩu ngẫu nhiên của user "admin", in ra một lần. User được tạo ở lần chạy API đầu tiên.

.EXAMPLE
    .\scripts\setup-dev.ps1
    .\scripts\setup-dev.ps1 -SqlServer '.\SQLEXPRESS' -Database 'StarterKitDev' -WithE2E
#>
[CmdletBinding()]
param(
    [string] $SqlServer = 'localhost\SQLEXPRESS',
    [string] $Database = 'StarterKitDev',
    # Ghi đè secret đã có và cài lại package npm
    [switch] $Force,
    # Tải thêm trình duyệt Chromium cho test E2E (Playwright)
    [switch] $WithE2E
)
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path "$PSScriptRoot\..").Path
$api = Join-Path $root 'API'
$client = Join-Path $root 'Client'

function Invoke-Checked([string] $Title, [scriptblock] $Command) {
    Write-Host "==> $Title" -ForegroundColor Cyan
    # Công cụ build hay in cảnh báo ra stderr: chỉ dựa vào mã thoát để biết có lỗi hay không
    $ErrorActionPreference = 'Continue'
    & $Command
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw "$Title thất bại (mã $LASTEXITCODE)" }
}

function New-Secret([int] $Bytes) {
    $buffer = [byte[]]::new($Bytes)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($buffer)
    $random.Dispose()
    return [System.BitConverter]::ToString($buffer).Replace('-', '').ToLowerInvariant()
}

# --- Công cụ cần có ---
Write-Host '==> Kiểm tra .NET SDK và Node' -ForegroundColor Cyan
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Chưa cài .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0' }
Push-Location $root
try {
    # global.json chọn SDK: lệnh lỗi nghĩa là máy chưa có SDK đúng phiên bản
    $ErrorActionPreference = 'Continue'
    $sdk = & dotnet --version 2>&1
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw "Không có .NET SDK khớp global.json. Cài .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0`n$sdk" }
}
finally {
    Pop-Location
}

$wantedNode = (Get-Content (Join-Path $client '.nvmrc') -TotalCount 1).Trim()
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Chưa cài Node $wantedNode (xem Client/.nvmrc)" }
$node = (& node --version).Trim()
if ($node.TrimStart('v').Split('.')[0] -ne $wantedNode) { throw "Cần Node $wantedNode (Client/.nvmrc), máy đang có $node" }
Write-Host "    .NET SDK $sdk, Node $node"

Push-Location $api
try {
    Invoke-Checked 'Khôi phục công cụ .NET (dotnet-ef, swagger)' { dotnet tool restore --verbosity quiet }

    # --- User-secrets ---
    Write-Host '==> User-secrets' -ForegroundColor Cyan
    $existing = @{}
    foreach ($line in (& dotnet user-secrets list 2>$null)) {
        if ($line -match '^(?<key>[^=]+?) = ') { $existing[$Matches.key] = $true }
    }

    $adminPassword = $null
    $secrets = [ordered]@{
        'ConnectionStrings:DefaultConnection' = { "Server=$SqlServer;Database=$Database;Integrated Security=True;TrustServerCertificate=True" }
        'JwtSettings:SecretKey'               = { New-Secret 48 }
        'Seed:AdminPassword'                  = { $script:adminPassword = "Dev-$(New-Secret 8)"; $script:adminPassword }
    }
    foreach ($secret in $secrets.GetEnumerator()) {
        if ($existing[$secret.Key] -and -not $Force) {
            Write-Host "    $($secret.Key): đã có, giữ nguyên"
            continue
        }
        & dotnet user-secrets set $secret.Key (& $secret.Value) | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Không đặt được $($secret.Key)" }
        Write-Host "    $($secret.Key): đã đặt"
    }

    # --- Database ---
    # User-secrets chỉ được nạp ở Development
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    Invoke-Checked 'Tạo database và chạy migration' { dotnet ef database update --no-color }
}
finally {
    Remove-Item Env:ASPNETCORE_ENVIRONMENT -ErrorAction SilentlyContinue
    Pop-Location
}

# --- Client ---
Push-Location $client
try {
    if ($Force -or -not (Test-Path 'node_modules')) {
        Invoke-Checked 'Cài package npm' { npm ci --no-audit --no-fund }
    }
    else {
        Write-Host '==> node_modules đã có: bỏ qua (truyền -Force để cài lại)' -ForegroundColor Cyan
    }
    if ($WithE2E) {
        Invoke-Checked 'Tải Chromium cho Playwright' { npx playwright install chromium }
    }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Xong. Chạy app bằng 2 cửa sổ:' -ForegroundColor Green
Write-Host '    cd API;    dotnet run --launch-profile http    # http://localhost:5157/swagger'
Write-Host '    cd Client; npm start                           # http://localhost:4200'
if ($adminPassword) {
    Write-Host ''
    Write-Host "Đăng nhập: admin / $adminPassword" -ForegroundColor Yellow
    Write-Host '    User admin được tạo ở lần chạy API đầu tiên. Xem lại mật khẩu: cd API; dotnet user-secrets list'
}
