using API.Models.DTOs.Common;

namespace API.Models.DTOs
{
    /// <summary>
    /// Dữ liệu danh mục trả về cho client
    /// </summary>
    public class CategoryResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        /// <summary>
        /// Phiên bản của bản ghi. Gửi lại nguyên giá trị này khi PUT để phát hiện bản ghi đã bị người khác sửa.
        /// </summary>
        public byte[] RowVersion { get; set; } = null!;
    }

    /// <summary>
    /// Dto tạo mới danh mục (POST). Quy tắc kiểm tra nằm trong CategoryCreateRequestValidator
    /// </summary>
    public class CategoryCreateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>
        /// Không gửi thì mặc định đang hoạt động
        /// </summary>
        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// Dto cập nhật danh mục (PUT). Quy tắc kiểm tra nằm trong CategoryUpdateRequestValidator
    /// </summary>
    public class CategoryUpdateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>
        /// Không gửi (null) nghĩa là giữ nguyên trạng thái, tránh client thiếu field vô tình tắt danh mục
        /// </summary>
        public bool? IsActive { get; set; }
        /// <summary>
        /// RowVersion nhận được lúc đọc bản ghi
        /// </summary>
        public byte[] RowVersion { get; set; } = [];
    }

    /// <summary>
    /// Tham số truy vấn danh sách danh mục: tìm kiếm theo Name/Description, lọc IsActive, phân trang, sắp xếp
    /// </summary>
    public class CategoryQueryRequest : PagedListQueryBase
    {
    }
}
