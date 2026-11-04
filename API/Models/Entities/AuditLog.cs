using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Models.Entities
{
    public enum AuditActionType
    {
        Created = 0,
        Updated = 1,
        Deleted = 2
    }

    [Table("AuditLogs")]
    public class AuditLog
    {
        public long Id { get; set; }

        [Required, MaxLength(100)]
        public string TableName { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string RecordId { get; set; } = string.Empty;

        public AuditActionType ActionType { get; set; }

        public int? ChangedByUserId { get; set; }

        [MaxLength(100)]
        public string? ChangedByUserName { get; set; }

        [MaxLength(45)]
        public string? IpAddress { get; set; }

        public DateTime ChangedAt { get; set; }

        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string? ChangedColumns { get; set; }
    }
}
