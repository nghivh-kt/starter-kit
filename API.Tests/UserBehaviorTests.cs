using API.Models.DTOs;
using API.Tests.Infrastructure;
using System.Net;
using System.Net.Http.Json;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed class UserBehaviorTests(ApiFixture fixture)
{
    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task Update_WithStaleRowVersion_Returns409_AndKeepsTheOtherAdminsChange()
    {
        var client = await AdminClientAsync();
        var user = await client.GetFromJsonAsync<UserResponse>($"/api/users/{(await Api.CreateUserAsync()).Id}");

        var first = await client.PutAsJsonAsync($"/api/users/{user!.Id}",
            new UserUpdateRequest { FullName = "Tên của người thứ nhất", Role = "User", RowVersion = user.RowVersion });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Người thứ hai vẫn giữ RowVersion cũ
        var second = await client.PutAsJsonAsync($"/api/users/{user.Id}",
            new UserUpdateRequest { FullName = "Tên của người thứ hai", Role = "User", RowVersion = user.RowVersion });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("CONFLICT", (await second.ReadProblemAsync()).GetProperty("code").GetString());
        var current = await client.GetFromJsonAsync<UserResponse>($"/api/users/{user.Id}");
        Assert.Equal("Tên của người thứ nhất", current!.FullName);
    }

    [Fact]
    public async Task Update_WithRowVersionFromResponse_Succeeds()
    {
        var client = await AdminClientAsync();
        var user = await client.GetFromJsonAsync<UserResponse>($"/api/users/{(await Api.CreateUserAsync()).Id}");

        var first = await client.PutAsJsonAsync($"/api/users/{user!.Id}",
            new UserUpdateRequest { FullName = "Lần một", Role = "User", RowVersion = user.RowVersion });
        var updated = await first.Content.ReadFromJsonAsync<UserResponse>();
        Assert.False(updated!.RowVersion.SequenceEqual(user.RowVersion));

        var second = await client.PutAsJsonAsync($"/api/users/{user.Id}",
            new UserUpdateRequest { FullName = "Lần hai", Role = "User", RowVersion = updated.RowVersion });

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }

    [Fact]
    public async Task Update_WithoutRowVersion_Returns400()
    {
        var client = await AdminClientAsync();
        var user = await Api.CreateUserAsync();

        var response = await client.PutAsJsonAsync($"/api/users/{user.Id}", new UserUpdateRequest { FullName = "Không có phiên bản", Role = "User" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).GetProperty("errors").TryGetProperty("rowVersion", out _));
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var admin = await Api.LoginAsAdminAsync();
        return Api.CreateApiClient(admin.AccessToken);
    }
}
