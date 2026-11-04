using API.Common.Security;
using API.Startup;
using Serilog;

// Logger tạm dùng trong lúc khởi động: lỗi cấu hình (thiếu connection string, JWT key...) vẫn được ghi lại
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // --------------------------------------------------------------------
    // SERVICES (chi tiết từng mục: Startup và Common/Security)
    // --------------------------------------------------------------------
    builder.Services
        .AddSerilogLogging(builder.Configuration)                 // Startup/LoggingConfiguration
        .AddDatabase(builder.Configuration)                       // Startup/DatabaseConfiguration: EF, Dapper, UnitOfWork, health check DB
        .AddApplicationServices()                                 // Startup/ApplicationServicesConfiguration: service nghiệp vụ, Mapster, validators
        .AddApiControllers(builder.Environment)                   // Startup/ApiConfiguration
        .AddErrorHandling()                                       //   Problem Details + GlobalExceptionHandler
        .AddClientCors(builder.Configuration)                     //   CORS cho client
        .AddProxyForwardedHeaders(builder.Configuration)          //   IP thật sau reverse proxy
        .AddDefaultAuthorization()                                //   mặc định mọi endpoint yêu cầu đăng nhập
        .AddSwaggerDocumentation()                                // Startup/SwaggerConfiguration
        .AddJwtAuthentication(builder.Configuration)              // Security/JwtConfiguration
        .AddAuthRateLimiting(builder.Configuration)               // Security/RateLimitingConfiguration
        .AddAdminSeed(builder.Configuration);                     // Startup/AdminSeedConfiguration

    var app = builder.Build();

    // --------------------------------------------------------------------
    // MIDDLEWARE PIPELINE & ENDPOINTS (Startup/PipelineConfiguration)
    // --------------------------------------------------------------------
    app.UseApiPipeline();
    app.MapApiEndpoints();

    // Tạo tài khoản quản trị đầu tiên nếu bảng Users còn rỗng
    await app.SeedAdminAsync();

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException) // HostAbortedException: công cụ (dotnet ef, test) dừng host chủ động
{
    Log.Fatal(ex, "Ứng dụng dừng do lỗi khi khởi động");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
