using Microsoft.AspNetCore.Diagnostics.HealthChecks;

namespace API.Startup
{
    /// <summary>
    /// /health/live: tiến trình còn chạy (không kiểm tra gì thêm).
    /// /health/ready: mọi check gắn tag "ready" (database...) đều đạt, sẵn sàng nhận request.
    /// Thêm check mới: services.AddHealthChecks().AddXxx(tags: [HealthCheckConfiguration.ReadyTag]).
    /// </summary>
    public static class HealthCheckConfiguration
    {
        public const string ReadyTag = "ready";

        public static WebApplication MapHealthCheckEndpoints(this WebApplication app)
        {
            app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false })
                .AllowAnonymous();
            app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains(ReadyTag) })
                .AllowAnonymous();

            return app;
        }
    }
}
