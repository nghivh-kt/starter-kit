using API.Common.Helpers;
using API.Data;
using API.Models.DTOs;
using API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed class CategoryBehaviorTests(ApiFixture fixture)
{
    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task Delete_IsSoft_HidesRow_AndFreesTheName()
    {
        var client = await AdminClientAsync();
        var category = await client.CreateCategoryAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/categories/{category.Id}")).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/categories/{category.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/categories/{category.Id}")).StatusCode);

        await using (var scope = Api.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
            var row = await db.Categories.IgnoreQueryFilters().SingleAsync(c => c.Id == category.Id);
            Assert.NotNull(row.DeletedAt);
            Assert.False(row.IsActive);
        }

        // Filtered unique index: tên của bản ghi đã xoá mềm được dùng lại
        await client.CreateCategoryAsync(category.Name);
    }

    [Fact]
    public async Task Update_WithoutIsActive_KeepsCurrentValue_AndReturnsUpdatedRecord()
    {
        var client = await AdminClientAsync();
        var category = await client.CreateCategoryAsync();
        var newName = ApiTestHelpers.UniqueName("cat");

        var response = await client.PutAsJsonAsync($"/api/categories/{category.Id}", new CategoryUpdateRequest { Name = newName, RowVersion = category.RowVersion });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<CategoryResponse>();
        Assert.Equal(newName, updated!.Name);
        Assert.True(updated.IsActive);
        Assert.NotNull(updated.UpdatedAt);
    }

    [Fact]
    public async Task Update_WithStaleRowVersion_Returns409_AndKeepsTheOtherUsersChange()
    {
        var client = await AdminClientAsync();
        var category = await client.CreateCategoryAsync();
        var firstName = ApiTestHelpers.UniqueName("first");

        var first = await client.PutAsJsonAsync($"/api/categories/{category.Id}", new CategoryUpdateRequest { Name = firstName, RowVersion = category.RowVersion });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Người thứ hai vẫn giữ RowVersion cũ
        var second = await client.PutAsJsonAsync($"/api/categories/{category.Id}", new CategoryUpdateRequest { Name = ApiTestHelpers.UniqueName("second"), RowVersion = category.RowVersion });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("CONFLICT", (await second.ReadProblemAsync()).GetProperty("code").GetString());

        var current = await client.GetFromJsonAsync<CategoryResponse>($"/api/categories/{category.Id}");
        Assert.Equal(firstName, current!.Name);
    }

    [Fact]
    public async Task Update_WithNewRowVersion_Succeeds()
    {
        var client = await AdminClientAsync();
        var category = await client.CreateCategoryAsync();

        var first = await client.PutAsJsonAsync($"/api/categories/{category.Id}", new CategoryUpdateRequest { Name = ApiTestHelpers.UniqueName("a"), RowVersion = category.RowVersion });
        var updated = await first.Content.ReadFromJsonAsync<CategoryResponse>();
        Assert.False(updated!.RowVersion.SequenceEqual(category.RowVersion));

        var second = await client.PutAsJsonAsync($"/api/categories/{category.Id}", new CategoryUpdateRequest { Name = ApiTestHelpers.UniqueName("b"), RowVersion = updated.RowVersion });

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }

    [Fact]
    public async Task Update_WithoutRowVersion_Returns400()
    {
        var client = await AdminClientAsync();
        var category = await client.CreateCategoryAsync();

        var response = await client.PutAsJsonAsync($"/api/categories/{category.Id}", new CategoryUpdateRequest { Name = ApiTestHelpers.UniqueName("a") });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).GetProperty("errors").TryGetProperty("rowVersion", out _));
    }

    [Theory]
    [InlineData("page=2147483647")] // Trước đây tràn số thành Skip âm và trả 500
    [InlineData("page=0")]
    [InlineData("pageSize=201")]
    public async Task Paging_OutOfRange_Returns400(string query)
    {
        var client = await AdminClientAsync();

        var response = await client.GetAsync($"/api/categories?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_ERROR", (await response.ReadProblemAsync()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Paging_LargestAllowedPage_ReturnsEmptyPage()
    {
        var client = await AdminClientAsync();

        var response = await client.GetAsync("/api/categories?page=1000000&pageSize=200");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = await response.Content.ReadFromJsonAsync<PagedResult<CategoryResponse>>();
        Assert.Empty(page!.Items);
    }

    [Theory]
    [InlineData("/api/categories?sortBy=KhongTonTai")]
    [InlineData("/api/users?sortBy=PasswordHash")]
    public async Task Sorting_ColumnOutsideWhitelist_FallsBackToId(string path)
    {
        var client = await AdminClientAsync();
        await client.CreateCategoryAsync();
        await client.CreateCategoryAsync();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = await response.Content.ReadFromJsonAsync<PagedResult<IdOnly>>();
        var ids = page!.Items.Select(i => i.Id).ToList();
        Assert.Equal(ids.Order(), ids);
    }

    [Fact]
    public async Task Search_TreatsPercentAsLiteral()
    {
        var client = await AdminClientAsync();
        var token = Guid.NewGuid().ToString("N")[..12];
        var withPercent = await client.CreateCategoryAsync($"c%{token}");
        await client.CreateCategoryAsync($"cx{token}");

        var response = await client.GetAsync($"/api/categories?search={Uri.EscapeDataString($"c%{token}")}");

        var page = await response.Content.ReadFromJsonAsync<PagedResult<CategoryResponse>>();
        Assert.Equal(withPercent.Id, Assert.Single(page!.Items).Id);
    }

    [Fact]
    public async Task Filter_ByIsActive_ReturnsOnlyMatchingRows()
    {
        var client = await AdminClientAsync();
        var token = Guid.NewGuid().ToString("N")[..12];
        var active = await client.CreateCategoryAsync($"on{token}");
        var inactive = await client.CreateCategoryAsync($"off{token}");
        await client.PutAsJsonAsync($"/api/categories/{inactive.Id}",
            new CategoryUpdateRequest { Name = inactive.Name, IsActive = false, RowVersion = inactive.RowVersion });

        async Task<int[]> IdsAsync(string query) =>
            (await client.GetFromJsonAsync<PagedResult<CategoryResponse>>($"/api/categories?search={token}{query}"))!
                .Items.Select(i => i.Id).Order().ToArray();

        Assert.Equal([active.Id], await IdsAsync("&isActive=true"));
        Assert.Equal([inactive.Id], await IdsAsync("&isActive=false"));
        Assert.Equal(new[] { active.Id, inactive.Id }.Order().ToArray(), await IdsAsync(""));
    }

    [Fact]
    public async Task Filter_UsersByRole_ReturnsOnlyThatRole()
    {
        var client = await AdminClientAsync();
        var user = await Api.CreateUserAsync(role: "User");
        var admin = await Api.CreateUserAsync(role: "Admin");

        async Task<int[]> IdsAsync(string role) =>
            (await client.GetFromJsonAsync<PagedResult<UserResponse>>($"/api/users?pageSize=200&role={role}"))!
                .Items.Select(i => i.Id).ToArray();

        var users = await IdsAsync("User");
        var admins = await IdsAsync("Admin");
        Assert.Contains(user.Id, users);
        Assert.DoesNotContain(admin.Id, users);
        Assert.Contains(admin.Id, admins);
        Assert.DoesNotContain(user.Id, admins);
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var admin = await Api.LoginAsAdminAsync();
        return Api.CreateApiClient(admin.AccessToken);
    }

    private sealed record IdOnly(int Id);
}
