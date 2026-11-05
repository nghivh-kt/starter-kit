using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace API.Startup
{
    /// <summary>
    /// Swagger UI (chỉ bật ở Development, xem PipelineConfiguration). Có nút Authorize để dán access token.
    /// API/openapi.json được xuất từ đây để sinh kiểu TypeScript cho Client (xem Client/scripts/generate-api.mjs).
    /// </summary>
    public static class SwaggerConfiguration
    {
        public static IServiceCollection AddSwaggerDocumentation(this IServiceCollection services)
        {
            services.AddEndpointsApiExplorer();
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "StarterKit API", Version = "1.0" });
                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Description = "Dán access token (không cần gõ 'Bearer ')",
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT"
                });
                c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
                {
                    [new OpenApiSecuritySchemeReference("Bearer", document)] = []
                });

                // string là bắt buộc, string? mới được null: khớp với Nullable của C#
                c.SupportNonNullableReferenceTypes();
                c.SchemaFilter<ResponseRequiredSchemaFilter>();
            });

            return services;
        }
    }

    /// <summary>
    /// Mọi field không nullable của response luôn có mặt trong JSON, nên đánh dấu required.
    /// Nếu không, kiểu TypeScript sinh ra sẽ là "id?: number" và client phải kiểm tra undefined ở khắp nơi.
    /// Chỉ áp dụng cho response: field của request có thể có giá trị mặc định nên client được phép bỏ qua.
    /// </summary>
    internal sealed class ResponseRequiredSchemaFilter : ISchemaFilter
    {
        public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
        {
            var type = context.Type;
            var isResponse = type.Name.EndsWith("Response", StringComparison.Ordinal)
                || (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Common.Helpers.PagedResult<>));

            if (!isResponse || schema is not OpenApiSchema target || target.Properties is null) return;

            target.Required ??= new HashSet<string>();
            foreach (var (name, property) in target.Properties)
            {
                if (property.Type?.HasFlag(JsonSchemaType.Null) != true)
                    target.Required.Add(name);
            }
        }
    }
}
