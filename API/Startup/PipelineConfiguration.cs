namespace API.Startup
{
    /// <summary>
    /// Thứ tự middleware. THỨ TỰ CÓ Ý NGHĨA, chỉ chèn thêm khi hiểu rõ vị trí cần đặt.
    /// </summary>
    public static class PipelineConfiguration
    {
        public static WebApplication UseApiPipeline(this WebApplication app)
        {
            // 1. Đầu tiên: mọi middleware sau đều thấy đúng IP client / scheme HTTPS
            app.UseForwardedHeaders();
            app.UseSecurityHeaders();

            // 2. Log mỗi request (đặt sớm để đo đủ thời gian và thấy status cuối cùng, kể cả lỗi)
            app.UseRequestLogging();

            // 3. Bắt exception chưa xử lý -> GlobalExceptionHandler
            app.UseExceptionHandler();
            // Response lỗi không có body (401/403 từ [Authorize], 404 sai route...) -> bọc thành Problem Details
            app.UseStatusCodePages();

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }
            else
            {
                // Production: trình duyệt chỉ dùng HTTPS cho domain này. Nếu TLS kết thúc ở reverse proxy (IIS/Nginx),
                // header X-Forwarded-Proto (UseForwardedHeaders) giúp app biết request gốc là HTTPS.
                app.UseHsts();
                app.UseHttpsRedirection();
            }

            // File của Angular (chỉ khi có wwwroot, tức bản đã publish): không cần đăng nhập nên đặt trước authentication
            app.UseClientApp();

            // 4. CORS trước authentication: preflight (OPTIONS) không mang token
            app.UseCors(ApiConfiguration.ClientCorsPolicy);

            app.UseRateLimiter();

            // 5. Xác thực (ai?) rồi mới phân quyền (được làm gì?)
            app.UseAuthentication();
            app.UseAuthorization();

            return app;
        }

        public static WebApplication MapApiEndpoints(this WebApplication app)
        {
            app.MapControllers();
            app.MapHealthCheckEndpoints();
            app.MapClientAppFallback();

            return app;
        }
    }
}
