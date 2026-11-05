<#
.SYNOPSIS
    Chuẩn bị IIS và database cho StarterKit. Chỉ cần chạy một lần; chạy lại vẫn an toàn.
    Chỉ tạo và sửa các site, app pool, database mang tên trong tham số; không đụng các site khác.
    Riêng cấu hình proxy của ARR nằm ở cấp máy chủ: site khác không dùng reverse proxy thì không bị ảnh hưởng.

.DESCRIPTION
    Secret được lưu trong biến môi trường của app pool, không nằm trong repo hay web.config.
    Mật khẩu admin đầu tiên được sinh ngẫu nhiên và ghi vào -AdminPasswordFile.

.EXAMPLE
    .\setup-iis.ps1 -CertificateThumbprint ABC123... -TrustCertificate
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string] $InstallRoot = 'C:\inetpub\StarterKit',
    [string] $SiteName = 'StarterKit',
    [int] $SitePort = 8443,
    [string] $ApiSiteName = 'StarterKitApi',
    [int] $ApiPort = 8091,
    [string] $SqlServer = 'localhost\SQLEXPRESS',
    [string] $Database = 'StarterKitLocal',
    [string] $AdminPasswordFile = "$env:USERPROFILE\StarterKit-admin-password.txt",
    # Bỏ trống: dùng chứng chỉ CN=localhost còn hạn lâu nhất trong LocalMachine\My
    [string] $CertificateThumbprint,
    # Thêm chứng chỉ vào Trusted Root của máy. Chỉ dùng cho chứng chỉ tự ký trên máy lập trình
    [switch] $TrustCertificate
)
$ErrorActionPreference = 'Stop'

Add-Type -Path "$env:windir\system32\inetsrv\Microsoft.Web.Administration.dll"

foreach ($module in @(
        @{ Name = 'URL Rewrite'; Path = "$env:windir\system32\inetsrv\rewrite.dll" },
        @{ Name = 'ARR'; Path = "$env:ProgramFiles\IIS\Application Request Routing\requestRouter.dll" },
        @{ Name = 'ASP.NET Core Module'; Path = "$env:ProgramFiles\IIS\Asp.Net Core Module\V2\aspnetcorev2.dll" })) {
    if (-not (Test-Path $module.Path)) { throw "Chưa cài $($module.Name). Xem deploy/iis/README.md" }
}

$clientPath = Join-Path $InstallRoot 'client'
$apiPath = Join-Path $InstallRoot 'api'
$clientPool = "${SiteName}Client"
$apiPool = "${ApiSiteName}"

# --- Chứng chỉ ---
if ($CertificateThumbprint) {
    $certificate = Get-Item "Cert:\LocalMachine\My\$CertificateThumbprint"
}
else {
    $certificate = Get-ChildItem Cert:\LocalMachine\My |
        Where-Object { $_.Subject -eq 'CN=localhost' -and $_.NotAfter -gt (Get-Date) -and $_.HasPrivateKey } |
        Sort-Object NotAfter -Descending | Select-Object -First 1
    if (-not $certificate) { throw 'Không tìm thấy chứng chỉ CN=localhost. Truyền -CertificateThumbprint.' }
}
Write-Host "==> Chứng chỉ: $($certificate.Subject), hết hạn $($certificate.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor Cyan

if ($TrustCertificate) {
    $publicOnly = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certificate.RawData)
    $store = [System.Security.Cryptography.X509Certificates.X509Store]::new('Root', 'LocalMachine')
    $store.Open('ReadWrite')
    $store.Add($publicOnly)
    $store.Close()
    Write-Host '    Đã thêm vào Trusted Root (chỉ phần khoá công khai).'
}

# --- Thư mục ---
foreach ($path in $clientPath, $apiPath, (Join-Path $apiPath 'logs')) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

# --- App pool và site ---
Write-Host '==> App pool và site' -ForegroundColor Cyan
$manager = [Microsoft.Web.Administration.ServerManager]::new()

foreach ($poolName in $clientPool, $apiPool) {
    $pool = $manager.ApplicationPools[$poolName]
    if (-not $pool) { $pool = $manager.ApplicationPools.Add($poolName) }
    $pool.ManagedRuntimeVersion = '' # No Managed Code: .NET hiện đại không chạy trong CLR của IIS
}

# ASP.NET Core lưu khoá Data Protection trong profile của app pool: không nạp thì khoá mất mỗi lần khởi động lại
$apiProcessModel = $manager.ApplicationPools[$apiPool].ProcessModel
$apiProcessModel.LoadUserProfile = $true
$apiProcessModel['setProfileEnvironment'] = $true

# Secret nằm ở biến môi trường của app pool. Giá trị đã có thì giữ nguyên, để chạy lại không làm mọi phiên đăng xuất
$variables = $manager.ApplicationPools[$apiPool].GetChildElement('environmentVariables').GetCollection()
function Get-PoolVariable([string] $Name) {
    $variables | Where-Object { $_['name'] -eq $Name } | Select-Object -First 1
}
function Set-PoolVariableIfMissing([string] $Name, [string] $Value) {
    if (Get-PoolVariable $Name) { return $false }
    $element = $variables.CreateElement('add')
    $element['name'] = $Name
    $element['value'] = $Value
    [void]$variables.Add($element)
    return $true
}

function New-Secret([int] $Bytes) {
    $buffer = [byte[]]::new($Bytes)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($buffer)
    $random.Dispose()
    return [System.BitConverter]::ToString($buffer).Replace('-', '').ToLowerInvariant()
}

