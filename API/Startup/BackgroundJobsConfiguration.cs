using API.Services.Background;

namespace API.Startup
{
    /// <summary>
    /// Việc chạy nền theo lịch, nằm trong app (SQL Server Express không có SQL Agent).
    /// Thêm việc mới: viết class xử lý (scoped) + BackgroundService gọi nó, rồi đăng ký tại đây.
    /// </summary>
    public static class BackgroundJobsConfiguration
    {
        public static IServiceCollection AddBackgroundJobs(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddOptions<CleanupSettings>()
                .Bind(configuration.GetSection("Cleanup"))
                .ValidateDataAnnotations()
                .ValidateOnStart();

            services.AddScoped<RefreshTokenCleanup>();
            services.AddHostedService<RefreshTokenCleanupService>();

            return services;
        }
    }
}
