using API.Common.Helpers;

namespace API.Startup
{
    /// <summary>Xuất file Excel. Cấu hình "Export" sai (múi giờ không tồn tại...) thì ứng dụng dừng ngay khi khởi động.</summary>
    public static class ExportConfiguration
    {
        public static IServiceCollection AddExcelExport(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddOptions<ExportSettings>()
                .Bind(configuration.GetSection("Export"))
                .ValidateDataAnnotations()
                .Validate(settings => TimeZoneInfo.TryFindSystemTimeZoneById(settings.TimeZone, out _), "Export:TimeZone không phải múi giờ hợp lệ.")
                .ValidateOnStart();

            services.AddSingleton<IExcelExporter, ExcelExporter>();

            return services;
        }
    }
}
