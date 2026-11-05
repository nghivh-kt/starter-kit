# StarterKit API

Khung ASP.NET Core Web API (.NET 10) dùng làm điểm khởi đầu cho dự án mới. Có sẵn đăng nhập JWT + Refresh Token,
quản lý User, AuditLog tự động, EF Core + Dapper dùng chung transaction, và một module CRUD mẫu (Category).

## Yêu cầu
- .NET 10 SDK
- SQL Server (Express trở lên)

## Chạy lần đầu

```bash
cd API
dotnet tool restore

# 1. Cấu hình bí mật (lưu ngoài source code, chỉ trên máy bạn)
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "server=localhost\SQLEXPRESS;database=StarterKitDB;User Id=sa;Password=<mật khẩu>;TrustServerCertificate=True;"
dotnet user-secrets set "JwtSettings:SecretKey" "<chuỗi ngẫu nhiên tối thiểu 32 ký tự>"
dotnet user-secrets set "Seed:AdminPassword" "<mật khẩu admin, tối thiểu 8 ký tự>"

# 2. Tạo database (user-secrets chỉ được nạp ở môi trường Development)
#    PowerShell: $env:ASPNETCORE_ENVIRONMENT="Development"
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update

# 3. Chạy
dotnet run --launch-profile http
```

Swagger: http://localhost:5157/swagger · Health check: http://localhost:5157/health/ready

**Tài khoản quản trị:** không có mật khẩu mặc định. Khi bảng `Users` còn rỗng và migration đã chạy xong, lần khởi động tiếp theo
tạo user `admin` với mật khẩu lấy từ `Seed:AdminPassword`. Nếu chưa cấu hình, app bỏ qua bước này, chỉ ghi 1 dòng vào log, và chưa có tài khoản nào đăng nhập được.
Khi đã có user, đổi `Seed:AdminPassword` không còn tác dụng; đổi mật khẩu bằng `POST /api/auth/change-password`.

Trên server, đặt cấu hình bằng biến môi trường thay cho user-secrets:
`ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey`, `Seed__AdminPassword`, `Cors__AllowedOrigins__0`, ...
Cấu hình sai hoặc thiếu (SecretKey < 32 byte, thời hạn token ngoài khoảng cho phép...) sẽ làm ứng dụng dừng ngay khi khởi động
kèm thông báo rõ ràng (Options pattern + `ValidateOnStart`).

## Chạy test

Test nằm trong `API.Tests`, chạy API thật trên SQL Server thật, không dùng user-secrets. Có 2 cách chọn SQL Server:

```powershell
# Cách 1: server có sẵn. Mỗi lần chạy tạo database tạm StarterKit_Test_* và xoá khi xong
$env:TEST_SQL_CONNECTION='Server=localhost\SQLEXPRESS;Integrated Security=True;TrustServerCertificate=True;'
dotnet test

# Cách 2: không đặt biến trên, Testcontainers tự chạy SQL Server (cần Docker ở chế độ Linux containers)
dotnet test
```

Tắt app đang chạy trước khi test, nếu không `API.exe` bị khoá và build sẽ lỗi. Tài khoản đăng nhập SQL Server cần có quyền tạo database.

## Cấu trúc

```
API/
├── Controllers/            Nhận request, trả response
├── Services/               Nghiệp vụ
│   ├── Interfaces/
│   ├── Implementations/
│   └── Validators/         FluentValidation (tự chạy qua FluentValidationFilter)
├── Data/                   Truy cập dữ liệu
│   ├── Configurations/     Cấu hình entity EF (index, độ dài cột, seed)
│   ├── Extensions/         QueryableExtensions (search, filter, sort, paging)
│   ├── Interfaces/ · Repositories/   GenericRepository, UnitOfWork, DapperRepository
│   └── Migrations/
├── Models/                 Entities, DTOs (không phụ thuộc tầng nào)
├── Common/                 Dùng chung: Security (JWT, UserContext, Roles, Rate limiting),
│                           Exceptions (GlobalExceptionHandler), Filters, Mappings (Mapster), Helpers
├── Startup/                Cấu hình khởi động, mỗi file 1 mảng (Database, ApplicationServices, Api, Swagger,
│                           Logging, HealthCheck, AdminSeed, Pipeline = thứ tự middleware)
└── Program.cs              Chỉ gọi các extension trong Startup/ — đọc 1 màn hình là thấy toàn bộ cấu hình
```

