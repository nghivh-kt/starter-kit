using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace API.Tests.Infrastructure;

/// <summary>
/// Chạy API thật trong tiến trình test, môi trường "Testing" (giống production: không Swagger, ẩn chi tiết lỗi 500).
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly TimeProvider _time;
    private readonly Action<IServiceCollection>? _configureServices;

    private ApiFactory(TimeProvider time, Action<IServiceCollection>? configureServices)
    {
        _time = time;
        _configureServices = configureServices;
    }

    /// <summary>
    /// Cấu hình đặt qua biến môi trường: Program.cs đọc cấu hình ngay lúc đăng ký service (connection string, rate limit),
    /// trước khi các callback của WebApplicationFactory được áp dụng. Biến chỉ tồn tại trong lúc host khởi động.
    /// Giá trị null trong settings nghĩa là bỏ cấu hình mặc định của test, dùng giá trị trong appsettings.json.
    /// </summary>
    public static ApiFactory Start(
        string connectionString,
        TimeProvider time,
        IReadOnlyDictionary<string, string?>? settings,
        Action<IServiceCollection>? configureServices)
    {
        var environment = new Dictionary<string, string?>
        {
            ["ASPNETCORE_ENVIRONMENT"] = "Testing",
            ["ConnectionStrings__DefaultConnection"] = connectionString,
            ["JwtSettings__SecretKey"] = "test-only-secret-key-at-least-32-bytes-long",
            ["RateLimiting__Login__PermitLimit"] = "100000",
            ["RateLimiting__Refresh__PermitLimit"] = "100000",
        };
        foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
            environment[key] = value;

        var previous = environment.Keys.ToDictionary(key => key, Environment.GetEnvironmentVariable);
        foreach (var (key, value) in environment)
            Environment.SetEnvironmentVariable(key, value);

        var factory = new ApiFactory(time, configureServices);
        try
        {
            _ = factory.Server; // Buộc host khởi động ngay trong lúc biến môi trường còn hiệu lực
            return factory;
        }
        catch
        {
            factory.Dispose();
            throw;
        }
        finally
        {
            foreach (var (key, value) in previous)
                Environment.SetEnvironmentVariable(key, value);
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton(_time);
            _configureServices?.Invoke(services);
        });
    }

    /// <summary>HTTPS để cookie Secure hoạt động. Không tự xử lý cookie: test cần gửi lại đúng token cũ để kiểm tra rotate.</summary>
    public HttpClient CreateApiClient(string? accessToken = null)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            HandleCookies = false,
            AllowAutoRedirect = false
        });

        if (accessToken is not null)
            client.DefaultRequestHeaders.Authorization = new("Bearer", accessToken);

        return client;
    }
}
