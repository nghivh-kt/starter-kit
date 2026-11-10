using Serilog;
using Serilog.Events;

namespace API.Startup
{
    /// <summary>
    /// Serilog: cấu hình trong mục "Serilog" của appsettings.json (sink, mức log, thư mục file...).
    /// Logger tạm lúc khởi động (bootstrap logger) vẫn đặt ở đầu Program.cs vì phải có trước khi tạo builder.
    /// </summary>
    public static class LoggingConfiguration
    {
        public static IServiceCollection AddSerilogLogging(this IServiceCollection services, IConfiguration configuration)
        {
            return services.AddSerilog((serviceProvider, loggerConfiguration) => loggerConfiguration
                .ReadFrom.Configuration(configuration)
                .ReadFrom.Services(serviceProvider)
                .Enrich.FromLogContext());
        }

        /// <summary>
        /// 1 dòng log cho mỗi request (method, path, status, thời gian, IP, user).
        /// Lỗi / 5xx ghi mức Error; health check (Verbose) và file của Angular (Debug) không ghi ở mức mặc định.
        /// </summary>
        public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder app)
        {
            return app.UseSerilogRequestLogging(options =>
            {
                options.GetLevel = (httpContext, _, exception) =>
                    exception is not null || httpContext.Response.StatusCode >= 500 ? LogEventLevel.Error
                    : httpContext.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose
                    // File của Angular: mỗi lần mở trang có hàng chục file, ghi ra chỉ làm nhiễu log
                    : !httpContext.Request.Path.StartsWithSegments("/api") ? LogEventLevel.Debug
                    : LogEventLevel.Information;

                options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
                {
                    diagnosticContext.Set("ClientIp", httpContext.Connection.RemoteIpAddress?.ToString());
                    diagnosticContext.Set("UserName", httpContext.User.Identity?.Name);
                };
            });
        }
    }
}
