<#
.SYNOPSIS
    Đổi tên StarterKit thành tên dự án mới. Chạy một lần, ngay sau khi chép kit sang thư mục của dự án mới.

.DESCRIPTION
    - StarterKit -> Name, starter-kit -> name dạng kebab, starterkit -> name viết thường, Starter Kit -> DisplayName.
      Áp dụng cho mã nguồn, cấu hình, script và tài liệu (cookie, JWT issuer, tên site/app pool/database, tiêu đề trang...).
    - Sinh UserSecretsId mới trong API.csproj. Nếu giữ nguyên, mọi dự án chép từ kit dùng chung một kho user-secrets trên máy,
      tức dự án này có thể đọc connection string của dự án khác và chạy migration vào database của nó.
    - Không đụng git. Thư mục được clone từ kit thì nên xoá .git rồi "git init" để bắt đầu lịch sử riêng.

.EXAMPLE
    .\scripts\init-project.ps1 -Name QuanLyKho -DisplayName 'Quản lý kho'
    .\scripts\init-project.ps1 -Name QuanLyKho -HttpsPort 8444
#>
[CmdletBinding()]
param(
    # Tên dạng PascalCase: chữ cái đầu viết hoa, chỉ gồm chữ không dấu và số, ví dụ QuanLyKho
    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Z][A-Za-z0-9]{1,39}$')]
    [string] $Name,

    # Tên hiển thị trên giao diện (tiêu đề trang, menu). Bỏ trống: tách Name thành từ, ví dụ "Quan Ly Kho"
    [string] $DisplayName,

    # Cổng HTTPS của site IIS. Mỗi dự án trên cùng một máy cần một cổng riêng. Bỏ trống: giữ 8443
    [ValidateRange(1, 65535)]
    [int] $HttpsPort
)
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path "$PSScriptRoot\..").Path
$kebab = ($Name -creplace '(?<=[a-z0-9])([A-Z])', '-$1').ToLowerInvariant()
if (-not $DisplayName) { $DisplayName = $Name -creplace '(?<=[a-z0-9])([A-Z])', ' $1' }

# Mảng thay vì hashtable: khoá của hashtable không phân biệt hoa thường, còn String.Replace thì có.
# Mỗi dạng tên chỉ khớp đúng một quy tắc
$replacements = @(
    @('StarterKit', $Name),
    @('starter-kit', $kebab),
    @('starterkit', $Name.ToLowerInvariant()),
    @('Starter Kit', $DisplayName)
)

$skipDirectories = '.git', 'node_modules', 'bin', 'obj', 'dist', 'publish', '.angular', '.vs', 'logs', 'coverage', 'test-results', 'playwright-report'
$skipExtensions = '.ico', '.png', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', '.dll', '.exe', '.pdb', '.bak', '.zip'

function Get-SourceFiles([string] $Directory) {
    foreach ($item in Get-ChildItem -LiteralPath $Directory -Force) {
        if ($item.PSIsContainer) {
            if ($skipDirectories -notcontains $item.Name) { Get-SourceFiles $item.FullName }
        }
        # Bỏ qua chính script này: nội dung của nó chứa các tên cần đổi
        elseif ($skipExtensions -notcontains $item.Extension.ToLowerInvariant() -and $item.FullName -ne $PSCommandPath) {
            $item
        }
    }
}

# Tính hết thay đổi trong bộ nhớ trước, ghi file sau: chạy lại trên dự án đã đổi tên thì dừng mà không sửa gì
# (sinh lại UserSecretsId sẽ làm dự án mất liên kết với user-secrets đang có)
$utf8 = [System.Text.UTF8Encoding]::new($false, $true)
$pending = @()
$renamed = $false
foreach ($file in Get-SourceFiles $root) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    if ([Array]::IndexOf($bytes, [byte]0) -ge 0) { continue } # File nhị phân
    $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
    $offset = if ($hasBom) { 3 } else { 0 }
    try { $text = $utf8.GetString($bytes, $offset, $bytes.Length - $offset) } catch { continue } # Không phải UTF-8

    $updated = $text
    foreach ($pair in $replacements) { $updated = $updated.Replace($pair[0], $pair[1]) }
    if ($updated -ne $text) { $renamed = $true }
    if ($file.Name -eq 'API.csproj') {
        $updated = $updated -replace '<UserSecretsId>[^<]*</UserSecretsId>', "<UserSecretsId>$([guid]::NewGuid())</UserSecretsId>"
    }
    if ($HttpsPort -and $file.FullName -like '*\deploy\iis\*') {
        $updated = $updated.Replace('8443', "$HttpsPort")
    }

    # Đọc và ghi lại đúng kiểu mã hoá ban đầu: script PowerShell cần giữ BOM để Windows PowerShell 5.1 đọc được tiếng Việt
    if ($updated -ne $text) { $pending += @{ Path = $file.FullName; Text = $updated; Bom = $hasBom } }
}

if (-not $renamed) {
    throw 'Không tìm thấy tên StarterKit trong mã nguồn: dự án này đã được đổi tên rồi. Không có file nào bị sửa.'
}

$changes = foreach ($change in $pending) {
    [System.IO.File]::WriteAllText($change.Path, $change.Text, [System.Text.UTF8Encoding]::new($change.Bom))
    $change.Path.Substring($root.Length + 1)
}

Write-Host "Đã đổi tên trong $($changes.Count) file:" -ForegroundColor Green
$changes | Sort-Object | ForEach-Object { Write-Host "    $_" }
Write-Host ''
Write-Host "Tên: $Name | kebab: $kebab | hiển thị: $DisplayName" -ForegroundColor Cyan
Write-Host 'Bước tiếp theo:' -ForegroundColor Cyan
Write-Host '    1. Thư mục clone từ kit: xoá thư mục .git rồi chạy "git init" để bắt đầu lịch sử riêng.'
Write-Host '    2. .\scripts\setup-dev.ps1     (secret, database, package npm)'
Write-Host '    3. Xoá scripts\init-project.ps1: không cần nữa.'