[void](Set-PoolVariableIfMissing 'ConnectionStrings__DefaultConnection' "Server=$SqlServer;Database=$Database;Integrated Security=true;TrustServerCertificate=true")
[void](Set-PoolVariableIfMissing 'JwtSettings__SecretKey' (New-Secret 48))

$apiSite = $manager.Sites[$ApiSiteName]
if (-not $apiSite) {
    # Chỉ nghe ở 127.0.0.1: bên ngoài không gọi trực tiếp được, mọi request phải qua site public
    $apiSite = $manager.Sites.Add($ApiSiteName, 'http', "127.0.0.1:${ApiPort}:", $apiPath)
    $apiSite.Applications['/'].ApplicationPoolName = $apiPool
}

$site = $manager.Sites[$SiteName]
if (-not $site) {
    $site = $manager.Sites.Add($SiteName, "*:${SitePort}:", $clientPath, $certificate.GetCertHash(), 'MY')
    $site.Applications['/'].ApplicationPoolName = $clientPool
}

$config = $manager.GetApplicationHostConfiguration()

# ARR: bật proxy, giữ Host gốc, X-Forwarded-For chỉ chứa IP (không kèm cổng)
$proxy = $config.GetSection('system.webServer/proxy')
$proxy['enabled'] = $true
$proxy['preserveHostHeader'] = $true
$proxy['reverseRewriteHostInResponseHeaders'] = $false
$proxy['includePortInXForwardedFor'] = $false

# Cho phép quy tắc /api trong web.config đặt header X-Forwarded-Proto. Chỉ áp dụng cho site này
$allowed = $config.GetSection('system.webServer/rewrite/allowedServerVariables', $SiteName).GetCollection()
if (-not ($allowed | Where-Object { $_['name'] -eq 'HTTP_X_FORWARDED_PROTO' })) {
    $entry = $allowed.CreateElement('add')
    $entry['name'] = 'HTTP_X_FORWARDED_PROTO'
    [void]$allowed.Add($entry)
}

$manager.CommitChanges()

# --- Quyền thư mục: chỉ đọc, riêng logs của API được ghi ---
Write-Host '==> Quyền thư mục' -ForegroundColor Cyan
foreach ($grant in @(
        @{ Path = $clientPath; Rule = "IIS AppPool\${clientPool}:(OI)(CI)RX" },
        @{ Path = $apiPath; Rule = "IIS AppPool\${apiPool}:(OI)(CI)RX" },
        @{ Path = (Join-Path $apiPath 'logs'); Rule = "IIS AppPool\${apiPool}:(OI)(CI)M" })) {
    & icacls $grant.Path /grant $grant.Rule /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls thất bại cho $($grant.Path)" }
}

# --- Database: app pool đăng nhập bằng Windows, chỉ có quyền đọc ghi trên database này ---
Write-Host "==> Database $Database" -ForegroundColor Cyan
$login = "IIS APPPOOL\$apiPool"
$sql = @"
SET NOCOUNT ON;
IF DB_ID(N'$Database') IS NULL CREATE DATABASE [$Database];
-- SQL Express mặc định bật AUTO_CLOSE: database đóng rồi mở lại liên tục, mỗi lần xoá plan cache của cả instance
ALTER DATABASE [$Database] SET AUTO_CLOSE OFF;
IF SUSER_ID(N'$login') IS NULL CREATE LOGIN [$login] FROM WINDOWS;
"@
& sqlcmd -S $SqlServer -E -C -b -Q $sql
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được database hoặc login' }

$sql = @"
SET NOCOUNT ON;
IF USER_ID(N'$login') IS NULL CREATE USER [$login] FOR LOGIN [$login];
ALTER ROLE db_datareader ADD MEMBER [$login];
ALTER ROLE db_datawriter ADD MEMBER [$login];
GRANT EXECUTE TO [$login];
"@
& sqlcmd -S $SqlServer -d $Database -E -C -b -Q $sql
if ($LASTEXITCODE -ne 0) { throw 'Không cấp được quyền database' }

# --- Mật khẩu admin đầu tiên: chỉ sinh khi database chưa có user, deploy.ps1 xoá biến này sau khi tạo xong ---
$manager = [Microsoft.Web.Administration.ServerManager]::new()
$variables = $manager.ApplicationPools[$apiPool].GetChildElement('environmentVariables').GetCollection()
$usersTableExists = (& sqlcmd -S $SqlServer -d $Database -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables WHERE name = 'Users'" | Select-Object -First 1).Trim() -eq '1'
$hasUsers = $usersTableExists -and ((& sqlcmd -S $SqlServer -d $Database -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM Users" | Select-Object -First 1).Trim() -ne '0')

if (-not $hasUsers -and -not (Get-PoolVariable 'Seed__AdminPassword')) {
    $password = "Sk-$(New-Secret 12)"
    [void](Set-PoolVariableIfMissing 'Seed__AdminPassword' $password)
    $manager.CommitChanges()

    Set-Content -Path $AdminPasswordFile -Value $password -Encoding Ascii
    & icacls $AdminPasswordFile /inheritance:r /grant:r "${env:USERNAME}:(R,W,D)" /Q | Out-Null
    Write-Host "==> Mật khẩu admin đầu tiên nằm trong $AdminPasswordFile" -ForegroundColor Yellow
    Write-Host '    Hãy đăng nhập, đổi mật khẩu rồi xoá file này.'
}

Write-Host 'Xong. Bước tiếp theo: publish.ps1 rồi deploy.ps1' -ForegroundColor Green
