using API.Common.Helpers;
using API.Models.DTOs;

namespace API.Services.Interfaces
{
    public interface IUserService
    {
        Task<PagedResult<UserResponse>> GetPagedAsync(UserQueryRequest query, CancellationToken ct);
        /// <summary>File Excel chứa mọi dòng khớp bộ lọc, không phân trang.</summary>
        Task<byte[]> ExportAsync(UserQueryRequest query, CancellationToken ct);
        Task<UserResponse> GetUserByIdAsync(int id, CancellationToken ct);
        Task<UserResponse> CreateAsync(UserCreateRequest request, CancellationToken ct);
        Task<UserResponse> UpdateAsync(int id, UserUpdateRequest request, CancellationToken ct);

        // Đặt lại mật khẩu (Admin), thu hồi toàn bộ refresh token của user đó
        Task ResetPasswordAsync(int id, UserResetPasswordRequest request, CancellationToken ct);

        // Mở khoá tạm do nhập sai mật khẩu nhiều lần (không liên quan tới IsActive)
        Task UnlockAsync(int id, CancellationToken ct);
    }
}
