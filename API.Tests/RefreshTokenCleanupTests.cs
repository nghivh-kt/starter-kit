using API.Common.Security;
using API.Data;
using API.Models.Entities;
using API.Services.Background;
using API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed class RefreshTokenCleanupTests(ApiFixture fixture)
{
    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task Cleanup_DeletesOnlyTokensExpiredLongerThanRetention()
    {
        var user = await Api.CreateUserAsync();
        var now = fixture.Time.GetUtcNow().UtcDateTime;
        var expiredLongAgo = await AddTokenAsync(user.Id, expiresAt: now.AddDays(-31));
        var expiredRecently = await AddTokenAsync(user.Id, expiresAt: now.AddDays(-1));
        var stillValid = await AddTokenAsync(user.Id, expiresAt: now.AddDays(7));

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var deleted = await scope.ServiceProvider.GetRequiredService<RefreshTokenCleanup>().RunAsync(CancellationToken.None);
            Assert.True(deleted >= 1);
        }

        var remaining = await TokenIdsAsync(user.Id);
        Assert.DoesNotContain(expiredLongAgo, remaining);
        Assert.Contains(expiredRecently, remaining);
        Assert.Contains(stillValid, remaining);
    }

    [Fact]
    public void InvalidRetention_StopsAppAtStartup()
    {
        var error = Assert.ThrowsAny<Exception>(() => fixture.StartApi(settings: new Dictionary<string, string?> { ["Cleanup__RefreshTokenRetentionDays"] = "0" }));

        Assert.Contains("RefreshTokenRetentionDays", error.ToString());
    }

    private async Task<int> AddTokenAsync(int userId, DateTime expiresAt)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
        var token = new RefreshToken
        {
            UserId = userId,
            TokenHash = JwtTokenHelper.HashToken(Guid.NewGuid().ToString()),
            CreatedAt = expiresAt.AddDays(-7),
            ExpiresAt = expiresAt
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();
        return token.Id;
    }

    private async Task<List<int>> TokenIdsAsync(int userId)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
        return await db.RefreshTokens.Where(t => t.UserId == userId).Select(t => t.Id).ToListAsync();
    }
}
