# StarterKit

Bộ khung fullstack cho ứng dụng quản trị nội bộ: **ASP.NET Core Web API** (.NET 10, SQL Server) và **Angular 22**,
chạy chung một địa chỉ và triển khai trên **một site IIS**. Dùng làm điểm khởi đầu cho dự án mới.

Có sẵn:
- Đăng nhập JWT, refresh token trong cookie HttpOnly (rotate, phát hiện dùng lại), khoá tạm tài khoản khi nhập sai mật khẩu nhiều lần.
- Quản lý người dùng và vai trò; module mẫu Danh mục: phân trang, tìm kiếm và sắp xếp trên URL, xuất Excel, chống ghi đè khi hai người cùng sửa.
- AuditLog và xoá mềm tự động; EF Core và Dapper dùng chung transaction; mọi lỗi theo chuẩn Problem Details.
- Kiểu TypeScript sinh từ OpenAPI của API; giao diện dùng design token và đạt kiểm tra accessibility.
- Test: API (xUnit, SQL Server thật), Client (Vitest), trình duyệt (Playwright + axe).

## Cần cài

| Công cụ | Phiên bản |
|---|---|
| .NET SDK | 10 (`global.json` chọn bản 10 mới nhất có trên máy) |
| Node | 22 (`Client/.nvmrc`) |
| SQL Server | Express trở lên; thêm `sqlcmd` nếu triển khai lên IIS |

## Bắt đầu

### Tạo dự án mới từ kit

Mở PowerShell tại thư mục sẽ chứa dự án mới (thư mục cha, nơi bạn để các dự án), rồi chạy lần lượt:

```powershell
# 1. Tại thư mục cha: tải kit vào một thư mục mới mang tên dự án
git clone <địa chỉ repo kit> QuanLyKho

# 2. Vào thư mục gốc của dự án mới. Mọi lệnh bên dưới đều chạy tại đây
cd QuanLyKho

# 3. Bỏ lịch sử git của kit, bắt đầu lịch sử riêng
Remove-Item .git -Recurse -Force; git init

# 4. Chỉ cần lần đầu trên máy, khi Windows báo "running scripts is disabled on this system"
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# 5. Đổi tên kit thành tên dự án, rồi cài môi trường dev
.\scripts\init-project.ps1 -Name QuanLyKho -DisplayName 'Quản lý kho'
.\scripts\setup-dev.ps1
```

