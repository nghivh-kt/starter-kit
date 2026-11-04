using API.Data;
using API.Tests.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace API.Tests;

/// <summary>
/// Các hành vi phụ thuộc cấu hình: mỗi test tự khởi động API với cấu hình riêng.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class SecurityConfigTests(ApiFixture fixture)
{
    private const string Refresh = "/api/auth/refresh";
    private const string TrustedOrigin = "https://app.example.com";

    // ---------------- Rate limit ----------------

    [Fact]
    public async Task RateLimit_DefaultConfig_BlocksEleventhLogin_ButNotRefresh()
    {
        await using var api = fixture.StartApi(settings: new Dictionary<string, string?>
        {
            ["RateLimiting__Login__PermitLimit"] = null,   // Bỏ giá trị của test: dùng appsettings.json
            ["RateLimiting__Refresh__PermitLimit"] = null,
        });
        var client = api.CreateApiClient();

        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostLoginAsync("admin", "sai-mat-khau")).StatusCode);

        var blocked = await client.PostLoginAsync("admin", "sai-mat-khau");

        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.True(blocked.Headers.Contains("Retry-After"));
        Assert.Equal("TOO_MANY_REQUESTS", (await blocked.ReadProblemAsync()).GetProperty("code").GetString());

        // Bộ đếm login đã hết nhưng refresh có bộ đếm riêng: 401 vì không có token, không phải 429
        for (var i = 0; i < 15; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostWithCookieAsync(Refresh, null)).StatusCode);
    }

    [Fact]
    public async Task RateLimit_RefreshLimitFromConfig_IsApplied()
    {
        await using var api = fixture.StartApi(settings: new Dictionary<string, string?> { ["RateLimiting__Refresh__PermitLimit"] = "3" });
        var client = api.CreateApiClient();

        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostWithCookieAsync(Refresh, null)).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostWithCookieAsync(Refresh, null)).StatusCode);
    }

    // ---------------- Cookie SameSite + Origin ----------------

    [Fact]
    public async Task SameSiteNone_RefreshAndLogout_RequireTrustedOrigin()
    {
        await using var api = StartCrossSiteApi();
        var login = await api.LoginAsAdminAsync();
        var client = api.CreateApiClient();

        Assert.Contains("samesite=none", login.SetCookieHeader, StringComparison.OrdinalIgnoreCase);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostWithCookieAsync(Refresh, login.RefreshCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostWithCookieAsync(Refresh, login.RefreshCookie, "https://evil.example.com")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostWithCookieAsync("/api/auth/logout", login.RefreshCookie, "https://evil.example.com")).StatusCode);

        // Các request bị chặn không làm token mất hiệu lực
        Assert.Equal(HttpStatusCode.OK, (await client.PostWithCookieAsync(Refresh, login.RefreshCookie, TrustedOrigin)).StatusCode);
    }

    [Fact]
    public void SameSiteNone_WithoutSecure_StopsAppAtStartup()
    {
        var error = Assert.ThrowsAny<Exception>(() => fixture.StartApi(settings: new Dictionary<string, string?>
        {
            ["RefreshTokenSettings__CookieSameSite"] = "None",
            ["RefreshTokenSettings__CookieSecure"] = "false",
        }));

        Assert.Contains("CookieSecure", error.ToString());
    }

    // ---------------- Forwarded headers ----------------

    [Theory]
    [InlineData("10.0.0.0/8", "203.0.113.9")] // Proxy thuộc dải tin cậy: lấy IP từ X-Forwarded-For
    [InlineData(null, "10.1.2.3")]            // Proxy lạ: bỏ qua header để client không giả mạo được IP
    public async Task ForwardedHeaders_TrustOnlyConfiguredNetworks(string? knownNetwork, string expectedIp)
    {
        await using var api = fixture.StartApi(
            settings: new Dictionary<string, string?> { ["ForwardedHeaders__KnownNetworks__0"] = knownNetwork },
            configureServices: services => services.AddSingleton<IStartupFilter>(new FakeProxyStartupFilter()));
        var client = api.CreateApiClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.9");

        var login = await client.PostLoginAsync("admin", ApiFixture.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
        var newest = await db.RefreshTokens.OrderByDescending(t => t.Id).FirstAsync();
        Assert.Equal(expectedIp, newest.CreatedByIp);
    }

    // ---------------- Seed admin ----------------

    [Fact]
    public async Task Seed_WithoutPassword_CreatesNoAccount()
    {
        var connectionString = await fixture.CreateDatabaseAsync();

        await using var api = fixture.StartApi(connectionString, new Dictionary<string, string?> { ["Seed__AdminPassword"] = null });

        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
        Assert.False(await db.Users.IgnoreQueryFilters().AnyAsync());
        Assert.False(await db.Categories.IgnoreQueryFilters().AnyAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.CreateApiClient().PostLoginAsync("admin", "Admin@123")).StatusCode);
    }

    [Fact]
    public async Task Seed_CreatesAdminOnce_LaterPasswordChangesHaveNoEffect()
    {
        var connectionString = await fixture.CreateDatabaseAsync();
        const string first = "First-Seed-Pass-1";
        const string second = "Second-Seed-Pass-2";

        await using (var api = fixture.StartApi(connectionString, new Dictionary<string, string?> { ["Seed__AdminPassword"] = first }))
        {
            Assert.Equal(HttpStatusCode.OK, (await api.CreateApiClient().PostLoginAsync("admin", first)).StatusCode);
        }

        await using var restarted = fixture.StartApi(connectionString, new Dictionary<string, string?> { ["Seed__AdminPassword"] = second });
        var client = restarted.CreateApiClient();
        Assert.Equal(HttpStatusCode.OK, (await client.PostLoginAsync("admin", first)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostLoginAsync("admin", second)).StatusCode);
    }

    [Fact]
    public void Seed_PasswordTooShort_StopsAppAtStartup()
    {
        var error = Assert.ThrowsAny<Exception>(() => fixture.StartApi(settings: new Dictionary<string, string?> { ["Seed__AdminPassword"] = "short" }));

        Assert.Contains("Seed:AdminPassword", error.ToString());
    }

    [Fact]
    public async Task Seed_DatabaseNotMigrated_AppStillStarts()
    {
        var connectionString = await fixture.CreateDatabaseAsync(migrate: false);

        await using var api = fixture.StartApi(connectionString, new Dictionary<string, string?> { ["Seed__AdminPassword"] = "Valid-Seed-Pass-1" });

        Assert.Equal(HttpStatusCode.OK, (await api.CreateApiClient().GetAsync("/health/live")).StatusCode);
    }

    // ---------------- TraceId ----------------

    [Fact]
    public async Task TraceId_InErrorResponse_CanBeFoundInLogFile()
    {
        var logDirectory = Path.Combine(Path.GetTempPath(), $"starterkit-test-{Guid.NewGuid():N}");
        try
        {
            string traceId;
            await using (var api = fixture.StartApi(settings: new Dictionary<string, string?>
            {
                // Sink thứ 2 trong appsettings.json là File: đổi đường dẫn nhưng giữ nguyên outputTemplate thật
                ["Serilog__WriteTo__1__Args__path"] = Path.Combine(logDirectory, "log-.txt")
            }))
            {
                var response = await api.CreateApiClient().GetAsync("/api/categories");
                traceId = (await response.ReadProblemAsync()).GetProperty("traceId").GetString()!;
            }

            var logFile = Assert.Single(Directory.GetFiles(logDirectory));
            Assert.Contains(traceId, await File.ReadAllTextAsync(logFile));
        }
        finally
        {
            if (Directory.Exists(logDirectory)) Directory.Delete(logDirectory, recursive: true);
        }
    }

    private ApiFactory StartCrossSiteApi() => fixture.StartApi(settings: new Dictionary<string, string?>
    {
        ["RefreshTokenSettings__CookieSameSite"] = "None",
        ["Cors__AllowedOrigins__0"] = TrustedOrigin,
    });

    /// <summary>Giả lập request đi qua proxy có IP 10.1.2.3 (TestServer không có IP thật).</summary>
    private sealed class FakeProxyStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Parse("10.1.2.3");
                return nextMiddleware();
            });
            next(app);
        };
    }
}
