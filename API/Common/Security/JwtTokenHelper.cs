using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace API.Common.Security
{
    public class JwtTokenHelper
    {
        public const string UserIdClaimType = "uid"; // ClaimType để lưu UserId trong Access Token
        public const string RoleClaimType = "role";  // ClaimType chứa role, dùng cho [Authorize(Roles = ...)]

        private readonly JwtSettings _jwtSettings;
        private readonly JsonWebTokenHandler _tokenHandler = new();

        public JwtTokenHelper(IOptions<JwtSettings> jwtOptions)
        {
            _jwtSettings = jwtOptions.Value;
        }

        /// <param name="now">Thời điểm phát hành (UTC), lấy từ TimeProvider của nơi gọi</param>
        public string GenerateAccessToken(int userId, string userName, IEnumerable<string> roles, DateTime now)
        {
            // Ký token bằng HMAC SHA256 với SecretKey
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            // Claims theo chuẩn JWT (sub, unique_name, jti) + claim riêng của hệ thống (uid, role)
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, userName),
                new(JwtRegisteredClaimNames.UniqueName, userName),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(UserIdClaimType, userId.ToString())
            };
            claims.AddRange(roles.Select(role => new Claim(RoleClaimType, role)));

            var descriptor = new SecurityTokenDescriptor
            {
                Issuer = _jwtSettings.Issuer,
                Audience = _jwtSettings.Audience,
                Subject = new ClaimsIdentity(claims),
                // Gán rõ cả 3 mốc: không gán thì handler tự lấy DateTime.UtcNow (bỏ qua TimeProvider)
                IssuedAt = now,
                NotBefore = now,
                Expires = now.AddMinutes(_jwtSettings.ExpiryInMinutes),
                SigningCredentials = credentials
            };

            // Chuỗi trả về có dạng: header.payload.signature (Base64Url)
            return _tokenHandler.CreateToken(descriptor);
        }

        public static string HashToken(string token)
        {
            // Băm (hash) refresh token trước khi lưu vào CSDL: lộ DB cũng không dùng được token
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return Convert.ToBase64String(bytes);
        }

        public static string GenerateRefreshTokenPlaintext(int size = 64)
        {
            // Tạo chuỗi ngẫu nhiên làm refresh token
            var bytes = RandomNumberGenerator.GetBytes(size);
            return Convert.ToBase64String(bytes);
        }
    }
}