- **Đứng đúng thư mục.** `.\scripts\...` là đường dẫn tính từ thư mục hiện tại, nên phải đứng ở thư mục gốc của dự án: thư mục có `API\`, `Client\`, `scripts\`.
  Kiểm tra bằng `Test-Path .\scripts\init-project.ps1`, kết quả phải là `True`. Gõ thiếu `.\` thì PowerShell báo không tìm thấy lệnh, vì nó không tự tìm script trong thư mục hiện tại.
- **`-Name` viết PascalCase:** bắt đầu bằng chữ hoa, chỉ gồm chữ không dấu và số, ví dụ `QuanLyKho` (không phải `quan-ly-kho`).
  Script tự sinh các dạng `quan-ly-kho` và `quanlykho`. `-DisplayName` là tên hiển thị, viết có dấu được.
- **Không muốn đổi execution policy của máy:** bỏ bước 4 và chạy từng script qua `powershell -ExecutionPolicy Bypass -File`,
  ví dụ `powershell -ExecutionPolicy Bypass -File .\scripts\init-project.ps1 -Name QuanLyKho -DisplayName 'Quản lý kho'`.
- **Kit tải về dạng file zip thay vì clone:** chạy thêm `Get-ChildItem -Recurse *.ps1 | Unblock-File` ở thư mục gốc, nếu không Windows vẫn chặn các script tải từ Internet.

`init-project.ps1` đổi mọi dạng tên StarterKit (cookie, JWT issuer, tên site IIS, database, tiêu đề trang...) và sinh `UserSecretsId` mới,
để các dự án trên cùng một máy không dùng chung secret. Mỗi dự án chạy trên cùng một máy IIS cần cổng HTTPS riêng: thêm `-HttpsPort 8444`.

### Cài trên máy mới (dự án đã có)

```powershell
.\scripts\setup-dev.ps1        # chạy tại thư mục gốc của dự án. Tham số: -SqlServer, -Database, -WithE2E (tải trình duyệt cho Playwright), -Force
```

Script kiểm tra .NET và Node, đặt user-secrets còn thiếu (connection string dùng Windows auth, khoá JWT và mật khẩu admin ngẫu nhiên),
tạo database bằng migration và cài package npm. Chạy lại vẫn an toàn: secret đã có thì giữ nguyên.

### Chạy

```powershell
cd API;    dotnet run --launch-profile http     # http://localhost:5157/swagger, /health/ready
cd Client; npm start                            # http://localhost:4200
```

`ng serve` chuyển `/api` sang API theo `Client/proxy.conf.json`, nên trình duyệt thấy một địa chỉ duy nhất như khi chạy thật.

**Tài khoản quản trị:** không có mật khẩu mặc định. Khi bảng `Users` còn rỗng và migration đã chạy xong, lần khởi động API tiếp theo
tạo user `admin` với mật khẩu lấy từ `Seed:AdminPassword` (`setup-dev.ps1` in ra mật khẩu này). Khi đã có user, đổi `Seed:AdminPassword`
không còn tác dụng; đổi mật khẩu trong app (menu tài khoản > Đổi mật khẩu).

Trên server, cấu hình đặt bằng biến môi trường thay cho user-secrets (`ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey`, ...).
Cấu hình sai hoặc thiếu (SecretKey < 32 byte, thời hạn token ngoài khoảng cho phép...) làm ứng dụng dừng ngay khi khởi động,
kèm thông báo rõ ràng (Options pattern + `ValidateOnStart`).

## Lệnh thường dùng

| Lệnh | Chạy ở | Việc |
|---|---|---|
| `dotnet test` | gốc repo | Test API trên SQL Server thật (xem bên dưới) |
| `npm test` | `Client/` | Unit test bằng Vitest |
| `npm run lint` | `Client/` | ESLint, gồm quy tắc accessibility của template |
| `npm run e2e` | `Client/` | Playwright với API và SQL Server thật (xem `Client/README.md`) |
| `npm run api:gen` | `Client/` | Sinh lại `API/openapi.json` và kiểu TypeScript sau khi đổi controller hoặc DTO |
| `.\deploy\iis\publish.ps1`, `.\deploy\iis\deploy.ps1` | gốc repo | Tạo gói rồi triển khai lên IIS (xem `deploy/iis/README.md`) |

Test API chạy API thật trên SQL Server thật, không dùng user-secrets:

```powershell
# Server có sẵn: mỗi lần chạy tạo database tạm StarterKit_Test_* và xoá khi xong. Tài khoản cần quyền tạo database
$env:TEST_SQL_CONNECTION='Server=localhost\SQLEXPRESS;Integrated Security=True;TrustServerCertificate=True;'
dotnet test

