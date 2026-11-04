using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace API.Common.Security
{
    public static class JwtConfiguration
    {
        public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
        {
            // Đọc + kiểm tra cấu hình ngay khi khởi động
            services.AddOptions<JwtSettings>()
                .Bind(configuration.GetSection("JwtSettings"))
                .ValidateDataAnnotations()
                .Validate(s => Encoding.UTF8.GetByteCount(s.SecretKey) >= 32,
                    "JwtSettings:SecretKey chưa được cấu hình hoặc ngắn hơn 32 byte. " +
                    "Đặt bằng: dotnet user-secrets set \"JwtSettings:SecretKey\" \"<chuỗi ngẫu nhiên ≥ 32 ký tự>\"")
                .ValidateOnStart();

            services.AddOptions<RefreshTokenSettings>()
                .Bind(configuration.GetSection("RefreshTokenSettings"))
                .ValidateDataAnnotations()
                .Validate(s => s.CookieSameSite is SameSiteMode.Strict or SameSiteMode.Lax or SameSiteMode.None,
                    "RefreshTokenSettings:CookieSameSite phải là Strict, Lax hoặc None.")
                .Validate(s => s.CookieSameSite != SameSiteMode.None || s.CookieSecure,
                    "RefreshTokenSettings:CookieSameSite = None bắt buộc CookieSecure = true (trình duyệt sẽ bỏ cookie nếu thiếu).")
                .ValidateOnStart();

            // Đăng ký helper
            services.AddSingleton<JwtTokenHelper>();

            // Thêm Authentication dùng JWT Bearer
            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();

            // Cấu hình JwtBearer từ JwtSettings đã được validate (đọc lúc chạy, không đọc lúc đăng ký)
            services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
                .Configure<IOptions<JwtSettings>, TimeProvider>((options, jwtOptions, timeProvider) =>
                {
                    var jwtSettings = jwtOptions.Value;

                    // Giữ nguyên tên claim trong token (sub, unique_name, role, uid), không đổi sang URI dài của .NET
                    options.MapInboundClaims = false;

                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwtSettings.Issuer,
                        ValidAudience = jwtSettings.Audience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
                        // Chỉ chấp nhận đúng thuật toán server dùng để ký (chặn tấn công đổi thuật toán)
                        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                        ClockSkew = TimeSpan.FromMinutes(jwtSettings.ClockSkewInMinutes),
                        // Kiểm tra hạn token theo cùng đồng hồ lúc phát hành token (TimeProvider).
                        // Thư viện chưa cho gán TimeProvider trực tiếp nên tự kiểm tra: bắt buộc có exp, tôn trọng ClockSkew.
                        LifetimeValidator = (notBefore, expires, _, parameters) =>
                        {
                            var now = timeProvider.GetUtcNow().UtcDateTime;
                            return expires.HasValue
                                && expires.Value > now - parameters.ClockSkew
                                && (!notBefore.HasValue || notBefore.Value <= now + parameters.ClockSkew);
                        },
                        // User.Identity.Name và [Authorize(Roles = ...)] đọc từ các claim này
                        NameClaimType = JwtRegisteredClaimNames.UniqueName,
                        RoleClaimType = JwtTokenHelper.RoleClaimType
                    };
                });

            return services;
        }
    }
}
