using API.Models.DTOs.Common;

namespace API.Models.DTOs
{
    /// <summary>
    /// Tham số truy vấn danh sách User: tìm theo UserName/FullName/Email, lọc IsActive và Role, phân trang, sắp xếp
    /// </summary>
    public class UserQueryRequest : PagedListQueryBase
    {
        public string? Role { get; set; }
    }

    /// <summary>
    /// Dữ liệu User trả về cho client (không bao giờ chứa PasswordHash)
    /// </summary>
    public class UserResponse
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        /// <summary>
        /// Khoá tạm đến thời điểm này (UTC) do nhập sai mật khẩu nhiều lần. Null hoặc đã qua: không bị khoá.
        /// </summary>
        public DateTime? LockoutEnd { get; set; }
        /// <summary>
        /// Phiên bản của bản ghi. Gửi lại nguyên giá trị này khi PUT để phát hiện bản ghi đã bị người khác sửa.
        /// </summary>
        public byte[] RowVersion { get; set; } = null!;
    }

    /// <summary>
    /// Dto dùng để tạo mới User. Quy tắc kiểm tra được định nghĩa trong UserCreateRequestValidator
    /// </summary>
    public class UserCreateRequest
    {
        public string UserName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    /// <summary>
    /// Dto dùng để cập nhật thông tin User (không bao gồm mật khẩu). Quy tắc kiểm tra được định nghĩa trong UserUpdateRequestValidator
    /// </summary>
    public class UserUpdateRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        /// <summary>
        /// Không gửi (null) nghĩa là giữ nguyên trạng thái
        /// </summary>
        public bool? IsActive { get; set; }
        /// <summary>
        /// RowVersion nhận được lúc đọc bản ghi
        /// </summary>
        public byte[] RowVersion { get; set; } = [];
    }

    /// <summary>
    /// Dto đặt lại mật khẩu của một User (do Admin thực hiện, không cần mật khẩu cũ).
    /// Ô "nhập lại mật khẩu" chỉ kiểm tra phía client, server không cần.
    /// </summary>
    public class UserResetPasswordRequest
    {
        public string NewPassword { get; set; } = string.Empty;
    }
}