# Không đặt biến trên: Testcontainers tự chạy SQL Server (cần Docker ở chế độ Linux containers)
dotnet test
```

Tắt API đang chạy trước khi test, nếu không `API.exe` bị khoá và build sẽ lỗi.

## Cấu trúc

```
API/                API ASP.NET Core (chi tiết bên dưới)
API.Tests/          Test API: xUnit + WebApplicationFactory + SQL Server thật
Client/             Angular (xem Client/README.md)
deploy/iis/         Script và hướng dẫn triển khai IIS (xem deploy/iis/README.md)
scripts/            init-project.ps1 (tạo dự án mới), setup-dev.ps1 (cài máy dev)
global.json         Chọn .NET SDK 10
```

```
API/
├── Controllers/            Nhận request, trả response
├── Services/               Nghiệp vụ
│   ├── Interfaces/
│   ├── Implementations/
│   ├── Validators/         FluentValidation (tự chạy qua FluentValidationFilter)
│   └── Background/         Việc chạy nền theo lịch (dọn refresh token hết hạn)
├── Data/                   Truy cập dữ liệu
│   ├── Configurations/     Cấu hình entity EF (index, độ dài cột)
│   ├── Extensions/         QueryableExtensions (lọc, tìm kiếm, sắp xếp, phân trang)
│   ├── Interfaces/ · Repositories/   GenericRepository, UnitOfWork, DapperRepository
│   └── Migrations/
├── Models/                 Entities, DTOs (không phụ thuộc tầng nào)
├── Common/                 Dùng chung: Security (JWT, UserContext, Roles, rate limit, khoá tạm tài khoản),
│                           Exceptions (GlobalExceptionHandler), Filters, Mappings (Mapster), Helpers (Excel, phân trang)
├── Startup/                Cấu hình khởi động, mỗi file 1 mảng (Database, ApplicationServices, Api, ClientApp, Swagger,
│                           Logging, HealthCheck, AdminSeed, BackgroundJobs, Pipeline = thứ tự middleware)
├── web.config              Cấu hình IIS (bỏ header Server, X-Powered-By)
└── Program.cs              Chỉ gọi các extension trong Startup/: đọc 1 màn hình là thấy toàn bộ cấu hình
```

Hướng phụ thuộc: `Controllers → Services → Data → Models`, và mọi tầng có thể dùng `Common`.
`Startup/` là nơi ghép mọi thứ lại nên được phép biết tất cả các tầng; không tầng nào khác được dùng `Startup/`.

## Thêm một module mới

Copy theo mẫu Danh mục (Category), từ API sang Client:

| Bước | File mẫu | Việc cần làm |
|---|---|---|
| 1 | `API/Models/Entities/Category.cs` | Entity kế thừa `AuditableEntity`: có xoá mềm, AuditLog, `RowVersion` |
| 2 | `API/Data/Configurations/CategoryConfiguration.cs` | Index, độ dài cột |
| 3 | `API/Data/EFDbContext.cs` | Thêm `DbSet<>` |
| 4 | `API/Models/DTOs/CategoryDto.cs` | `XxxResponse`, `XxxCreateRequest`, `XxxUpdateRequest`, `XxxQueryRequest` (kế thừa `PagedListQueryBase`) |
| 5 | `API/Services/Validators/CategoryValidators.cs` | Quy tắc validate |
| 6 | `API/Services/Interfaces/ICategoryService.cs`, `API/Services/Implementations/CategoryService.cs` | Nghiệp vụ; `SortColumns` là danh sách cột được phép sắp xếp |
| 7 | `API/Controllers/CategoriesController.cs` | Endpoint. Route viết thường, khai báo mọi response bằng `[ProducesResponseType]` (nguồn sinh kiểu TypeScript) |
| 8 | `API/Startup/ApplicationServicesConfiguration.cs` | `AddScoped<IXxxService, XxxService>()` |
| 9 | Migration | Lệnh bên dưới |
| 10 | `Client/`: `npm run api:gen` | Sinh kiểu TypeScript mới |
| 11 | `Client/src/app/core/api/index.ts` | Tên ngắn cho kiểu mới (`XxxResponse`, `XxxPage`...) |
| 12 | `Client/src/app/features/categories/` | Copy cả thư mục rồi đổi tên: service gọi API, `-list` (bảng, cột, quyền; trang, tìm kiếm, sắp xếp nằm trên URL), `-form` (field và validator khớp với API), `*.routes.ts` (thêm `roleGuard` nếu giới hạn vai trò) |
| 13 | `Client/src/app/app.routes.ts`, `Client/src/app/core/navigation/navigation.ts` | Khai báo route; thêm một dòng menu, menu bên trái và trang chủ tự cập nhật |

```bash
# Trong API/. PowerShell: $env:ASPNETCORE_ENVIRONMENT="Development"
ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add AddXxx -o Data/Migrations
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update
```

**Chống ghi đè lẫn nhau:** entity kế thừa `AuditableEntity` có `RowVersion`. Trả nó trong `XxxResponse`, nhận lại trong `XxxUpdateRequest`, rồi so sánh trong service như `CategoryService.UpdateAsync`. Hai người cùng sửa thì người lưu sau nhận 409; form Client báo lỗi và tải lại danh sách.

## Quy ước

- **Lỗi nghiệp vụ**: không tự trả `BadRequest(...)`/`NotFound(...)` trong controller, mà ném exception từ service.
  `GlobalExceptionHandler` (`IExceptionHandler`) chuyển thành **Problem Details** (RFC 9457, `application/problem+json`).
- **Phân quyền**: mặc định mọi endpoint yêu cầu đăng nhập (FallbackPolicy). Dùng `[AllowAnonymous]` để mở,
  `[Authorize(Roles = Roles.Admin)]` để giới hạn. Role khai báo trong `Common/Security/Roles.cs`.
- **Validation**: FluentValidation là nguồn thông báo duy nhất (tiếng Việt); `[Required]` ngầm định của .NET đã tắt,
  nên mọi field string bắt buộc của request phải có `NotEmpty()` trong validator. Validator chỉ kiểm tra định dạng;
  kiểm tra cần truy vấn DB (trùng tên, tồn tại...) đặt trong service.
- **Đặt tên DTO**: `XxxCreateRequest`, `XxxUpdateRequest`, `XxxQueryRequest`, `XxxResponse`. `PUT` trả 200 kèm bản ghi sau khi sửa.
- **Mapping**: Mapster tự map property trùng tên; cấu hình đặc biệt viết trong `Common/Mappings/MappingConfig.cs`.
- **Transaction**: `IUnitOfWork.ExecuteInTransactionAsync` bọc cả lệnh EF và Dapper. Lệnh ghi qua Dapper không có AuditLog,
  không tự gán `CreatedAt`/`UpdatedAt`; lỗi unique/khoá ngoại vẫn trả 409 và `DateTime` đọc lên vẫn là UTC như EF.
- **Truy vấn danh sách** (`Data/Extensions/QueryableExtensions.cs`): lọc bằng `WhereIf(request.X.HasValue, x => x.X == request.X)`
  để giá trị thành tham số SQL; tìm kiếm bằng `ApplySearch`; sắp xếp bằng `ApplySorting(request.SortBy, request.Desc, SortColumns)`.
  `SortColumns` là danh sách cột được phép (xem `CategoryService`): cột khác bị bỏ qua và sắp theo `Id`.
  `ApplySorting` tự thêm khoá phụ `Id` để phân trang ổn định khi nhiều dòng trùng giá trị sắp xếp.
- **Entity kế thừa `AuditableEntity`** — `EFDbContext` tự làm, service không cần viết:
  - `CreatedAt` / `UpdatedAt` được gán khi thêm / sửa.
  - `Repository.Delete(entity)` thành **xoá mềm** (`IsActive = false`, `DeletedAt = now`); bản ghi đã xoá tự bị ẩn khỏi
    mọi truy vấn (global query filter). Cần xem lại: `.IgnoreQueryFilters()`. Cần xoá thật: `ExecuteDeleteAsync`.
  - Mọi thay đổi được ghi vào bảng `AuditLogs` (ai, lúc nào, IP, giá trị cũ/mới; cột nhạy cảm như `PasswordHash` chỉ ghi tên cột).
- **Đọc và ghi qua repository**: đọc (hiển thị, xuất file) bằng `Query()`, không tracking nên nhanh hơn. Mọi thao tác ghi dùng `QueryForEdit()`:
  lấy entity, sửa property rồi `SaveChangesAsync` (EF chỉ UPDATE cột thật sự đổi), `Delete`, hoặc `ExecuteUpdateAsync`/`ExecuteDeleteAsync`.
  Sửa entity lấy từ `Query()` thì `SaveChangesAsync` không lưu gì và không báo lỗi. Repository cố ý không có `Update(entity)`:
  lệnh này UPDATE mọi cột (cột nào object thiếu thì bị ghi đè thành rỗng) và AuditLog mất giá trị cũ.
- **Thời gian**: luôn lưu UTC. Lấy giờ hiện tại qua `TimeProvider` (inject), viết `_timeProvider.GetUtcNow().UtcDateTime`,
  **không** dùng `DateTime.UtcNow`/`DateTime.Now`: khi viết test có thể thay bằng `FakeTimeProvider` để tua thời gian.
  Giá trị đọc từ DB được đánh dấu UTC nên JSON luôn có hậu tố `Z`; client tự đổi sang giờ địa phương khi hiển thị.
- **Logging**: Serilog, cấu hình trong mục `Serilog` của `appsettings.json`. Ghi ra Console và `logs/log-yyyyMMdd.txt`
  (giữ 30 ngày), mỗi request 1 dòng kèm IP, user, status, thời gian xử lý.

## Định dạng lỗi (Problem Details)

Mọi lỗi đều có cùng khuôn, kể cả 401/403/404 do framework sinh ra:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Danh mục 'ABC' đã tồn tại.",
  "instance": "POST /api/categories",
  "code": "BUSINESS_ERROR",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

- `detail`: thông báo để **hiển thị** cho người dùng.
- `code`: mã lỗi để client **phân nhánh** (không so chuỗi `detail`). Danh sách ở `Common/Exceptions/ErrorCodes.cs`.
- Lỗi validation có thêm `errors` (key dạng camelCase):
  `{ ..., "status": 400, "code": "VALIDATION_ERROR", "errors": { "name": ["Tên danh mục là bắt buộc."] } }`

**Nguyên tắc:** lỗi dành cho người dùng thì ném một `AppException` (`Common/Exceptions/AppExceptions.cs`).
Mọi exception khác (của .NET, thư viện, bug) đều là **500** và message bị ẩn, để không lộ thông tin nội bộ.

| Nguồn lỗi | Status | code |
|---|---|---|
| Validation (FluentValidation, model binding, `ValidateAndThrowAsync`) | 400 + `errors` | `VALIDATION_ERROR` |
| `BusinessException` | 400 | `BUSINESS_ERROR` |
| `UnauthorizedException`, thiếu/sai token | 401 | `UNAUTHORIZED` |
| `ForbiddenException`, thiếu quyền | 403 | `FORBIDDEN` |
| `NotFoundException`, sai route | 404 | `NOT_FOUND` |
| `ConflictException`; DB vi phạm unique / khoá ngoại / concurrency | 409 (không lộ lỗi SQL) | `CONFLICT` |
| Vượt rate limit | 429 + header `Retry-After` | `TOO_MANY_REQUESTS` |
| Tài khoản đang khoá tạm do nhập sai mật khẩu nhiều lần | 429 | `ACCOUNT_LOCKED` |
| Còn lại (kể cả `ArgumentException`, `KeyNotFoundException`, lỗi SQL khác như timeout, deadlock) | 500, `detail` chung chung; chỉ Development có thêm `exception` | `INTERNAL_ERROR` |

`traceId` trùng với cột `{TraceId}` trong log phía server: tìm đúng chuỗi này trong `logs/log-*.txt` để tra lỗi khi người dùng báo.

## Authentication

| Endpoint | Mô tả |
|---|---|
| `POST /api/auth/login` | Trả access token (5 phút) và đặt cookie HttpOnly chứa refresh token (7 ngày) |
| `POST /api/auth/refresh` | Đổi refresh token (cookie) lấy access token mới; refresh token được rotate mỗi lần |
| `POST /api/auth/logout` | Thu hồi refresh token hiện tại |
| `POST /api/auth/logout-all` | Thu hồi mọi phiên của user |
| `POST /api/auth/change-password` | Đổi mật khẩu; mọi phiên bị thu hồi, client phải đăng nhập lại |
| `GET /api/auth/me` | Thông tin user hiện tại |

Cơ chế bảo vệ:
- **Rotate + phát hiện dùng lại**: mỗi lần refresh cấp token mới. Dùng lại token cũ sau 30 giây (dấu hiệu bị đánh cắp)
  ⇒ thu hồi toàn bộ phiên của user. Nhiều request refresh song song cùng 1 token ⇒ chỉ đúng 1 request thành công.
- **Rate limit** theo IP, vượt ⇒ 429: `login` và `change-password` dùng chung 10 lần/phút (`RateLimiting:Login`);
  `refresh` 120 lần/phút (`RateLimiting:Refresh`) vì mỗi user đang hoạt động tự gọi đều đặn theo hạn access token.
  Nhiều user sau 1 IP dùng chung bộ đếm, nên chỉnh theo số user dự kiến. Bộ đếm nằm trong bộ nhớ của từng instance.
- **Chống dò tài khoản**: sai username và sai mật khẩu trả cùng thông báo, cùng thời gian xử lý.
- **Khoá tạm theo tài khoản**: nhập sai mật khẩu 10 lần liên tiếp (đăng nhập hoặc đổi mật khẩu) ⇒ khoá 15 phút, trả 429 `ACCOUNT_LOCKED`
  (`Lockout:MaxFailedAttempts`, `Lockout:LockoutMinutes`). Bổ sung cho rate limit theo IP, vốn không chặn được người thử chậm vào một tài khoản.
  Trong lúc khoá, API không kiểm tra mật khẩu nên không dò được mật khẩu đúng. Đăng nhập đúng đưa bộ đếm về 0; admin mở khoá sớm bằng
  `PUT /api/users/{id}/unlock` hoặc đặt lại mật khẩu. Bộ đếm cập nhật bằng `ExecuteUpdate`, nên lần gõ sai không sinh AuditLog. Phiên đang đăng nhập không bị thu hồi.
- **Cookie** refresh token: `HttpOnly`, `Secure`, `SameSite`, `Path=/api/auth` (không gửi kèm các API khác).
  `CookieSameSite`: `Strict` (mặc định) khi client và API cùng site; `None` khi khác site (bắt buộc `CookieSecure = true`),
  khi đó `refresh`/`logout` trả 403 nếu header `Origin` không nằm trong `Cors:AllowedOrigins`.
- Khoá tài khoản, đặt lại / đổi mật khẩu ⇒ thu hồi mọi refresh token.
- **Dọn bảng `RefreshTokens`**: mỗi lần refresh sinh một dòng, nên một job chạy trong API (`Services/Background`, đăng ký ở
  `Startup/BackgroundJobsConfiguration.cs`) xoá token đã hết hạn quá 30 ngày (`Cleanup:RefreshTokenRetentionDays`),
  một phút sau khi app khởi động rồi mỗi 24 giờ. SQL Server Express không có SQL Agent nên việc này nằm trong app.

Cấu hình thời hạn token và cookie trong `JwtSettings` / `RefreshTokenSettings` của `appsettings.json`.

## Triển khai (production)

Triển khai lên IIS: xem [deploy/iis/README.md](deploy/iis/README.md). Gói triển khai là một thư mục: API kèm bản build Angular
trong `wwwroot`, chạy trên **một site IIS** (`Startup/ClientAppConfiguration.cs`); `deploy.ps1` tự backup database trước khi chạy migration.

- Đặt `ASPNETCORE_ENVIRONMENT=Production` (mặc định) và cấu hình qua biến môi trường.
- Ngoài Development ứng dụng bật **HSTS + HTTPS redirection**. Chạy trong IIS thì app thấy thẳng IP thật của client và HTTPS, không cần cấu hình gì thêm.
  Nếu đặt sau một reverse proxy khác (Nginx, load balancer) mà TLS kết thúc ở proxy, thì khai báo IP proxy trong `ForwardedHeaders:KnownProxies`, hoặc dải mạng trong `ForwardedHeaders:KnownNetworks` (ví dụ `10.0.0.0/8`)
  khi IP proxy thay đổi như Docker/Kubernetes/cloud LB. Thiếu bước này thì app thấy mọi người dùng là IP của proxy:
  rate limit tính chung cho tất cả, AuditLog ghi sai IP và có thể lặp redirect HTTPS.
- Load balancer / giám sát: `/health/live` (tiến trình còn sống), `/health/ready` (kết nối được DB). Không cần đăng nhập.
- Database: chạy migration bằng `dotnet ef database update` hoặc xuất script `dotnet ef migrations script --idempotent`
  để DBA chạy; ứng dụng không tự migrate khi khởi động.
