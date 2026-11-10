using System.ComponentModel.DataAnnotations;

namespace API.Common.Security
{
    /// <summary>
    /// Cấu hình "Lockout" trong appsettings.json: khoá tạm tài khoản sau nhiều lần nhập sai mật khẩu liên tiếp.
    /// Bổ sung cho rate limit theo IP: rate limit không chặn được người thử chậm, đều đặn vào một tài khoản.
    /// </summary>
    public class LockoutSettings
    {
        /// <summary>Số lần nhập sai liên tiếp thì khoá tạm</summary>
        [Range(1, 100)]
        public int MaxFailedAttempts { get; set; } = 10;

        /// <summary>Thời gian khoá tạm (phút). Admin mở khoá sớm được trong màn hình Người dùng.</summary>
        [Range(1, 1440)]
        public int LockoutMinutes { get; set; } = 15;
    }

    public static class LockoutConfiguration
    {
        public static IServiceCollection AddLoginLockout(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddOptions<LockoutSettings>()
                .Bind(configuration.GetSection("Lockout"))
                .ValidateDataAnnotations()
                .ValidateOnStart();

            return services;
        }
    }
}
