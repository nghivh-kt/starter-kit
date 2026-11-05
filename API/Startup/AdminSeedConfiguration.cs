using API.Common.Security;
using API.Data;
using API.Models.Entities;
using API.Services.Validators;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace API.Startup
{
    /// <summary>
    /// Cấu hình "Seed" trong appsettings.json. Đặt AdminPassword bằng user-secrets / biến môi trường, không commit.
    /// </summary>
    public class AdminSeedSettings
    {
        /// <summary>Mật khẩu của tài khoản quản trị đầu tiên. Để trống thì không tạo tài khoản.</summary>
        public string AdminPassword { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(256)]
        public string AdminEmail { get; set; } = "admin@example.com";
    }

    /// <summary>
    /// Tạo tài khoản quản trị đầu tiên khi bảng Users còn rỗng. Có user rồi thì không làm gì,
    /// nên đổi "Seed:AdminPassword" về sau không ảnh hưởng tới tài khoản đã có.
    /// </summary>
    public static class AdminSeedConfiguration
    {
        private const string AdminUserName = "admin";

        public static IServiceCollection AddAdminSeed(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddOptions<AdminSeedSettings>()
                .Bind(configuration.GetSection("Seed"))
                .ValidateDataAnnotations()
                .Validate(s => string.IsNullOrEmpty(s.AdminPassword)
                        || (s.AdminPassword.Length >= PasswordRuleExtensions.MinLength
                            && Encoding.UTF8.GetByteCount(s.AdminPassword) <= PasswordRuleExtensions.MaxBytes),
                    $"Seed:AdminPassword phải có ít nhất {PasswordRuleExtensions.MinLength} ký tự và tối đa {PasswordRuleExtensions.MaxBytes} byte.")
                .ValidateOnStart();

            return services;
        }

        /// <summary>
        /// Lỗi ở đây chỉ ghi log, không làm app dừng: app không tự migrate, nên lúc khởi động database có thể chưa sẵn sàng.
        /// Khi đó /health/ready sẽ báo lỗi kết nối.
        /// </summary>
        public static async Task SeedAdminAsync(this WebApplication app)
        {
            await using var scope = app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<EFDbContext>();
            var settings = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedSettings>>().Value;
            var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(AdminSeedConfiguration));

            // Không có mật khẩu thì không chạm vào database: công cụ như "dotnet swagger tofile" cũng chạy qua đoạn này
            if (string.IsNullOrEmpty(settings.AdminPassword))
            {
                logger.LogInformation("Chưa cấu hình Seed:AdminPassword: bỏ qua bước tạo tài khoản quản trị. Nếu bảng Users đang rỗng thì chưa ai đăng nhập được.");
                return;
            }

            try
            {
                if ((await db.Database.GetPendingMigrationsAsync()).Any())
                {
                    logger.LogWarning("Database còn migration chưa chạy: bỏ qua bước tạo tài khoản quản trị.");
                    return;
                }

                if (await db.Users.IgnoreQueryFilters().AnyAsync())
                    return;

                db.Users.Add(new User
                {
                    UserName = AdminUserName,
                    FullName = "Administrator",
                    Email = settings.AdminEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(settings.AdminPassword),
                    Role = Roles.Admin,
                    IsActive = true
                });
                await db.SaveChangesAsync();

                logger.LogInformation("Đã tạo tài khoản quản trị {UserName}.", AdminUserName);
            }
            catch (SqlException ex)
            {
                logger.LogWarning(ex, "Không kết nối được database: bỏ qua bước tạo tài khoản quản trị.");
            }
            catch (DbUpdateException ex)
            {
                // Nhiều instance khởi động cùng lúc: instance khác đã tạo trước, unique index chặn bản ghi thứ hai
                logger.LogWarning(ex, "Không tạo được tài khoản quản trị, có thể instance khác vừa tạo.");
            }
        }
    }
}
