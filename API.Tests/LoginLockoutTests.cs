using API.Data;
using API.Models.DTOs;
using API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;

namespace API.Tests;

/// <summary>Khoá tạm theo tài khoản, cấu hình mặc định: sai 10 lần liên tiếp thì khoá 15 phút.</summary>
[Collection(ApiCollection.Name)]
public sealed class LoginLockoutTests(ApiFixture fixture)
{
    private const int MaxFailedAttempts = 10;
    private const string WrongPassword = "Sai-Mat-Khau-1";

    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task TenWrongPasswords_LockTheAccount_EvenForTheRightPassword()
    {
        var user = await Api.CreateUserAsync();
        var client = Api.CreateApiClient();

        for (var i = 0; i < MaxFailedAttempts; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostLoginAsync(user.UserName, WrongPassword)).StatusCode);

        var response = await client.PostLoginAsync(user.UserName, user.Password);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("ACCOUNT_LOCKED", (await response.ReadProblemAsync()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task ParallelWrongPasswords_AreAllCounted()
    {
        var user = await Api.CreateUserAsync();
        var client = Api.CreateApiClient();

        await Task.WhenAll(Enumerable.Range(0, MaxFailedAttempts).Select(_ => client.PostLoginAsync(user.UserName, WrongPassword)));

        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostLoginAsync(user.UserName, user.Password)).StatusCode);
    }

    [Fact]
    public async Task WhileLocked_RightAndWrongPassword_GetTheSameResponse()
    {
        var user = await LockedUserAsync();
        var client = Api.CreateApiClient();

        var wrong = await client.PostLoginAsync(user.UserName, WrongPassword);
        var right = await client.PostLoginAsync(user.UserName, user.Password);

        Assert.Equal(wrong.StatusCode, right.StatusCode);
        var wrongProblem = await wrong.ReadProblemAsync();
        var rightProblem = await right.ReadProblemAsync();
        Assert.Equal(wrongProblem.GetProperty("code").GetString(), rightProblem.GetProperty("code").GetString());
        Assert.Equal(wrongProblem.GetProperty("detail").GetString(), rightProblem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Lock_ExpiresAfterLockoutMinutes()
    {
        var user = await LockedUserAsync();

        fixture.Time.Advance(TimeSpan.FromMinutes(15) + TimeSpan.FromSeconds(1));

        Assert.Equal(HttpStatusCode.OK, (await Api.CreateApiClient().PostLoginAsync(user.UserName, user.Password)).StatusCode);
    }

    [Fact]
    public async Task SuccessfulLogin_ResetsTheCounter()
    {
        var user = await Api.CreateUserAsync();
        var client = Api.CreateApiClient();

        for (var round = 0; round < 2; round++)
        {
            for (var i = 0; i < MaxFailedAttempts - 1; i++)
                await client.PostLoginAsync(user.UserName, WrongPassword);

            Assert.Equal(HttpStatusCode.OK, (await client.PostLoginAsync(user.UserName, user.Password)).StatusCode);
        }
    }

    [Fact]
    public async Task AdminUnlock_LetsTheUserLogInAgain()
    {
        var user = await LockedUserAsync();
        var admin = Api.CreateApiClient((await Api.LoginAsAdminAsync()).AccessToken);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsync($"/api/users/{user.Id}/unlock", null)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Api.CreateApiClient().PostLoginAsync(user.UserName, user.Password)).StatusCode);
        var listed = await admin.GetFromJsonAsync<UserResponse>($"/api/users/{user.Id}");
        Assert.Null(listed!.LockoutEnd);
    }

    [Fact]
    public async Task AdminPasswordReset_AlsoUnlocks()
    {
        var user = await LockedUserAsync();
        var admin = Api.CreateApiClient((await Api.LoginAsAdminAsync()).AccessToken);
        const string newPassword = "Mat-Khau-Moi-1";

        var reset = await admin.PutAsJsonAsync($"/api/users/{user.Id}/reset-password", new UserResetPasswordRequest { NewPassword = newPassword });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Api.CreateApiClient().PostLoginAsync(user.UserName, newPassword)).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WrongCurrentPassword_CountsTowardsTheLock()
    {
        var user = await Api.CreateUserAsync();
        var login = await Api.LoginAsync(user.UserName, user.Password);
        var client = Api.CreateApiClient(login.AccessToken);

        for (var i = 0; i < MaxFailedAttempts; i++)
        {
            var change = await client.PostAsJsonAsync("/api/auth/change-password",
                new ChangePasswordRequest { CurrentPassword = WrongPassword, NewPassword = "Mat-Khau-Moi-1" });
            Assert.Equal(HttpStatusCode.BadRequest, change.StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await Api.CreateApiClient().PostLoginAsync(user.UserName, user.Password)).StatusCode);
    }

    [Fact]
    public async Task WrongPasswords_WriteNoAuditLog_AndKeepUpdatedAt()
    {
        var user = await Api.CreateUserAsync();
        var before = await ReadAuditStateAsync(user.Id);

        for (var i = 0; i < 3; i++)
            await Api.CreateApiClient().PostLoginAsync(user.UserName, WrongPassword);

        var after = await ReadAuditStateAsync(user.Id);
        Assert.Equal(before, after);
    }

    [Fact]
    public void InvalidLockoutSettings_StopAppAtStartup()
    {
        var error = Assert.ThrowsAny<Exception>(() => fixture.StartApi(settings: new Dictionary<string, string?> { ["Lockout__MaxFailedAttempts"] = "0" }));

        Assert.Contains("MaxFailedAttempts", error.ToString());
    }

    private async Task<(int Id, string UserName, string Password)> LockedUserAsync()
    {
        var user = await Api.CreateUserAsync();
        var client = Api.CreateApiClient();
        for (var i = 0; i < MaxFailedAttempts; i++)
            await client.PostLoginAsync(user.UserName, WrongPassword);
        return user;
    }

    private async Task<(int AuditLogs, DateTime? UpdatedAt)> ReadAuditStateAsync(int userId)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
        var recordId = userId.ToString();
        var logs = await db.AuditLogs.CountAsync(l => l.TableName == "Users" && l.RecordId == recordId);
        var updatedAt = await db.Users.Where(u => u.Id == userId).Select(u => u.UpdatedAt).SingleAsync();
        return (logs, updatedAt);
    }
}
