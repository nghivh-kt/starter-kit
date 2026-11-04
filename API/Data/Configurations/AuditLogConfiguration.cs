using API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace API.Data.Configurations
{
    public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
    {
        public void Configure(EntityTypeBuilder<AuditLog> builder)
        {
            // Tra cứu lịch sử thay đổi của 1 bản ghi
            builder.HasIndex(x => new { x.TableName, x.RecordId });
            builder.HasIndex(x => x.ChangedAt);
        }
    }
}
