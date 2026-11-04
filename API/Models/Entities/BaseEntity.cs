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
    }
}
