<#
.SYNOPSIS
    Đưa gói trong publish/ lên IIS. Chạy sau publish.ps1, mỗi lần cập nhật.
    Thứ tự: tạm dừng app -> backup database -> cập nhật database -> chép file -> chạy lại app -> kiểm tra.

.NOTES
    Backup là bản COPY_ONLY: không làm lệch chuỗi backup sẵn có của DBA (nếu có).
    Nơi DBA đã tự backup trước khi triển khai thì truyền -SkipBackup.
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string] $PublishRoot = (Join-Path (Resolve-Path "$PSScriptRoot\..\..").Path 'publish'),
    [string] $InstallRoot = 'C:\inetpub\StarterKit',
    [string] $SiteName = 'StarterKit',
    [string] $SiteUrl = 'https://localhost:8443',
    [string] $SqlServer = 'localhost\SQLEXPRESS',
    [string] $Database = 'StarterKitLocal',
    # Số bản backup trước triển khai được giữ lại trong thư mục backup của SQL Server (nếu thư mục nằm trên máy này)
    [int] $KeepBackups = 5,
    [switch] $SkipBackup
)
$ErrorActionPreference = 'Stop'

Add-Type -Path "$env:windir\system32\inetsrv\Microsoft.Web.Administration.dll"

$app = Join-Path $PublishRoot 'app'
foreach ($required in 'app\web.config', 'app\wwwroot\index.html', 'migrate.sql') {
    if (-not (Test-Path (Join-Path $PublishRoot $required))) { throw "Thiếu $required. Chạy publish.ps1 trước." }
}

$offline = Join-Path $InstallRoot 'app_offline.htm'

function Invoke-Sql([string] $Query) {
    # -b: dừng và báo lỗi ngay khi có lỗi SQL. -h -1 -W: chỉ in giá trị, không tiêu đề và khoảng trắng thừa
    $ErrorActionPreference = 'Continue'
    $result = & sqlcmd -S $SqlServer -E -C -b -h -1 -W -Q "SET NOCOUNT ON; $Query"
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($exitCode -ne 0) { throw "Lệnh SQL thất bại: $result" }
    return $result
}

function Backup-Database {
    # Thư mục backup mặc định của instance: tài khoản dịch vụ SQL Server chắc chắn ghi được vào đây.
    # Đọc từ registry của instance thay vì SERVERPROPERTY('InstanceDefaultBackupPath') vì thuộc tính đó chỉ có từ SQL Server 2019
    $directory = (Invoke-Sql "DECLARE @dir nvarchar(4000); EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'BackupDirectory', @dir OUTPUT; SELECT @dir;" |
        Select-Object -First 1).Trim()
    if (-not $directory -or $directory -eq 'NULL') { throw 'Không đọc được thư mục backup của SQL Server. Tự backup rồi chạy lại với -SkipBackup.' }
    $file = Join-Path $directory ("{0}-{1}.bak" -f $Database, (Get-Date -Format 'yyyyMMdd-HHmmss'))

    # COPY_ONLY: không ảnh hưởng chuỗi backup đang có. CHECKSUM: phát hiện trang dữ liệu hỏng ngay lúc backup.
    # Không dùng COMPRESSION: SQL Server Express không hỗ trợ
    Invoke-Sql "BACKUP DATABASE [$Database] TO DISK = N'$file' WITH COPY_ONLY, CHECKSUM, INIT;" | Out-Null
    Write-Host "    $file"

    # Xoá bớt bản cũ khi thư mục nằm trên máy này (SQL Server cài cùng máy)
    if (Test-Path $directory) {
        Get-ChildItem $directory -Filter "$Database-*.bak" | Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $KeepBackups | Remove-Item -Force
    }
}

function Copy-Mirror([string] $Source, [string] $Target) {
    # Giữ log và file bảo trì: /MIR xoá mọi thứ không có trong gói
    $arguments = @($Source, $Target, '/MIR', '/XD', (Join-Path $Target 'logs'), '/XF', 'app_offline.htm',
        '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:3', '/W:2')
    & robocopy @arguments | Out-Null
    # Robocopy: mã nhỏ hơn 8 là thành công
    if ($LASTEXITCODE -ge 8) { throw "Robocopy thất bại (mã $LASTEXITCODE) khi chép $Source" }
    $global:LASTEXITCODE = 0
}

