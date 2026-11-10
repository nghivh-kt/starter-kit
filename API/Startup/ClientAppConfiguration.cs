using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;
using System.IO.Compression;
using System.Text.RegularExpressions;

namespace API.Startup
{
    /// <summary>
    /// API phục vụ luôn bản build Angular nằm trong wwwroot (deploy/iis/publish.ps1 chép vào), nên IIS chỉ cần 1 site:
    /// /api/* vào controller, đường dẫn còn lại là file của Angular, không có file thì trả index.html.
    /// Dev không có wwwroot nên phần phục vụ file tắt: Angular chạy bằng ng serve, proxy /api sang API.
    /// </summary>
    public static partial class ClientAppConfiguration
    {
        private const string IndexFile = "index.html";

        // Chỉ tải tài nguyên từ chính site. style-src cần 'unsafe-inline' vì Angular chèn style của component lúc chạy.
        // frame-ancestors 'none': trang không bị nhúng vào iframe của site khác (chống clickjacking)
        private const string ContentSecurityPolicy =
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; " +
            "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

        // Angular thêm mã hash vào tên file (main-MDJ4QYAQ.js, chunk-B7NZ_hwz.js, media/inter-latin-NRMW37G5.woff2):
        // đổi nội dung là đổi tên, nên cache lâu không sợ trình duyệt dùng bản cũ
        [GeneratedRegex(@"-[A-Za-z0-9_-]{8}\.[a-z0-9]+$")]
        private static partial Regex HashedFileName();

        public static IServiceCollection AddClientApp(this IServiceCollection services)
        {
            services.AddResponseCompression(options =>
            {
                options.EnableForHttps = true; // Chỉ bật cho file tĩnh, xem UseClientApp
                options.Providers.Add<BrotliCompressionProvider>();
                options.Providers.Add<GzipCompressionProvider>();
            });
            services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
            services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

            return services;
        }

        /// <summary>
        /// Header bảo mật cho mọi response. Gán trong OnStarting vì exception handler xoá header của response trước khi ghi lỗi.
        /// </summary>
        public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
        {
            return app.Use(async (context, next) =>
            {
                context.Response.OnStarting(() =>
                {
                    var headers = context.Response.Headers;
                    headers.XContentTypeOptions = "nosniff";
                    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                    return Task.CompletedTask;
                });
                await next();
            });
        }

        /// <summary>Nén và phục vụ file của Angular. Đặt trước authentication: file tĩnh không cần đăng nhập.</summary>
        public static WebApplication UseClientApp(this WebApplication app)
        {
            if (!HasClientApp(app)) return app;

            // Không nén /api: response có token, nén chung với dữ liệu người dùng gửi lên mở đường cho tấn công BREACH
            app.UseWhen(context => !IsApiRequest(context.Request.Path), branch => branch.UseResponseCompression());
            app.UseStaticFiles(StaticFileOptions());

            return app;
        }

        /// <summary>
        /// Đường dẫn của Angular như /categories không phải file thật: trả index.html để F5 hay mở link gửi cho nhau vẫn vào đúng trang.
        /// /api/* không khớp route nào thì vẫn là 404 Problem Details, không trả trang HTML.
        /// </summary>
        public static WebApplication MapClientAppFallback(this WebApplication app)
        {
            if (!HasClientApp(app)) return app;

            app.MapFallback("/api/{**path}", context =>
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound; // UseStatusCodePages ghi body Problem Details
                return Task.CompletedTask;
            });
            app.MapFallbackToFile(IndexFile, StaticFileOptions()).AllowAnonymous();

            return app;
        }

        private static bool HasClientApp(WebApplication app) =>
            app.Environment.WebRootFileProvider.GetFileInfo(IndexFile).Exists;

        private static bool IsApiRequest(PathString path) => path.StartsWithSegments("/api");

        private static StaticFileOptions StaticFileOptions() => new()
        {
            OnPrepareResponse = context =>
            {
                var headers = context.Context.Response.Headers;
                var fileName = context.File.Name;

                if (fileName == IndexFile)
                {
                    // index.html giữ tên cố định và trỏ tới các file hash mới nhất: không cache, để người dùng nhận bản mới ngay
                    headers.CacheControl = "no-cache";
                    headers.ContentSecurityPolicy = ContentSecurityPolicy;
                }
                else if (HashedFileName().IsMatch(fileName))
                {
                    headers.CacheControl = "public, max-age=31536000, immutable";
                }
                else
                {
                    headers.CacheControl = "public, max-age=86400";
                }
            }
        };
    }
}
