using API.Data.Interfaces;
using API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Data.Extensions
{
    public static class RefreshTokenRevocationExtensions
    {
        /// <summary>
        /// Đánh dấu thu hồi mọi refresh token còn hiệu lực của 1 user.
        /// KHÔNG gọi SaveChanges: để nơi gọi gộp chung 1 lần lưu với thay đổi khác
        /// (ví dụ đổi mật khẩu / khoá tài khoản) — cùng thành công hoặc cùng thất bại.
        /// </summary>
        public static async Task RevokeActiveRefreshTokensAsync(
            this IUnitOfWork unitOfWork, int userId, string? ipAddress, string reason, DateTime now, CancellationToken ct)
        {
            // QueryForEdit (có tracking): EF tự sinh UPDATE cho các cột thay đổi khi SaveChangesAsync
            var activeRefreshTokens = await unitOfWork.Repository<RefreshToken>().QueryForEdit()
                .Where(rt => rt.UserId == userId && rt.RevokedAt == null && rt.ExpiresAt > now)
                .ToListAsync(ct);

            foreach (var token in activeRefreshTokens)
            {
                token.RevokedAt = now;
                token.RevokedByIp = ipAddress;
                token.ReasonRevoked = reason;
            }
        }
    }
}
