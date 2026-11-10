using API.Tests.Infrastructure;
using System.Net;
using System.Net.Http.Headers;

namespace API.Tests;

/// <summary>
/// Bản đã publish: API phục vụ luôn file Angular trong wwwroot. Test dùng wwwroot tạm giống kết quả của "ng build".
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class ClientAppHostingTests(ApiFixture fixture) : IAsyncLifetime
{
    private const string IndexMarker = "<app-root>trang-angular</app-root>";
    private const string HashedScript = "main-MDJ4QYAQ.js";

    private readonly string _webRoot = Path.Combine(Path.GetTempPath(), $"starterkit-wwwroot-{Guid.NewGuid():N}");
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        Directory.CreateDirectory(_webRoot);
        File.WriteAllText(Path.Combine(_webRoot, "index.html"), $"<!doctype html><html><body>{IndexMarker}</body></html>");
        File.WriteAllText(Path.Combine(_webRoot, HashedScript), string.Concat(Enumerable.Repeat("console.log('angular');", 200)));
        File.WriteAllBytes(Path.Combine(_webRoot, "favicon.ico"), [0, 0, 1, 0]);

        _api = fixture.StartApi(settings: new Dictionary<string, string?> { ["ASPNETCORE_WEBROOT"] = _webRoot });
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await _api.DisposeAsync();
        Directory.Delete(_webRoot, recursive: true);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/categories")]
    [InlineData("/users?page=2")]
    public async Task AngularRoutes_ReturnIndexHtml_NotCached_WithCsp(string path)
    {
        var response = await _api.CreateApiClient().GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains(IndexMarker, await response.Content.ReadAsStringAsync());
        Assert.True(response.Headers.CacheControl?.NoCache);
        Assert.Contains("frame-ancestors 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Fact]
    public async Task HashedFiles_AreCachedForAYear_OtherFilesForADay()
    {
        var client = _api.CreateApiClient();

        var script = await client.GetAsync($"/{HashedScript}");
        var icon = await client.GetAsync("/favicon.ico");

        Assert.Equal(TimeSpan.FromDays(365), script.Headers.CacheControl?.MaxAge);
        Assert.Contains("immutable", script.Headers.CacheControl!.Extensions.Select(e => e.Name));
        Assert.Equal(TimeSpan.FromDays(1), icon.Headers.CacheControl?.MaxAge);
    }

    [Fact]
    public async Task UnknownApiRoute_StaysProblemDetails_NotIndexHtml()
    {
        var admin = await _api.LoginAsAdminAsync();

        var anonymous = await _api.CreateApiClient().GetAsync("/api/khong-ton-tai");
        var signedIn = await _api.CreateApiClient(admin.AccessToken).GetAsync("/api/khong-ton-tai");

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, signedIn.StatusCode);
        Assert.Equal("NOT_FOUND", (await signedIn.ReadProblemAsync()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task StaticFiles_AreCompressed_ApiResponses_AreNot()
    {
        var admin = await _api.LoginAsAdminAsync();
        var client = _api.CreateApiClient(admin.AccessToken);
        client.DefaultRequestHeaders.AcceptEncoding.Add(new StringWithQualityHeaderValue("br"));
        client.DefaultRequestHeaders.AcceptEncoding.Add(new StringWithQualityHeaderValue("gzip"));

        var script = await client.GetAsync($"/{HashedScript}");
        var api = await client.GetAsync("/api/auth/me");

        Assert.Equal("br", Assert.Single(script.Content.Headers.ContentEncoding));
        Assert.Equal(HttpStatusCode.OK, api.StatusCode);
        Assert.Empty(api.Content.Headers.ContentEncoding);
    }

    [Fact]
    public async Task EveryResponse_HasNoSniffAndReferrerPolicy()
    {
        var client = _api.CreateApiClient();

        foreach (var path in new[] { "/", "/api/auth/me", "/health/live" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
            Assert.Equal("strict-origin-when-cross-origin", response.Headers.GetValues("Referrer-Policy").Single());
        }
    }
}
