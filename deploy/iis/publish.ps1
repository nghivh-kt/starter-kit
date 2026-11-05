<#
.SYNOPSIS
    Tạo gói triển khai trong thư mục publish/ ở gốc repo. Không đụng gì tới IIS hay database.
    Kết quả: publish/api (API), publish/client (Angular), publish/migrate.sql (cập nhật database).
#>
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$output = Join-Path $root 'publish'

function Invoke-Checked([string] $Title, [scriptblock] $Command) {
    Write-Host "==> $Title" -ForegroundColor Cyan
    # Công cụ build hay in cảnh báo ra stderr: chỉ dựa vào mã thoát để biết có lỗi hay không
    $ErrorActionPreference = 'Continue'
    & $Command
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw "$Title thất bại (mã $LASTEXITCODE)" }
}

if (Test-Path $output) { Remove-Item $output -Recurse -Force }
New-Item -ItemType Directory -Path $output | Out-Null

Invoke-Checked 'Build API' {
    dotnet publish "$root\API\API.csproj" -c Release -o "$output\api" --nologo --verbosity quiet
}

Push-Location "$root\Client"
try {
    Invoke-Checked 'Build Client' { npm run build }
}
finally {
    Pop-Location
}
Copy-Item "$root\Client\dist\starter-kit-client\browser" "$output\client" -Recurse

# Công cụ EF cần khởi động cấu hình của app nhưng không kết nối database khi tạo script.
# Các giá trị giả này chỉ tồn tại trong tiến trình của script.
$env:ConnectionStrings__DefaultConnection = 'Server=.;Database=PublishOnly'
$env:JwtSettings__SecretKey = 'publish-only-not-a-real-key-at-least-32-bytes'
Push-Location "$root\API"
try {
    Invoke-Checked 'Khôi phục công cụ dotnet-ef' { dotnet tool restore --verbosity quiet }
    Invoke-Checked 'Tạo script migration' {
        dotnet ef migrations script --idempotent --output "$output\migrate.sql" --no-color
    }
}
finally {
    Pop-Location
    Remove-Item Env:ConnectionStrings__DefaultConnection, Env:JwtSettings__SecretKey -ErrorAction SilentlyContinue
}

Write-Host "Xong. Gói triển khai: $output" -ForegroundColor Green
