using API.Common.Mappings;
using API.Common.Security;
using API.Services.Implementations;
using API.Services.Interfaces;
using FluentValidation;
using Mapster;
using MapsterMapper;

namespace API.Startup
{
    /// <summary>
    /// Service nghiệp vụ và các tiện ích dùng chung (UserContext, TimeProvider, Mapster, FluentValidation).
    /// Thêm module mới: đăng ký AddScoped&lt;IXxxService, XxxService&gt;() tại đây.
    /// </summary>
    public static class ApplicationServicesConfiguration
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            // Thông tin user hiện tại (Id, UserName, IP) lấy từ HttpContext
            services.AddHttpContextAccessor();
            services.AddScoped<IUserContext, UserContext>();

            // Đồng hồ hệ thống: lấy giờ hiện tại qua TimeProvider thay vì DateTime.UtcNow
            // để test có thể thay bằng FakeTimeProvider (tua thời gian)
            services.AddSingleton(TimeProvider.System);

            // Application services
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<ICategoryService, CategoryService>();
            services.AddScoped<IUserService, UserService>();

            // Mapster: nạp mọi class IRegister (Common/Mappings). Mỗi host một cấu hình riêng (không dùng GlobalSettings tĩnh)
            var mapsterConfig = new TypeAdapterConfig();
            mapsterConfig.Scan(typeof(MappingConfig).Assembly);
            services.AddSingleton(mapsterConfig);
            services.AddScoped<IMapper, ServiceMapper>();

            // Validators (FluentValidation): tự chạy qua FluentValidationFilter
            services.AddValidatorsFromAssemblyContaining<Program>();

            return services;
        }
    }
}
