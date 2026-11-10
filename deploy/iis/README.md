# Triển khai lên IIS

Hướng dẫn chạy StarterKit trên IIS của một máy Windows, ở địa chỉ `https://localhost:8443`.

## Mô hình

```
Trình duyệt ── https://localhost:8443 ── Site StarterKit (1 app pool, ASP.NET Core chạy trong IIS)
                                          ├─ /api/*, /health/*  → controller của API
                                          └─ còn lại            → file Angular trong wwwroot; không có file thì trả index.html
```

API phục vụ luôn bản build Angular (xem `API/Startup/ClientAppConfiguration.cs`). Client và API chung một địa chỉ nên không cần CORS,
và IIS chỉ cần ASP.NET Core Module: không cần URL Rewrite, không cần ARR, không có site thứ hai.

App tự đặt cache và header bảo mật cho file Angular:

| File | Cache |
|---|---|
| `index.html` | `no-cache`: người dùng nhận bản mới ngay sau khi triển khai. Kèm `Content-Security-Policy` |
| File có mã hash trong tên (`main-MDJ4QYAQ.js`...) | 1 năm, `immutable` |
| File khác (`favicon.ico`) | 1 ngày |

File tĩnh được nén brotli/gzip. Response `/api` không nén, vì response có token (tránh tấn công BREACH).
`API/web.config` bỏ header `X-Powered-By` và `Server` của IIS.

## Cài một lần trên máy

