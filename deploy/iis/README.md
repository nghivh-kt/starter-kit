# Triển khai lên IIS

Hướng dẫn chạy StarterKit trên IIS của một máy Windows, ở địa chỉ `https://localhost:8443`.

## Mô hình

```
Trình duyệt ── https://localhost:8443
      │
      ▼
 Site StarterKit (public)
  ├─ /api/...  ──> ARR chuyển tiếp ──> Site StarterKitApi (chỉ nghe 127.0.0.1:8091) ──> SQL Server
  └─ còn lại   ──> file Angular
```

Client và API chung một địa chỉ nên không cần CORS. Không dùng sub-application `/api`, vì route của controller đã có sẵn tiền tố `api/`.

## Cài một lần trên máy

Cần các thành phần sau; cài xong, IIS tự khởi động lại nên các site khác gián đoạn vài giây.

| Thành phần | Tác dụng |
|---|---|
| IIS (Windows Features) | Web server |
| [.NET 10 Hosting Bundle](https://dotnet.microsoft.com/download/dotnet/10.0) | Chạy API .NET 10 trong IIS |
| [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite) | Quy tắc điều hướng trong `web.config` |
| [Application Request Routing 3.0](https://www.iis.net/downloads/microsoft/application-request-routing) | Chuyển tiếp `/api` sang site API |
| SQL Server, `sqlcmd` | Database |

Sau đó mở PowerShell **Run as Administrator** tại thư mục gốc repo:

```powershell
.\deploy\iis\setup-iis.ps1 -TrustCertificate
```

`-TrustCertificate` cho máy tin chứng chỉ `CN=localhost` tự ký. Chỉ dùng trên máy lập trình; máy chủ thật dùng chứng chỉ do công ty cấp, truyền qua `-CertificateThumbprint` và bỏ tham số này.

Script tạo:

- 2 site và 2 app pool: `StarterKit`, `StarterKitClient`, `StarterKitApi`.
- Thư mục `C:\inetpub\StarterKit\{client,api}`.
- Database `StarterKitLocal`. App pool đăng nhập SQL bằng Windows nên không có mật khẩu trong cấu hình.
- Biến môi trường của app pool: connection string, khoá JWT, mật khẩu admin đầu tiên.
- Mật khẩu admin đầu tiên trong `%USERPROFILE%\StarterKit-admin-password.txt`. Đăng nhập, đổi mật khẩu rồi xoá file này.

## Mỗi lần cập nhật

```powershell
.\deploy\iis\publish.ps1   # tạo gói trong publish/, không đụng IIS
.\deploy\iis\deploy.ps1    # tạm dừng API, cập nhật database, chép file, chạy lại, kiểm tra
```

Trên dữ liệu thật, **backup database trước** khi chạy `deploy.ps1`.

## Xem và đổi cấu hình

Secret không nằm trong repo hay `web.config`. Xem tên các biến trong app pool:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" list apppool StarterKitApi /text:environmentVariables.[*]
```

Đổi cấu hình khác của API (như `Export__MaxRows`) cũng bằng biến môi trường của app pool, rồi recycle app pool. Dấu `__` thay cho `:` trong tên khoá.

Đổi cổng API thì sửa đồng thời: quy tắc `API` trong `Client/src/web.config` và tham số của cả hai script.

## Khi có lỗi

| Hiện tượng | Xem ở đâu |
|---|---|
| HTTP 500.19 | `web.config` có mục IIS không nhận: thường do thiếu URL Rewrite |
| HTTP 500.30, 500.31 | API không khởi động được: Event Viewer > Windows Logs > Application, nguồn `IIS AspNetCore Module V2` |
| HTTP 502.3 ở `/api` | Site API không chạy, hoặc sai cổng trong `web.config` |
| Lỗi nghiệp vụ, lỗi 5xx có mã tra cứu | `C:\inetpub\StarterKit\api\logs`, tìm theo mã tra cứu (traceId) |
| Đăng nhập được nhưng F5 thì mất phiên | Cookie `Secure` không được đặt: kiểm tra đang mở bằng `https` |

Kiểm tra API trực tiếp trên máy: `http://127.0.0.1:8091/health/ready`. Gọi trực tiếp như vậy sẽ để lại cảnh báo `Failed to determine the https port` trong log; đây là bình thường vì request không đi qua site public.

## Gỡ bỏ

```powershell
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
& $appcmd delete site StarterKit
& $appcmd delete site StarterKitApi
& $appcmd delete apppool StarterKitClient
& $appcmd delete apppool StarterKitApi
```

Sau đó xoá thư mục `C:\inetpub\StarterKit` và database `StarterKitLocal` nếu không dùng nữa.
