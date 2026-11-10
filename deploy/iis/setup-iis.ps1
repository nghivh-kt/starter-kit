<#
.SYNOPSIS
    Chuẩn bị IIS và database cho StarterKit. Chỉ cần chạy một lần; chạy lại vẫn an toàn.
    Tạo 1 site HTTPS và 1 app pool: API phục vụ luôn file Angular, nên không cần URL Rewrite hay ARR.
    Chỉ tạo và sửa site, app pool, database mang tên trong tham số; không đụng các site khác.

.DESCRIPTION
    Secret được lưu trong biến môi trường của app pool, không nằm trong repo hay web.config.
    Mật khẩu admin đầu tiên được sinh ngẫu nhiên và ghi vào -AdminPasswordFile.
    Máy đã cài bản 2 site cũ (site "<SiteName>Api" + ARR): biến môi trường được chuyển sang app pool mới,
    rồi site và app pool cũ bị gỡ.

.EXAMPLE
    .\setup-iis.ps1 -TrustCertificate
    .\setup-iis.ps1 -CertificateThumbprint ABC123... -SqlServer 'db01\SQLEXPRESS' -Database 'StarterKit'
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string] $InstallRoot = 'C:\inetpub\StarterKit',
    [string] $SiteName = 'StarterKit',
    [int] $SitePort = 8443,
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

if (-not (Test-Path "$env:ProgramFiles\IIS\Asp.Net Core Module\V2\aspnetcorev2.dll")) {
    throw 'Chưa cài .NET Hosting Bundle (ASP.NET Core Module). Xem deploy/iis/README.md'
}

$appPool = $SiteName
$logsPath = Join-Path $InstallRoot 'logs'

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
foreach ($path in $InstallRoot, $logsPath) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

# --- App pool và site ---
Write-Host '==> App pool và site' -ForegroundColor Cyan
$manager = [Microsoft.Web.Administration.ServerManager]::new()

$pool = $manager.ApplicationPools[$appPool]
if (-not $pool) { $pool = $manager.ApplicationPools.Add($appPool) }
$pool.ManagedRuntimeVersion = '' # No Managed Code: .NET hiện đại không chạy trong CLR của IIS
# ASP.NET Core lưu khoá Data Protection trong profile của app pool: không nạp thì khoá mất mỗi lần khởi động lại
$pool.ProcessModel.LoadUserProfile = $true
$pool.ProcessModel['setProfileEnvironment'] = $true

$variables = $pool.GetChildElement('environmentVariables').GetCollection()
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

# Bản 2 site cũ: giữ lại cấu hình (connection string, khoá JWT...) đang nằm ở app pool của API cũ
$legacyApiPool = $manager.ApplicationPools["${SiteName}Api"]
if ($legacyApiPool) {
    foreach ($legacy in $legacyApiPool.GetChildElement('environmentVariables').GetCollection()) {
        if (Set-PoolVariableIfMissing $legacy['name'] $legacy['value']) {
            Write-Host "    Chuyển biến $($legacy['name']) từ app pool ${SiteName}Api"
        }
    }
}

# Secret nằm ở biến môi trường của app pool. Giá trị đã có thì giữ nguyên, để chạy lại không làm mọi phiên đăng xuất
[void](Set-PoolVariableIfMissing 'ConnectionStrings__DefaultConnection' "Server=$SqlServer;Database=$Database;Integrated Security=true;TrustServerCertificate=true")
[void](Set-PoolVariableIfMissing 'JwtSettings__SecretKey' (New-Secret 48))

$site = $manager.Sites[$SiteName]
if (-not $site) {
    $site = $manager.Sites.Add($SiteName, "*:${SitePort}:", $InstallRoot, $certificate.GetCertHash(), 'MY')
}
# Site đã có (kể cả site public của bản 2 site cũ): trỏ về thư mục và app pool mới
$site.Applications['/'].VirtualDirectories['/'].PhysicalPath = $InstallRoot
$site.Applications['/'].ApplicationPoolName = $appPool

# Gỡ bản 2 site cũ: site API chỉ nghe 127.0.0.1 và hai app pool riêng
foreach ($legacySite in @("${SiteName}Api")) {
    if ($manager.Sites[$legacySite]) {
        $manager.Sites.Remove($manager.Sites[$legacySite])
        Write-Host "    Gỡ site cũ $legacySite"
    }
}
foreach ($legacyPool in @("${SiteName}Api", "${SiteName}Client")) {
    if ($legacyPool -ne $appPool -and $manager.ApplicationPools[$legacyPool]) {
        $manager.ApplicationPools.Remove($manager.ApplicationPools[$legacyPool])
        Write-Host "    Gỡ app pool cũ $legacyPool"
    }
}

$manager.CommitChanges()

# --- Quyền thư mục: chỉ đọc, riêng logs được ghi ---
Write-Host '==> Quyền thư mục' -ForegroundColor Cyan
foreach ($grant in @(
        @{ Path = $InstallRoot; Rule = "IIS AppPool\${appPool}:(OI)(CI)RX" },
        @{ Path = $logsPath; Rule = "IIS AppPool\${appPool}:(OI)(CI)M" })) {
    & icacls $grant.Path /grant $grant.Rule /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls thất bại cho $($grant.Path)" }
}

# --- Database: app pool đăng nhập bằng Windows, chỉ có quyền đọc ghi trên database này ---
Write-Host "==> Database $Database" -ForegroundColor Cyan
$login = "IIS APPPOOL\$appPool"
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
$variables = $manager.ApplicationPools[$appPool].GetChildElement('environmentVariables').GetCollection()
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
