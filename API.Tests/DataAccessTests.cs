using API.Data;
using API.Data.Extensions;
using Microsoft.EntityFrameworkCore;
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
    public async Task Query_DoesNotSaveEdits_QueryForEdit_Does()
    {
        var admin = await Api.LoginAsAdminAsync();
        var category = await Api.CreateApiClient(admin.AccessToken).CreateCategoryAsync();
        var readOnlyName = ApiTestHelpers.UniqueName("ro");
        var editedName = ApiTestHelpers.UniqueName("edit");

        // Query(): để đọc, EF không theo dõi entity nên sửa rồi lưu cũng không có gì được ghi
        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var readOnly = await unitOfWork.Repository<Category>().Query().SingleAsync(c => c.Id == category.Id);
            readOnly.Name = readOnlyName;
            Assert.Equal(0, await unitOfWork.SaveChangesAsync());
        }

        // QueryForEdit(): EF ghi nhớ giá trị gốc, SaveChangesAsync UPDATE đúng cột đã đổi
        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var editable = await unitOfWork.Repository<Category>().QueryForEdit().SingleAsync(c => c.Id == category.Id);
            editable.Name = editedName;
            Assert.Equal(1, await unitOfWork.SaveChangesAsync());
        }

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
            Assert.Equal(editedName, (await db.Categories.SingleAsync(c => c.Id == category.Id)).Name);
        }
    }

    [Fact]
    public async Task ListQuery_SendsFilterAndSearchValues_AsSqlParameters()
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
        bool? isActive = true;
        const string keyword = "tu-khoa-tim-kiem";

        var sql = db.Categories
            .ApplySearch(keyword, c => c.Name)
            .WhereIf(isActive.HasValue, c => c.IsActive == isActive)
            .ApplySorting("name", desc: false, new Dictionary<string, string> { ["name"] = nameof(Category.Name) })
            .ToQueryString();

        // ToQueryString in giá trị tham số ở các dòng DECLARE phía trên, câu lệnh thật bắt đầu từ SELECT.
        // Giá trị nhúng thẳng vào câu lệnh sẽ làm SQL Server lưu một execution plan riêng cho mỗi giá trị khác nhau.
        var statement = sql[sql.IndexOf("SELECT", StringComparison.Ordinal)..];
        Assert.DoesNotContain(keyword, statement);
        Assert.Contains("LIKE @", statement);
        Assert.Contains("[IsActive] = @", statement);
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
