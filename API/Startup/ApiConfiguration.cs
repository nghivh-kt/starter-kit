using API.Common.Exceptions;
using API.Common.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Net;
using System.Net.Mime;
using System.Text.Json;

namespace API.Startup
{
    /// <summary>
    /// Tầng HTTP: controllers + JSON, xử lý lỗi (Problem Details), CORS, forwarded headers, phân quyền mặc định.
    /// </summary>
    public static class ApiConfiguration
    {
        /// <summary>Tên CORS policy cho client (Angular...)</summary>
        public const string ClientCorsPolicy = "AllowClient";

        public static IServiceCollection AddApiControllers(this IServiceCollection services, IHostEnvironment environment)
        {
            services.AddControllers(o =>
                {
                    o.Filters.Add<FluentValidationFilter>();
                    // FluentValidation là nguồn thông báo validate DUY NHẤT (tiếng Việt). Tắt [Required] ngầm định của .NET
                    // cho property kiểu tham chiếu không nullable, nếu không field null/thiếu sẽ bị báo bằng tiếng Anh
                    // ("The X field is required.") trước khi FluentValidation kịp chạy.
                    // => Mọi field string bắt buộc của request PHẢI có rule NotEmpty() trong validator.
                    o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;

                    // Tài liệu OpenAPI: các lỗi mọi endpoint đều có thể trả. Lỗi riêng (404, 409, 429) khai báo trên từng action.
                    o.Filters.Add(new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest, MediaTypeNames.Application.ProblemJson));
                    o.Filters.Add(new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized, MediaTypeNames.Application.ProblemJson));
                    o.Filters.Add(new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden, MediaTypeNames.Application.ProblemJson));
                    o.Filters.Add(new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status500InternalServerError, MediaTypeNames.Application.ProblemJson));
                })
                .AddJsonOptions(o =>
                {
                    o.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
                    // JSON sai định dạng: ngoài Development chỉ báo "The input was not valid.", không lộ tên kiểu .NET / chi tiết parser
                    o.AllowInputFormatterExceptionMessages = environment.IsDevelopment();
                });

            return services;
        }

        /// <summary>
        /// Mọi response lỗi (exception, validation, 401/403/404 của framework) đều là application/problem+json (RFC 9457).
        /// CustomizeProblemDetails áp dụng chung cho GlobalExceptionHandler, FluentValidationFilter và [ApiController].
        /// </summary>
        public static IServiceCollection AddErrorHandling(this IServiceCollection services)
        {
            services.AddProblemDetails(options =>
            {
                options.CustomizeProblemDetails = context =>
                {
                    var request = context.HttpContext.Request;
                    context.ProblemDetails.Instance = $"{request.Method} {request.Path}";
                    // Dùng TraceId (32 ký tự hex), không dùng Activity.Id: giá trị này trùng với {TraceId} trong log
                    context.ProblemDetails.Extensions["traceId"] = Activity.Current?.TraceId.ToString() ?? context.HttpContext.TraceIdentifier;
                    // Mọi lỗi đều có "code" để client phân nhánh; AppException đã tự gán code của nó
                    context.ProblemDetails.Extensions.TryAdd("code",
                        ErrorCodes.FromStatus(context.ProblemDetails.Status, context.ProblemDetails is HttpValidationProblemDetails));
                };
            });
            services.AddExceptionHandler<GlobalExceptionHandler>();

            // IProblemDetailsService ghi JSON bằng cấu hình của Minimal API (khác MVC): đặt camelCase cho key của "errors"
            // để lỗi từ GlobalExceptionHandler giống lỗi từ FluentValidationFilter ({"name": [...]} thay vì {"Name": [...]})
            services.ConfigureHttpJsonOptions(o => o.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase);

            return services;
        }

        /// <summary>
        /// Danh sách origin của client lấy từ "Cors:AllowedOrigins".
        /// AllowCredentials để trình duyệt gửi kèm cookie refresh token.
        /// </summary>
        public static IServiceCollection AddClientCors(this IServiceCollection services, IConfiguration configuration)
        {
            var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
            services.AddCors(options =>
            {
                options.AddPolicy(ClientCorsPolicy, policy => policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials());
            });

            return services;
        }

        /// <summary>
        /// Lấy IP thật của client và scheme (HTTPS) khi chạy sau reverse proxy (IIS/Nginx).
        /// X-Forwarded-For chỉ được tin khi đến từ proxy khai báo trong "ForwardedHeaders:KnownProxies" (từng IP)
        /// hoặc "ForwardedHeaders:KnownNetworks" (dải CIDR, dùng khi IP proxy thay đổi như Docker/Kubernetes/cloud LB);
        /// mặc định chỉ tin loopback nên client không thể giả mạo IP.
        /// </summary>
        public static IServiceCollection AddProxyForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

                var knownProxies = configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [];
                foreach (var proxy in knownProxies)
                    options.KnownProxies.Add(IPAddress.Parse(proxy));

                var knownNetworks = configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [];
                foreach (var network in knownNetworks)
                    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
            });

            return services;
        }

        /// <summary>
        /// Mặc định mọi endpoint yêu cầu đăng nhập (FallbackPolicy). Mở bằng [AllowAnonymous],
        /// giới hạn theo vai trò bằng [Authorize(Roles = Roles.Admin)].
        /// </summary>
        public static IServiceCollection AddDefaultAuthorization(this IServiceCollection services)
        {
            services.AddAuthorization(options =>
            {
                options.FallbackPolicy = new AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build();
            });

            return services;
        }
    }
}
