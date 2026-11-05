using System.ComponentModel.DataAnnotations;

namespace API.Models.Entities
{
    public class BaseEntity
    {
        public int Id { get; set; }
    }

    public class AuditableEntity : BaseEntity
    {
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; } // EFDbContext tự gán khi thêm mới
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        /// <summary>
        /// SQL Server tự đổi giá trị này mỗi lần bản ghi được cập nhật. EF so sánh nó khi UPDATE, nên hai người cùng sửa
        /// thì người lưu sau nhận 409 thay vì âm thầm ghi đè người trước. Xem CategoryService.UpdateAsync.
        /// </summary>
        [Timestamp]
        public byte[] RowVersion { get; set; } = null!;
    }
}