Hướng phụ thuộc: `Controllers → Services → Data → Models`, và mọi tầng có thể dùng `Common`.
`Startup/` là nơi ghép mọi thứ lại nên được phép biết tất cả các tầng; không tầng nào khác được dùng `Startup/`.

## Thêm một module mới

Copy theo mẫu Category:

| File mẫu | Việc cần làm |
|---|---|
| `Models/Entities/Category.cs` | Entity, kế thừa `AuditableEntity` để có soft delete + AuditLog |
| `Data/Configurations/CategoryConfiguration.cs` | Index, độ dài cột, seed |
| `Data/EFDbContext.cs` | Thêm `DbSet<>` |
| `Models/DTOs/CategoryDto.cs` | Response, CreateRequest, UpdateRequest, QueryRequest (kế thừa `PagedListQueryBase`) |
| `Services/Validators/CategoryValidators.cs` | Quy tắc validate |
| `Services/Interfaces/ICategoryService.cs`, `Services/Implementations/CategoryService.cs` | Nghiệp vụ |
| `Controllers/CategoriesController.cs` | Endpoint |
| `Startup/ApplicationServicesConfiguration.cs` | `AddScoped<IXxxService, XxxService>()` |

Sau đó tạo migration:
```bash
ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add AddXxx -o Data/Migrations
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update
```

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
- **Sắp xếp động**: chỉ cho phép theo danh sách cột cố định (xem `SortColumns` trong `CategoryService`).
  `ApplySorting` tự thêm khoá phụ `Id` để phân trang ổn định khi nhiều dòng trùng giá trị sắp xếp.
- **Entity kế thừa `AuditableEntity`** — `EFDbContext` tự làm, service không cần viết:
  - `CreatedAt` / `UpdatedAt` được gán khi thêm / sửa.
  - `Repository.Delete(entity)` thành **xoá mềm** (`IsActive = false`, `DeletedAt = now`); bản ghi đã xoá tự bị ẩn khỏi
    mọi truy vấn (global query filter). Cần xem lại: `.IgnoreQueryFilters()`. Cần xoá thật: `ExecuteDeleteAsync`.
  - Mọi thay đổi được ghi vào bảng `AuditLogs` (ai, lúc nào, IP, giá trị cũ/mới; cột nhạy cảm như `PasswordHash` chỉ ghi tên cột).
- **Cập nhật**: lấy entity bằng `Query(asNoTracking: false)`, sửa property rồi `SaveChangesAsync` — không cần gọi `Update()`.
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
- **Cookie** refresh token: `HttpOnly`, `Secure`, `SameSite`, `Path=/api/auth` (không gửi kèm các API khác).
  `CookieSameSite`: `Strict` (mặc định) khi client và API cùng site; `None` khi khác site (bắt buộc `CookieSecure = true`),
  khi đó `refresh`/`logout` trả 403 nếu header `Origin` không nằm trong `Cors:AllowedOrigins`.
- Khoá tài khoản, đặt lại / đổi mật khẩu ⇒ thu hồi mọi refresh token.

Cấu hình thời hạn token và cookie trong `JwtSettings` / `RefreshTokenSettings` của `appsettings.json`.

## Triển khai (production)

- Đặt `ASPNETCORE_ENVIRONMENT=Production` (mặc định) và cấu hình qua biến môi trường.
- Ngoài Development ứng dụng bật **HSTS + HTTPS redirection**. Nếu TLS kết thúc ở reverse proxy (IIS/Nginx),
  khai báo IP proxy trong `ForwardedHeaders:KnownProxies`, hoặc dải mạng trong `ForwardedHeaders:KnownNetworks` (ví dụ `10.0.0.0/8`)
  khi IP proxy thay đổi như Docker/Kubernetes/cloud LB. Thiếu bước này thì app thấy mọi người dùng là IP của proxy:
  rate limit tính chung cho tất cả, AuditLog ghi sai IP và có thể lặp redirect HTTPS.
- Load balancer / giám sát: `/health/live` (tiến trình còn sống), `/health/ready` (kết nối được DB). Không cần đăng nhập.
- Database: chạy migration bằng `dotnet ef database update` hoặc xuất script `dotnet ef migrations script --idempotent`
  để DBA chạy; ứng dụng không tự migrate khi khởi động.