| Thành phần | Tác dụng |
|---|---|
| IIS (Windows Features) | Web server |
| [.NET 10 Hosting Bundle](https://dotnet.microsoft.com/download/dotnet/10.0) | Chạy app .NET 10 trong IIS. Cài sau IIS; cài xong IIS tự khởi động lại nên các site khác gián đoạn vài giây |
| SQL Server, `sqlcmd` | Database |

Sau đó mở PowerShell **Run as Administrator** tại thư mục gốc repo:

```powershell
.\deploy\iis\setup-iis.ps1 -TrustCertificate
```

`-TrustCertificate` cho máy tin chứng chỉ `CN=localhost` tự ký. Chỉ dùng trên máy lập trình; máy chủ thật dùng chứng chỉ do công ty cấp, truyền qua `-CertificateThumbprint` và bỏ tham số này.

Script tạo:

- Site và app pool `StarterKit`, thư mục `C:\inetpub\StarterKit` (app chỉ có quyền đọc, riêng `logs\` được ghi).
- Database `StarterKitLocal`. App pool đăng nhập SQL bằng Windows (`IIS APPPOOL\StarterKit`) nên không có mật khẩu trong cấu hình.
- Biến môi trường của app pool: connection string, khoá JWT, mật khẩu admin đầu tiên.
- Mật khẩu admin đầu tiên trong `%USERPROFILE%\StarterKit-admin-password.txt`. Đăng nhập, đổi mật khẩu rồi xoá file này.

## Mỗi lần cập nhật

```powershell
.\deploy\iis\publish.ps1   # tạo gói trong publish/: app (API + Angular trong wwwroot) và migrate.sql. Không đụng IIS
.\deploy\iis\deploy.ps1    # tạm dừng app, backup database, cập nhật database, chép file, chạy lại, kiểm tra
```

`deploy.ps1` tự backup database ngay trước khi chạy migration: bản `COPY_ONLY` (không làm lệch chuỗi backup sẵn có) trong thư mục backup mặc định của SQL Server,
tên dạng `StarterKitLocal-20261110-093012.bak`, giữ 5 bản gần nhất (`-KeepBackups`). Nơi DBA đã tự backup trước khi triển khai thì truyền `-SkipBackup`.

Migration lỗi thì app vẫn ở trang bảo trì và file cũ chưa bị thay: sửa lỗi rồi chạy lại, hoặc restore từ bản backup vừa tạo.

## Backup hằng ngày

Bản backup lúc triển khai không thay cho backup định kỳ. SQL Server Express không có SQL Agent, nên đặt lịch bằng Task Scheduler,
chạy bằng một tài khoản Windows có quyền backup database (sysadmin, hoặc `db_backupoperator` trên database). Không dùng `SYSTEM`:
từ SQL Server 2012 tài khoản này mặc định không có quyền backup.

```powershell
$sql = "DECLARE @f nvarchar(400) = N'D:\Backup\StarterKitLocal-' + FORMAT(SYSDATETIME(), 'yyyyMMdd') + N'.bak'; BACKUP DATABASE [StarterKitLocal] TO DISK = @f WITH CHECKSUM, INIT;"
$action = New-ScheduledTaskAction -Execute 'sqlcmd.exe' -Argument "-S localhost\SQLEXPRESS -E -C -b -Q `"$sql`""
Register-ScheduledTask -TaskName 'StarterKit backup' -Action $action -Trigger (New-ScheduledTaskTrigger -Daily -At 1am) `
    -User "$env:USERDOMAIN\$env:USERNAME" -Password (Read-Host 'Mật khẩu Windows của tài khoản này') -RunLevel Highest
```

Thư mục `D:\Backup` phải cho tài khoản dịch vụ SQL Server ghi được (chính dịch vụ SQL Server ghi file backup), và nên được chép sang máy khác.
Thỉnh thoảng thử restore một bản để chắc backup dùng được.

## Xem và đổi cấu hình

Secret không nằm trong repo hay `web.config`. Xem tên các biến trong app pool (không in giá trị):

```powershell
(Get-IISAppPool StarterKit).GetChildElement('environmentVariables').GetCollection() | ForEach-Object { $_['name'] }
```

Đổi cấu hình khác (như `Export__MaxRows`, `Lockout__MaxFailedAttempts`) cũng bằng biến môi trường của app pool, rồi recycle app pool. Dấu `__` thay cho `:` trong tên khoá.

## Khi có lỗi

| Hiện tượng | Xem ở đâu |
|---|---|
| HTTP 500.19 | `web.config` có mục IIS không nhận: thường do chưa cài Hosting Bundle, hoặc IIS cũ hơn bản 10 |
| HTTP 500.30, 500.31 | App không khởi động được: Event Viewer > Windows Logs > Application, nguồn `IIS AspNetCore Module V2` |
| Lỗi nghiệp vụ, lỗi 5xx có mã tra cứu | `C:\inetpub\StarterKit\logs`, tìm theo mã tra cứu (traceId) |
| Đăng nhập được nhưng F5 thì mất phiên | Cookie `Secure` không được đặt: kiểm tra đang mở bằng `https` |
| Mở `/categories` hay F5 bị 404 | Thiếu `wwwroot\index.html` trong thư mục app: chạy lại `publish.ps1` rồi `deploy.ps1` |

Kiểm tra nhanh trên máy: `https://localhost:8443/health/ready`.

## Chuyển từ bản 2 site (trước 11/2026)

Bản cũ dùng 2 site (`StarterKit` phục vụ Angular, `StarterKitApi` nghe ở `127.0.0.1:8091`) nối với nhau bằng ARR. Chạy lại `setup-iis.ps1` là đủ:

- Biến môi trường của app pool `StarterKitApi` (connection string, khoá JWT...) được chép sang app pool `StarterKit`, nên phiên đăng nhập và cấu hình được giữ.
- Site `StarterKitApi`, app pool `StarterKitApi` và `StarterKitClient` bị gỡ; site `StarterKit` trỏ sang thư mục và app pool mới.
- Lần `deploy.ps1` đầu tiên xoá hai thư mục cũ `client\` và `api\`.

Không còn site nào dùng URL Rewrite và ARR thì gỡ được hai thành phần này trong Apps & features. Login SQL cũ không còn dùng:
`DROP USER [IIS APPPOOL\StarterKitApi]` trong database, rồi `DROP LOGIN [IIS APPPOOL\StarterKitApi]`.

## Gỡ bỏ

```powershell
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
& $appcmd delete site StarterKit
& $appcmd delete apppool StarterKit
```

Sau đó xoá thư mục `C:\inetpub\StarterKit` và database `StarterKitLocal` nếu không dùng nữa.
