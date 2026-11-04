using System.Text.Json.Serialization;

namespace API.Models.DTOs
{
    /// <summary>
    /// Kết quả trả về sau khi đăng nhập hoặc làm mới token.
    /// </summary>
    public class AuthResponse
    {
        /// <summary>Access token (JWT) dùng để gọi API.</summary>
        public string AccessToken { get; set; } = null!;

        /// <summary>Thời điểm hết hạn của access token (UTC).</summary>
        public DateTime AccessTokenExpiresAt { get; set; }

        /// <summary>Refresh token plaintext (chỉ có khi không dùng cookie). Chế độ cookie: không xuất hiện trong JSON.</summary>
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? RefreshToken { get; set; }

        /// <summary>Thời điểm hết hạn của refresh token (UTC).</summary>
        public DateTime RefreshTokenExpiresAt { get; set; }
    }

    /// <summary>
    /// Request đăng nhập người dùng. Quy tắc kiểm tra nằm trong LoginRequestValidator
    /// </summary>
    public class LoginRequest
    {
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request đăng xuất người dùng
    /// </summary>
    public class LogoutRequest
    {
        // Chế độ cookie (UseCookie = true): có thể để trống, server đọc từ cookie.
        public string? RefreshToken { get; set; }
    }

    /// <summary>
    /// Request làm mới token.
    /// </summary>
    public class RefreshTokenRequest
    {
        // Chế độ cookie (UseCookie = true): có thể để trống, server đọc từ cookie.
        public string? RefreshToken { get; set; }
    }

    /// <summary>
    /// Request người dùng tự đổi mật khẩu. Quy tắc kiểm tra nằm trong ChangePasswordRequestValidator
    /// </summary>
    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    /// <summary>
    /// Thông tin user đang đăng nhập (GET /api/auth/me).
    /// </summary>
    public class CurrentUserResponse
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string[] Roles { get; set; } = [];
    }
}
