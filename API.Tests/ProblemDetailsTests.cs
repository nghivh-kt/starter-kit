using API.Common.Helpers;
using API.Data.Interfaces;
using API.Models.DTOs;
using API.Models.Entities;
using API.Services.Interfaces;
using API.Tests.Infrastructure;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed partial class ProblemDetailsTests(ApiFixture fixture)
{
    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task Validation_Returns400_WithErrorsInCamelCase()
    {
        var client = await AdminClientAsync();

        var response = await client.PostAsJsonAsync("/api/categories", new CategoryCreateRequest { Name = "" });

        var problem = await AssertProblemAsync(response, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        Assert.Equal("POST /api/categories", problem.GetProperty("instance").GetString());
        Assert.True(problem.GetProperty("errors").TryGetProperty("name", out _));
    }

    [Fact]
    public async Task BusinessRule_Returns400()
    {
        var client = await AdminClientAsync();
        var category = await client.CreateCategoryAsync();

        var response = await client.PostAsJsonAsync("/api/categories", new CategoryCreateRequest { Name = category.Name });

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "BUSINESS_ERROR");
    }

    [Fact]
    public async Task MissingToken_Returns401()
    {
        var response = await Api.CreateApiClient().GetAsync("/api/categories");

        await AssertProblemAsync(response, HttpStatusCode.Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task WrongRole_Returns403()
    {
        var user = await Api.CreateUserAsync();
        var login = await Api.LoginAsync(user.UserName, user.Password);

        var response = await Api.CreateApiClient(login.AccessToken)
            .PostAsJsonAsync("/api/categories", new CategoryCreateRequest { Name = ApiTestHelpers.UniqueName("cat") });

        await AssertProblemAsync(response, HttpStatusCode.Forbidden, "FORBIDDEN");
    }

    [Theory]
    [InlineData("/api/categories/2147483647")] // NotFoundException từ service
    [InlineData("/api/khong-ton-tai")]         // Sai route, do framework trả
    public async Task NotFound_Returns404(string path)
    {
        var client = await AdminClientAsync();

        await AssertProblemAsync(await client.GetAsync(path), HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Fact]
    public async Task UniqueViolationThroughEf_Returns409_WithoutSqlDetails()
    {
        var existing = (await (await AdminClientAsync()).CreateCategoryAsync()).Name;

        await using var api = StartApiWhereGetCategoryRuns(async services =>
        {
            var unitOfWork = services.GetRequiredService<IUnitOfWork>();
            await unitOfWork.Repository<Category>().AddAsync(new Category { Name = existing, IsActive = true });
            await unitOfWork.SaveChangesAsync();
        });

        await AssertConflictHidesSqlAsync(api);
    }

    [Fact]
    public async Task UniqueViolationThroughDapper_Returns409_WithoutSqlDetails()
    {
        var existing = (await (await AdminClientAsync()).CreateCategoryAsync()).Name;

        await using var api = StartApiWhereGetCategoryRuns(services =>
            services.GetRequiredService<IUnitOfWork>().Dapper.ExecuteAsync(
                "INSERT INTO Categories (Name, IsActive, CreatedAt) VALUES (@name, 1, SYSUTCDATETIME())", new { name = existing }));

        await AssertConflictHidesSqlAsync(api);
    }

    [Fact]
    public async Task UnexpectedException_Returns500_AndHidesMessage()
    {
        const string secret = "chuoi-bi-mat-noi-bo";
        await using var api = StartApiWhereGetCategoryRuns(_ => throw new InvalidOperationException(secret));
        var admin = await api.LoginAsAdminAsync();

        var response = await api.CreateApiClient(admin.AccessToken).GetAsync("/api/categories/1");

        var problem = await AssertProblemAsync(response, HttpStatusCode.InternalServerError, "INTERNAL_ERROR");
        Assert.DoesNotContain(secret, problem.GetRawText());
        Assert.False(problem.TryGetProperty("exception", out _));
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var admin = await Api.LoginAsAdminAsync();
        return Api.CreateApiClient(admin.AccessToken);
    }

    private static async Task AssertConflictHidesSqlAsync(ApiFactory api)
    {
        var admin = await api.LoginAsAdminAsync();

        var response = await api.CreateApiClient(admin.AccessToken).GetAsync("/api/categories/1");

        var problem = await AssertProblemAsync(response, HttpStatusCode.Conflict, "CONFLICT");
        Assert.DoesNotContain("IX_Categories", problem.GetRawText());
    }

    private static async Task<JsonElement> AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);

        var problem = await response.ReadProblemAsync();
        Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.Matches(TraceIdFormat(), problem.GetProperty("traceId").GetString()!);
        return problem;
    }

    /// <summary>API mà GET /api/categories/{id} chạy đoạn code do test truyền vào, để tạo lỗi thật ở tầng service.</summary>
    private ApiFactory StartApiWhereGetCategoryRuns(Func<IServiceProvider, Task> action)
        => fixture.StartApi(configureServices: services =>
            services.AddScoped<ICategoryService>(provider => new ScriptedCategoryService(provider, action)));

    [GeneratedRegex("^[0-9a-f]{32}$")]
    private static partial Regex TraceIdFormat();

    private sealed class ScriptedCategoryService(IServiceProvider services, Func<IServiceProvider, Task> action) : ICategoryService
    {
        public async Task<CategoryResponse> GetByIdAsync(int id, CancellationToken ct)
        {
            await action(services);
            throw new InvalidOperationException("Đoạn code của test phải tự ném lỗi");
        }

        public Task<PagedResult<CategoryResponse>> GetPagedAsync(CategoryQueryRequest query, CancellationToken ct) => throw new NotSupportedException();
        public Task<CategoryResponse> CreateAsync(CategoryCreateRequest request, CancellationToken ct) => throw new NotSupportedException();
        public Task<CategoryResponse> UpdateAsync(int id, CategoryUpdateRequest request, CancellationToken ct) => throw new NotSupportedException();
        public Task DeleteAsync(int id, CancellationToken ct) => throw new NotSupportedException();
    }
}
