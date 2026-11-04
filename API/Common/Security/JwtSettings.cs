using System.ComponentModel.DataAnnotations;

namespace API.Common.Security
{
    /// <summary>
    /// Cấu hình "JwtSettings" trong appsettings.json. Được kiểm tra khi khởi động (ValidateOnStart),
    /// sai cấu hình thì ứng dụng dừng ngay thay vì lỗi ở request đầu tiên.
    /// </summary>
    public class JwtSettings
    {
        /// <summary>Khoá ký HMAC-SHA256, tối thiểu 32 byte. Đặt bằng user-secrets / biến môi trường, không commit.</summary>
        [Required]
        public string SecretKey { get; set; } = string.Empty;

        [Required]
        public string Issuer { get; set; } = string.Empty;

        [Required]
        public string Audience { get; set; } = string.Empty;

        /// <summary>Thời hạn access token (phút)</summary>
        [Range(1, 1440)]
        public int ExpiryInMinutes { get; set; } = 5;

        /// <summary>Độ lệch đồng hồ cho phép giữa các server (phút)</summary>
        [Range(0, 10)]
        public int ClockSkewInMinutes { get; set; } = 0;
    }

    /// <summary>
    /// Cấu hình "RefreshTokenSettings" trong appsettings.json
    /// </summary>
    public class RefreshTokenSettings
    {
        /// <summary>Thời hạn refresh token (ngày)</summary>
        [Range(1, 365)]
        public int ExpiryDays { get; set; } = 7;

        /// <summary>true: refresh token nằm trong cookie HttpOnly (web). false: trả trong body (mobile/desktop)</summary>
        public bool UseCookie { get; set; }

        [Required]
        public string CookieName { get; set; } = "rt";

        public bool CookieSecure { get; set; } = true;

        /// <summary>
        /// Strict: client và API cùng site (mặc định). None: client khác site với API, bắt buộc CookieSecure = true;
        /// khi đó refresh/logout kiểm tra header Origin theo "Cors:AllowedOrigins" để chống CSRF.
        /// </summary>
        public SameSiteMode CookieSameSite { get; set; } = SameSiteMode.Strict;
    }
}
