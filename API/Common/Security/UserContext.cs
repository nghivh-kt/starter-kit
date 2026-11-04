using System.Security.Claims;

namespace API.Common.Security
{
    public class UserContext : IUserContext
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public UserContext(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        private ClaimsPrincipal? CurrentPrincipal => _httpContextAccessor.HttpContext?.User;

        public int? UserId
        {
            get
            {
                var value = CurrentPrincipal?.FindFirstValue(JwtTokenHelper.UserIdClaimType);
                return int.TryParse(value, out var id) ? id : null;
            }
        }

        // NameClaimType = unique_name (cấu hình trong JwtConfiguration)
        public string? UserName => CurrentPrincipal?.Identity?.Name;

        public string IpAddress
        {
            get
            {
                // Không tự đọc header X-Forwarded-For vì client có thể giả mạo.
                // UseForwardedHeaders() (Startup/PipelineConfiguration.cs) đã thay RemoteIpAddress bằng IP thật
                // khi request đi qua proxy tin cậy (cấu hình ForwardedHeaders:KnownProxies).
                return _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
            }
        }
    }
}
