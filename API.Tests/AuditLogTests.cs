using API.Data;
using API.Data.Interfaces;
using API.Models.DTOs;
using API.Models.Entities;
using API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed class AuditLogTests(ApiFixture fixture)
{
    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task CreateUpdateDelete_EachWriteOneLog_WithWhoAndOldNewValues()
    {
        var admin = await Api.LoginAsAdminAsync();
        var client = Api.CreateApiClient(admin.AccessToken);
        var oldName = ApiTestHelpers.UniqueName("old");
        var newName = ApiTestHelpers.UniqueName("new");

        var category = await client.CreateCategoryAsync(oldName);
        var update = await client.PutAsJsonAsync($"/api/categories/{category.Id}", new CategoryUpdateRequest { Name = newName, RowVersion = category.RowVersion });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/categories/{category.Id}")).StatusCode);

        var logs = await ReadLogsAsync("Categories", category.Id);

        Assert.Equal([AuditActionType.Created, AuditActionType.Updated, AuditActionType.Deleted], logs.Select(l => l.ActionType));
        Assert.All(logs, l => Assert.Equal("admin", l.ChangedByUserName));
        Assert.Contains(oldName, logs[0].NewValues);
        Assert.Contains(oldName, logs[1].OldValues);
        Assert.Contains(newName, logs[1].NewValues);
        Assert.Contains("DeletedAt", logs[2].ChangedColumns);
        Assert.All(logs, l =>
        {
            Assert.DoesNotContain("RowVersion", l.NewValues ?? string.Empty);
            Assert.DoesNotContain("RowVersion", l.ChangedColumns ?? string.Empty);
        });
    }

    [Fact]
    public async Task BlindUpdate_StillLogsNewValues_WithRowVersionColumn()
    {
        var admin = await Api.LoginAsAdminAsync();
        var category = await Api.CreateApiClient(admin.AccessToken).CreateCategoryAsync();
        var newName = ApiTestHelpers.UniqueName("blind");

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            unitOfWork.Repository<Category>().Update(new Category
            {
                Id = category.Id,
                Name = newName,
                IsActive = true,
                CreatedAt = category.CreatedAt,
                RowVersion = category.RowVersion
            });
            await unitOfWork.SaveChangesAsync();
        }

        var log = (await ReadLogsAsync("Categories", category.Id))[^1];
        Assert.Equal(AuditActionType.Updated, log.ActionType);
        Assert.Null(log.OldValues);
        Assert.Contains(newName, log.NewValues);
    }

    [Fact]
    public async Task PasswordHash_IsLoggedByNameOnly_NeverItsValue()
    {
        var user = await Api.CreateUserAsync();
        var login = await Api.LoginAsync(user.UserName, user.Password);

        var change = await Api.CreateApiClient(login.AccessToken).PostAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest { CurrentPassword = user.Password, NewPassword = "Test-User-Pass-2" });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        var logs = await ReadLogsAsync("Users", user.Id);

        Assert.Contains("PasswordHash", logs[^1].ChangedColumns);
        Assert.All(logs, l =>
        {
            Assert.DoesNotContain("PasswordHash", l.OldValues ?? string.Empty);
            Assert.DoesNotContain("PasswordHash", l.NewValues ?? string.Empty);
            Assert.DoesNotContain("$2a$", l.OldValues ?? string.Empty);
            Assert.DoesNotContain("$2a$", l.NewValues ?? string.Empty);
        });
    }

    [Fact]
    public async Task Rollback_RemovesBothDataAndLog()
    {
        var name = ApiTestHelpers.UniqueName("rollback");

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            await Assert.ThrowsAsync<InvalidOperationException>(() => unitOfWork.ExecuteInTransactionAsync(async ct =>
            {
                await unitOfWork.Repository<Category>().AddAsync(new Category { Name = name, IsActive = true }, ct);
                await unitOfWork.SaveChangesAsync(ct);
                throw new InvalidOperationException("Cố ý gây lỗi để rollback");
            }));
        }

        await using var verify = Api.Services.CreateAsyncScope();
        var db = verify.ServiceProvider.GetRequiredService<EFDbContext>();
        Assert.False(await db.Categories.IgnoreQueryFilters().AnyAsync(c => c.Name == name));
        Assert.False(await db.AuditLogs.AnyAsync(l => l.NewValues != null && l.NewValues.Contains(name)));
    }

    private async Task<List<AuditLog>> ReadLogsAsync(string table, int recordId)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
        return await db.AuditLogs
            .Where(l => l.TableName == table && l.RecordId == recordId.ToString())
            .OrderBy(l => l.Id)
            .ToListAsync();
    }
}