function Wait-Healthy([string] $Url) {
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        try {
            if ((Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200) { return }
        }
        catch { Start-Sleep -Seconds 2 }
    }
    throw "App chưa sẵn sàng sau 60 giây: $Url. Xem log trong $InstallRoot\logs và Event Viewer."
}

try {
    # File này khiến ASP.NET Core Module dừng app và giải phóng file DLL, người dùng tạm thấy trang bảo trì
    Write-Host '==> Tạm dừng app' -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
    Set-Content -Path $offline -Value '<!doctype html><meta charset="utf-8"><title>Bảo trì</title><p>Hệ thống đang cập nhật, vui lòng thử lại sau ít phút.</p>' -Encoding UTF8
    Start-Sleep -Seconds 2

    if ($SkipBackup) {
        Write-Host '==> Bỏ qua backup (-SkipBackup)' -ForegroundColor Yellow
    }
    else {
        Write-Host '==> Backup database' -ForegroundColor Cyan
        Backup-Database
    }

    Write-Host '==> Cập nhật database' -ForegroundColor Cyan
    # -I: script của EF cần QUOTED_IDENTIFIER ON
    $ErrorActionPreference = 'Continue'
    & sqlcmd -S $SqlServer -d $Database -E -C -b -I -i (Join-Path $PublishRoot 'migrate.sql') | Out-Null
    $migrationExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($migrationExitCode -ne 0) { throw 'Script migration thất bại: app vẫn ở trạng thái bảo trì, file chưa được thay.' }

    Write-Host '==> Chép file' -ForegroundColor Cyan
    Copy-Mirror $app $InstallRoot
}
catch {
    Write-Host "LỖI: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "App đang ở chế độ bảo trì. Sửa lỗi rồi chạy lại, hoặc xoá $offline để mở lại bản cũ." -ForegroundColor Red
    throw
}

Write-Host '==> Chạy lại app' -ForegroundColor Cyan
Remove-Item $offline -Force
Wait-Healthy "$SiteUrl/health/ready"

# Tài khoản admin đã được tạo khi app khởi động: không cần giữ mật khẩu trong cấu hình nữa
$manager = [Microsoft.Web.Administration.ServerManager]::new()
$variables = $manager.ApplicationPools[$SiteName].GetChildElement('environmentVariables').GetCollection()
$seed = $variables | Where-Object { $_['name'] -eq 'Seed__AdminPassword' } | Select-Object -First 1
if ($seed) {
    Write-Host '==> Xoá mật khẩu admin đầu tiên khỏi cấu hình app pool' -ForegroundColor Cyan
    $variables.Remove($seed)
    $manager.CommitChanges()
    $manager.ApplicationPools[$SiteName].Recycle() | Out-Null
    Start-Sleep -Seconds 2
    Wait-Healthy "$SiteUrl/health/ready"
}

Write-Host '==> Kiểm tra' -ForegroundColor Cyan
$homePage = Invoke-WebRequest "$SiteUrl/" -UseBasicParsing
if ($homePage.StatusCode -ne 200 -or $homePage.Content -notmatch '<app-root') { throw 'Trang chủ không trả về bản build Angular' }
if (-not $homePage.Headers['Content-Security-Policy']) { throw 'Trang chủ thiếu header Content-Security-Policy' }
foreach ($header in 'X-Powered-By', 'Server') {
    if ($homePage.Headers[$header]) { throw "Response còn header $header ($($homePage.Headers[$header])): xem web.config của app" }
}

# Đường dẫn của Angular không phải file thật: phải trả index.html, F5 mới không gặp 404
$deepLink = Invoke-WebRequest "$SiteUrl/categories" -UseBasicParsing
if ($deepLink.Content -notmatch '<app-root') { throw '/categories không trả về index.html' }

try {
    Invoke-WebRequest "$SiteUrl/api/auth/me" -UseBasicParsing | Out-Null
    throw '/api/auth/me phải trả về 401 khi chưa đăng nhập'
}
catch [System.Net.WebException] {
    $response = $_.Exception.Response
    if ([int]$response.StatusCode -ne 401 -or $response.ContentType -notmatch 'problem\+json') {
        throw "/api/auth/me trả về $([int]$response.StatusCode) $($response.ContentType), mong đợi 401 application/problem+json"
    }
}

Write-Host "Xong. Mở $SiteUrl" -ForegroundColor Green
