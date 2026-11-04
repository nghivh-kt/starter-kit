using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using System.Threading.RateLimiting;

namespace API.Common.Security
{
    /// <summary>
    /// Tên các policy giới hạn tần suất, dùng với [EnableRateLimiting(RateLimitPolicies.Login)].
    /// Mỗi policy có bộ đếm riêng; các endpoint dùng chung 1 policy thì dùng chung bộ đếm của IP đó.
    /// </summary>
    public static class RateLimitPolicies
    {
        /// <summary>Login, đổi mật khẩu: các endpoint kiểm tra mật khẩu, giới hạn chặt để chống dò mật khẩu (brute force)</summary>
        public const string Login = "login";

        /// <summary>
        /// Refresh token: mỗi user đang hoạt động tự gọi đều đặn theo hạn access token, nên giới hạn rộng hơn nhiều.
        /// Nhiều user sau 1 IP (văn phòng, NAT) cùng dùng 1 bộ đếm: chọn PermitLimit theo số user dự kiến.
        /// </summary>
        public const string Refresh = "refresh";
    }

    /// <summary>
    /// Cấu hình đọc từ "RateLimiting:Login" và "RateLimiting:Refresh" trong appsettings.json
    /// </summary>
    public class RateLimitSettings
    {
        /// <summary>Số request tối đa của 1 IP trong 1 cửa sổ thời gian</summary>
        [Range(1, 100_000)]
        public int PermitLimit { get; set; }

        /// <summary>Độ dài cửa sổ thời gian (giây)</summary>
        [Range(1, 3_600)]
        public int WindowSeconds { get; set; } = 60;
    }

    public static class RateLimitingConfiguration
    {
        private const int DefaultLoginPermitLimit = 10;
        private const int DefaultRefreshPermitLimit = 120;

        public static IServiceCollection AddAuthRateLimiting(this IServiceCollection services, IConfiguration configuration)
        {
            var login = BindSettings(services, configuration, RateLimitPolicies.Login, "RateLimiting:Login", DefaultLoginPermitLimit);
            var refresh = BindSettings(services, configuration, RateLimitPolicies.Refresh, "RateLimiting:Refresh", DefaultRefreshPermitLimit);

            services.AddRateLimiter(options =>
            {
                AddFixedWindowPerIpPolicy(options, RateLimitPolicies.Login, login);
                AddFixedWindowPerIpPolicy(options, RateLimitPolicies.Refresh, refresh);

                // Vượt giới hạn: 429 + Retry-After + Problem Details (cùng khuôn với mọi lỗi khác)
                options.OnRejected = async (context, cancellationToken) =>
                {
                    var httpContext = context.HttpContext;
                    httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    {
                        httpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
                    }

                    var problemDetailsService = httpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
                    await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
                    {
                        HttpContext = httpContext,
                        ProblemDetails = new ProblemDetails
                        {
                            Status = StatusCodes.Status429TooManyRequests,
                            Title = "Too Many Requests",
                            Detail = "Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại."
                        }
                    });
                };
            });

            return services;
        }

        // Đọc cấu hình ngay để tạo policy, đồng thời đăng ký Options để giá trị sai làm app dừng khi khởi động
        private static RateLimitSettings BindSettings(
            IServiceCollection services, IConfiguration configuration, string policyName, string sectionPath, int defaultPermitLimit)
        {
            var section = configuration.GetSection(sectionPath);

            services.AddOptions<RateLimitSettings>(policyName)
                .Configure(o =>
                {
                    o.PermitLimit = defaultPermitLimit;
                    section.Bind(o);
                })
                .ValidateDataAnnotations()
                .ValidateOnStart();

            var settings = new RateLimitSettings { PermitLimit = defaultPermitLimit };
            section.Bind(settings);
            return settings;
        }

        // Fixed window theo IP client (RemoteIpAddress đã là IP thật nhờ UseForwardedHeaders)
        private static void AddFixedWindowPerIpPolicy(RateLimiterOptions options, string policyName, RateLimitSettings settings)
        {
            options.AddPolicy(policyName, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = settings.PermitLimit,
                        Window = TimeSpan.FromSeconds(settings.WindowSeconds),
                        QueueLimit = 0
                    }));
        }
    }
}
