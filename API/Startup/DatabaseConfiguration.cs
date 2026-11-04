using API.Data;
using API.Data.Interfaces;
using API.Data.Repositories;
using Dapper;
using Microsoft.EntityFrameworkCore;

namespace API.Startup
{
    /// <summary>
    /// EF Core + Dapper (dùng chung connection/transaction qua UnitOfWork), repository và health check database.
    /// </summary>
    public static class DatabaseConfiguration
    {
        public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration configuration)
        {
            // Connection string đặt bằng user-secrets (dev) hoặc biến môi trường ConnectionStrings__DefaultConnection (server)
            var connectionString = configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "ConnectionStrings:DefaultConnection chưa được cấu hình. " +
                    "Đặt bằng: dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"<connection string>\"");
            }

            // EF DbContext (ORM)
            // LƯU Ý: chưa bật EnableRetryOnFailure. EFDbContext.SaveChangesAsync tự mở transaction để dữ liệu và AuditLog
            // cùng thành công/thất bại; retrying execution strategy không cho mở transaction kiểu đó, nên khi bật retry
            // EFDbContext sẽ bỏ transaction riêng => dữ liệu và AuditLog không còn nguyên tử.
            // Muốn bật retry (ví dụ Azure SQL) thì phải sửa SaveChangesAsync để chạy trong strategy.ExecuteAsync trước.
            services.AddDbContext<EFDbContext>(options => options.UseSqlServer(connectionString));
            // Dapper context (raw SQL / Stored Procedure)
            services.AddScoped<DapperDbContext>();
            // Dapper không đi qua value converter của EF: đăng ký riêng để DateTime đọc lên cũng là UTC
            SqlMapper.AddTypeHandler(new UtcDateTimeTypeHandler());

            // Repositories & Unit of Work
            services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
            services.AddScoped<IDapperRepository, DapperRepository>();
            services.AddScoped<IUnitOfWork, UnitOfWork>();

            // /health/ready kiểm tra kết nối database (xem HealthCheckConfiguration)
            services.AddHealthChecks()
                .AddDbContextCheck<EFDbContext>(tags: [HealthCheckConfiguration.ReadyTag]);

            return services;
        }
    }
}
