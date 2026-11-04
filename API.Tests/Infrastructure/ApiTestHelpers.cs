using API.Models.DTOs;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace API.Tests.Infrastructure;

public sealed record LoginResult(string AccessToken, string RefreshCookie, string SetCookieHeader);

public static class ApiTestHelpers
{
    private const string RefreshCookieName = "StarterKitRefreshToken";

    public static string UniqueName(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..Math.Min(prefix.Length + 21, 50)];

    public static Task<HttpResponseMessage> PostLoginAsync(this HttpClient client, string userName, string password)
        => client.PostAsJsonAsync("/api/auth/login", new LoginRequest { UserName = userName, Password = password });

    public static async Task<LoginResult> LoginAsync(this ApiFactory factory, string userName, string password)
    {
        var response = await factory.CreateApiClient().PostLoginAsync(userName, password);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadTokensAsync(response);
    }

    public static Task<LoginResult> LoginAsAdminAsync(this ApiFactory factory)
        => factory.LoginAsync("admin", ApiFixture.AdminPassword);

    /// <summary>Gửi refresh với đúng giá trị cookie truyền vào.</summary>
    public static Task<HttpResponseMessage> PostWithCookieAsync(this HttpClient client, string path, string? cookie, string? origin = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path);
        if (cookie is not null) request.Headers.Add("Cookie", cookie);
        if (origin is not null) request.Headers.Add("Origin", origin);
        return client.SendAsync(request);
    }

    public static async Task<LoginResult> ReadTokensAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        var setCookie = response.Headers.GetValues("Set-Cookie").Single(h => h.StartsWith(RefreshCookieName + "=", StringComparison.Ordinal));
        return new LoginResult(body!.AccessToken, setCookie.Split(';')[0], setCookie);
    }

    /// <summary>Admin tạo user mới, trả về (Id, UserName, mật khẩu).</summary>
    public static async Task<(int Id, string UserName, string Password)> CreateUserAsync(this ApiFactory factory, string role = "User")
    {
        var admin = await factory.LoginAsAdminAsync();
        var userName = UniqueName("u");
        const string password = "Test-User-Pass-1";

        var response = await factory.CreateApiClient(admin.AccessToken).PostAsJsonAsync("/api/users", new UserCreateRequest
        {
            UserName = userName,
            FullName = "Người dùng test",
            Email = $"{userName}@example.com",
            Password = password,
            Role = role
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<UserResponse>();
        return (created!.Id, userName, password);
    }

    public static async Task<CategoryResponse> CreateCategoryAsync(this HttpClient adminClient, string? name = null)
    {
        var response = await adminClient.PostAsJsonAsync("/api/categories", new CategoryCreateRequest { Name = name ?? UniqueName("cat") });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<CategoryResponse>())!;
    }

    public static async Task<JsonElement> ReadProblemAsync(this HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
    }
}
