using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Models.Entities
{
    /// <summary>
    /// Entity mẫu cho một module CRUD. Kế thừa AuditableEntity để có IsActive, CreatedAt,
    /// UpdatedAt, DeletedAt và được EFDbContext tự động ghi AuditLog.
    /// </summary>
    [Table("Categories")]
    public class Category : AuditableEntity
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = null!;

        [MaxLength(500)]
        public string? Description { get; set; }
    }
}
