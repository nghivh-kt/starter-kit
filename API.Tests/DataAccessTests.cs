using API.Data.Interfaces;
using API.Models.Entities;
using API.Tests.Infrastructure;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed class DataAccessTests(ApiFixture fixture)
{
    private const string InsertCategorySql = "INSERT INTO Categories (Name, IsActive, CreatedAt) VALUES (@name, 1, SYSUTCDATETIME())";
    private const string CountCategorySql = "SELECT COUNT(*) FROM Categories WHERE Name = @name";

    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task GetByIdAsync_FindsEntity_WithSingleKeyAndKeyArray()
    {
        var admin = await Api.LoginAsAdminAsync();
        var category = await Api.CreateApiClient(admin.AccessToken).CreateCategoryAsync();

        await using var scope = Api.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IUnitOfWork>().Repository<Category>();

        var bySingleKey = await repository.GetByIdAsync((object)category.Id);
        var byKeyArray = await repository.GetByIdAsync(new object[] { category.Id });

        Assert.Equal(category.Name, bySingleKey?.Name);
        Assert.Equal(category.Name, byKeyArray?.Name);
    }

    [Fact]
    public async Task EfAndDapper_ShareTransaction_AndCommitTogether()
    {
        var efName = ApiTestHelpers.UniqueName("ef");
        var dapperName = ApiTestHelpers.UniqueName("dapper");

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            await unitOfWork.ExecuteInTransactionAsync(async ct =>
            {
                await unitOfWork.Repository<Category>().AddAsync(new Category { Name = efName, IsActive = true }, ct);
                await unitOfWork.SaveChangesAsync(ct);

                // Dapper thấy được dữ liệu EF chưa commit => đang ở cùng 1 transaction
                var seen = await unitOfWork.Dapper.QueryAsync<int>(CountCategorySql, new { name = efName }, ct);
                Assert.Equal(1, seen.Single());

                await unitOfWork.Dapper.ExecuteAsync(InsertCategorySql, new { name = dapperName }, ct);
            });
        }

        Assert.Equal(1, await CountCategoriesAsync(efName));
        Assert.Equal(1, await CountCategoriesAsync(dapperName));
    }

    [Fact]
    public async Task EfAndDapper_RollBackTogether()
    {
        var efName = ApiTestHelpers.UniqueName("ef");
        var dapperName = ApiTestHelpers.UniqueName("dapper");

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            await Assert.ThrowsAsync<InvalidOperationException>(() => unitOfWork.ExecuteInTransactionAsync(async ct =>
            {
                await unitOfWork.Repository<Category>().AddAsync(new Category { Name = efName, IsActive = true }, ct);
                await unitOfWork.SaveChangesAsync(ct);
                await unitOfWork.Dapper.ExecuteAsync(InsertCategorySql, new { name = dapperName }, ct);
                throw new InvalidOperationException("Cố ý gây lỗi để rollback");
            }));
        }

        Assert.Equal(0, await CountCategoriesAsync(efName));
        Assert.Equal(0, await CountCategoriesAsync(dapperName));
    }

    [Fact]
    public async Task Dapper_ReadsDateTimeAsUtc_LikeEf()
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var dapper = scope.ServiceProvider.GetRequiredService<IUnitOfWork>().Dapper;

        var rows = await dapper.QueryAsync<DateRow>("SELECT SYSUTCDATETIME() AS Required, SYSUTCDATETIME() AS Optional");
        var row = rows.Single();

        Assert.Equal(DateTimeKind.Utc, row.Required.Kind);
        Assert.Equal(DateTimeKind.Utc, row.Optional?.Kind);
    }

    private async Task<int> CountCategoriesAsync(string name)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var dapper = scope.ServiceProvider.GetRequiredService<IUnitOfWork>().Dapper;
        return (await dapper.QueryAsync<int>(CountCategorySql, new { name })).Single();
    }

    private sealed class DateRow
    {
        public DateTime Required { get; set; }
        public DateTime? Optional { get; set; }
    }
}
