using API.Common.Helpers;
using API.Models.DTOs;
using API.Tests.Infrastructure;
using ClosedXML.Excel;
using System.Net;
using System.Net.Http.Json;

namespace API.Tests;

[Collection(ApiCollection.Name)]
public sealed class ExportTests(ApiFixture fixture)
{
    private ApiFactory Api => fixture.Factory;

    [Fact]
    public async Task Export_ContainsEveryPage_FollowsSearchAndSort()
    {
        var client = await AdminClientAsync();
        var prefix = ApiTestHelpers.UniqueName("xlsx");
        // Nhiều hơn PageSize: file phải có đủ, không chỉ trang đầu
        for (var i = 0; i < 25; i++) await client.CreateCategoryAsync($"{prefix}-{i:00}");
        await client.CreateCategoryAsync(ApiTestHelpers.UniqueName("khac"));

        var rows = Rows(await ExportAsync(client, $"/api/categories/export?search={prefix}&sortBy=name&desc=true&pageSize=2"));

        Assert.Equal(["Tên danh mục", "Diễn giải", "Trạng thái", "Ngày tạo"], rows[0]);
        Assert.Equal(26, rows.Count); // Tiêu đề + 25 dòng
        Assert.Equal($"{prefix}-24", rows[1][0]);
        Assert.Equal($"{prefix}-00", rows[25][0]);
    }

    [Fact]
    public async Task Export_ExcludesSoftDeletedRows()
    {
        var client = await AdminClientAsync();
        var prefix = ApiTestHelpers.UniqueName("xlsx");
        await client.CreateCategoryAsync($"{prefix}-giu");
        var deleted = await client.CreateCategoryAsync($"{prefix}-xoa");
        await client.DeleteAsync($"/api/categories/{deleted.Id}");

        var rows = Rows(await ExportAsync(client, $"/api/categories/export?search={prefix}"));

        Assert.Equal(2, rows.Count);
        Assert.Equal($"{prefix}-giu", rows[1][0]);
    }

    [Fact]
    public async Task Export_TextStartingWithEquals_StaysTextNotFormula()
    {
        var client = await AdminClientAsync();
        var name = "=1+1 " + ApiTestHelpers.UniqueName("xlsx");
        await client.CreateCategoryAsync(name);

        var file = await ExportAsync(client, $"/api/categories/export?search={Uri.EscapeDataString(name)}");

        using var workbook = new XLWorkbook(new MemoryStream(file));
        var cell = workbook.Worksheet(1).Cell(2, 1);
        Assert.False(cell.HasFormula);
        Assert.Equal(name, cell.GetString());
    }

    [Fact]
    public async Task Export_ShowsTimesInConfiguredTimeZone()
    {
        var client = await AdminClientAsync();
        var category = await client.CreateCategoryAsync();

        var file = await ExportAsync(client, $"/api/categories/export?search={category.Name}");

        using var workbook = new XLWorkbook(new MemoryStream(file));
        var cell = workbook.Worksheet(1).Cell(2, 4);
        var vietnam = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
        var expected = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(category.CreatedAt, DateTimeKind.Utc), vietnam);
        Assert.Equal(expected, cell.GetDateTime(), TimeSpan.FromSeconds(1));
        Assert.Equal("dd/MM/yyyy HH:mm", cell.Style.DateFormat.Format);
    }

    [Fact]
    public async Task UserExport_HasNoSensitiveColumns()
    {
        var user = await Api.CreateUserAsync();
        var client = await AdminClientAsync();

        var rows = Rows(await ExportAsync(client, $"/api/users/export?search={user.UserName}"));

        Assert.Equal(["Tên đăng nhập", "Họ và tên", "Email", "Vai trò", "Trạng thái", "Ngày tạo"], rows[0]);
        Assert.Equal(user.UserName, rows[1][0]);
        Assert.Equal("Người dùng", rows[1][3]);
        Assert.DoesNotContain(rows[1], value => value.StartsWith("$2", StringComparison.Ordinal)); // BCrypt hash
    }

    [Fact]
    public async Task Export_FollowsSameAuthorizationAsTheList()
    {
        var user = await Api.CreateUserAsync();
        var login = await Api.LoginAsync(user.UserName, user.Password);
        var client = Api.CreateApiClient(login.AccessToken);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/categories/export")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/users/export")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.CreateApiClient().GetAsync("/api/categories/export")).StatusCode);
    }

    [Fact]
    public async Task Export_OverTheRowLimit_ReturnsBusinessError()
    {
        await using var api = fixture.StartApi(settings: new Dictionary<string, string?> { ["Export__MaxRows"] = "1" });
        var login = await api.LoginAsync("admin", ApiFixture.AdminPassword);
        var client = api.CreateApiClient(login.AccessToken);
        var prefix = ApiTestHelpers.UniqueName("xlsx");
        await client.CreateCategoryAsync($"{prefix}-1");

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/categories/export?search={prefix}")).StatusCode);

        await client.CreateCategoryAsync($"{prefix}-2");
        var response = await client.GetAsync($"/api/categories/export?search={prefix}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Equal("BUSINESS_ERROR", problem.GetProperty("code").GetString());
        Assert.Contains("lọc bớt", problem.GetProperty("detail").GetString());
    }

    [Fact]
    public void InvalidTimeZone_StopsTheAppAtStartup()
    {
        Assert.ThrowsAny<Exception>(() => fixture.StartApi(settings: new Dictionary<string, string?> { ["Export__TimeZone"] = "Khong/TonTai" }));
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var admin = await Api.LoginAsAdminAsync();
        return Api.CreateApiClient(admin.AccessToken);
    }

    private static async Task<byte[]> ExportAsync(HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(ExcelExporter.ContentType, response.Content.Headers.ContentType?.MediaType);
        return await response.Content.ReadAsByteArrayAsync();
    }

    private static List<string[]> Rows(byte[] file)
    {
        using var workbook = new XLWorkbook(new MemoryStream(file));
        var sheet = workbook.Worksheet(1);
        var columnCount = sheet.LastColumnUsed()!.ColumnNumber();
        return sheet.RowsUsed()
            .Select(row => Enumerable.Range(1, columnCount).Select(column => row.Cell(column).GetFormattedString()).ToArray())
            .ToList();
    }
}
