using API.Models.DTOs;
using API.Tests.Infrastructure;
using System.Net;
using System.Net.Http.Json;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed class AuthFlowTests(ApiFixture fixture)
{
    private const string Refresh = "/api/auth/refresh";

    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task Login_WrongPasswordAndUnknownUser_ReturnSameResponse()
    {
        var client = Api.CreateApiClient();

        var wrongPassword = await client.PostLoginAsync("admin", "sai-mat-khau");
        var unknownUser = await client.PostLoginAsync(ApiTestHelpers.UniqueName("nobody"), "sai-mat-khau");

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownUser.StatusCode);

        var first = await wrongPassword.ReadProblemAsync();
        var second = await unknownUser.ReadProblemAsync();
        Assert.Equal(first.GetProperty("detail").GetString(), second.GetProperty("detail").GetString());
        Assert.Equal("UNAUTHORIZED", first.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Login_PutsRefreshTokenInProtectedCookie_NotInBody()
    {
        var response = await Api.CreateApiClient().PostLoginAsync("admin", ApiFixture.AdminPassword);

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("refreshToken\"", body, StringComparison.OrdinalIgnoreCase);

        var tokens = await ApiTestHelpers.ReadTokensAsync(response);
        Assert.Contains("httponly", tokens.SetCookieHeader, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", tokens.SetCookieHeader, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", tokens.SetCookieHeader, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/auth", tokens.SetCookieHeader, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Refresh_IssuesNewTokens_ThatWork()
    {
        var login = await Api.LoginAsAdminAsync();

        var response = await Api.CreateApiClient().PostWithCookieAsync(Refresh, login.RefreshCookie);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rotated = await ApiTestHelpers.ReadTokensAsync(response);
        Assert.NotEqual(login.RefreshCookie, rotated.RefreshCookie);

        var me = await Api.CreateApiClient(rotated.AccessToken).GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task Refresh_OldTokenWithinGraceWindow_IsRejected_ButNewSessionSurvives()
    {
        var login = await Api.LoginAsAdminAsync();
        var client = Api.CreateApiClient();
        var rotated = await ApiTestHelpers.ReadTokensAsync(await client.PostWithCookieAsync(Refresh, login.RefreshCookie));

        var reused = await client.PostWithCookieAsync(Refresh, login.RefreshCookie);
        var next = await client.PostWithCookieAsync(Refresh, rotated.RefreshCookie);

        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);
        Assert.Equal(HttpStatusCode.OK, next.StatusCode);
    }

    [Fact]
    public async Task Refresh_OldTokenAfterGraceWindow_RevokesAllSessions()
    {
        var user = await Api.CreateUserAsync();
        var login = await Api.LoginAsync(user.UserName, user.Password);
        var client = Api.CreateApiClient();
        var rotated = await ApiTestHelpers.ReadTokensAsync(await client.PostWithCookieAsync(Refresh, login.RefreshCookie));

        fixture.Time.Advance(TimeSpan.FromSeconds(31));

        var reused = await client.PostWithCookieAsync(Refresh, login.RefreshCookie);
        var newSession = await client.PostWithCookieAsync(Refresh, rotated.RefreshCookie);

        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, newSession.StatusCode);
    }

    [Fact]
    public async Task Refresh_ParallelRequestsWithSameToken_OnlyOneSucceeds()
    {
        var login = await Api.LoginAsAdminAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5)
            .Select(_ => Api.CreateApiClient().PostWithCookieAsync(Refresh, login.RefreshCookie)));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Equal(4, responses.Count(r => r.StatusCode == HttpStatusCode.Unauthorized));
    }

    [Fact]
    public async Task Logout_RevokesCurrentToken()
    {
        var login = await Api.LoginAsAdminAsync();
        var client = Api.CreateApiClient();

        var logout = await client.PostWithCookieAsync("/api/auth/logout", login.RefreshCookie);
        var refresh = await client.PostWithCookieAsync(Refresh, login.RefreshCookie);

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task AccessToken_IsRejected_AfterItExpires()
    {
        var login = await Api.LoginAsAdminAsync();
        var client = Api.CreateApiClient(login.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);

        fixture.Time.Advance(TimeSpan.FromMinutes(6));

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_RevokesSessions_AndReplacesPassword()
    {
        var user = await Api.CreateUserAsync();
        var login = await Api.LoginAsync(user.UserName, user.Password);
        const string newPassword = "Test-User-Pass-2";

        var change = await Api.CreateApiClient(login.AccessToken).PostAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest { CurrentPassword = user.Password, NewPassword = newPassword });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        var client = Api.CreateApiClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostWithCookieAsync(Refresh, login.RefreshCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostLoginAsync(user.UserName, user.Password)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostLoginAsync(user.UserName, newPassword)).StatusCode);
    }

    [Fact]
    public async Task LockedUser_CannotUseStillValidAccessToken_RefreshOrLogin()
    {
        var user = await Api.CreateUserAsync();
        var login = await Api.LoginAsync(user.UserName, user.Password);
        var admin = await Api.LoginAsAdminAsync();

        var locked = await Api.CreateApiClient(admin.AccessToken).PutAsJsonAsync($"/api/users/{user.Id}",
            new UserUpdateRequest { FullName = "Bị khoá", Role = "User", IsActive = false });
        Assert.Equal(HttpStatusCode.OK, locked.StatusCode);

        var userClient = Api.CreateApiClient(login.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await userClient.GetAsync("/api/auth/me")).StatusCode);

        var change = await userClient.PostAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest { CurrentPassword = user.Password, NewPassword = "Test-User-Pass-2" });
        Assert.Equal(HttpStatusCode.Unauthorized, change.StatusCode);

        var client = Api.CreateApiClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostWithCookieAsync(Refresh, login.RefreshCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostLoginAsync(user.UserName, user.Password)).StatusCode);
    }
}
