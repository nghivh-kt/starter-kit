<#
.SYNOPSIS
    Đưa gói trong publish/ lên IIS. Chạy sau publish.ps1, mỗi lần cập nhật.
    Thứ tự: tạm dừng API -> cập nhật database -> chép file -> chạy lại API -> kiểm tra.

.NOTES
    Trước khi triển khai lên dữ liệu thật, hãy backup database: script migration thay đổi cấu trúc bảng.
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string] $PublishRoot = (Join-Path (Resolve-Path "$PSScriptRoot\..\..").Path 'publish'),
    [string] $InstallRoot = 'C:\inetpub\StarterKit',
    [string] $ApiSiteName = 'StarterKitApi',
    [string] $SiteUrl = 'https://localhost:8443',
    [string] $ApiUrl = 'http://127.0.0.1:8091',
    [string] $SqlServer = 'localhost\SQLEXPRESS',
    [string] $Database = 'StarterKitLocal'
)
$ErrorActionPreference = 'Stop'

Add-Type -Path "$env:windir\system32\inetsrv\Microsoft.Web.Administration.dll"

foreach ($required in 'api\web.config', 'client\index.html', 'client\web.config', 'migrate.sql') {
    if (-not (Test-Path (Join-Path $PublishRoot $required))) { throw "Thiếu $required. Chạy publish.ps1 trước." }
}

$apiPath = Join-Path $InstallRoot 'api'
$clientPath = Join-Path $InstallRoot 'client'
$offline = Join-Path $apiPath 'app_offline.htm'

function Copy-Mirror([string] $Source, [string] $Target) {
    # Giữ log của API và file bảo trì: /MIR xoá mọi thứ không có trong gói
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
    throw "API chưa sẵn sàng sau 60 giây: $Url. Xem log trong $apiPath\logs và Event Viewer."
}

try {
    # File này khiến ASP.NET Core Module dừng app và giải phóng file DLL, người dùng tạm thấy trang bảo trì
    Write-Host '==> Tạm dừng API' -ForegroundColor Cyan
    Set-Content -Path $offline -Value '<!doctype html><meta charset="utf-8"><title>Bảo trì</title><p>Hệ thống đang cập nhật, vui lòng thử lại sau ít phút.</p>' -Encoding UTF8
    Start-Sleep -Seconds 2

    Write-Host '==> Cập nhật database' -ForegroundColor Cyan
    # -I: script của EF cần QUOTED_IDENTIFIER ON. -b: dừng và báo lỗi ngay khi có lỗi SQL
    $ErrorActionPreference = 'Continue'
    & sqlcmd -S $SqlServer -d $Database -E -C -b -I -i (Join-Path $PublishRoot 'migrate.sql') | Out-Null
    $migrationExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($migrationExitCode -ne 0) { throw 'Script migration thất bại: API vẫn ở trạng thái bảo trì, file chưa được thay.' }

    Write-Host '==> Chép file' -ForegroundColor Cyan
    Copy-Mirror (Join-Path $PublishRoot 'api') $apiPath
    Copy-Mirror (Join-Path $PublishRoot 'client') $clientPath
}
catch {
    Write-Host "LỖI: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "API đang ở chế độ bảo trì. Sửa lỗi rồi chạy lại, hoặc xoá $offline để mở lại bản cũ." -ForegroundColor Red
    throw
}

Write-Host '==> Chạy lại API' -ForegroundColor Cyan
Remove-Item $offline -Force
Wait-Healthy "$ApiUrl/health/ready"

# Tài khoản admin đã được tạo khi API khởi động: không cần giữ mật khẩu trong cấu hình nữa
$manager = [Microsoft.Web.Administration.ServerManager]::new()
$pool = $manager.ApplicationPools[$ApiSiteName]
$variables = $pool.GetChildElement('environmentVariables').GetCollection()
$seed = $variables | Where-Object { $_['name'] -eq 'Seed__AdminPassword' } | Select-Object -First 1
if ($seed) {
    Write-Host '==> Xoá mật khẩu admin đầu tiên khỏi cấu hình app pool' -ForegroundColor Cyan
    $variables.Remove($seed)
    $manager.CommitChanges()
    $manager.ApplicationPools[$ApiSiteName].Recycle() | Out-Null
    Start-Sleep -Seconds 2
    Wait-Healthy "$ApiUrl/health/ready"
}

Write-Host '==> Kiểm tra qua site public' -ForegroundColor Cyan
$homePage = Invoke-WebRequest "$SiteUrl/" -UseBasicParsing
if ($homePage.StatusCode -ne 200) { throw "Trang chủ trả về $($homePage.StatusCode)" }

try {
    Invoke-WebRequest "$SiteUrl/api/auth/me" -UseBasicParsing | Out-Null
    throw '/api/auth/me phải trả về 401 khi chưa đăng nhập'
}
catch [System.Net.WebException] {
    $status = [int]$_.Exception.Response.StatusCode
    if ($status -ne 401) { throw "/api/auth/me trả về $status, mong đợi 401: quy tắc chuyển /api có thể chưa đúng" }
}

Write-Host "Xong. Mở $SiteUrl" -ForegroundColor Green
