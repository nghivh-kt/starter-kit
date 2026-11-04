using API.Common.Security;
using API.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;
using Testcontainers.MsSql;
using Xunit;

namespace API.Tests.Infrastructure;

/// <summary>
/// Mọi test class dùng chung 1 fixture và chạy tuần tự, vì ApiFactory đặt cấu hình qua biến môi trường của tiến trình.
/// </summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "Api";
}

/// <summary>
/// SQL Server thật cho test: đặt biến môi trường TEST_SQL_CONNECTION (không có Initial Catalog) để dùng server sẵn có,
/// không đặt thì Testcontainers tự chạy SQL Server trong Docker (Linux containers).
/// Chỉ xoá những database StarterKit_Test_* do chính fixture này tạo.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string AdminPassword = "Test-Admin-Pass-1";

    private readonly List<string> _createdDatabases = [];
    private MsSqlContainer? _container;
    private string _serverConnectionString = string.Empty;

    public FakeTimeProvider Time { get; } = new(DateTimeOffset.UtcNow);
    public string ConnectionString { get; private set; } = string.Empty;

    /// <summary>API dùng chung: rate limit rất rộng, đã có user admin.</summary>
    public ApiFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        _serverConnectionString = Environment.GetEnvironmentVariable("TEST_SQL_CONNECTION") ?? string.Empty;
        if (string.IsNullOrWhiteSpace(_serverConnectionString))
        {
            _container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
            await _container.StartAsync();
            _serverConnectionString = _container.GetConnectionString();
        }

        ConnectionString = await CreateDatabaseAsync();
        Factory = StartApi(ConnectionString, new Dictionary<string, string?> { ["Seed__AdminPassword"] = AdminPassword });
    }

    public async Task DisposeAsync()
    {
        if (Factory is not null) await Factory.DisposeAsync();

        SqlConnection.ClearAllPools();
        foreach (var database in _createdDatabases)
        {
            await using var connection = new SqlConnection(_serverConnectionString);
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}];";
            await command.ExecuteNonQueryAsync();
        }

        if (_container is not null) await _container.DisposeAsync();
    }

    /// <summary>Tạo database mới, trả về connection string của nó.</summary>
    public async Task<string> CreateDatabaseAsync(bool migrate = true)
    {
        var name = $"StarterKit_Test_{Guid.NewGuid():N}";
        var connectionString = new SqlConnectionStringBuilder(_serverConnectionString) { InitialCatalog = name }.ConnectionString;

        await using (var connection = new SqlConnection(_serverConnectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"CREATE DATABASE [{name}];";
            await command.ExecuteNonQueryAsync();
        }
        _createdDatabases.Add(name);

        if (migrate)
        {
            var options = new DbContextOptionsBuilder<EFDbContext>().UseSqlServer(connectionString).Options;
            await using var db = new EFDbContext(options, new NoUserContext(), TimeProvider.System);
            await db.Database.MigrateAsync();
        }

        return connectionString;
    }

    /// <summary>Khởi động thêm 1 API với cấu hình riêng, mặc định trên database dùng chung.</summary>
    public ApiFactory StartApi(
        string? connectionString = null,
        IReadOnlyDictionary<string, string?>? settings = null,
        Action<IServiceCollection>? configureServices = null)
        => ApiFactory.Start(connectionString ?? ConnectionString, Time, settings, configureServices);

    private sealed class NoUserContext : IUserContext
    {
        public int? UserId => null;
        public string? UserName => null;
        public string IpAddress => string.Empty;
    }
}
